import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalPipelineRunner} from '../src/runner.mjs';
import {createTrustedMemoryStore} from '../src/store.mjs';
import {fixture,issue,specFor} from './fixtures.mjs';
const eventTypes=r=>r.events({limit:1024}).map(e=>e.type);
const noSuccess=r=>assert.equal(eventTypes(r).includes('pipeline-completed'),false);

test('executes the four real handlers in order, committing outputs before success events',async()=>{
 const f=await fixture();assert.ok(f.runner,'runner must be constructed');
 const observed=[];f.runner.subscribe(e=>{if(e.type==='step-completed') observed.push(f.store.read(e.pipelineId).record.completed.length);});
 const r=await f.runner.run(f.spec);assert.equal(r.state,'completed');assert.deepEqual(f.calls,['step-1','step-2','step-3','step-4']);
 assert.equal(r.outputs[0].output.stepCount,1);assert.equal(r.outputs[1].output.nodeCount,2);assert.equal(r.outputs[2].output.verified,false);assert.equal(r.outputs[3].output.installedToolCount,null);
 assert.deepEqual(observed,[1,2,3,4]);assert.equal(f.store.read(f.spec.pipelineId).record.state,'completed');
 assert.equal(eventTypes(f.runner).filter(x=>x==='pipeline-completed').length,1);
});
test('pause and resume skip only the stored verified prefix and demand fresh evidence',async()=>{
 const f=await fixture(),a=await f.runner.run(f.spec,{pauseAfterSteps:2});assert.equal(a.state,'paused');assert.equal(a.completedCount,2);
 const r=await f.runner.run(f.spec,{resume:a.checkpoint});assert.equal(r.state,'completed');assert.equal(r.outputs.length,4);assert.deepEqual(f.calls,['step-1','step-2','step-3','step-4']);
 const done=await f.runner.run(f.spec,{resume:r.checkpoint});assert.equal(done.state,'completed');assert.equal(f.calls.length,4);
});
test('caller JSON cannot smuggle completed steps into resume, and stale references fail',async()=>{
 const f=await fixture(),a=await f.runner.run(f.spec,{pauseAfterSteps:1});
 await assert.rejects(f.runner.run(f.spec,{resume:{...a.checkpoint,completed:[{stepId:'step-2'}]}}),/unknown field|CHECKPOINT/);
 await assert.rejects(f.runner.run(f.spec,{resume:{pipelineId:f.spec.pipelineId,revision:a.checkpoint.revision-1}}),/STALE/);
 await assert.rejects(f.runner.run(f.spec,{resume:{pipelineId:'forged',revision:1}}),/CHECKPOINT/);assert.equal(f.calls.length,1);
});
test('input, version and limit drift block resume without executing',async()=>{
 for(const mutate of [s=>s.steps[0].input.title='changed',s=>s.steps[0].version='1.0.1',s=>s.steps[0].versionHash='sha256:'+'0'.repeat(64),s=>s.limits.maxElapsedMs=900]) {
  const f=await fixture(),a=await f.runner.run(f.spec,{pauseAfterSteps:1}),changed=structuredClone(f.spec);mutate(changed);
  await assert.rejects(f.runner.run(changed,{resume:a.checkpoint}),/DRIFT|VERSION/);assert.equal(f.calls.length,1);
 }
});
test('abort before start never executes and aborted checkpoints cannot resume',async()=>{
 const f=await fixture(),c=new AbortController();c.abort();const r=await f.runner.run(f.spec,{signal:c.signal});assert.equal(r.state,'aborted');assert.equal(f.calls.length,0);noSuccess(f.runner);
 await assert.rejects(f.runner.run(f.spec,{resume:r.checkpoint}),/TERMINAL/);
});
test('requestPause and abort during real event-loop boundaries stop following steps',async()=>{
 const f=await fixture();f.runner.subscribe(e=>{if(e.type==='step-completed') f.runner.pause();});
 const r=await f.runner.run(f.spec);assert.equal(r.state,'paused');assert.equal(f.calls.length,1);
 const g=await fixture();g.runner.subscribe(e=>{if(e.type==='step-completed') g.runner.abort();});
 const a=await g.runner.run(g.spec);assert.equal(a.state,'aborted');assert.equal(g.calls.length,1);noSuccess(g.runner);
});
test('handler failure stops all following steps and has no success event for failed step',async()=>{
 const f=await fixture();f.spec.steps[1].input.nodes.push({id:'a',label:'Duplicate'});
 const r=await f.runner.run(f.spec);assert.equal(r.state,'failed');assert.equal(r.code,'HANDLER_FAILED');assert.deepEqual(f.calls,['step-1','step-2']);assert.equal(r.completedCount,1);noSuccess(f.runner);
 assert.equal(f.runner.events().some(e=>e.type==='step-completed'&&e.stepId==='step-2'),false);
});
test('expired, revoked, missing and reused evidence stop before the next execution',async()=>{
 for(const kind of ['expired','revoked','missing','reused']) {
  let old;
  const f=await fixture({evidence(ctx,{clock,catalog,authority}) {
   if(kind==='missing') return {};
   if(kind==='reused') return old??=issue(authority,catalog,ctx.skillId);
   const h=issue(authority,catalog,ctx.skillId,{ttlMs:2});if(kind==='expired') clock.value+=2;else authority.revoke(h);return h;
  }});
  if(kind==='reused') f.spec=specFor(f.catalog,['mission-check','mission-check']);
  const r=await f.runner.run(f.spec);assert.equal(r.state,'failed');assert.equal(r.completedCount,kind==='reused'?1:0);noSuccess(f.runner);
 }
});
test('asynchronous evidence is rejected rather than leaving an unbounded pending provider',async()=>{
 const f=await fixture({evidence:()=>Promise.resolve({})}),r=await f.runner.run(f.spec);assert.equal(r.state,'failed');assert.equal(r.code,'EVIDENCE_INVALID');assert.equal(r.completedCount,0);
});
test('time budget checked after evidence; zero successful steps when the deadline was crossed',async()=>{
 const f=await fixture({evidence(ctx,{clock,catalog,authority}) {const h=issue(authority,catalog,ctx.skillId);clock.value+=1000;return h;}});
 const r=await f.runner.run(f.spec);assert.equal(r.state,'budget-exhausted');assert.equal(r.completedCount,0);assert.equal(eventTypes(f.runner).includes('step-completed'),false);noSuccess(f.runner);
});
test('clock rollback and nonfinite clocks fail closed and rollback remains poisoned',async()=>{
 const f=await fixture({evidence(ctx,{clock,catalog,authority}) {const h=issue(authority,catalog,ctx.skillId);clock.value--;return h;}}),r=await f.runner.run(f.spec);assert.equal(r.state,'failed');assert.equal(r.code,'CLOCK_INVALID');noSuccess(f.runner);
 f.clock.value=500;await assert.rejects(f.runner.run({...f.spec,pipelineId:'other'}),/CLOCK_INVALID/);
 const g=await fixture({runner:{now:()=>NaN}});await assert.rejects(g.runner.run(g.spec),/CLOCK_INVALID/);
});
test('concurrent invocation on one runner is rejected before asynchronous preparation',async()=>{
 const f=await fixture(),a=f.runner.run(f.spec);await assert.rejects(f.runner.run(f.spec),/CONCURRENT_RUN/);assert.equal((await a).state,'completed');
});
test('shared store running reservation stops a second runner from executing same pipeline',async()=>{
 const f=await fixture();let second;
 f.runner.subscribe(e=>{if(e.type==='pipeline-started') {
  const other=createLocalPipelineRunner({catalog:f.catalog,authority:f.authority,store:f.store,getFreshHostEvidence:ctx=>{throw new Error('must not execute');},now:()=>100});
  second=other.run(f.spec).then(()=>false,error=>/EXISTS|RUNNING|CONFLICT/.test(error.message));
 }});
 assert.equal((await f.runner.run(f.spec)).state,'completed');assert.equal(await second,true);
});
test('corrupt trusted-store prefix and outputs are rejected on resume',async()=>{
 for(const corrupt of [r=>r.nextStepIndex=4,r=>r.completed[0].output.stepCount=999,r=>r.completed[0].stepId='wrong',r=>r.authority={approved:true}]) {
  const base=createTrustedMemoryStore();let damaged=false;
  const store={compareAndSwap:(...x)=>base.compareAndSwap(...x),read(id){const r=base.read(id);if(r&&damaged) corrupt(r.record);return r;}};
  const f=await fixture({store}),a=await f.runner.run(f.spec,{pauseAfterSteps:1});damaged=true;
  await assert.rejects(f.runner.run(f.spec,{resume:a.checkpoint}),/CHECKPOINT/);assert.equal(f.calls.length,1);
 }
});
test('CAS conflict and lying store do not publish successful execution',async()=>{
 const base=createTrustedMemoryStore();let writes=0;
 const store={read:(...x)=>base.read(...x),compareAndSwap(...x){if(++writes===2) {const e=new Error('conflict');e.code='STORE_CONFLICT';throw e;}return base.compareAndSwap(...x);}};
 const f=await fixture({store}),r=await f.runner.run(f.spec);assert.equal(r.state,'failed');assert.equal(r.code,'STORE_CONFLICT');assert.equal(r.completedCount,0);assert.equal(eventTypes(f.runner).includes('step-completed'),false);
 const lying={read:()=>null,compareAndSwap:()=>1},g=await fixture({store:lying});await assert.rejects(g.runner.run(g.spec),/STORE_CORRUPT/);assert.equal(g.calls.length,0);
});
test('strict specification validation rejects excess steps, invalid schema, extra code and wrong kinds',async()=>{
 for(const mutate of [s=>s.steps=Array.from({length:9},(_,i)=>({...s.steps[0],stepId:'step-'+i})),s=>s.steps[0].input={shell:'rm'},s=>s.steps[0].execute='https://example.org',s=>s.steps[1].kind='inspect-mission',s=>s.steps[0].skillId='cue.unknown',s=>s.limits.maxElapsedMs=1001,s=>s.steps[1].stepId=s.steps[0].stepId]) {
  const f=await fixture();mutate(f.spec);await assert.rejects(f.runner.run(f.spec));assert.equal(f.calls.length,0);
 }
});
test('caller mutations during asynchronous preparation cannot change the pinned input',async()=>{
 const f=await fixture(),pending=f.runner.run(f.spec);f.spec.steps[0].input.title='mutated';const r=await pending;assert.equal(r.outputs[0].output.title,'Local checks');
});
test('bounded event retention is visible and events contain no inputs, outputs or evidence',async()=>{
 const f=await fixture({runner:{historyLimit:5}}),r=await f.runner.run(f.spec);assert.equal(r.state,'completed');const info=f.runner.historyInfo();assert.equal(info.retainedCount,5);assert.ok(info.droppedCount>0);assert.equal(info.firstSequence,info.droppedCount+1);
 const events=f.runner.events();assert.equal(events.length,5);for(const e of events) {assert.equal('input' in e,false);assert.equal('output' in e,false);assert.equal('evidence' in e,false);}assert.throws(()=>f.runner.events({limit:1025}),/EVENT_QUERY/);
});
test('checkpoint has only data bindings, never capabilities or raw input',async()=>{
 const f=await fixture(),r=await f.runner.run(f.spec,{pauseAfterSteps:1}),record=f.store.read(r.checkpoint.pipelineId).record;
 const text=JSON.stringify(record);assert.equal(/skillApprovals|permissions|evidence|authorized|input":/.test(text),false);assert.equal(record.completed[0].output.mode,'offline-deterministic');
});
