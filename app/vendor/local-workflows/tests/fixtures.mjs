import {createBrowserCatalog} from '../src/catalog.mjs';
import {createTrustedMemoryStore} from '../src/store.mjs';
import {createHostAuthority} from '../../skill-core/src/browser.mjs';
import {createLocalPipelineRunner} from '../src/runner.mjs';
export const inputs={
 'mission-check':{title:'Local checks',steps:[{title:'Check',done:true}]},
 'graph-explain':{nodes:[{id:'a',label:'A'},{id:'b',label:'B'}],edges:[{source:'a',target:'b'}]},
 'backup-plan':{name:'Local copy',location:'/not-opened',hasChecksum:false,hasRestoreEvidence:false},
 'source-status':{sources:[{id:'s',label:'Claim',kind:'live-claim'}]}
};
export function specFor(catalog,names=['mission-check','graph-explain','backup-plan','source-status'],pipelineId='test-pipeline') {
 return {namespace:'cue.local-pipeline/v1',pipelineId,limits:{maxSteps:8,maxElapsedMs:1000},steps:names.map((name,i)=>{
  const m=catalog.list().find(m=>m.handler===name);return {stepId:'step-'+(i+1),kind:name==='mission-check'?'inspect-mission':'run-offline-skill',skillId:m.id,version:m.version,versionHash:m.versionHash,input:structuredClone(inputs[name])};
 })};
}
export function issue(authority,catalog,skillId,{ttlMs=60000}={}) {
 const m=catalog.list().find(m=>m.id===skillId);
 return authority.issue({skillApprovals:[{id:m.id,versionHash:m.versionHash,test:{status:'passed',runId:'local-test'}}],tools:m.tools.map(t=>({id:t.id,catalogued:true,configured:true,authenticated:'not-required',authorized:true,permissions:t.permissions,check:{status:'passed',runId:'local-test'}}))},{ttlMs});
}
export async function fixture(options={}) {
 const clock={value:100},catalog=options.catalog??await createBrowserCatalog(),authority=options.authority??createHostAuthority({now:()=>clock.value}),store=options.store??createTrustedMemoryStore(),calls=[];
 const getFreshHostEvidence=context=>{calls.push(context.stepId);return options.evidence?options.evidence(context,{clock,catalog,authority}):issue(authority,catalog,context.skillId);};
 const runner=createLocalPipelineRunner({catalog,authority,store,getFreshHostEvidence,now:()=>clock.value,...options.runner});
 return {catalog,authority,store,clock,calls,runner,spec:specFor(catalog)};
}
