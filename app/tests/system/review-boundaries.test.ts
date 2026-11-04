import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {emptyWork,savedWorkContract} from '../../upstream/lib/work-contract.ts';
import {workReferenceErrors} from '../../upstream/lib/work-updates.ts';
import {createWorkflowHost,workflowInputs} from '../../src/studio/workflow-host.ts';
import {createBackupAdapter} from '../../src/backup-adapter.ts';
import {defaultSystemState} from '../../src/system-state.ts';
import {fixture} from '../../vendor/mesh-extensions/tests/fixture.ts';
const data=JSON.parse(fs.readFileSync(new URL('../../upstream/lib/mesh-data.json',import.meta.url),'utf8'));
test('review: graph skill handles a valid dense V5 work graph',async()=>{
 const work=emptyWork();work.tasks=Array.from({length:60},(_,i)=>({...work.tasks[0],id:'task'+i,title:'Valid task '+i,dependencies:Array.from({length:Math.min(i,12)},(_,j)=>'task'+j)}));
 const prototype=fixture().command.missions[0];work.command.missions=Array.from({length:30},(_,i)=>({...prototype,id:crypto.randomUUID(),title:'Valid mission '+i,taskIds:work.tasks.slice(0,20).map(x=>x.id),sourceIds:data.sources.map((s:any)=>s.id),roomId:null}));
 const checked=savedWorkContract.parse(work);assert.deepEqual(workReferenceErrors(checked,data.sources.map((s:any)=>s.id)),[]);
 const inputs=workflowInputs(checked,data.sources);console.log('VALID_DENSE_GRAPH',JSON.stringify({nodes:inputs['graph-explain'].nodes.length,edges:inputs['graph-explain'].edges.length}));const host=await createWorkflowHost();const spec=host.prepare(checked,data.sources,'all');const partitions=spec.steps.filter((step:any)=>step.skillId==='cue.graph-explain');assert.deepEqual(partitions.flatMap((step:any)=>step.input.edges),inputs['graph-explain'].edges);assert.ok(partitions.every((step:any)=>step.input.edges.length<=500));const result=await host.run(spec);assert.equal(result.outputs.filter((out:any)=>'edgeCount' in out.output).reduce((sum:number,out:any)=>sum+out.output.edgeCount,0),inputs['graph-explain'].edges.length);console.log('DENSE_GRAPH_RESULT',result.state,result.code,result.completedCount,result.outputs.length);assert.equal(result.state,'completed');assert.equal(result.completedCount,7);assert.equal(result.outputs.filter((x:any)=>x.output.mode==='offline-deterministic').length,7);
});
test('review: valid monotonic revision ahead of device clock remains backup-exportable',async()=>{
 const work=emptyWork();work.updatedAt='2026-10-01T12:00:00.000Z';savedWorkContract.parse(work);const adapter=createBackupAdapter(data);
 const text=await adapter.export(work,defaultSystemState(),'2026-09-30T23:00:00.000Z');assert.ok(text);
});
test('review: malformed reserved system envelope is not classified as a legitimate legacy backup',async()=>{
 const {exportBackup}=await import('../../vendor/portable-kit/backup.mjs');const {makeV4Validator}=await import('../../vendor/portable-kit/examples/v4-adapter.mjs');const work=emptyWork();const options={validateWork:makeV4Validator({savedWorkContract,workReferenceErrors,knownSourceIds:data.sources.map((s:any)=>s.id)}),maxBytes:8*1024*1024};const metadata={exportedAt:'2026-09-30T23:00:00.000Z',producer:{name:'cue-command-mesh-system',version:'0.2.0-v5-integrated-preview'},source:{revision:'2b838b4f574acfaff72013c270a1fa637eb995c6',workUpdatedAt:null}};
 const text=await exportBackup({work,data:{system:{schema:'not-the-system-schema',historyPolicy:'replay-allowed'}}},metadata,options);const adapter=createBackupAdapter(data);await assert.rejects(adapter.preview(text,work,defaultSystemState()),/system|System|hülle|catalog|Katalog|schema|Schema|Felder/);
});
