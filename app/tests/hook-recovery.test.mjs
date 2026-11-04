import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {IDBFactory, IDBObjectStore} from '../node_modules/fake-indexeddb/build/esm/index.js';
import {LocalWorkStore} from '../src/local-adapter.ts';
import {emptyWork, savedWorkContract} from '../upstream/lib/work-contract.ts';
import {ConflictGate} from '../src/conflict-gate.ts';
import {workSizeError,workBytes,WORK_WRITE_BUDGET} from '../upstream/lib/work-budget.ts';
import {createId} from '../upstream/lib/ids.ts';
import * as reconciliation from '../upstream/lib/write-reconciliation.ts';
const require=createRequire(new URL('../package.json',import.meta.url));
const ts=require('typescript');
const date=new Date('2026-09-30T21:30:00.000Z');
const make=()=>{const options={indexedDB:new IDBFactory(),name:'review-'+crypto.randomUUID(),now:()=>new Date(date)};return{options,store:new LocalWorkStore(options)}};
const read=async s=>{const r=await s.request('/api/state');assert.equal(r.status,200,JSON.stringify(await r.clone().json()));return r.json()};
const write=(s,state,opts={})=>{const {updatedAt,...body}=state;return s.request('/api/state',{method:'PUT',body:JSON.stringify({...body,expectedUpdatedAt:updatedAt}),...opts})};
const note=text=>({id:crypto.randomUUID(),text,createdAt:date.toISOString()});
const raw=async(options,value)=>new Promise((resolve,reject)=>{const request=options.indexedDB.open(options.name,1);request.onsuccess=()=>{const db=request.result;const tx=db.transaction('work','readwrite');tx.objectStore('work').put(value,'local-default');tx.oncomplete=()=>{db.close();resolve()};tx.onabort=()=>reject(tx.error)};request.onerror=()=>reject(request.error)});

// Execute the unchanged generated hook with a minimal state/effect runner.
// This is a Node logic simulation, NOT React DOM, browser, WebView or Android QA.
function hookHarness(transport){
 const slots=[];let cursor=0;let effects=[];let renderNeeded=false;let result;
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
 const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;renderNeeded=true}]},useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i]},useCallback(callback,deps){const i=cursor++;if(!(i in slots)||!same(slots[i].deps,deps))slots[i]={deps,callback};return slots[i].callback},useEffect(callback,deps){const i=cursor++;if(!(i in slots)||!same(slots[i].deps,deps)){slots[i]={deps};effects.push(callback)}}};
 const imports={'react':react,'@/lib/work-contract':{savedWorkContract,emptyWork},'@/lib/work-budget':{workSizeError},'@/lib/ids':{createId},'sonner':{toast:{success(){},error(){}}},'../src/work-transport':{useWorkTransport:()=>transport},'../src/conflict-gate':{ConflictGate},'@/lib/write-reconciliation':reconciliation};
 const source=fs.readFileSync(new URL('../overlay/use-work-state.ts',import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const context={exports:{},require:name=>{assert.ok(name in imports,'unmocked module '+name);return imports[name]},AbortController,Date,Error,Promise};vm.runInNewContext(js,context);
 function render(){cursor=0;renderNeeded=false;result=context.exports.useWorkState();const pending=effects;effects=[];pending.forEach(fn=>fn());return result}
 async function settle(){for(let i=0;i<100;i++){await new Promise(resolve=>setImmediate(resolve));if(renderNeeded)render();if(result.initialized&&!result.loadingWork&&!result.busy)return result}throw new Error('Hook did not settle')}
 render();return{settle,render,get current(){return result}};
}
test('409 conflict permanently blocks stale form saves until full hook remount',async()=>{const{store,options}=make();const h=hookHarness(store);await h.settle();const draft={...h.current.work,notes:[note('old draft')]};const other=new LocalWorkStore(options);await write(other,{...emptyWork(),notes:[note('other writer')]});assert.equal(await h.current.changeWork(draft),false);await h.settle();assert.equal(h.current.storageError,true);const newest=h.current.work;assert.equal(await h.current.changeWork({...newest,notes:[...newest.notes,note('second attempt')]}),false);assert.equal((await read(store)).notes.length,1);store.close();other.close()});
test('REGRESSION: ambiguous failure with external revision must block retained stale form',async()=>{const{store,options}=make();const other=new LocalWorkStore(options);let failed=false;const transport={async request(path,init={}){if(init.method==='PUT'&&!failed){failed=true;const latest=await read(other);latest.settings.fontScale=125;assert.equal((await write(other,latest)).status,200);return Response.json({error:'Injected storage interruption'},{status:503})}return store.request(path,init)}};const h=hookHarness(transport);await h.settle();const retainedDraft={...h.current.work.settings,theme:'dark'};assert.equal(await h.current.changeWork({...h.current.work,settings:retainedDraft}),false);await h.settle();assert.equal(h.current.work.settings.fontScale,125);const savedAgain=await h.current.changeWork({...h.current.work,settings:retainedDraft});await h.settle();const final=await read(store);store.close();other.close();assert.equal(final.settings.fontScale,125,'Retained old settings silently overwrite the newer fontScale after uncertain recovery; second save result='+savedAgain)});
test('failed ambiguous recovery cannot later re-fetch and rebase an old settings draft',async()=>{const{store,options}=make();const other=new LocalWorkStore(options);let writeFailed=false,readFailed=false;const transport={async request(path,init={}){if(init.method==='PUT'&&!writeFailed){writeFailed=true;const latest=await read(other);latest.settings.fontScale=125;await write(other,latest);return Response.json({error:'Interrupted'},{status:503});}if(writeFailed&&!readFailed&&(!init.method||init.method==='GET')){readFailed=true;return Response.json({error:'Read failed'},{status:503});}return store.request(path,init)}};const h=hookHarness(transport);await h.settle();const draft={...h.current.work.settings,theme:'dark'};assert.equal(await h.current.changeWork({...h.current.work,settings:draft}),false);await h.settle();assert.equal(await h.current.loadWork(),false);await h.settle();assert.equal(await h.current.changeWork({...h.current.work,settings:draft}),false);assert.equal((await read(store)).settings.fontScale,125);store.close();other.close();});
test('reconciled own write remains confirmed but uncertain-session drafts cannot write again',async()=>{const{store,options}=make();const other=new LocalWorkStore(options);let interrupted=false;const transport={async request(path,init={}){if(init.method==='PUT'&&!interrupted){interrupted=true;const result=await store.request(path,init);assert.equal(result.status,200);const latest=await read(other);latest.settings.fontScale=125;await write(other,latest);return Response.json({error:'Lost response'},{status:503});}return store.request(path,init)}};const h=hookHarness(transport);await h.settle();const draft={...h.current.work.settings,theme:'dark'};assert.equal(await h.current.changeWork({...h.current.work,notes:[note('Own saved note')]}),true);await h.settle();assert.equal(h.current.storageError,true);assert.equal(await h.current.changeWork({...h.current.work,settings:draft}),false);assert.equal((await read(store)).settings.fontScale,125);store.close();other.close();});
