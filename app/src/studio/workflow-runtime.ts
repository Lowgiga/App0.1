import type {WorkState} from '../../upstream/lib/work-contract.ts';
import {adaptWorkState,type SourceRecord} from '../../vendor/mesh-extensions/src/model.ts';
import {createBrowserCatalog,createHostAuthority} from '../../vendor/local-workflows/src/index.mjs';
import {createKernel} from '../../vendor/skill-core/src/browser.mjs';
import {executeBuiltin,builtinTools} from '../../vendor/skill-core/src/handlers.mjs';
import {canonical} from '../../vendor/skill-core/src/contract.mjs';
export type Handler='mission-check'|'graph-explain'|'backup-plan'|'source-status';
export type CatalogSource={id:string;title:string;status?:string;file?:string};
const samples:Record<Handler,{input:any;expected:any}>={
 'mission-check':{input:{title:'Self-test',steps:[{title:'Open',done:false},{title:'Done',done:true}]},expected:{mode:'offline-deterministic',title:'Self-test',stepCount:2,completedCount:1,issues:[]}},
 'graph-explain':{input:{nodes:[{id:'a',label:'A'}],edges:[]},expected:{mode:'offline-deterministic',nodeCount:1,edgeCount:0,danglingEdges:[],adjacency:[{id:'a',label:'A',outbound:[],inbound:[]}]}},
 'backup-plan':{input:{name:'Self-test',location:'not-opened',hasChecksum:false,hasRestoreEvidence:false},expected:{mode:'offline-deterministic',backup:'Self-test',verified:false,steps:['Locate the declared backup at not-opened','Compare size and recorded checksum with the source inventory','Restore a copy into an isolated test location','Open representative restored files and compare contents','Record the test date, scope, failures and operator'],warnings:['No checksum evidence supplied','No restore-test evidence supplied','This is a plan only; no backup was read, changed, or restored']}},
 'source-status':{input:{sources:[{id:'s',label:'Snapshot',kind:'snapshot'}]},expected:{mode:'offline-deterministic',snapshotCount:1,liveClaimCount:0,unknownCount:0,installedToolCount:null,statuses:[{id:'s',status:'snapshot-only'}]}}
};
export function workflowInputs(work:WorkState,sources:CatalogSource[]):Record<Handler,any>{
 const graph=adaptWorkState(work,sources.map(s=>({...s,status:s.status??'unknown',file:s.file??''})) as SourceRecord[]);
 return {
  'mission-check':{title:'Aktueller Aufgabenstand · lokal',steps:work.tasks.filter(t=>!t.archived).map(t=>({title:t.title.slice(0,200),done:t.status==='Erledigt'}))},
  'graph-explain':{nodes:graph.nodes.map(n=>({id:n.id,label:n.title.slice(0,80)})),edges:graph.edges.map(e=>({source:e.from,target:e.to}))},
  'backup-plan':{name:'Command Mesh Systembackup',location:'Vom Nutzer zu wählende Backup-Datei; hier nicht geöffnet',hasChecksum:false,hasRestoreEvidence:false},
  'source-status':{sources:sources.map(s=>({id:s.id,label:s.title.slice(0,200),kind:'snapshot'}))}
 };
}
export async function createWorkflowRuntime(){
 const catalog=await createBrowserCatalog(),authority=createHostAuthority(),kernel=createKernel({catalog,authority});
 let tests=0;
 const manifests=catalog.list();
 function selfTest(m:any){const handler=m.handler as Handler,sample=samples[handler];if(!sample||canonical(m.tools)!==canonical([builtinTools[handler]])||catalog.verify(m.id).status!=='passed')throw new Error('LOCAL_TOOL_BINDING');if(canonical(executeBuiltin(handler,sample.input))!==canonical(sample.expected))throw new Error('LOCAL_SELF_TEST_FAILED');return 'host-self-test-'+(++tests)}
 function getFreshHostEvidence(context:any){const m=manifests.find((m:any)=>m.id===context.skillId);if(!m||m.versionHash!==context.versionHash)throw new Error('LOCAL_VERSION_DRIFT');const runId=selfTest(m);return authority.issue({skillApprovals:[{id:m.id,versionHash:m.versionHash,test:{status:'passed',runId}}],tools:m.tools.map((t:any)=>({id:t.id,catalogued:true,configured:true,authenticated:'not-required',authorized:true,permissions:t.permissions,check:{status:'passed',runId}}))},{ttlMs:5000})}
 function prepare(work:WorkState,sources:CatalogSource[],selection:Handler|'all'){
  const inputs=workflowInputs(work,sources);const names=selection==='all'?Object.keys(samples) as Handler[]:[selection];
  const steps=names.flatMap((handler,index)=>{const m=manifests.find((m:any)=>m.handler===handler);if(!m)throw new Error('UNKNOWN_SKILL');const input=inputs[handler];const parts=handler==='graph-explain'?Array.from({length:Math.max(1,Math.ceil(input.edges.length/500))},(_,part)=>({...input,edges:input.edges.slice(part*500,(part+1)*500)})):[input];return parts.map((part,number)=>({stepId:'check-'+(index+1)+(parts.length>1?'-part-'+(number+1)+'-of-'+parts.length:''),kind:handler==='mission-check'?'inspect-mission':'run-offline-skill',skillId:m.id,version:m.version,versionHash:m.versionHash,input:part}))});
  if(steps.length>8)throw new Error('Der vollständige Graph benötigt mehr als acht begrenzte Schritte. Bitte Graph-Erklärung getrennt starten; es wurden keine Kanten weggelassen.');
  const spec={namespace:'cue.local-pipeline/v1',pipelineId:'local-'+crypto.randomUUID(),limits:{maxSteps:8,maxElapsedMs:1000},steps};
  return spec;
 }
 return {catalog,authority,kernel,manifests,prepare,getFreshHostEvidence,selfTestsRun:()=>tests};
}
