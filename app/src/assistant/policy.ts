/** Conservative project defaults, not measured model or hardware capacity. */
export const DEFAULT_ASSISTANT_POLICY=Object.freeze({maxHostSteps:12,maxModelCalls:3,maxRepairAttempts:1,maxInputBytes:32768,maxOutputBytes:8192,maxActiveMs:30000});
export type AssistantPolicy=Readonly<{[K in keyof typeof DEFAULT_ASSISTANT_POLICY]:number}>;
export type RuntimeCode='INVALID_REQUEST'|'INVALID_RESULT'|'CONTEXT_MISMATCH'|'STALE_BASIS'|'CONTEXT_BUDGET'|'OUTPUT_BUDGET'|'POLICY'|'BUDGET'|'UNAVAILABLE'|'ABORTED'|'TIMEOUT'|'SUPERSEDED'|'ADAPTER_FAILED'|'DUPLICATE'|'CYCLE'|'TEMPORARY_READ'|'UNKNOWN_SIDE_EFFECT'|'LOGGING_FAILED';
export class AssistantRuntimeError extends Error {
 constructor(readonly code:RuntimeCode){super(code);this.name='AssistantRuntimeError'}
}
export type OperationEffect='pure'|'read-only'|'write'|'unknown';
export function canRetry(effect:OperationEffect,code:RuntimeCode):boolean{
 return (effect==='pure'||effect==='read-only')&&(code==='INVALID_RESULT'||code==='TEMPORARY_READ');
}
export function validatePolicy(input:AssistantPolicy):AssistantPolicy{
 try{
  if(!input||typeof input!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(input)))throw new AssistantRuntimeError('POLICY');
  const descriptors=Object.getOwnPropertyDescriptors(input),keys=Object.keys(DEFAULT_ASSISTANT_POLICY) as (keyof AssistantPolicy)[];
  if(Reflect.ownKeys(descriptors).length!==keys.length)throw new AssistantRuntimeError('POLICY');
  const validated={} as Record<keyof AssistantPolicy,number>;
  for(const key of keys){
   const property=descriptors[key];if(!property||!('value' in property)||!property.enumerable)throw new AssistantRuntimeError('POLICY');
   const value:unknown=property.value;if(typeof value!=='number'||!Number.isSafeInteger(value)||value<(key==='maxRepairAttempts'?0:1)||value>DEFAULT_ASSISTANT_POLICY[key])throw new AssistantRuntimeError('POLICY');
   validated[key]=value;
  }
  return Object.freeze(validated);
 }catch{throw new AssistantRuntimeError('POLICY')}
}
export function createRunBudget(input:AssistantPolicy=DEFAULT_ASSISTANT_POLICY,clock:()=>number=()=>performance.now()){
 const policy=validatePolicy(input),started=clock();
 if(!Number.isFinite(started))throw new AssistantRuntimeError('POLICY');
 let hostSteps=0,modelCalls=0,repairAttempts=0,last=started;
 const active=new Set<string>(),seen=new Set<string>();
 function remainingMs(){const now=clock();if(!Number.isFinite(now)||now<last)throw new AssistantRuntimeError('POLICY');last=now;const left=policy.maxActiveMs-(now-started);if(left<=0)throw new AssistantRuntimeError('TIMEOUT');return left}
 return {
  step(){remainingMs();if(hostSteps>=policy.maxHostSteps)throw new AssistantRuntimeError('BUDGET');hostSteps++},
  call(){remainingMs();if(modelCalls>=policy.maxModelCalls)throw new AssistantRuntimeError('BUDGET');modelCalls++},
  repair(effect:OperationEffect,code:RuntimeCode){remainingMs();if(!canRetry(effect,code))throw new AssistantRuntimeError('POLICY');if(repairAttempts>=policy.maxRepairAttempts)throw new AssistantRuntimeError('BUDGET');repairAttempts++},
  enter(id:string){remainingMs();if(active.has(id))throw new AssistantRuntimeError('CYCLE');if(seen.has(id))throw new AssistantRuntimeError('DUPLICATE');active.add(id);seen.add(id);return()=>{active.delete(id)}},
  snapshot:()=>Object.freeze({hostSteps,modelCalls,repairAttempts}),remainingMs
 };
}
