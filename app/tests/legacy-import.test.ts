import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory, IDBObjectStore} from 'fake-indexeddb';
import {LocalWorkStore} from '../src/local-adapter.ts';
import {emptyWork, type WorkState} from '../upstream/lib/work-contract.ts';
import {missionContract,approvalContract} from '../upstream/lib/command-contract.ts';
import {workBytes,WORK_WRITE_BUDGET} from '../upstream/lib/work-budget.ts';
const now=new Date('2026-10-04T01:00:00.000Z');
const id=()=>crypto.randomUUID();
const room=(title='Room')=>({id:id(),title,agent:'manus' as const,project:'cue' as const,mode:'DEEP' as const,goal:'Synthetic import proof',output:'Proof',sources:[],status:'Aktiv' as const,createdAt:now.toISOString(),messages:[{id:id(),kind:'Notiz' as const,text:'Incoming 😀 contribution',createdAt:now.toISOString()}]});
const text=(work:WorkState)=>JSON.stringify({schemaVersion:4,work});
const setup=()=>{const options={indexedDB:new IDBFactory(),name:'import-'+id(),now:()=>new Date(now),sources:[]};return {options,store:new LocalWorkStore(options)}};
const read=async(store:LocalWorkStore)=>{const r=await store.request('/api/state');assert.equal(r.status,200);return r.json()};
const write=(store:LocalWorkStore,state:WorkState)=>{const{updatedAt,...body}=state;return store.request('/api/state',{method:'PUT',body:JSON.stringify({...body,expectedUpdatedAt:updatedAt})})};
const preview=(store:LocalWorkStore,raw:string,signal?:AbortSignal)=>store.request('/api/imports/preview',{method:'POST',body:raw,signal});
const commit=(store:LocalWorkStore,planId:string,signal?:AbortSignal)=>store.request('/api/imports/commit',{method:'POST',body:JSON.stringify({planId}),signal});
async function checkedPreview(store:LocalWorkStore,raw:string){const r=await preview(store,raw);assert.equal(r.status,200,JSON.stringify(await r.clone().json()));return r.json()}

