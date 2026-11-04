import type {WorkState} from '../../upstream/lib/work-contract.ts';
import {canonical} from '../../vendor/skill-core/src/contract.mjs';
import {prepareSpec,validateCheckpoint} from '../../vendor/local-workflows/src/contracts.mjs';
import {hashJson,snapshot} from '../../vendor/local-workflows/src/data.mjs';
import {createWorkflowEvents} from '../../vendor/local-workflows/src/events.mjs';
import {createWorkflowRuntime,type Handler,type CatalogSource} from './workflow-runtime.ts';
import {WorkflowJournalStore,validateJournal,type JournalRecord,type WorkflowJournal} from './workflow-journal.ts';

export type WorkflowState='paused'|'completed'|'aborted'|'failed'|'budget-exhausted'|'interrupted';
export type DurableOutcome={id:string;state:WorkflowState;completedCount:number;outputs:Array<{stepId:string;output:any}>;sourceUpdatedAt:string|null;code?:string;persisted:boolean};
export type RecoveryView=Omit<DurableOutcome,'persisted'>&{totalSteps:number;stale:boolean;reason?:string;recoverable:boolean;pendingStepId:string|null;createdAt:string;updatedAt:string};
type Snapshot={work:WorkState;sources:CatalogSource[]};
type RunOptions={pauseAfterStep?:boolean;getSnapshot?:()=>Snapshot};
type Store=Pick<WorkflowJournalStore,'load'|'save'|'close'>;
type Options={store?:Store;locks?:LockManager|null;now?:()=>number};
const LOCK='cue.workflow-journal:v1:execution';
const terminal=new Set(['completed','aborted','failed']);
const recoverable=new Set(['running','paused','budget-exhausted']);
function fail(code:string):never {throw new Error('WORKFLOW_'+code)}
class Halt extends Error {constructor(readonly state:'paused'|'aborted'|'failed'|'budget-exhausted',readonly code:string){super(code)}}
const copySnapshot=(work:WorkState,sources:CatalogSource[]):Snapshot=>({work:snapshot(work,2000000),sources:snapshot(sources,1048576)});
const sourceHash=(input:Snapshot)=>hashJson(input);
const outcome=(record:JournalRecord):DurableOutcome=>({id:record.value.spec.pipelineId,state:record.value.checkpoint.state==='running'?'interrupted':record.value.checkpoint.state,completedCount:record.value.checkpoint.completed.length,outputs:record.value.checkpoint.completed.map((c:any)=>({stepId:c.stepId,output:structuredClone(c.output)})),sourceUpdatedAt:record.value.sourceUpdatedAt,...(record.value.checkpoint.code?{code:record.value.checkpoint.code}:{}),persisted:true});

