import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {IDBFactory,forceCloseDatabase} from 'fake-indexeddb';
import {PreferencesStore} from '../../src/preferences-store.ts';
import {LocalWorkStore} from '../../src/local-adapter.ts';
import {emptyWork,savedWorkContract,type WorkState} from '../../upstream/lib/work-contract.ts';
import {workReferenceErrors} from '../../upstream/lib/work-updates.ts';
import {defaultSystemState} from '../../src/system-state.ts';
import {createBackupAdapter,BACKUP_LIMIT} from '../../src/backup-adapter.ts';
import {exportBackup} from '../../vendor/portable-kit/backup.mjs';
import {makeV4Validator} from '../../vendor/portable-kit/examples/v4-adapter.mjs';

const read=async(store:LocalWorkStore)=>{const response=await store.request('/api/state');assert.equal(response.status,200);return await response.json() as WorkState};
const write=(store:LocalWorkStore,state:WorkState)=>{const{updatedAt,...body}=state;return store.request('/api/state',{method:'PUT',body:JSON.stringify({...body,expectedUpdatedAt:updatedAt}),headers:{'X-Mesh-State-Version':'4'}})};
const completed=async(store:LocalWorkStore)=>{const state=await read(store);Object.assign(state.tasks[0],{status:'Erledigt',evidence:'Checked original content on 2026-10-04',reviewed:true});const response=await write(store,state);assert.equal(response.status,200);return await response.json() as WorkState};

for(const field of ['title','acceptance','evidence','owner','dependencies'] as const)test(`R2: changed reviewed task ${field} cannot retain its old review`,async()=>{
 const store=new LocalWorkStore({indexedDB:new IDBFactory(),name:crypto.randomUUID()});
 try{const before=await completed(store),next=structuredClone(before);
  if(field==='owner')next.tasks[0].owner=next.tasks[0].owner==='codex'?'manus':'codex';
  else if(field==='dependencies'){Object.assign(next.tasks[1],{status:'Erledigt',evidence:'Dependency checked',reviewed:true});next.tasks[0].dependencies=[next.tasks[1].id];}
  else next.tasks[0][field]+=' changed after review';
  const response=await write(store,next);assert.equal(response.status,400,'Changed reviewed content must be rejected atomically');assert.match((await response.json()).error,/Review|Gegenprüfung/);assert.deepEqual(await read(store),before);
 }finally{store.close()}
});
test('R2: editing and clearing review is permitted, but completion needs a separately saved review',async()=>{
 const store=new LocalWorkStore({indexedDB:new IDBFactory(),name:crypto.randomUUID()});try{
  const before=await completed(store),next=structuredClone(before);Object.assign(next.tasks[0],{title:'Newly revised task title',reviewed:false,status:'Review'});
  let response=await write(store,next);assert.equal(response.status,200);const changed=await response.json() as WorkState;assert.equal(changed.tasks[0].reviewed,false);
  changed.tasks[0].reviewed=true;changed.tasks[0].status='Erledigt';response=await write(store,changed);assert.equal(response.status,200);assert.equal((await read(store)).tasks[0].reviewed,true);
 }finally{store.close()}
});
test('R2: priority/archive changes do not invalidate an unchanged acceptance',async()=>{
 const store=new LocalWorkStore({indexedDB:new IDBFactory(),name:crypto.randomUUID()});try{const next=await completed(store);next.tasks[0].priority='P2';next.tasks[0].archived=true;const response=await write(store,next);assert.equal(response.status,200);assert.equal((await read(store)).tasks[0].reviewed,true)}finally{store.close()}
});
test('R2: a reviewed dependent cannot retain approval when its prerequisite changes',async()=>{
 const store=new LocalWorkStore({indexedDB:new IDBFactory(),name:crypto.randomUUID()});try{let before=await completed(store);Object.assign(before.tasks[1],{status:'Review',evidence:'Dependent review',reviewed:true,dependencies:[before.tasks[0].id]});let response=await write(store,before);assert.equal(response.status,200);before=await response.json();const next=structuredClone(before);Object.assign(next.tasks[0],{evidence:'Changed prerequisite',reviewed:false,status:'Review'});response=await write(store,next);assert.equal(response.status,400,'Dependent review must not survive changed evidence');assert.deepEqual(await read(store),before);next.tasks[1].reviewed=false;assert.equal((await write(store,next)).status,200)}finally{store.close()}
});