test('preview reads only; room-ID-wins receipt counts match exact committed target',async()=>{
 const{store,options}=setup();const initial=emptyWork();initial.rooms=[room('Existing')];assert.equal((await write(store,initial)).status,200);const before=await read(store);const incoming=emptyWork();incoming.rooms=[{...before.rooms[0],title:'Must not replace',messages:[...before.rooms[0].messages,{...room().messages[0],text:'New but skipped'}]},room('Fresh')];incoming.settings.theme='dark';
 const p=await checkedPreview(store,text(incoming));assert.equal(p.summary.newRooms,1);assert.equal(p.summary.retainedRooms,1);assert.equal(p.summary.importedPosts,1);assert.equal(p.summary.skippedPosts,2);assert.equal(p.summary.duplicatePosts,1);assert.deepEqual(await read(store),before);assert.equal(p.inputBytes,new TextEncoder().encode(text(incoming)).length);assert.equal(p.remainingBytes,WORK_WRITE_BUDGET-p.targetBytes);
 const r=await commit(store,p.planId);assert.equal(r.status,200);const result=await r.json();assert.equal(workBytes(result.state),p.targetBytes);assert.deepEqual(result.receipt,p);assert.equal(JSON.stringify(result.state.rooms.find((x:any)=>x.id===before.rooms[0].id)),JSON.stringify(before.rooms[0]));assert.deepEqual(result.state.settings,before.settings);store.close();const reopened=new LocalWorkStore(options);assert.deepEqual(await read(reopened),result.state);reopened.close();
});
test('old or reused confirmation cannot overwrite intervening edits or reward twice',async()=>{
 const{store}=setup();const incoming=emptyWork();incoming.rooms=[room()];let p=await checkedPreview(store,text(incoming));let state=await read(store);state.settings.theme='dark';assert.equal((await write(store,state)).status,200);const changed=await read(store);assert.equal((await commit(store,p.planId)).status,409);assert.deepEqual(await read(store),changed);
 p=await checkedPreview(store,text(incoming));const [a,b]=await Promise.all([commit(store,p.planId),commit(store,p.planId)]);assert.deepEqual([a.status,b.status].sort(),[200,409]);const once=await read(store);const again=await checkedPreview(store,text(incoming));assert.equal(again.summary.newRooms,0);assert.equal(again.summary.importedPosts,0);assert.equal((await commit(store,again.planId)).status,200);const twice=await read(store);assert.deepEqual(twice.command.events,once.command.events);assert.deepEqual(twice.rooms,once.rooms);store.close();
});
test('new preview invalidates prior file and aborted requests do not write',async()=>{
 const{store}=setup();const p=await checkedPreview(store,text(emptyWork()));await checkedPreview(store,text({...emptyWork(),rooms:[room()]}));assert.equal((await commit(store,p.planId)).status,409);const controller=new AbortController();controller.abort();await assert.rejects(preview(store,text(emptyWork()),controller.signal),{name:'AbortError'});await assert.rejects(commit(store,p.planId,controller.signal),{name:'AbortError'});assert.deepEqual(await read(store),emptyWork());store.close();
});
test('malformed, duplicate IDs and orphan references reject all input without writes',async()=>{
 const{store}=setup();const before=await read(store);for(const raw of ['{','{}',text({...emptyWork(),rooms:[room(),{...room(),sources:['unknown-source']}]}),(()=>{const x=emptyWork(),r=room();x.rooms=[r,r];return text(x)})()]){const r=await preview(store,raw);assert.equal(r.status,400);assert.ok((await r.json()).error);assert.deepEqual(await read(store),before)}store.close();
});
test('input byte limit below, at and above 3 MiB is independent of target size',async()=>{
 const{store}=setup(),raw=text({...emptyWork(),rooms:[room('Unicode 😀')]});for(const n of [3*1024*1024-1,3*1024*1024]){const padded=raw+' '.repeat(n-new TextEncoder().encode(raw).length);const p=await checkedPreview(store,padded);assert.equal(p.inputBytes,n);assert.ok(p.targetBytes<WORK_WRITE_BUDGET)}const r=await preview(store,raw+' '.repeat(3*1024*1024+1-new TextEncoder().encode(raw).length));assert.equal(r.status,413);assert.deepEqual(await read(store),emptyWork());store.close();
});
function dense(){const work=emptyWork();work.notes=Array.from({length:100},()=>({id:id(),text:'😀'.repeat(2499),createdAt:now.toISOString()}));work.rooms=Array.from({length:7},()=>({...room(),messages:Array.from({length:30},()=>({...room().messages[0],text:'😀'.repeat(990)}))}));return work}
test('actual transformed UTF-8 target below, at, above budget includes events and final revision',async()=>{
 const{store}=setup();const incoming=dense();let p=await checkedPreview(store,text(incoming));let excess=p.targetBytes-WORK_WRITE_BUDGET;for(const r of incoming.rooms){for(const m of r.messages){if(excess<=0)break;const remove=Math.min(m.text.length/2-1,Math.ceil(excess/4));m.text=m.text.slice(0,m.text.length-remove*2);excess-=remove*4;}}incoming.rooms[6].messages[29].text=incoming.rooms[6].messages[29].text.slice(0,-2);p=await checkedPreview(store,text(incoming));incoming.rooms[6].messages[29].text+='x'.repeat(WORK_WRITE_BUDGET-p.targetBytes);p=await checkedPreview(store,text(incoming));assert.equal(p.targetBytes,WORK_WRITE_BUDGET);assert.equal(p.canCommit,true);assert.equal(p.remainingBytes,0);incoming.rooms[6].messages[29].text+='x';const over=await checkedPreview(store,text(incoming));assert.equal(over.targetBytes,WORK_WRITE_BUDGET+1);assert.equal(over.canCommit,false);assert.equal(over.remainingBytes,-1);assert.equal((await commit(store,over.planId)).status,400);assert.deepEqual(await read(store),emptyWork());incoming.rooms[6].messages[29].text=incoming.rooms[6].messages[29].text.slice(0,-2);const below=await checkedPreview(store,text(incoming));assert.equal(below.targetBytes,WORK_WRITE_BUDGET-1);assert.equal(below.canCommit,true);incoming.rooms[6].messages[29].text+='x';p=await checkedPreview(store,text(incoming));const r=await commit(store,p.planId);assert.equal(r.status,200);assert.equal(workBytes((await r.json()).state),WORK_WRITE_BUDGET);store.close();
});
test('storage write failure preserves original state and consumes confirmation',async()=>{
 const{store}=setup();const before=await read(store),p=await checkedPreview(store,text({...emptyWork(),rooms:[room()]}));const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('full','QuotaExceededError')};try{const r=await commit(store,p.planId);assert.equal(r.status,507);assert.match((await r.json()).error,/Keine Änderung/)}finally{IDBObjectStore.prototype.put=put}assert.deepEqual(await read(store),before);assert.equal((await commit(store,p.planId)).status,409);store.close();
});
test('new missions and approvals reset review; long prefixed checkpoints reject without truncation',async()=>{
 const{store}=setup(),incoming=emptyWork();incoming.command.missions=[missionContract.parse({id:id(),title:'Synthetic mission',goal:'A bounded synthetic goal',scope:'Local test scope',project:'cue',owner:'manus',reviewer:'junior',stage:'Approved',priority:'P1',output:'Verified output',taskIds:[],roomId:null,sourceIds:[],evidence:'A sufficiently clear test evidence',reviewed:true,checkpoint:'checkpoint',archived:false,createdAt:now.toISOString()})];incoming.command.approvals=[approvalContract.parse({id:id(),missionId:incoming.command.missions[0].id,action:'Local test action',target:'Local test target',dataSummary:'Synthetic input only',reason:'Verify reset behavior',expectedResult:'No automatic authority',risk:'low',reversibility:'yes',impact:'Local test only',testEvidence:'The evidence was tested',rollback:'Keep old state',createdAt:now.toISOString(),expiresAt:'2026-10-05T01:00:00.000Z',status:'approved',scope:'once',decidedAt:now.toISOString(),decisionNote:'Approved then',executed:false})];const p=await checkedPreview(store,text(incoming));assert.equal(p.summary.resetMissions,1);assert.equal(p.summary.resetApprovals,1);assert.equal((await commit(store,p.planId)).status,200);const saved=await read(store);assert.equal(saved.command.missions[0].stage,'Created');assert.equal(saved.command.missions[0].reviewed,false);assert.equal(saved.command.approvals[0].status,'pending');assert.equal(saved.command.approvals[0].decidedAt,null);const long=structuredClone(incoming);long.command.missions[0].id=id();long.command.missions[0].checkpoint='x'.repeat(3000);long.command.approvals=[];const r=await preview(store,text(long));assert.equal(r.status,400);assert.match((await r.json()).error,/Checkpoint|gekürzt/);assert.deepEqual(await read(store),saved);store.close();
});

