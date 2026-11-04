import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fixture} from './fixtures.mjs';
import {createTrustedMemoryStore} from '../src/store.mjs';

for(const mode of ['abort','budget','rollback']) {
 test(`a ${mode} observed during the precommit store read discards uncommitted output`,async()=>{
  const base=createTrustedMemoryStore(),controller=new AbortController();let armed=false,triggered=false,f;
  const store={compareAndSwap:(...args)=>base.compareAndSwap(...args),read(id){
   const value=base.read(id);
   if(armed&&!triggered) {triggered=true;if(mode==='abort')controller.abort();else f.clock.value=mode==='budget'?1100:99;}
   return value;
  }};
  f=await fixture({store});f.runner.subscribe(e=>{if(e.type==='step-started')armed=true;});
  const r=await f.runner.run(f.spec,{signal:controller.signal});
  assert.equal(r.state,mode==='abort'?'aborted':mode==='budget'?'budget-exhausted':'failed');
  assert.equal(r.completedCount,0);assert.equal(r.outputs.length,0);
  assert.equal(f.runner.events().some(e=>e.type==='step-completed'),false);
  const saved=base.read(f.spec.pipelineId);assert.equal(saved.record.completed.length,0);assert.equal(saved.record.state,r.state);
 });
}
for(const value of [null,undefined]) {
 test(`a host evidence provider throwing ${String(value)} yields a saved HOST_FAILURE`,async()=>{
  const f=await fixture({evidence(){throw value;}}),r=await f.runner.run(f.spec);
  assert.equal(r.state,'failed');assert.equal(r.code,'HOST_FAILURE');assert.equal(r.completedCount,0);
  assert.equal(f.store.read(r.checkpoint.pipelineId).record.state,'failed');
  assert.equal(f.runner.events().some(e=>e.type==='step-completed'),false);
 });
}
test('async observer rejections are isolated without changing successful execution',()=>{
 const fixtureUrl=new URL('./fixtures.mjs',import.meta.url).href;
 const code=`import {fixture} from ${JSON.stringify(fixtureUrl)};
 const f=await fixture();f.runner.subscribe(async()=>{throw new Error('observer rejected');});
 const r=await f.runner.run(f.spec);if(r.state!=='completed'||r.completedCount!==4)process.exit(2);
 await new Promise(resolve=>setTimeout(resolve,20));`;
 const p=spawnSync(process.execPath,['--unhandled-rejections=strict','--input-type=module','-e',code],{encoding:'utf8'});
 assert.equal(p.status,0,p.stderr);
});
for(const mode of ['abort','budget']) {
 test(`a ${mode} during final CAS preserves committed output but suppresses pipeline success`,async()=>{
  const base=createTrustedMemoryStore(),controller=new AbortController();let f,triggered=false;
  const store={read:(...args)=>base.read(...args),compareAndSwap(id,revision,record){
   const savedRevision=base.compareAndSwap(id,revision,record);
   if(record.state==='completed'&&!triggered){triggered=true;if(mode==='abort')controller.abort();else f.clock.value=1100;}
   return savedRevision;
  }};
  f=await fixture({store});const r=await f.runner.run(f.spec,{signal:controller.signal});
  assert.equal(r.state,mode==='abort'?'aborted':'budget-exhausted');assert.equal(r.completedCount,4);assert.equal(r.outputs.length,4);
  assert.equal(f.runner.events().some(e=>e.type==='pipeline-completed'),false);
  const record=base.read(f.spec.pipelineId).record;assert.equal(record.state,r.state);assert.equal(record.completed.length,4);
 });
}
