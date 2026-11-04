/** Browser-compatible demo; all activity below is actual local computation. */
import {createBrowserCatalog,createHostAuthority,createTrustedMemoryStore,createLocalPipelineRunner} from '../src/index.mjs';
import {executeBuiltin} from '../../skill-core/src/handlers.mjs';
import {canonical} from '../../skill-core/src/contract.mjs';
const samples={
 'mission-check':{
  input:{title:'Local check',steps:[{title:'Validate supplied data',done:true}]},
  expected:{mode:'offline-deterministic',title:'Local check',stepCount:1,completedCount:1,issues:[]}
 },
 'graph-explain':{
  input:{nodes:[{id:'mission',label:'Mission'},{id:'result',label:'Result'}],edges:[{source:'mission',target:'result'}]},
  expected:{mode:'offline-deterministic',nodeCount:2,edgeCount:1,danglingEdges:[],adjacency:[{id:'mission',label:'Mission',outbound:['result'],inbound:[]},{id:'result',label:'Result',outbound:[],inbound:['mission']}]}
 },
 'backup-plan':{
  input:{name:'Declared local backup',location:'example-only/not-opened',hasChecksum:false,hasRestoreEvidence:false},
  expected:{mode:'offline-deterministic',backup:'Declared local backup',verified:false,steps:['Locate the declared backup at example-only/not-opened','Compare size and recorded checksum with the source inventory','Restore a copy into an isolated test location','Open representative restored files and compare contents','Record the test date, scope, failures and operator'],warnings:['No checksum evidence supplied','No restore-test evidence supplied','This is a plan only; no backup was read, changed, or restored']}
 },
 'source-status':{
  input:{sources:[{id:'snapshot',label:'Supplied snapshot',kind:'snapshot'},{id:'claim',label:'Unverified claim',kind:'live-claim'}]},
  expected:{mode:'offline-deterministic',snapshotCount:1,liveClaimCount:1,unknownCount:0,installedToolCount:null,statuses:[{id:'snapshot',status:'snapshot-only'},{id:'claim',status:'unverified-live-claim'}]}
 }
};
export async function runDemo() {
 const catalog=await createBrowserCatalog(),authority=createHostAuthority(),store=createTrustedMemoryStore();let testRuns=0;
 const runner=createLocalPipelineRunner({catalog,authority,store,getFreshHostEvidence(context) {
  const m=catalog.list().find(m=>m.id===context.skillId),sample=samples[m.handler];
  // Host-owned, real self-test: an exact expected output is checked before issuing evidence.
  if(canonical(executeBuiltin(m.handler,sample.input))!==canonical(sample.expected)) throw new Error('Local self-test failed');
  const runId='demo-local-self-test-'+(++testRuns);
  return authority.issue({skillApprovals:[{id:m.id,versionHash:m.versionHash,test:{status:'passed',runId}}],tools:m.tools.map(t=>({id:t.id,catalogued:true,configured:true,authenticated:'not-required',authorized:true,permissions:t.permissions,check:{status:'passed',runId}}))},{ttlMs:60000});
 }});
 const spec={namespace:'cue.local-pipeline/v1',pipelineId:'four-local-checks',limits:{maxSteps:8,maxElapsedMs:1000},steps:Object.keys(samples).map((handler,i)=>{
  const m=catalog.list().find(m=>m.handler===handler);return {stepId:'local-check-'+(i+1),kind:handler==='mission-check'?'inspect-mission':'run-offline-skill',skillId:m.id,version:m.version,versionHash:m.versionHash,input:samples[handler].input};
 })};
 const paused=await runner.run(spec,{pauseAfterSteps:2});
 if(paused.state!=='paused'||paused.completedCount!==2) throw new Error('Demo did not pause at the requested boundary');
 const completed=await runner.run(spec,{resume:paused.checkpoint});
 if(completed.state!=='completed'||completed.completedCount!==4||testRuns!==4) throw new Error('Demo completion verification failed');
 return {executionMode:'offline-deterministic',modelCalled:false,networkCalled:false,backupRestored:false,connectorLiveStatusVerified:false,
  hostSelfTestRuns:testRuns,pause:{state:paused.state,completedCount:paused.completedCount},result:completed,
  events:runner.events({limit:1024}),history:runner.historyInfo()};
}