function trackedFactory(){const factory=new IDBFactory(),connections:IDBDatabase[]=[];const open=factory.open.bind(factory);factory.open=((...args:Parameters<IDBFactory['open']>)=>{const request=open(...args);request.addEventListener('success',()=>connections.push(request.result));return request}) as IDBFactory['open'];return{factory,connections}}
// fake-indexeddb's public declaration uses the constructor type, but its
// documented helper operates on the database instance returned by open().
const forceClose=(db:IDBDatabase)=>forceCloseDatabase(db as unknown as Parameters<typeof forceCloseDatabase>[0]);
test('R3: PreferencesStore reopens after unexpected close without losing revision, history or settings',async()=>{
 const{factory,connections}=trackedFactory(),store=new PreferencesStore({indexedDB:factory,name:crypto.randomUUID()});try{const first=await store.load();const saved=await store.save(first.revision,current=>({...current,surfaceLayout:'focus'}));forceClose(connections.at(-1)!);assert.deepEqual(await store.load(),saved);const next=await store.save(saved.revision,current=>({...current,surfaceLayout:'split'}));assert.equal(next.revision,saved.revision+1);assert.equal(next.value.surfaceLayout,'split');assert.equal(connections.length,2)}finally{store.close()}
});
test('R3: delayed old close cannot invalidate a newer PreferencesStore connection',async()=>{
 const{factory,connections}=trackedFactory(),store=new PreferencesStore({indexedDB:factory,name:crypto.randomUUID()});try{const saved=await store.load(),old=connections[0],oldClose=old.onclose;store.close();assert.deepEqual(await store.load(),saved);oldClose?.call(old,new Event('close'));assert.deepEqual(await store.load(),saved);assert.equal(connections.length,2,'Old connection event must not create a third connection')}finally{store.close()}
});
test('R3: reconnection still rejects stale writes from another session',async()=>{
 const{factory,connections}=trackedFactory(),name=crypto.randomUUID(),a=new PreferencesStore({indexedDB:factory,name}),b=new PreferencesStore({indexedDB:factory,name});try{const first=await a.load();await b.load();const latest=await b.save(first.revision,current=>({...current,surfaceLayout:'focus'}));forceClose(connections[0]);await assert.rejects(a.save(first.revision,current=>({...current,surfaceLayout:'split'})),/PREFERENCES_CONFLICT/);assert.deepEqual(await a.load(),latest)}finally{a.close();b.close()}
});
test('R3: immediate load after close during a successful save reconnects before the delayed close event',async()=>{
 const{factory,connections}=trackedFactory(),store=new PreferencesStore({indexedDB:factory,name:crypto.randomUUID()});try{const before=await store.load();let calls=0;const saved=await store.save(before.revision,current=>{calls++;forceClose(connections[0]);return{...current,surfaceLayout:'focus'}});assert.equal(calls,1);assert.deepEqual(await store.load(),saved);assert.equal(connections.length,2)}finally{store.close()}
});
test('R3: closed-connection save is not replayed and a later load recovers the committed data',async()=>{
 const{factory,connections}=trackedFactory(),store=new PreferencesStore({indexedDB:factory,name:crypto.randomUUID()});try{const before=await store.load();const saved=await store.save(before.revision,current=>{forceClose(connections[0]);return{...current,surfaceLayout:'focus'}});let calls=0;await assert.rejects(store.save(saved.revision,current=>{calls++;return{...current,surfaceLayout:'split'}}),error=>error instanceof Error&&error.name==='InvalidStateError');assert.equal(calls,0);assert.deepEqual(await store.load(),saved);assert.equal(calls,0)}finally{store.close()}
});

