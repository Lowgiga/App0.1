import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory,IDBObjectStore,forceCloseDatabase} from 'fake-indexeddb';
import {LocalWorkStore} from '../../src/local-adapter.ts';
import {emptyWork} from '../../upstream/lib/work-contract.ts';
import {PERSONAL_CONTINUATION_BYTES,personalContinuationContract} from '../../src/personal-continuation.ts';

const at='2026-10-05T12:00:00.000Z';
const composer={kind:'decision',text:'  My unfinished thought\n',origin:'manual',sourceId:null,editingEntryId:null};
const route='/api/personal-continuation';
const call=(store:LocalWorkStore,input:unknown,signal?:AbortSignal)=>store.request(route,{method:'POST',body:JSON.stringify(input),signal});
async function setup(){
 const options={indexedDB:new IDBFactory(),name:'continuation-'+crypto.randomUUID(),now:()=>new Date(at)};
 const store=new LocalWorkStore(options),work=emptyWork(),id=crypto.randomUUID(),otherId=crypto.randomUUID();
 work.rooms=[id,otherId].map((id,i)=>({id,title:'Project '+i,agent:'codex',project:'custom',mode:'DEEP',goal:'Local',output:'Local',sources:[],status:'Aktiv',messages:[],createdAt:at}));
 const {updatedAt,...state}=work;
 const saved=await store.request('/api/state',{method:'PUT',body:JSON.stringify({...state,expectedUpdatedAt:updatedAt})});
 assert.equal(saved.status,200);
 return {store,options,id,otherId,work:await saved.json(),identity:{contextId:id,contextCreatedAt:at}};
}
type Harness=Awaited<ReturnType<typeof setup>>;
const base=(h:Harness)=>({workUpdatedAt:h.work.updatedAt,memoryRevision:0,entryRevision:null});
const save=(h:Harness,extra={})=>call(h.store,{operation:'save-draft',...h.identity,expectedRevision:0,base:base(h),composer,...extra});
async function read(h:Harness,identity=h.identity){const r=await call(h.store,{operation:'read',...identity});assert.equal(r.status,200);return r.json()}
async function raw(h:Harness,key:string,value?:unknown,write=value!==undefined):Promise<any>{return new Promise((resolve,reject)=>{
 const r=h.options.indexedDB.open(h.options.name,1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{
  const db=r.result,tx=db.transaction('work',write?'readwrite':'readonly'),store=tx.objectStore('work');let output:unknown;
  const request=write?store.put(value,key):store.get(key);request.onsuccess=()=>{output=request.result};
  tx.oncomplete=()=>{db.close();resolve(output)};tx.onabort=()=>{db.close();reject(tx.error)};
 };
})}

test('local draft preserves exact unfinished text across reopening without changing work or memory',async()=>{
 const h=await setup();try{
  const before=await raw(h,'local-default');
  const response=await save(h);assert.equal(response.status,200);
  const first=await response.json();assert.equal(first.schema,'lowquantflow.personal-continuation-response/v1');assert.equal(first.draft.revision,1);assert.equal(first.draft.status,'active');assert.deepEqual(first.draft.composer,composer);assert.equal(first.memory.revision,0);
  h.store.close();h.store=new LocalWorkStore(h.options);
  assert.deepEqual(await read(h),first);assert.deepEqual(await raw(h,'local-default'),before);assert.equal(await raw(h,'project-memory-v1'),undefined);
 }finally{h.store.close()}
});

test('two tabs get one CAS winner and revisions remain monotonic through discard and new drafts',async()=>{
 const h=await setup(),other=new LocalWorkStore(h.options);try{
  const results=await Promise.all([save(h),save({...h,store:other},{composer:{...composer,text:'Other tab'}})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal((await call(h.store,{operation:'discard-draft',...h.identity,expectedRevision:0})).status,409);
  assert.equal((await call(h.store,{operation:'discard-draft',...h.identity,expectedRevision:1})).status,200);
  assert.equal((await read(h)).draft.status,'discarded');
  assert.equal((await save(h,{expectedRevision:2})).status,200);assert.equal((await read(h)).draft.revision,3);
 }finally{h.store.close();other.close()}
});

async function alterWork(h:Harness,change:(work:any)=>void){const {updatedAt,...work}=h.work;change(work);const response=await h.store.request('/api/state',{method:'PUT',body:JSON.stringify({...work,expectedUpdatedAt:updatedAt})});assert.equal(response.status,200);h.work=await response.json()}
test('autosave keeps stale base; only explicit rebase can authorize applying against a changed work snapshot',async()=>{
 const h=await setup();try{
  const original=base(h);await save(h);await alterWork(h,w=>{w.rooms[0].title='Renamed'});
  assert.equal((await save(h,{expectedRevision:1,base:base(h)})).status,409);
  assert.equal((await save(h,{expectedRevision:1,base:original,composer:{...composer,text:'Retained stale text'}})).status,200);
  assert.deepEqual((await read(h)).draft.base,original);
  assert.equal((await call(h.store,{operation:'apply-draft',...h.identity,expectedRevision:2})).status,409);
  const rebased=await call(h.store,{operation:'rebase-draft',...h.identity,expectedRevision:2,base:base(h)});assert.equal(rebased.status,200);
  assert.equal((await rebased.json()).draft.composer.text,'Retained stale text');
  assert.equal((await call(h.store,{operation:'apply-draft',...h.identity,expectedRevision:3})).status,200);
 }finally{h.store.close()}
});

test('explicit apply atomically creates one proposal and durable receipt makes a lost-response retry idempotent',async()=>{
 const h=await setup();try{
  const before=await raw(h,'local-default');await save(h);
  const apply={operation:'apply-draft',...h.identity,expectedRevision:1};
  const response=await call(h.store,apply);assert.equal(response.status,200);const applied=await response.json();
  assert.equal(applied.draft.status,'applied');assert.equal(applied.draft.revision,2);assert.equal(applied.memory.entries.length,1);assert.equal(applied.memory.entries[0].text,composer.text.trim());assert.equal(applied.memory.entries[0].status,'proposed');
  h.store.close();h.store=new LocalWorkStore(h.options);
  assert.deepEqual(await (await call(h.store,apply)).json(),applied);
  assert.equal((await call(h.store,{...apply,expectedRevision:2})).status,409);
  assert.deepEqual(await raw(h,'local-default'),before);
  await save(h,{expectedRevision:2,base:{...base(h),memoryRevision:1}});
  assert.equal((await call(h.store,apply)).status,409);assert.equal((await read(h)).memory.entries.length,1);
 }finally{h.store.close()}
});

const memoryCall=(h:Harness,body:unknown)=>h.store.request('/api/project-memory',{method:'POST',body:JSON.stringify(body)});
test('correction draft checks entry revision and leaves a confirmed decision unchanged until explicit confirmation',async()=>{
 const h=await setup();try{
  const proposal=await memoryCall(h,{operation:'propose',contextId:h.id,expectedRevision:0,expectedWorkUpdatedAt:h.work.updatedAt,kind:'decision',text:'Original',origin:'manual'});
  const entry=(await proposal.json()).entries[0];
  await memoryCall(h,{operation:'confirm',contextId:h.id,expectedRevision:1,expectedWorkUpdatedAt:h.work.updatedAt,entryId:entry.id});
  const good={...base(h),memoryRevision:2,entryRevision:2};
  const edit={...composer,text:'Proposed correction',editingEntryId:entry.id};
  assert.equal((await save(h,{base:{...good,entryRevision:1},composer:edit})).status,409);
  assert.equal((await save(h,{base:good,composer:edit})).status,200);
  const response=await call(h.store,{operation:'apply-draft',...h.identity,expectedRevision:1});assert.equal(response.status,200);
  const memory=(await response.json()).memory;assert.equal(memory.entries[0].status,'confirmed');assert.equal(memory.entries[0].text,'Original');assert.equal(memory.entries[1].status,'proposed');assert.equal(memory.entries[1].replaces,entry.id);
 }finally{h.store.close()}
});

test('changed memory and changed entry revisions block apply until explicit comparison and rebase',async()=>{
 const h=await setup();try{
  const response=await memoryCall(h,{operation:'propose',contextId:h.id,expectedRevision:0,expectedWorkUpdatedAt:h.work.updatedAt,kind:'decision',text:'Original',origin:'manual'});const entry=(await response.json()).entries[0];
  await save(h,{base:{...base(h),memoryRevision:1,entryRevision:1},composer:{...composer,editingEntryId:entry.id}});
  await memoryCall(h,{operation:'correct',contextId:h.id,expectedRevision:1,expectedWorkUpdatedAt:h.work.updatedAt,entryId:entry.id,text:'Other tab correction'});
  assert.equal((await call(h.store,{operation:'apply-draft',...h.identity,expectedRevision:1})).status,409);
  assert.equal((await call(h.store,{operation:'rebase-draft',...h.identity,expectedRevision:1,base:{...base(h),memoryRevision:2,entryRevision:1}})).status,409);
  assert.equal((await call(h.store,{operation:'rebase-draft',...h.identity,expectedRevision:1,base:{...base(h),memoryRevision:2,entryRevision:2}})).status,200);
 }finally{h.store.close()}
});

test('archived and replaced incarnations retain detached drafts but cannot apply or rebase them',async()=>{
 for(const change of ['archived','replaced'] as const){const h=await setup();try{
  const original=base(h);await save(h);
  await alterWork(h,w=>{if(change==='archived')w.rooms[0].status='Archiviert';else w.rooms[0].createdAt='2026-10-05T12:01:00.000Z'});
  const detached=await read(h);assert.equal(detached.contextStatus,change==='archived'?'archived':'missing');assert.equal(detached.draft.composer.text,composer.text);if(change==='replaced')assert.equal(detached.memory,null);
  for(const operation of ['apply-draft','rebase-draft'])assert.equal((await call(h.store,{operation,...h.identity,expectedRevision:1,...(operation==='rebase-draft'?{base:base(h)}:{})})).status,409);
  assert.equal((await save(h,{expectedRevision:1,base:original,composer:{...composer,text:'Rescued text'}})).status,200);
  assert.equal((await call(h.store,{operation:'discard-draft',...h.identity,expectedRevision:2})).status,200);
  assert.equal((await save(h,{expectedRevision:3})).status,409);
  if(change==='replaced')assert.equal((await read(h,{contextId:h.id,contextCreatedAt:'2026-10-05T12:01:00.000Z'})).draft,null);
 }finally{h.store.close()}}
});

test('read missing identity is non-mutating and cannot create a new orphan draft',async()=>{
 const h=await setup();try{const identity={contextId:crypto.randomUUID(),contextCreatedAt:at};const result=await read(h,identity);assert.equal(result.contextStatus,'missing');assert.equal(result.memory,null);assert.equal(result.draft,null);assert.equal((await save(h,identity)).status,409);assert.equal(await raw(h,'personal-continuation-v1'),undefined)}finally{h.store.close()}
});

test('last workpoint view is empty on read, persists with CAS and rejects archived, missing or foreign incarnation',async()=>{
 const h=await setup(),other=new LocalWorkStore(h.options);try{
  const initial={schema:'lowquantflow.personal-view/v1',revision:0,updatedAt:null,contextId:null,contextCreatedAt:null};
  assert.deepEqual(await (await call(h.store,{operation:'read-view'})).json(),initial);assert.equal(await raw(h,'personal-view-v1'),undefined);
  const before=await raw(h,'local-default');
  const results=await Promise.all([call(h.store,{operation:'remember',...h.identity,expectedRevision:0}),call(other,{operation:'remember',contextId:h.otherId,contextCreatedAt:at,expectedRevision:0})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const view=await (await call(h.store,{operation:'read-view'})).json();assert.equal(view.revision,1);
  assert.equal((await call(h.store,{operation:'remember',...h.identity,contextCreatedAt:'2025-01-01T00:00:00.000Z',expectedRevision:1})).status,409);
  assert.deepEqual(await raw(h,'local-default'),before);
  h.store.close();h.store=new LocalWorkStore(h.options);assert.deepEqual(await (await call(h.store,{operation:'read-view'})).json(),view);
  await alterWork(h,w=>{w.rooms[0].status='Archiviert'});assert.equal((await call(h.store,{operation:'remember',...h.identity,expectedRevision:1})).status,409);
 }finally{h.store.close();other.close()}
});

test('malformed methods, JSON, unsupported metadata and credential content cannot save',async()=>{
 const h=await setup();try{
  assert.equal((await h.store.request(route)).status,405);
  assert.equal((await h.store.request(route,{method:'POST',body:'{'})).status,400);
  assert.equal((await h.store.request(route,{method:'POST',body:'x'.repeat(32769)})).status,413);
  assert.equal((await h.store.request(route,{method:'POST',body:'{}',headers:{Authorization:'synthetic'}})).status,400);
  assert.equal((await save(h,{metadata:{network:true}})).status,400);
  assert.equal((await save(h,{composer:{...composer,text:'x'.repeat(2001)}})).status,400);
  assert.equal((await save(h,{composer:{...composer,text:'Authorization: Bearer SYNTHETIC_ONLY'}})).status,400);
  assert.equal((await read(h)).draft,null);
 }finally{h.store.close()}
});

test('empty draft is recoverable while explicit empty apply fails without destroying the draft',async()=>{
 const h=await setup();try{assert.equal((await save(h,{composer:{...composer,text:' \n '}})).status,200);assert.equal((await call(h.store,{operation:'apply-draft',...h.identity,expectedRevision:1})).status,400);assert.equal((await read(h)).draft.composer.text,' \n ')}finally{h.store.close()}
});

test('corrupt and future draft/view/memory storage fail closed without overwrite',async()=>{
 for(const [key,broken,code] of [
  ['personal-continuation-v1',{schema:'lowquantflow.personal-continuation/v1',records:'broken'},'CORRUPT_STORAGE'],
  ['personal-continuation-v1',{schema:'lowquantflow.personal-continuation/v9',records:[]},'UNSUPPORTED_VERSION'],
  ['personal-view-v1',{schema:'lowquantflow.personal-view/v1',revision:1},'CORRUPT_STORAGE'],
  ['personal-view-v1',{schema:'lowquantflow.personal-view/v9'},'UNSUPPORTED_VERSION'],
  ['project-memory-v1',{schema:'lowquantflow.project-memory-backup/v1',records:'broken'},'CORRUPT_STORAGE'],
 ] as const){const h=await setup();try{
  await raw(h,key,broken);const response=await call(h.store,{operation:key==='personal-view-v1'?'read-view':'read',...(key==='personal-view-v1'?{}:h.identity)});
  assert.equal(response.status,503);assert.equal((await response.json()).code,code);assert.equal((await save(h)).status,503);assert.deepEqual(await raw(h,key),broken);
 }finally{h.store.close()}}
});

test('offline draft operations never fetch, unavailable storage never reports saved, pre-abort does not write',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>{throw Error('NETWORK_FORBIDDEN')};const h=await setup();try{
  const controller=new AbortController();controller.abort();await assert.rejects(()=>call(h.store,{operation:'save-draft',...h.identity,expectedRevision:0,base:base(h),composer},controller.signal),{name:'AbortError'});
  assert.equal((await read(h)).draft,null);assert.equal((await save(h)).status,200);
  assert.equal((await call(new LocalWorkStore({indexedDB:null}),{operation:'read-view'})).status,503);
 }finally{globalThis.fetch=original;h.store.close()}
});

test('closing during database acquisition cannot create a draft under a replaced connection generation',async()=>{
 const h=await setup();try{
  h.store.close();h.store=new LocalWorkStore(h.options);
  const pending=save(h);h.store.close();const response=await pending;assert.equal(response.status,503);
  assert.equal((await read(h)).draft,null);
 }finally{h.store.close()}
});

test('stored undefined is corruption, not an absent default eligible for overwrite',async()=>{
 for(const key of ['local-default','project-memory-v1','personal-continuation-v1','personal-view-v1']){const h=await setup();try{
  await raw(h,key,undefined,true);const response=await save(h);assert.equal(response.status,503);assert.equal((await response.json()).code,'CORRUPT_STORAGE');
  assert.equal(await raw(h,key),undefined);
 }finally{h.store.close()}}
});

test('quota failure on draft receipt put rolls back an already queued memory put',async()=>{
 const h=await setup(),original=IDBObjectStore.prototype.put;try{
  await save(h);const before=await raw(h,'personal-continuation-v1');
  IDBObjectStore.prototype.put=function(value:any,key?:IDBValidKey){if(key==='personal-continuation-v1')throw new DOMException('Synthetic quota','QuotaExceededError');return original.call(this,value,key!)};
  const response=await call(h.store,{operation:'apply-draft',...h.identity,expectedRevision:1});assert.equal(response.status,507);assert.equal((await response.json()).code,'QUOTA_EXCEEDED');
  assert.equal(await raw(h,'project-memory-v1'),undefined);assert.deepEqual(await raw(h,'personal-continuation-v1'),before);
 }finally{IDBObjectStore.prototype.put=original;h.store.close()}
});

test('transaction abort after successful memory put cannot commit either memory or receipt',async()=>{
 const h=await setup(),original=IDBObjectStore.prototype.put;try{
  await save(h);const before=await raw(h,'personal-continuation-v1');
  IDBObjectStore.prototype.put=function(value:any,key?:IDBValidKey){const request=original.call(this,value,key!);if(key==='project-memory-v1')request.addEventListener('success',()=>this.transaction.abort());return request};
  assert.equal((await call(h.store,{operation:'apply-draft',...h.identity,expectedRevision:1})).status,503);
  assert.equal(await raw(h,'project-memory-v1'),undefined);assert.deepEqual(await raw(h,'personal-continuation-v1'),before);
 }finally{IDBObjectStore.prototype.put=original;h.store.close()}
});

test('signal abort after successful memory put rolls back both writes and reports AbortError',async()=>{
 const h=await setup(),original=IDBObjectStore.prototype.put;try{
  await save(h);const controller=new AbortController();
  IDBObjectStore.prototype.put=function(value:any,key?:IDBValidKey){const request=original.call(this,value,key!);if(key==='project-memory-v1')request.addEventListener('success',()=>controller.abort());return request};
  await assert.rejects(()=>call(h.store,{operation:'apply-draft',...h.identity,expectedRevision:1},controller.signal),{name:'AbortError'});
  assert.equal(await raw(h,'project-memory-v1'),undefined);assert.equal((await read(h)).draft.status,'active');
 }finally{IDBObjectStore.prototype.put=original;h.store.close()}
});

test('external claims retain selected source provenance and never confirm implicitly',async()=>{
 const h=await setup();try{
  assert.equal((await save(h,{composer:{...composer,origin:'external-claim',sourceId:'foreign'}})).status,400);
  h.store.close();h.store=new LocalWorkStore({...h.options,sources:['local-source']});await alterWork(h,w=>{w.rooms[0].sources=['local-source']});
  assert.equal((await save(h,{composer:{...composer,origin:'external-claim',sourceId:'local-source'}})).status,200);
  const response=await call(h.store,{operation:'apply-draft',...h.identity,expectedRevision:1});assert.equal(response.status,200);const entry=(await response.json()).memory.entries[0];assert.equal(entry.status,'external-claim');assert.equal(entry.origin.sourceId,'local-source');
 }finally{h.store.close()}
});

test('incomplete external-source selection is recoverable but cannot be applied',async()=>{
 const h=await setup();try{
  const incomplete={...composer,origin:'external-claim',sourceId:null};const response=await save(h,{composer:incomplete});assert.equal(response.status,200);assert.deepEqual((await response.json()).draft.composer,incomplete);
  assert.equal((await call(h.store,{operation:'apply-draft',...h.identity,expectedRevision:1})).status,400);assert.equal((await read(h)).draft.status,'active');assert.equal(await raw(h,'project-memory-v1'),undefined);
 }finally{h.store.close()}
});

test('unrelated personal records and supported legacy WorkState remain byte-equivalent',async()=>{
 const h=await setup();try{
  const before=await raw(h,'local-default');before.stateVersion=3;before.state.stateVersion=3;delete before.state.command;await raw(h,'local-default',before);
  const opaque={value:'Unrelated local preference',revision:7};await raw(h,'system-preferences-v1',opaque);await save(h);await call(h.store,{operation:'remember',...h.identity,expectedRevision:0});
  assert.deepEqual(await raw(h,'local-default'),before);assert.deepEqual(await raw(h,'system-preferences-v1'),opaque);
  const backup=await h.store.request('/api/project-memory/backup',{method:'POST',body:JSON.stringify({expectedWorkUpdatedAt:h.work.updatedAt})});assert.equal(backup.status,200);assert.deepEqual((await backup.json()).records,[]);
 }finally{h.store.close()}
});

test('future WorkState blocks draft/view requests without migration',async()=>{
 const h=await setup();try{const before=await raw(h,'local-default');before.stateVersion=9;await raw(h,'local-default',before);const response=await save(h);assert.equal(response.status,503);assert.equal((await response.json()).code,'UNSUPPORTED_VERSION');assert.deepEqual(await raw(h,'local-default'),before);assert.equal(await raw(h,'personal-continuation-v1'),undefined)}finally{h.store.close()}
});

test('backward wall clock does not lower draft or view update times',async()=>{
 const h=await setup();try{
  const first=await (await save(h)).json();const view=await (await call(h.store,{operation:'remember',...h.identity,expectedRevision:0})).json();
  h.store.close();h.store=new LocalWorkStore({...h.options,now:()=>new Date('2020-01-01T00:00:00.000Z')});
  const second=await (await save(h,{expectedRevision:1})).json();assert.ok(second.draft.updatedAt>first.draft.updatedAt);
  const nextView=await (await call(h.store,{operation:'remember',...h.identity,expectedRevision:1})).json();assert.ok(nextView.updatedAt>view.updatedAt);
 }finally{h.store.close()}
});

test('forced database closure cannot lose saved drafts and next read reacquires storage',async()=>{
 const h=await setup();try{await save(h);const db=await (h.store as any).opened;forceCloseDatabase(db);await new Promise(resolve=>setTimeout(resolve,0));assert.equal((await read(h)).draft.composer.text,composer.text)}finally{h.store.close()}
});

test('connection invalidation after successful memory put aborts before committing either record',async()=>{
 const h=await setup(),original=IDBObjectStore.prototype.put;try{
  await save(h);
  IDBObjectStore.prototype.put=function(value:any,key?:IDBValidKey){const request=original.call(this,value,key!);if(key==='project-memory-v1')request.addEventListener('success',()=>h.store.close());return request};
  assert.equal((await call(h.store,{operation:'apply-draft',...h.identity,expectedRevision:1})).status,503);
  assert.equal(await raw(h,'project-memory-v1'),undefined);assert.equal((await read(h)).draft.status,'active');
 }finally{IDBObjectStore.prototype.put=original;h.store.close()}
});

test('100 retained drafts block another project without eviction and existing discard remains available',async()=>{
 const h=await setup();try{
  await save(h);const initial=await raw(h,'personal-continuation-v1'),draft=initial.records[0];
  initial.records=[draft,...Array.from({length:99},()=>({...draft,contextId:crypto.randomUUID()}))];await raw(h,'personal-continuation-v1',initial);
  assert.equal((await save(h,{contextId:h.otherId})).status,400);assert.deepEqual(await raw(h,'personal-continuation-v1'),initial);
  assert.equal((await call(h.store,{operation:'discard-draft',...h.identity,expectedRevision:1})).status,200);assert.equal((await raw(h,'personal-continuation-v1')).records.length,100);
 }finally{h.store.close()}
});

test('512 KiB UTF-8 bound rejects the next draft without truncating earlier records',async()=>{
 const h=await setup();try{
  await save(h);const initial=await raw(h,'personal-continuation-v1'),draft={...initial.records[0],composer:{...composer,text:'界'.repeat(2000)}};
  const entries=[];let candidate:any;
  while(true){const next={...draft,contextId:crypto.randomUUID()};candidate={...initial,records:[...entries,next]};if(new TextEncoder().encode(JSON.stringify(candidate)).length>PERSONAL_CONTINUATION_BYTES)break;entries.push(next)}
  const full={...initial,records:entries};assert.equal(personalContinuationContract.safeParse(full).success,true);await raw(h,'personal-continuation-v1',full);
  assert.equal((await save(h,{composer:{...composer,text:'界'.repeat(2000)}})).status,400);assert.deepEqual(await raw(h,'personal-continuation-v1'),full);
 }finally{h.store.close()}
});

test('remember aborted during timestamp preparation reports AbortError and never writes the view',async()=>{
 const h=await setup();try{
  const controller=new AbortController();h.store.close();h.store=new LocalWorkStore({...h.options,now:()=>{controller.abort();return new Date(at)}});
  await assert.rejects(()=>call(h.store,{operation:'remember',...h.identity,expectedRevision:0},controller.signal),{name:'AbortError'});
  assert.equal(await raw(h,'personal-view-v1'),undefined);
 }finally{h.store.close()}
});