/** Host-only durable orchestration. Journal data never contains a grant or executable code. */
export async function createDurableWorkflowHost(options:Options={}) {
 const runtime=await createWorkflowRuntime(),{catalog,kernel,manifests,getFreshHostEvidence}=runtime;
 const initial=new Map(manifests.map((m:any)=>[m.id,snapshot(m)]));
 const store=options.store??new WorkflowJournalStore();
 const locks=options.locks===undefined?(globalThis.navigator?.locks??null):options.locks;
 const available=!!locks&&typeof locks.request==='function'&&globalThis.isSecureContext!==false;
 const now=options.now??(()=>performance.now()),events=createWorkflowEvents(512);
 let busy=false,disposed=false,seen:{id:string;revision:number}|null=null;
 let control:{kind:'paused'|'aborted'|null;accepting:boolean;persist:(()=>void)|null}|null=null;
 const remember=(r:JournalRecord|null)=>{seen=r?{id:r.value.spec.pipelineId,revision:r.revision}:null;};
 function checkedRecord(raw:any):JournalRecord{
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||![Object.prototype,null].includes(Object.getPrototypeOf(raw))||Object.getOwnPropertySymbols(raw).length)fail('STORE_CORRUPT');
  const fields=Object.getOwnPropertyDescriptors(raw);
  if(Object.keys(fields).sort().join(',')!=='revision,value'||Object.values(fields).some(field=>!field.enumerable||!('value' in field)))fail('STORE_CORRUPT');
  if(!Number.isSafeInteger(fields.revision.value)||fields.revision.value<1)fail('STORE_CORRUPT');
  return {revision:fields.revision.value,value:validateJournal(fields.value.value)};
 }
 const read=async()=>{const raw=await store.load();return raw===null?null:checkedRecord(raw);};
 async function persist(expected:number|null,value:WorkflowJournal):Promise<JournalRecord>{
  const candidate=validateJournal(value),saved=checkedRecord(await store.save(expected,structuredClone(candidate)));
  if(saved.revision!==(expected??0)+1||canonical(saved.value)!==canonical(candidate))fail('STORE_CORRUPT');
  const actual=await read();
  if(!actual||actual.revision!==saved.revision||canonical(actual.value)!==canonical(candidate))fail('STORE_CORRUPT');
  return saved;
 }
 const assertSeen=(r:JournalRecord)=>{if(seen?.id!==r.value.spec.pipelineId||seen?.revision!==r.revision)fail('STALE_VIEW');};
 async function verifyHashes(value:WorkflowJournal){
  if(await hashJson(value.spec)!==value.checkpoint.revisionHash)fail('CHECKPOINT_CORRUPT');
  for(let i=0;i<value.checkpoint.completed.length;i++){const result=value.checkpoint.completed[i];if(await hashJson(value.spec.steps[i].input)!==result.inputHash||await hashJson(result.output)!==result.outputHash)fail('CHECKPOINT_CORRUPT')}
 }
 async function verify(value:WorkflowJournal){await verifyHashes(value);const prepared=await prepareSpec(value.spec,catalog,initial);await validateCheckpoint(value.checkpoint,prepared);for(const step of value.spec.steps){const integrity=catalog.verify(step.skillId);if(integrity.status!=='passed'||integrity.versionHash!==step.versionHash)fail('VERSION_DRIFT')}return prepared;}
 async function verifyForRead(value:WorkflowJournal):Promise<boolean>{
  try{await verify(value);return false}catch(error){if(error instanceof Error&&error.message.includes('VERSION_DRIFT'))return true;throw error}
 }
 async function load(work:WorkState,sources:CatalogSource[]):Promise<RecoveryView|null>{
  const input=copySnapshot(work,sources),record=await read();if(!record){if(!busy)remember(null);return null}
  const versionMismatch=await verifyForRead(record.value);
  const stale=record.value.sourceUpdatedAt!==input.work.updatedAt||record.value.sourceHash!==await sourceHash(input);
  if(!busy)remember(record);
  const value=record.value,stored=value.checkpoint.state;
  return {...outcome(record),state:stored==='running'?'interrupted':stored,totalSteps:value.spec.steps.length,stale:stale||versionMismatch,...(versionMismatch?{reason:'Die gespeicherte Skillversion passt nicht zu dieser App. Lauf stoppen und mit den aktuellen Paketen neu planen.'}:stale?{reason:'Der Arbeitsstand oder die Quellen haben sich geändert. Lauf stoppen und die aktuellen Daten neu prüfen.'}:stored==='running'?{reason:'Der letzte Lauf wurde nicht abgeschlossen. Eine andere Sitzung kann noch arbeiten; Fortsetzen prüft die exklusive Sperre erneut.'}:{}),recoverable:recoverable.has(stored)&&!stale&&!versionMismatch,pendingStepId:value.pendingStepId,createdAt:value.createdAt,updatedAt:value.updatedAt};
 }
 async function exclusive<T>(fn:()=>Promise<T>):Promise<T>{
  if(disposed)fail('HOST_CLOSED');if(busy)fail('CONCURRENT_RUN');if(!available)fail('LOCKS_UNAVAILABLE');busy=true;control={kind:null,accepting:true,persist:null};
  try{return await locks!.request(LOCK,{mode:'exclusive',ifAvailable:true},async lock=>{if(!lock)fail('LOCK_BUSY');return fn()})}
  finally{control=null;busy=false;if(disposed)store.close()}
 }
 async function execute(mode:'start'|'resume',input:Snapshot,selection:Handler|'all',settings:RunOptions):Promise<DurableOutcome>{
  const runControl=control!;let current:JournalRecord|null=null,writeFailure:unknown=null,queue=Promise.resolve();
  let budget=1000,last=-Infinity;const clock=()=>{const value=now();if(!Number.isFinite(value)||value<last)throw new Halt('failed','CLOCK_INVALID');last=value;return value};
  const started=clock();
  function boundary(){if(writeFailure)throw writeFailure;if(runControl.kind)throw new Halt(runControl.kind,runControl.kind==='aborted'?'ABORTED':'PAUSED');if(clock()-started>=budget)throw new Halt('budget-exhausted','TIME_BUDGET')}
  const existing=await read();
  let prepared:any,value:WorkflowJournal;
  const fingerprint=await sourceHash(input);
  if(mode==='resume'){
   if(!existing)fail('CHECKPOINT_MISSING');assertSeen(existing);
   if(terminal.has(existing.value.checkpoint.state))fail('CHECKPOINT_TERMINAL');
   prepared=await verify(existing.value);
   if(existing.value.sourceUpdatedAt!==input.work.updatedAt||existing.value.sourceHash!==fingerprint)fail('SNAPSHOT_CHANGED');
   current=existing;value=existing.value;
  }else{
   if(existing&&!terminal.has(existing.value.checkpoint.state))fail('RECOVERY_REQUIRED');
   if(existing){assertSeen(existing);await verifyForRead(existing.value)}
   const spec=snapshot(runtime.prepare(input.work,input.sources,selection));prepared=await prepareSpec(spec,catalog,initial);
   const at=new Date().toISOString();value={schema:'cue.workflow-journal/v1',createdAt:at,updatedAt:at,sourceUpdatedAt:input.work.updatedAt,sourceHash:fingerprint,spec,checkpoint:{namespace:'cue.local-checkpoint/v1',pipelineId:spec.pipelineId,revisionHash:prepared.revisionHash,nextStepIndex:0,completed:[],state:'running'},pendingStepId:null};
   // Existing terminal results must have been inspected before their explicit replacement.
   current=existing;
  }
  budget=value.spec.limits.maxElapsedMs;
  const id=value.spec.pipelineId;
  const emit=(type:string,extra:any={})=>events.append({type,pipelineId:id,...extra});
  function controlled(next:WorkflowJournal):WorkflowJournal{
   if(!runControl.kind)return next;
   // Never commit a new result after a stop/pause request. Keep only confirmed outputs.
   const base=current&&current.value.spec.pipelineId===id?current.value:next;
   return {...base,pendingStepId:null,checkpoint:{...base.checkpoint,state:runControl.kind,code:runControl.kind==='aborted'?'ABORTED':'PAUSED'}};
  }
  function commit(next:(value:WorkflowJournal)=>WorkflowJournal):Promise<void>{
   const operation=queue.then(async()=>{
    if(writeFailure)throw writeFailure;
    const base=current&&current.value.spec.pipelineId===id?current.value:value;
    const candidate=controlled(next(base));
    const at=new Date(Math.max(Date.now(),Date.parse(candidate.updatedAt))).toISOString();
    current=await persist(current?.revision??null,{...candidate,updatedAt:at});
    remember(current);emit('checkpoint-saved',{state:current.value.checkpoint.state,revision:current.revision});
   });
   queue=operation.catch(error=>{writeFailure=error});return operation;
  }
  async function drainWrites(closeControls=false){
   let tail:Promise<void>;do{tail=queue;await tail}while(tail!==queue);
   if(closeControls){runControl.accepting=false;runControl.persist=null}
   if(writeFailure)throw writeFailure;
  }
  async function freshSnapshot(){
   if(!settings.getSnapshot)return;
   let fresh:Snapshot;try{const source=settings.getSnapshot();fresh=copySnapshot(source.work,source.sources)}catch{throw new Halt('failed','SNAPSHOT_UNAVAILABLE')}
   if(fresh.work.updatedAt!==value.sourceUpdatedAt||await sourceHash(fresh)!==fingerprint)throw new Halt('failed','SNAPSHOT_CHANGED');
  }
  async function stillOwned(){const live=await read();if(!current||!live||live.revision!==current.revision||canonical(live.value)!==canonical(current.value))fail('STORE_CONFLICT')}
  try{
   const {code:previousCode,...checkpoint}=value.checkpoint;
   await commit(()=>({...value,pendingStepId:null,checkpoint:{...checkpoint,state:'running'}}));
   runControl.persist=()=>{void commit(v=>v).catch(()=>{})};
   emit('pipeline-started',{state:'running',resumed:mode==='resume'});boundary();
   for(let i=current!.value.checkpoint.nextStepIndex;i<value.spec.steps.length;i++){
    boundary();await freshSnapshot();boundary();await stillOwned();boundary();
    const step=value.spec.steps[i],binding=prepared.bindings[i];
    // The durable intent exists before even the local, pure calculation can begin.
    await commit(v=>({...v,pendingStepId:step.stepId}));boundary();
    await freshSnapshot();boundary();
    const integrity=kernel.verify(step.skillId);if(integrity.status!=='passed'||integrity.versionHash!==step.versionHash)throw new Halt('failed','INTEGRITY_FAILED');
    const handle=getFreshHostEvidence({pipelineId:id,stepId:step.stepId,skillId:step.skillId,versionHash:step.versionHash,inputHash:binding.inputHash});
    if(!kernel.readiness(step.skillId,handle).ready)throw new Halt('failed','EVIDENCE_INVALID');
    boundary();emit('step-started',{stepId:step.stepId,state:'running'});boundary();
    let output:any;try{output=kernel.run(step.skillId,step.input,handle)}catch{throw new Halt('failed','HANDLER_FAILED')}
    boundary();output=snapshot(output,131072);const outputHash=await hashJson(output);boundary();await freshSnapshot();boundary();await stillOwned();boundary();
    const completed={stepId:step.stepId,skillId:step.skillId,version:step.version,versionHash:step.versionHash,inputHash:binding.inputHash,outputHash,output};
    await commit(v=>({...v,pendingStepId:null,checkpoint:{...v.checkpoint,nextStepIndex:i+1,completed:[...v.checkpoint.completed,completed]}}));boundary();
    emit('step-completed',{stepId:step.stepId,state:'completed',revision:current!.revision});
    if(settings.pauseAfterStep&&i+1<value.spec.steps.length)throw new Halt('paused','PAUSED');
    await new Promise(resolve=>setTimeout(resolve,0));boundary();
   }
   await commit(v=>({...v,pendingStepId:null,checkpoint:{...v.checkpoint,state:'completed'}}));
   await drainWrites(true);
   boundary();
   emit('pipeline-'+current!.value.checkpoint.state,{state:current!.value.checkpoint.state});return outcome(current!);
  }catch(error){
   await drainWrites();
   // A failed/uncertain write must not be followed by an overwrite or an optimistic receipt.
   if(writeFailure)throw writeFailure;
   const message=error instanceof Error?error.message:'';
   if(message.includes('STORE_CONFLICT')||message.startsWith('WORKFLOW_JOURNAL_'))throw error;
   const halt=error instanceof Halt?error:new Halt('failed','HOST_FAILURE');
   await commit(v=>({...v,pendingStepId:null,checkpoint:{...v.checkpoint,state:halt.state,code:halt.code}}));
   await drainWrites(true);
   emit('pipeline-'+current!.value.checkpoint.state,{state:current!.value.checkpoint.state,code:current!.value.checkpoint.code});return outcome(current!);
  }finally{runControl.accepting=false;runControl.persist=null;await drainWrites()}
 }
 function request(kind:'paused'|'aborted'){
  if(!busy||!control||!control.accepting)return false;
  if(control.kind===kind||control.kind==='aborted')return true;
  // A later pause must never soften an already requested stop.
  control.kind=kind;
  control.persist?.();return true;
 }
 return Object.freeze({
  available,load,
  start(work:WorkState,sources:CatalogSource[],selection:Handler|'all',settings:RunOptions={}){const input=copySnapshot(work,sources);return exclusive(()=>execute('start',input,selection,settings))},
  resume(work:WorkState,sources:CatalogSource[],settings:RunOptions={}){const input=copySnapshot(work,sources);return exclusive(()=>execute('resume',input,'all',settings))},
  stopSaved(){return exclusive(async()=>{control!.accepting=false;const current=await read();if(!current)fail('CHECKPOINT_MISSING');assertSeen(current);if(terminal.has(current.value.checkpoint.state))fail('CHECKPOINT_TERMINAL');const value=current.value;await verifyForRead(value);const at=new Date(Math.max(Date.now(),Date.parse(value.updatedAt))).toISOString();const saved=await persist(current.revision,{...value,updatedAt:at,pendingStepId:null,checkpoint:{...value.checkpoint,state:'aborted',code:'ABORTED'}});remember(saved);events.append({type:'pipeline-aborted',pipelineId:value.spec.pipelineId,state:'aborted'});return outcome(saved)})},
  pause:()=>request('paused'),abort:()=>request('aborted'),
  dispose(){disposed=true;if(busy)request('paused');else store.close()},
  events:()=>events.read({limit:1024}),historyInfo:()=>events.info(),subscribe:(listener:()=>void)=>events.subscribe(listener),
  catalog:()=>manifests.map((m:any)=>({id:m.id,version:m.version,versionHash:m.versionHash,description:m.description,handler:m.handler,tools:m.tools,integrity:catalog.verify(m.id)})),
  inspect:(handler:Handler)=>kernel.inspect({intent:handler,tags:[],nodeType:handler==='mission-check'?'mission':handler==='source-status'?'source':'graph'}),selfTestsRun:runtime.selfTestsRun
 });
}
export type DurableWorkflowHost=Awaited<ReturnType<typeof createDurableWorkflowHost>>;