test('planner is pure and deterministic with supplied time and event IDs',async()=>{
 const{planLegacyImport}=await import('../src/legacy-import.ts');const before=emptyWork(),incoming={...emptyWork(),rooms:[room()]};const snapshot=JSON.stringify({before,incoming});const ids=Array.from({length:200},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);const a=planLegacyImport(before,text(incoming),[],now,'plan',ids),b=planLegacyImport(before,text(incoming),[],now,'plan',ids);assert.deepEqual(a,b);assert.equal(JSON.stringify({before,incoming}),snapshot);assert.equal(a.preview.targetBytes,workBytes(a.state));assert.notEqual(a.state.updatedAt,null);
});
test('approval preview cannot commit after its proposed expiry; fresh confirmation is needed',async()=>{
 let clock=new Date(now);const store=new LocalWorkStore({indexedDB:new IDBFactory(),name:id(),now:()=>clock});const incoming=emptyWork();incoming.command.approvals=[approvalContract.parse({id:id(),missionId:null,action:'Local test action',target:'Local test target',dataSummary:'Synthetic input only',reason:'Verify clock behavior',expectedResult:'Fresh approval request',risk:'low',reversibility:'yes',impact:'Local test only',testEvidence:'',rollback:'',createdAt:now.toISOString(),expiresAt:'2026-10-05T01:00:00.000Z',status:'pending',scope:'once',decidedAt:null,decisionNote:'',executed:false})];const p=await checkedPreview(store,text(incoming));clock=new Date('2026-10-06T01:00:00.000Z');assert.equal((await commit(store,p.planId)).status,409);assert.deepEqual(await read(store),emptyWork());store.close();
});

test('V1 omitted task defaults are explained as templates, never claimed as file records',async()=>{
 const{store}=setup();const raw=JSON.stringify({schemaVersion:1,work:{checks:{},notes:[],updatedAt:null}});let p=await checkedPreview(store,raw);assert.equal(p.summary.importedTasks,0);assert.equal(p.summary.duplicateRecords,0);assert.equal(p.summary.defaultedTasks,emptyWork().tasks.length);assert.equal((await write(store,emptyWork())).status,200);p=await checkedPreview(store,raw);assert.equal(p.summary.importedTasks,0);assert.equal(p.summary.duplicateRecords,0);assert.equal(p.summary.defaultedTasks,emptyWork().tasks.length);store.close();
});
test('orphan references inside retained rooms reject the whole file before any merge',async()=>{
 const{store}=setup(),initial=emptyWork();initial.rooms=[room('Existing')];assert.equal((await write(store,initial)).status,200);const before=await read(store),incoming=emptyWork();incoming.rooms=[{...before.rooms[0],sources:['does-not-exist']},room('Fresh')];const r=await preview(store,text(incoming));assert.equal(r.status,400);assert.match((await r.json()).error,/Quelle|Referenz/);assert.deepEqual(await read(store),before);store.close();
});

test('delayed confirmation preserves the exact planned revision and canonical event time',async()=>{
 let clock=new Date(now);const store=new LocalWorkStore({indexedDB:new IDBFactory(),name:id(),now:()=>new Date(clock)});
 try{
  const incoming={...emptyWork(),rooms:[room()]};const p=await checkedPreview(store,text(incoming));
  clock=new Date(now.getTime()+5*60*1000);
  const response=await commit(store,p.planId);assert.equal(response.status,200);
  const result=await response.json();assert.deepEqual(result.receipt,p);assert.equal(result.state.updatedAt,now.toISOString());
  assert.equal(workBytes(result.state),p.targetBytes);assert.ok(result.state.command.events.length>0);
  assert.ok(result.state.command.events.every((event:any)=>event.at===now.toISOString()));
  assert.deepEqual(await read(store),result.state);
  const next=structuredClone(result.state);next.settings.theme='dark';assert.equal((await write(store,next)).status,200);
  const after=await read(store);assert.equal(after.updatedAt,clock.toISOString());
  assert.equal(after.command.events.at(-1).at,clock.toISOString());
 }finally{store.close()}
});