const catalog=JSON.parse(fs.readFileSync(new URL('../../upstream/lib/mesh-data.json',import.meta.url),'utf8'));
const metadata={exportedAt:'2026-10-04T00:00:00.000Z',producer:{name:'cue-command-mesh-system',version:'quality-fixture'},source:{revision:'3e921804b13e0d7c70d1ff15474f0387e84d70b6',workUpdatedAt:null}};
const options={validateWork:makeV4Validator({savedWorkContract,workReferenceErrors,knownSourceIds:catalog.sources.map((s:any)=>s.id)}),maxBytes:BACKUP_LIMIT};
for(const sources of [[null,{id:42,title:false}],[{id:'duplicate',title:'A'},{id:'duplicate',title:'B'}],[{id:'',title:'No ID'}],[{id:'valid',title:false}],[{id:'valid',status:false}],[{id:'valid',file:42}],[{id:'valid',description:null}]])test(`R4: validly hashed malformed source records are rejected: ${JSON.stringify(sources)}`,async()=>{
 const work=emptyWork(),system=defaultSystemState();const adapter=createBackupAdapter(catalog);const text=await exportBackup({work,data:{system,sourceCatalog:{...catalog,sources}}},metadata,options);await assert.rejects(adapter.preview(text,work,system),/source|Source|Quelle|catalog|Catalog|Katalog|Expected|expected|duplicate/i);
});
test('R4: full live catalog roundtrip retains every unrelated root field and every source field',async()=>{
 const work=emptyWork(),system=defaultSystemState(),adapter=createBackupAdapter(catalog);const text=await adapter.export(work,system,metadata.exportedAt);const preview=await adapter.preview(text,work,system);assert.deepEqual(preview.inspection.snapshot.data.sourceCatalog,catalog);assert.deepEqual(Object.keys(preview.inspection.snapshot.data.sourceCatalog).sort(),Object.keys(catalog).sort());assert.equal(preview.plan.targetState,'identical');assert.deepEqual(preview.plan.writes,[]);
});
test('R4: minimal legacy catalog source IDs and empty catalogs stay supported',async()=>{
 for(const sourceCatalog of [{sources:[]},{sources:[{id:'minimal-fixture'}],title:'fixture'}]){const work=emptyWork(),system=defaultSystemState(),adapter=createBackupAdapter(sourceCatalog);const text=await adapter.export(work,system,metadata.exportedAt);assert.deepEqual((await adapter.preview(text,work,system)).inspection.snapshot.data.sourceCatalog,sourceCatalog)}
});
function withSource(source:string){const work=emptyWork();work.rooms=[{id:crypto.randomUUID(),title:'Catalog reference',goal:'Check source catalog consistency',agent:'manus',project:'cue',mode:'DEEP',output:'Validation',sources:[source],status:'Aktiv',messages:[],createdAt:metadata.exportedAt}];return work}
test('R4: incoming source references must resolve in its own catalog, not the local catalog',async()=>{
 const work=withSource(catalog.sources[0].id),system=defaultSystemState();const text=await exportBackup({work,data:{system,sourceCatalog:{sources:[]}}},metadata,options);await assert.rejects(createBackupAdapter(catalog).preview(text,emptyWork(),system),/Quelle|source|Source|referen/i);
});
test('R4: valid older catalog and different current catalog are validated independently',async()=>{
 const old={sources:[{id:'historical-source',title:'Historical source'}]},system=defaultSystemState(),work=withSource('historical-source');const text=await createBackupAdapter(old).export(work,system,metadata.exportedAt);const preview=await createBackupAdapter(catalog).preview(text,withSource(catalog.sources[0].id),system);assert.equal(preview.includesSystemState,true);assert.equal(preview.restoreAvailable,false);assert.deepEqual(preview.plan.writes,[]);assert.equal(preview.plan.targetState,'different');
});
