import {z} from 'zod';
import {advisoryRequestContract,assistantResultContract,contextEnvelopeContract,configChangeContract,modelCapabilitiesContract,validateAssistantResult,canonicalValue,cloneAssistantPlainData,utf8Bytes,AssistantContractError,type AdvisoryAdapter,type AdvisoryRequest,type AssistantResult,type RoleId} from './contracts.ts';
import {DEFAULT_ASSISTANT_POLICY,validatePolicy,createRunBudget,AssistantRuntimeError,type AssistantPolicy,type RuntimeCode} from './policy.ts';
import {projectRunEvent,type RunEvent} from './logging.ts';

const requestContract=z.object({runId:z.string().uuid(),context:contextEnvelopeContract,task:z.enum(['explain-continuation','review-proposal','extract-labels']),configProposal:configChangeContract.optional(),review:z.boolean().optional()}).strict();
export type AssistantRuntimeRequest=z.infer<typeof requestContract>;
/** The host alone attaches this independently validated, clearly attributed review. */
export type AssistantRuntimeResult=AssistantResult&{review?:AssistantResult};
export type AssistantRegistry=Partial<Record<RoleId,AdvisoryAdapter>>;
const roles:Record<AssistantRuntimeRequest['task'],RoleId>={'explain-continuation':'advisor','review-proposal':'specialist','extract-labels':'local-helper'};
export type AdapterActivity=Readonly<{pendingAdapterCalls:number;engineEnd:'not-attested'}>;
type Options={activity?:(state:AdapterActivity)=>void;registry:AssistantRegistry;policy?:AssistantPolicy;clock?:()=>number;emit?:(event:RunEvent)=>void|Promise<void>};
function freeze<T>(value:T):T{if(value&&typeof value==='object'){for(const item of Object.values(value))freeze(item);Object.freeze(value)}return value}
function failure(error:unknown):AssistantRuntimeError{
 if(error instanceof AssistantRuntimeError)return error;
 if(error instanceof AssistantContractError){
  const code=error.code;
  if(['INVALID_RESULT','INVALID_REQUEST','CONTEXT_MISMATCH','STALE_BASIS','CONTEXT_BUDGET','OUTPUT_BUDGET'].includes(code))return new AssistantRuntimeError(code as RuntimeCode);
 }
 return new AssistantRuntimeError('ADAPTER_FAILED');
}
/** Offline host: no commit transport, URLs, credentials, provider fallback or write retry. */
export function createAssistantRuntime(options:Options){
 const policy=validatePolicy(options.policy??DEFAULT_ASSISTANT_POLICY),clock=options.clock??(()=>performance.now());
 const registry:AssistantRegistry={};
 if(!options.registry||typeof options.registry!=='object'||Object.keys(options.registry).some(key=>!['advisor','specialist','local-helper'].includes(key)))throw new AssistantRuntimeError('POLICY');
 for(const role of Object.keys(options.registry) as RoleId[]){
  const adapter=options.registry[role];
  const parsed=modelCapabilitiesContract.safeParse(adapter?.capabilities);
  if(!adapter||typeof adapter.invoke!=='function'||!parsed.success)throw new AssistantRuntimeError('POLICY');
  const caps=parsed.data;
  // Real adapters need a future verified token/cost/authorization boundary.
  if(caps.status!=='unavailable'&&(caps.execution!=='deterministic'||!caps.structuredOutput||!caps.cancellation))throw new AssistantRuntimeError('POLICY');
  registry[role]=Object.freeze({capabilities:freeze(caps),invoke:adapter.invoke.bind(adapter)});
 }
 let pendingAdapterCalls=0;
 function activity(){try{options.activity?.(Object.freeze({pendingAdapterCalls,engineEnd:'not-attested'}))}catch{loggingFailed=true}}
 let generation=0,loggingFailed=false,current:{stop:(code:RuntimeCode)=>void}|null=null;
 const usedRuns=new Set<string>(),suggested=new Set<string>();
 return {
  diagnostics:()=>Object.freeze({loggingFailed,pendingAdapterCalls,engineEnd:'not-attested' as const}),
  stop(){current?.stop('ABORTED')},
  async advise(raw:AssistantRuntimeRequest,signal?:AbortSignal):Promise<AssistantRuntimeResult>{
   let clean:unknown;try{clean=cloneAssistantPlainData(raw)}catch{throw new AssistantRuntimeError('INVALID_REQUEST')}
   const parsed=requestContract.safeParse(clean);if(!parsed.success)throw new AssistantRuntimeError('INVALID_REQUEST');
   const input=freeze(parsed.data),role=roles[input.task];
   if(input.review&&input.task!=='explain-continuation')throw new AssistantRuntimeError('INVALID_REQUEST');
   const requestCheck=advisoryRequestContract.safeParse({runId:input.runId,role,context:input.context,task:input.task,maxOutputBytes:policy.maxOutputBytes,...(input.configProposal?{configProposal:input.configProposal}:{})});
   if(!requestCheck.success)throw new AssistantRuntimeError('INVALID_REQUEST');
   if(new TextEncoder().encode(JSON.stringify(input.context)).length>policy.maxInputBytes)throw new AssistantRuntimeError('CONTEXT_BUDGET');
   if(signal?.aborted)throw new AssistantRuntimeError('ABORTED');
   if(usedRuns.has(input.runId))throw new AssistantRuntimeError('DUPLICATE');
   // A bounded instance never evicts a used identifier to permit accidental replay.
   if(usedRuns.size>=200)throw new AssistantRuntimeError('BUDGET');
   const budget=createRunBudget(policy,clock),started=clock();
   usedRuns.add(input.runId);current?.stop('SUPERSEDED');const mine=++generation;
   const controller=new AbortController();let stopCode:RuntimeCode|null=null,rejectStopped!:(error:AssistantRuntimeError)=>void;
   const stopped=new Promise<never>((_resolve,reject)=>{rejectStopped=reject});void stopped.catch(()=>{});
   function stop(code:RuntimeCode){if(stopCode)return;stopCode=code;controller.abort();rejectStopped(new AssistantRuntimeError(code))}
   const handle={stop};current=handle;
   const onAbort=()=>stop('ABORTED');signal?.addEventListener('abort',onAbort,{once:true});
   const timer=setTimeout(()=>stop('TIMEOUT'),budget.remainingMs());
   function guard(){if(stopCode)throw new AssistantRuntimeError(stopCode);if(mine!==generation)throw new AssistantRuntimeError('SUPERSEDED');budget.remainingMs()}
   let eventRole:RoleId=role,eventMode:RunEvent['mode']='unavailable';
   function emit(phase:RunEvent['phase'],code:RunEvent['code']){
    // Projection contains metadata only. Provider content and error objects never enter it.
    const duration=Math.min(policy.maxActiveMs,Math.max(0,clock()-started));
    const event=projectRunEvent({eventId:crypto.randomUUID(),runId:input.runId,role:eventRole,phase,code,durationMs:duration,counters:budget.snapshot(),context:input.context.context,basis:input.context.basis,mode:eventMode,...(eventMode!=='unavailable'?{producer:{mode:eventMode,bindingId:registry[eventRole]!.capabilities.bindingId}}:{})});
    if(!event){loggingFailed=true;return}
    try{const pending=options.emit?.(event);if(pending&&typeof (pending as PromiseLike<unknown>).then==='function')void Promise.resolve(pending).catch(()=>{loggingFailed=true})}catch{loggingFailed=true}
   }
   async function invokeRole(request:AdvisoryRequest):Promise<AssistantResult>{
    guard();budget.step();const leave=budget.enter(request.role+':'+request.task),adapter=registry[request.role];
    try{
     if(!adapter||adapter.capabilities.status==='unavailable'||request.role==='local-helper'&&adapter.capabilities.status!=='verified')throw new AssistantRuntimeError('UNAVAILABLE');
     eventRole=request.role;eventMode=adapter.capabilities.status==='simulated'?'simulated':'deterministic';
     let attempt=request;
     for(;;){
      guard();budget.step();budget.call();emit('calling','OK');guard();
      // Rejecting the host result does not settle a noncooperative adapter.
      // Promise settlement is tracked separately and never attests an engine end.
      const invocation=Promise.resolve().then(async()=>{guard();pendingAdapterCalls++;activity();try{guard();return await adapter.invoke(freeze(structuredClone(attempt)),controller.signal)}finally{pendingAdapterCalls--;activity()}});
      const rawValue=await Promise.race([invocation,stopped]);
      guard();const value=cloneAssistantPlainData(rawValue);
      guard();budget.step();
      try{return validateAssistantResult(value,attempt,adapter.capabilities,[])}catch(error){
       const problem=failure(error);
       if(problem.code!=='INVALID_RESULT'||budget.snapshot().repairAttempts>=policy.maxRepairAttempts)throw problem;
       budget.step();budget.repair('pure','INVALID_RESULT');
       const shape=assistantResultContract.safeParse(value),fields=['schema','runId','context','basis','producer','summary','claims','blockers','configProposal','checks','nextAction'] as const;
       const issues:NonNullable<AdvisoryRequest['repair']>['issues']=shape.success?[{field:'result',code:'evidence'}]:shape.error.issues.slice(0,8).map(issue=>({field:fields.find(field=>field===issue.path[0])??'result',code:'schema'}));
       attempt={...request,repair:{attempt:1,issues}};emit('retrying','INVALID_RESULT');
      }
     }
    }finally{leave()}
   }
   try{
    guard();budget.step();emit('started','OK');
    const request=freeze(requestCheck.data);let result=await invokeRole(request),specialistResult:AssistantResult|undefined;
    if(input.review&&result.configProposal){
     const review=await invokeRole({...request,role:'specialist',task:'review-proposal',configProposal:result.configProposal});
     specialistResult=review;
     if(review.blockers.length){
      const blockers=[...new Map([...result.blockers,...review.blockers].map(item=>[item.code,item])).values()];
      result=validateAssistantResult({...result,blockers,configProposal:null,nextAction:'ask-user'},request,registry[role]!.capabilities,[]);
     }
    }
    const suggestion=result.configProposal?canonicalValue({context:input.context.context,basis:input.context.basis,change:result.configProposal}):null;
    if(suggestion&&suggested.has(suggestion)){
     result=validateAssistantResult({...result,configProposal:null,nextAction:input.context.draft?'review-draft':'none'},request,registry[role]!.capabilities,[]);
     result={...result,summary:`${result.producer.mode==='simulated'?'Simulation: ':''}Diesen unveränderten Konfigurationsvorschlag hast du für diesen Projektstand bereits erhalten. ${input.context.draft?'Prüfe den vorhandenen Entwurf gegen den aktuellen Stand.':'Es wurde keine weitere Änderung vorgeschlagen.'}`};
    }
    const response:AssistantRuntimeResult=specialistResult?{...result,review:specialistResult}:result;
    if(utf8Bytes(response)>policy.maxOutputBytes||(['claims','blockers','checks'] as const).some(field=>result[field].length+(specialistResult?.[field].length??0)>8))throw new AssistantRuntimeError('OUTPUT_BUDGET');
    guard();budget.step();emit('completed','OK');guard();if(suggestion)suggested.add(suggestion);return freeze(response);
   }catch(error){const problem=stopCode?new AssistantRuntimeError(stopCode):failure(error);if(mine===generation)emit('stopped',problem.code);throw problem}
   finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);if(current===handle)current=null;controller.abort()}
  }
 };
}
