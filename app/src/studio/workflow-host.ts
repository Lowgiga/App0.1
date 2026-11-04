import {createTrustedMemoryStore,createLocalPipelineRunner} from '../../vendor/local-workflows/src/index.mjs';
import {createWorkflowRuntime} from './workflow-runtime.ts';
export {workflowInputs} from './workflow-runtime.ts';
export type {Handler,CatalogSource} from './workflow-runtime.ts';
import type {Handler} from './workflow-runtime.ts';
export async function createWorkflowHost(){
 const runtime=await createWorkflowRuntime();
 const {catalog,authority,kernel,manifests,getFreshHostEvidence}=runtime;
 const prepared=new WeakSet<object>();
 let live:any=null;
 const listeners=new Set<()=>void>();
 function prepare(...args:Parameters<typeof runtime.prepare>){const spec=runtime.prepare(...args);prepared.add(spec);return spec;}
 return Object.freeze({
  prepare,
  async run(spec:ReturnType<typeof prepare>,options:any={}){
   if(!prepared.has(spec))throw new Error('FOREIGN_PIPELINE');
   if(!options.resume&&live?.active)throw new Error('CONCURRENT_RUN');
   if(!options.resume){const runner=createLocalPipelineRunner({catalog,authority,store:createTrustedMemoryStore({maxEntries:1}),getFreshHostEvidence});runner.subscribe(()=>listeners.forEach(fn=>fn()));live={spec,runner,active:false};}
   if(live?.spec!==spec)throw new Error('CHECKPOINT_MISSING');if(live.active)throw new Error('CONCURRENT_RUN');live.active=true;try{return await live.runner.run(spec,options)}finally{live.active=false}
  },
  abort:()=>live?.runner.abort()??false,pause:()=>live?.runner.pause()??false,
  events:()=>live?.runner.events({limit:1024})??[],historyInfo:()=>live?.runner.historyInfo()??{retainedCount:0,droppedCount:0},
  subscribe(listener:()=>void){listeners.add(listener);return()=>listeners.delete(listener)},
  catalog:()=>manifests.map((m:any)=>({id:m.id,version:m.version,versionHash:m.versionHash,description:m.description,handler:m.handler,tools:m.tools,integrity:catalog.verify(m.id)})),
  inspect:(handler:Handler)=>kernel.inspect({intent:handler,tags:[],nodeType:handler==='mission-check'?'mission':handler==='source-status'?'source':'graph'}),
  selfTestsRun:runtime.selfTestsRun
 });
}
export type WorkflowHost=Awaited<ReturnType<typeof createWorkflowHost>>;
