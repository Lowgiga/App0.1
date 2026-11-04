import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNativeSnapshot} from '../../src/platform/native-ar.ts';
import {buildSpaceGraph} from '../../overlay/lib/space-model.ts';
import {emptyWork} from '../../upstream/lib/work-contract.ts';
import {workflowInputs} from '../../src/studio/workflow-runtime.ts';
import {createDurableWorkflowHost} from '../../src/studio/durable-workflow-host.ts';
import {createBackupAdapter} from '../../src/backup-adapter.ts';
import {defaultSystemState} from '../../src/system-state.ts';
function locks(){let held=false;return{async request(_n:string,_o:any,fn:any){if(held)return fn(null);held=true;try{return await fn({})}finally{held=false}}} as unknown as LockManager}
function journal(){let value:any=null;return{async load(){return structuredClone(value)},async save(revision:number|null,next:any){assert.equal(revision,value?.revision??null);value={revision:(revision??0)+1,value:structuredClone(next)};return structuredClone(value)},close(){}}}
test('LowQuantFlow AR title changes presentation while preserving complete graph and revision',()=>{
 const work=emptyWork();work.updatedAt='2026-10-04T00:00:00.000Z';const graph=buildSpaceGraph(work,[],true);
 const result=buildNativeSnapshot(graph,{stateRevision:work.updatedAt,scope:'all',known:true});
 assert.equal(result.snapshot.title,'LowQuantFlow · all');
 assert.deepEqual(result.snapshot.nodes.map(n=>n.id),graph.nodes.map(n=>n.id));
 assert.equal(result.snapshot.edges.length,graph.edges.length);
 assert.equal(result.snapshot.snapshotRevision,buildNativeSnapshot(graph,{stateRevision:work.updatedAt,scope:'all',known:true}).snapshot.snapshotRevision);
});
test('branding leaves workflow input identities and explicit checkpoint recovery unchanged',async()=>{
 const work=emptyWork();assert.equal(workflowInputs(work,[])['backup-plan'].name,'Command Mesh Systembackup');
 const store=journal(),lock=locks(),first=await createDurableWorkflowHost({store,locks:lock});
 const paused=await first.start(work,[],'all',{pauseAfterStep:true});assert.equal(paused.state,'paused');assert.equal(paused.completedCount,1);
 const before=await store.load();first.dispose();
 const reopened=await createDurableWorkflowHost({store,locks:lock});
 assert.equal((await reopened.load(work,[]))?.recoverable,true);assert.equal(reopened.selfTestsRun(),0);
 assert.deepEqual(await store.load(),before,'Reading a saved journal must not relabel or execute it');
 const result=await reopened.resume(work,[]);assert.equal(result.state,'completed');assert.equal(result.completedCount,4);
 assert.deepEqual(result.outputs[0],paused.outputs[0]);assert.equal(reopened.selfTestsRun(),3);reopened.dispose();
});
test('new branding does not change backup producer identity, source data or restore authority',async()=>{
 const work=emptyWork(),state=defaultSystemState(),adapter=createBackupAdapter({sources:[]});
 const before=JSON.stringify({work,state}),text=await adapter.export(work,state,'2026-10-04T00:00:00.000Z');
 assert.match(text,/"name":\s*"cue-command-mesh-system"/);assert.doesNotMatch(text,/"name":\s*"LowQuantFlow"/);
 await adapter.preview(text,work,state);assert.equal(JSON.stringify({work,state}),before);
});

