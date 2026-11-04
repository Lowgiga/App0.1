import {createKernel} from '../../skill-core/src/browser.mjs';
import {canonical,copy,exactFields,validateData} from '../../skill-core/src/contract.mjs';
import {prepareSpec,validateCheckpoint,validateEnvelope,validateReference} from './contracts.mjs';
import {createWorkflowEvents} from './events.mjs';
import {fail,hashJson,plainOptions,snapshot} from './data.mjs';
const evidenceUsed=new WeakMap();
const endEvent={paused:'pipeline-paused',aborted:'pipeline-aborted',failed:'pipeline-failed','budget-exhausted':'budget-exhausted',completed:'pipeline-completed'};
class Stop extends Error {constructor(state,code) {super(code);this.state=state;this.code=code;}}
/** Host-only orchestration: the only executor is skill-core's static local kernel. */
export function createLocalPipelineRunner({catalog,authority,store,getFreshHostEvidence,now=()=>globalThis.performance.now(),historyLimit=512}) {
 if(!catalog||!authority||!store||typeof store.read!=='function'||typeof store.compareAndSwap!=='function'||typeof getFreshHostEvidence!=='function'||typeof now!=='function') fail('HOST_CONFIGURATION');
 const initial=new Map(catalog.list().map(m=>[m.id,snapshot(m)])),kernel=createKernel({catalog,authority}),log=createWorkflowEvents(historyLimit);
 if(!evidenceUsed.has(authority)) evidenceUsed.set(authority,new WeakSet());
 const used=evidenceUsed.get(authority);let active=null,lastClock=-Infinity,clockBroken=false;
 function clock() {
  const value=now();if(clockBroken||!Number.isFinite(value)||value<lastClock) {clockBroken=true;fail('CLOCK_INVALID');}lastClock=value;return value;
 }
 async function run(untrustedSpec,options={}) {
  if(active) fail('CONCURRENT_RUN');
  const control={pause:false,abort:false};active=control;
  try {
   // Copy before the first await. No live references to caller-supplied pipeline data.
   const spec=snapshot(untrustedSpec);plainOptions(options);exactFields(options,['resume','signal','pauseAfterSteps'],[],'run options');
   const {signal,pauseAfterSteps=Infinity}=options;
   if(signal!==undefined && !(signal instanceof AbortSignal)) fail('ABORT_SIGNAL');
   if(pauseAfterSteps!==Infinity&&(!Number.isSafeInteger(pauseAfterSteps)||pauseAfterSteps<1||pauseAfterSteps>8)) fail('PAUSE_LIMIT');
   const ref=options.resume===undefined?null:validateReference(options.resume,spec.pipelineId),startedAt=clock();
   const prepared=await prepareSpec(spec,catalog,initial);
   let current,revision=null,storeHealthy=true,performed=0;
   const emit=(type,extra={})=>log.append({type,pipelineId:spec.pipelineId,...extra});
   const read=()=>{try {const v=store.read(spec.pipelineId);return v===null?null:validateEnvelope(v);} catch {fail('STORE_CORRUPT');}};
   const observed=read();
   if(ref) {
    if(!observed) fail('CHECKPOINT_MISSING');if(observed.revision!==ref.revision) fail('CHECKPOINT_STALE');
    await validateCheckpoint(observed.record,prepared);current=observed.record;revision=observed.revision;
    // Also verify the package associated with every skipped result.
    for(const c of current.completed) {const v=catalog.verify(c.skillId);if(v.status!=='passed'||v.versionHash!==c.versionHash) fail('VERSION_DRIFT');}
    if(current.state==='running') fail('CHECKPOINT_RUNNING');
    if(['aborted','failed'].includes(current.state)) fail('CHECKPOINT_TERMINAL');
    if(current.state==='completed') return outcome();
   } else {
    if(observed) fail('PIPELINE_EXISTS');
    current={namespace:'cue.local-checkpoint/v1',pipelineId:spec.pipelineId,revisionHash:prepared.revisionHash,nextStepIndex:0,completed:[],state:'running'};
   }
   function commit(next,checkBeforeWrite=false) {
    const safe=snapshot(next);
    // A synchronous host read or serialization may have consumed the remaining
    // budget or delivered cancellation. Stop before committing a new result.
    if(checkBeforeWrite) boundary();
    try {
     const expected=revision,newRevision=store.compareAndSwap(spec.pipelineId,expected,safe);
     if(newRevision!==(expected??0)+1) fail('STORE_CORRUPT');
     const saved=read();if(!saved||saved.revision!==newRevision||canonical(saved.record)!==canonical(safe)) fail('STORE_CORRUPT');
     current=safe;revision=newRevision;emit('checkpoint-saved',{state:current.state,revision});
    } catch(error) {storeHealthy=false;fail(error?.code==='STORE_CONFLICT'?'STORE_CONFLICT':'STORE_CORRUPT');}
   }
   function outcome(code) {
    return {state:current.state,completedCount:current.completed.length,checkpoint:storeHealthy?{pipelineId:spec.pipelineId,revision}:null,
     outputs:current.completed.map(({stepId,output})=>({stepId,output:copy(output)})),...(code?{code}:{})};
   }
   function boundary(includePause=false) {
    if(control.abort||signal?.aborted) throw new Stop('aborted','ABORTED');
    let time;try {time=clock();} catch {throw new Stop('failed','CLOCK_INVALID');}
    if(time-startedAt>=spec.limits.maxElapsedMs) throw new Stop('budget-exhausted','TIME_BUDGET');
    if(includePause&&control.pause) throw new Stop('paused','PAUSED');
   }
   function stillOwned() {
    const live=read();if(!live||live.revision!==revision||canonical(live.record)!==canonical(current)) fail('STORE_CONFLICT');
   }
   // CAS reserves the run before a handler or a start event can occur.
   const {code:oldCode,...running}=current;commit({...running,state:'running'});emit('pipeline-started',{state:'running',revision,resumed:Boolean(ref)});
   try {
    boundary(true);
    for(let i=current.nextStepIndex;i<spec.steps.length;i++) {
     boundary(true);stillOwned();
     const step=spec.steps[i],binding=prepared.bindings[i],context={stepId:step.stepId,skillId:step.skillId,versionHash:step.versionHash,inputHash:binding.inputHash};
     if(await hashJson(step.input)!==binding.inputHash||validateData(binding.manifest.inputSchema,step.input).length) fail('INPUT_DRIFT');
     boundary(true);
     const integrity=kernel.verify(step.skillId);if(integrity.status!=='passed'||integrity.versionHash!==step.versionHash) fail('INTEGRITY_FAILED');
     const handle=getFreshHostEvidence(Object.freeze({pipelineId:spec.pipelineId,...context}));
     if(handle&&typeof handle.then==='function') {
      // Reject the contract violation, but consume a rejected host promise so it
      // cannot escape as an unhandled rejection. Never await or use its result.
      Promise.resolve(handle).catch(()=>{});fail('EVIDENCE_INVALID');
     }
     if(!handle||typeof handle!=='object'||used.has(handle)) fail('EVIDENCE_INVALID');
     used.add(handle);boundary(true);
     if(!kernel.readiness(step.skillId,handle).ready) fail('EVIDENCE_INVALID');
     boundary(true);emit('step-started',{...context,state:'running'});boundary(true);
     let output;
     try {output=kernel.run(step.skillId,step.input,handle);} catch {fail('HANDLER_FAILED');}
     boundary();snapshot(output,131072);const outputHash=await hashJson(output);boundary();stillOwned();
     const completed={stepId:step.stepId,skillId:step.skillId,version:step.version,versionHash:step.versionHash,inputHash:binding.inputHash,outputHash,output};
     commit({...current,completed:[...current.completed,completed],nextStepIndex:i+1},true);
     // A commit cannot be undone. If host storage crossed a stop boundary,
     // retain its confirmed outputs but do not publish an optimistic success.
     boundary();
     emit('step-completed',{...context,state:'completed',revision});performed++;
     if(performed>=pauseAfterSteps) control.pause=true;
     // Yield to host/UI abort and pause actions between synchronous local steps.
     await new Promise(resolve=>setTimeout(resolve,0));boundary(i+1<spec.steps.length);
    }
    boundary();commit({...current,state:'completed'},true);boundary();emit('pipeline-completed',{state:'completed',revision});return outcome();
   } catch(error) {
    const allowed=['EVIDENCE_INVALID','HANDLER_FAILED','INTEGRITY_FAILED','INPUT_DRIFT','STORE_CONFLICT','STORE_CORRUPT'];
    let state=error instanceof Stop?error.state:'failed',code=error instanceof Stop?error.code:allowed.includes(error?.code)?error.code:'HOST_FAILURE';
    if(code.startsWith('STORE_')) storeHealthy=false;
    if(storeHealthy) {try {commit({...current,state,code});} catch(e) {state='failed';code=e.code;}}
    // If storage failed, do not pretend a terminal checkpoint was persisted.
    const result={...outcome(code),state};emit(endEvent[state],{state,code,...(storeHealthy?{revision}:{})});return result;
   }
  } finally {active=null;}
 }
 return Object.freeze({run,pause:()=>{if(!active)return false;active.pause=true;return true;},abort:()=>{if(!active)return false;active.abort=true;return true;},
  events:options=>log.read(options),historyInfo:()=>log.info(),subscribe:listener=>log.subscribe(listener)});
}
