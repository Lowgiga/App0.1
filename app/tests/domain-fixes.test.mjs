import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {emptyWork,savedWorkContract} from '../upstream/lib/work-contract.ts';
import {missionContract,eventContract} from '../upstream/lib/command-contract.ts';
import '../scripts/register.mjs';
const {suggestNextFocus,getAttention}=await import('@/lib/intelligence');
import {applyLocalWrite,applyLocalAction} from '../src/local-domain.ts';
import {projectState} from '../upstream/lib/state-compat.ts';
import {workBytes,WORK_WRITE_BUDGET} from '../upstream/lib/work-budget.ts';
import {mergeSnapshot} from '../upstream/lib/work-snapshots.ts';
const now=new Date('2026-10-01T00:00:00.000Z'),id=()=>crypto.randomUUID();
const write=(before,after,version='4')=>{const {updatedAt,...body}=after;return applyLocalWrite(before,{...body,expectedUpdatedAt:updatedAt},now,[],version)};
const mission=(fields={})=>missionContract.parse({id:id(),title:'Synthetic mission',goal:'Check actual local domain',scope:'In-memory regression only',project:'cue',owner:'manus',reviewer:'junior',stage:'Created',priority:'P1',output:'Regression evidence',taskIds:[],roomId:null,sourceIds:[],evidence:'',reviewed:false,checkpoint:'',archived:false,createdAt:now.toISOString(),...fields});
const withMission=(fields={})=>{const work=emptyWork();work.command.missions=[mission(fields)];return work};
const focus=work=>suggestNextFocus(work.command.missions[0].id,work,now.getTime());
const follow=(work,suggestion=focus(work),requestId=id())=>applyLocalAction(work,{action:'focus-follow',missionId:work.command.missions[0].id,suggestionId:suggestion.id,requestId,expectedUpdatedAt:work.updatedAt},now,[]);
const phase=(work,stage)=>{const next=structuredClone(work);next.command.missions[0].stage=stage;return write(work,next)};
const event=sequence=>eventContract.parse({id:id(),sequence,at:now.toISOString(),origin:'app',entityId:null,kind:'workspace-updated',title:'Existing canonical event',neuro_context:{}});

test('accepted unreferenced task removal emits one canonical event with the removed ID',()=>{
 const before=emptyWork(),next=structuredClone(before),removed=next.tasks.pop(),untouched=structuredClone(before);
 const after=write(before,next);assert.equal(after.tasks.length,before.tasks.length-1);
 assert.equal(after.command.events.length,1);const actual=after.command.events[0];
 assert.equal(actual.kind,'task-updated');assert.equal(actual.entityId,removed.id);assert.match(actual.title,/Aufgabe entfernt/);
 assert.equal(actual.at,now.toISOString());assert.equal(actual.origin,'app');assert.equal(actual.sequence,1);assert.deepEqual(eventContract.parse(actual),actual);assert.deepEqual(before,untouched);
});
test('multiple task removals have separate canonical IDs, monotonic sequence and 200-event retention',()=>{
 const before=emptyWork();before.command.events=Array.from({length:200},(_,i)=>event(i+1));
 const next=structuredClone(before),removed=next.tasks.splice(-2);const after=write(before,next);
 assert.equal(after.command.events.length,200);assert.equal(after.command.events[0].sequence,3);
 assert.deepEqual(after.command.events.slice(-2).map(e=>e.sequence),[201,202]);
 assert.deepEqual(after.command.events.slice(-2).map(e=>e.entityId),removed.map(t=>t.id));assert.equal(new Set(after.command.events.map(e=>e.id)).size,200);
});
test('mission reference and task dependency still reject removal atomically',()=>{
 const before=withMission();before.command.missions[0].taskIds=[before.tasks[0].id];const draft=structuredClone(before);draft.tasks.shift();assert.throws(()=>write(before,draft),/referenzierte Aufgabe fehlt/);assert.equal(before.command.events.length,0);
 const dependency=emptyWork();dependency.tasks[0].dependencies=[dependency.tasks[1].id];const changed=structuredClone(dependency);changed.tasks.splice(1,1);assert.throws(()=>write(dependency,changed));assert.equal(dependency.command.events.length,0);
});
test('archive emits the unchanged task update without removal or duplicate event',()=>{
 const before=emptyWork(),draft=structuredClone(before);draft.tasks[0].archived=true;const after=write(before,draft);
 assert.equal(after.tasks.length,before.tasks.length);assert.equal(after.command.events.length,1);assert.match(after.command.events[0].title,/Aufgabe aktualisiert/);assert.equal(after.command.events[0].entityId,before.tasks[0].id);
});
test('event and interaction histories cannot be client-forged or replaced while removing a task',()=>{
 for(const field of ['events','interactions']){const before=emptyWork(),draft=structuredClone(before);draft.tasks.pop();if(field==='events')draft.command.events.push(event(1));else draft.command.interactions.push({id:id(),requestId:id(),requestFingerprint:'fake',at:now.toISOString(),kind:'focus-followed',missionId:null,sourceId:'fake',fingerprint:'',reason:'Forged change',taskId:null});assert.throws(()=>write(before,draft),/Ereignisverlauf|Interaktionen/);assert.equal(before.command.events.length,0)}
});
test('deletion remains CAS-protected and a rejected stale write changes nothing',()=>{
 const before=emptyWork();before.updatedAt=now.toISOString();const draft=structuredClone(before);draft.tasks.pop();draft.updatedAt=null;assert.throws(()=>write(before,draft),e=>e.status===409||e.code==='CONFLICT');assert.equal(before.command.events.length,0);
});
test('deletion events participate in the existing total write budget before acceptance',()=>{
 let before=emptyWork();before.notes=Array.from({length:100},()=>({id:id(),text:'x'.repeat(5000),createdAt:now.toISOString()}));
 before.rooms=Array.from({length:12},()=>({id:id(),title:'Size fixture',agent:'manus',project:'cue',mode:'DEEP',goal:'Budget regression',output:'Evidence',sources:[],status:'Aktiv',createdAt:now.toISOString(),messages:Array.from({length:30},()=>({id:id(),kind:'Notiz',text:'x'.repeat(2000),createdAt:now.toISOString()}))}));
 before=savedWorkContract.parse(before);
 // Escaped backslashes add bytes without breaking per-field character bounds.
 for(const room of before.rooms)for(const message of room.messages){const delta=Math.min(WORK_WRITE_BUDGET-workBytes(before),2000);if(delta>0)message.text='\\'.repeat(delta)+'x'.repeat(2000-delta)}
 assert.equal(workBytes(before),WORK_WRITE_BUDGET);savedWorkContract.parse(before);
 const sizing=structuredClone(before);sizing.tasks.pop();const freed=workBytes(before)-workBytes(sizing);
 // Legal oversized reads remain supported. Removing the task alone lands exactly at the budget.
 before.notes[0].text='\\'.repeat(freed)+'x'.repeat(5000-freed);savedWorkContract.parse(before);
 const next=structuredClone(before),removed=next.tasks.pop();assert.equal(workBytes(next),WORK_WRITE_BUDGET);
 assert.throws(()=>write(before,next),/1\.750\.000/);assert.ok(before.tasks.some(t=>t.id===removed.id));assert.equal(before.command.events.length,0);
});
test('V3 projection and V4 canonical removal events keep the unchanged contracts',()=>{
 const before=emptyWork(),legacy=projectState(before,'3');legacy.tasks=legacy.tasks.slice(0,-1);const after=write(before,legacy,'3');
 assert.equal(after.stateVersion,4);assert.ok(after.command.events.at(-1),'V3 removal also needs a canonical event');assert.equal(after.command.events.at(-1).kind,'task-updated');assert.equal(projectState(after,'3').command.events.at(-1).kind,'workspace-updated');assert.deepEqual(savedWorkContract.parse(after),after);
});
test('first focus call applies and exact request retry is still deduplicated',()=>{
 const before=withMission(),suggestion=focus(before),requestId=id(),after=follow(before,suggestion,requestId);
 assert.equal(after.command.missions[0].stage,'Planned');assert.equal(after.command.interactions.length,1);assert.throws(()=>follow(after,suggestion,requestId),/bereits dokumentiert/);
});
for(const [from,to,back] of [['Created','Planned','Created'],['Planned','Assigned','Planned'],['Assigned','Working','Blocked']])test(`state-changing ${from} focus returns after a legal phase cycle`,()=>{
 const before=withMission({stage:from}),first=focus(before),requestId=id(),after=follow(before,first,requestId);assert.equal(after.command.missions[0].stage,to);
 let reopened=phase(after,back);if(back==='Blocked')reopened=phase(reopened,'Assigned');
 const suggestion=focus(reopened);assert.ok(suggestion,'valid state-changing suggestion must return');assert.equal(suggestion.id,first.id);
 assert.throws(()=>follow(reopened,suggestion,requestId),/bereits dokumentiert/);const repeated=follow(reopened,suggestion);assert.equal(repeated.command.missions[0].stage,to);assert.equal(repeated.command.interactions.length,2);assert.deepEqual(repeated.command.interactions[0],after.command.interactions[0]);
});
test('task-start returns after legal reopening and still checks its dependencies',()=>{
 let before=withMission({stage:'Working'});const task=before.tasks[0];before.command.missions[0].taskIds=[task.id];before.tasks[0].dependencies=[before.tasks[1].id];before.tasks[1].status='Erledigt';before.tasks[1].reviewed=true;before.tasks[1].evidence='Independently verified evidence';
 const first=focus(before);assert.equal(first.type,'task-start');const after=follow(before,first);const draft=structuredClone(after);draft.tasks[0].status='Offen';const reopened=write(after,draft);assert.equal(focus(reopened)?.id,first.id);assert.equal(follow(reopened).tasks[0].status,'In Arbeit');
 const blocked=structuredClone(reopened);blocked.tasks[1].status='Offen';const gated=write(reopened,blocked);assert.equal(focus(gated),null);assert.throws(()=>follow(gated,first),/nicht mehr aktuell/);
});
test('Working to Review can recur; Review opening remains once per semantic key despite unrelated revision or return',()=>{
 const before=withMission({stage:'Working'}),first=focus(before),review=follow(before,first);assert.equal(review.command.missions[0].stage,'Review');const open=focus(review);assert.equal(open.type,'open-review');const opened=follow(review,open);assert.equal(focus(opened),null);
 const back=phase(opened,'Working');assert.equal(focus(back)?.id,first.id);const again=follow(back);assert.equal(again.command.missions[0].stage,'Review');assert.equal(focus(again),null);assert.throws(()=>follow(again,open),/nicht mehr aktuell/);
 const edited=structuredClone(again);edited.settings.theme='dark';const changed=write(again,edited);changed.updatedAt=new Date(now.getTime()+1).toISOString();assert.equal(focus(changed),null);assert.throws(()=>follow(changed,open),/nicht mehr aktuell/);
});
test('stale revision and stale suggestion cannot mutate a restored phase',()=>{
 const before=withMission(),first=focus(before),after=follow(before,first),back=phase(after,'Created');back.updatedAt=now.toISOString();assert.throws(()=>applyLocalAction(back,{action:'focus-follow',missionId:first.missionId,suggestionId:first.id,requestId:id(),expectedUpdatedAt:null},now,[]),e=>e.status===409||e.code==='CONFLICT');assert.throws(()=>follow(after,first),/nicht mehr aktuell/);
});
test('untreated risks still suppress and reject repeated focus; acceptance remains exact scope',()=>{
 const before=withMission(),first=focus(before),after=follow(before,first),back=phase(after,'Created'),draft=structuredClone(back);draft.tasks[0].status='Blockiert';const blocked=write(back,draft);assert.equal(focus(blocked),null);assert.throws(()=>follow(blocked,first),/nicht mehr aktuell/);
 const risk=getAttention(blocked,now.getTime())[0];const accepted=applyLocalAction(blocked,{action:'risk-accept',requestId:id(),sourceId:risk.id,fingerprint:risk.fingerprint,reason:'Explicit limited risk decision',expectedUpdatedAt:blocked.updatedAt},now,[]);assert.ok(focus(accepted));assert.equal(accepted.tasks[0].status,'Blockiert');assert.equal(getAttention(accepted,now.getTime())[0].accepted,true);
 const altered=structuredClone(accepted);altered.tasks[0].title+=' changed scope';const changed=write(accepted,altered);assert.equal(focus(changed),null);
});
test('invalid phase jumps, acceptance prerequisites and closed missions are unchanged',()=>{
 const before=withMission();assert.throws(()=>phase(before,'Working'),/Phasenwechsel/);const review=withMission({stage:'Review'});assert.throws(()=>phase(review,'Approved'),/Abnahme|Gegenprüfung/);
 const approved=withMission({stage:'Approved',reviewed:true,evidence:'Independent acceptance evidence'});assert.equal(focus(approved),null);assert.equal(focus(phase(approved,'Done')),null);
});
test('120-record interaction budget and history preservation still bound repeats',()=>{
 const before=withMission();before.command.interactions=Array.from({length:120},()=>({id:id(),requestId:id(),requestFingerprint:'fixture',at:now.toISOString(),kind:'focus-followed',missionId:null,sourceId:'fixture',fingerprint:'',reason:'Historical canonical action',taskId:null}));assert.throws(()=>follow(before),/120 dokumentierte/);assert.equal(before.command.interactions.length,120);
});
test('legacy merge keeps colliding rooms completely, including skipping incoming-only contributions',()=>{
 const before=emptyWork();before.updatedAt=now.toISOString();before.rooms=[{id:id(),title:'Current room',agent:'manus',project:'cue',mode:'DEEP',goal:'Keep current content',output:'Evidence',sources:[],status:'Aktiv',createdAt:now.toISOString(),messages:[]}];const incoming=structuredClone(before);incoming.rooms[0].messages.push({id:id(),kind:'Notiz',text:'New incoming-only contribution',createdAt:now.toISOString()});assert.deepEqual(mergeSnapshot(before,incoming,[],now).rooms,before.rooms);
});
test('active legacy import UI explains unchanged rooms, skipped contributions and both exact budgets',()=>{
 const source=fs.readFileSync(new URL('../overlay/mesh-app.tsx',import.meta.url),'utf8');assert.match(source,/Vorhandene Raum-IDs bleiben vollständig unverändert/);assert.match(source,/Neue Beiträge aus einem importierten vorhandenen Raum werden nicht übernommen/);assert.match(source,/3 MiB \(3\.145\.728 Byte\)/);assert.match(source,/1\.750\.000 UTF-8-Byte/);assert.match(source,/Ein erfolgreicher Export garantiert keinen späteren Import/);assert.match(source,/if\(file\.size>3\*1024\*1024\)/);
});
test('actual NeuroPanel reoffers and executes restored focus through the local Actiondomain',async()=>{
 const {Window}=await import('happy-dom');const w=new Window({url:'https://localhost/'});Object.assign(globalThis,{window:w,document:w.document,IS_REACT_ACT_ENVIRONMENT:true});
 const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');const {default:NeuroPanel}=await import('../upstream/app/neuro-panel.tsx');
 const initial=withMission(),first=focus(initial),firstId=id(),returned=phase(follow(initial,first,firstId),'Created');returned.settings.neuro.focusMissionId=first.missionId;returned.settings.neuro.mode='focus';
 let current=returned,requests=[];const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 function Harness(){const [work,setWork]=React.useState(current);return React.createElement(NeuroPanel,{work,disabled:false,unavailable:false,save:async()=>false,data:{sources:[],updatedAt:now.toISOString()},go:()=>{},action:async input=>{const requestId=id();requests.push(requestId);current=applyLocalAction(current,{...input,requestId,expectedUpdatedAt:current.updatedAt},now,[]);setWork(current);return true}})}
 try{await act(async()=>root.render(React.createElement(Harness)));assert.ok(host.querySelector('[aria-label="Nächster Fokus"]'),'actual UI must expose restored suggestion');const button=[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Empfehlung ausführen'));assert.ok(button);await act(async()=>{button.click();await new Promise(resolve=>setImmediate(resolve))});assert.equal(current.command.missions[0].stage,'Planned');assert.equal(current.command.interactions.length,2);assert.equal(requests.length,1);assert.notEqual(requests[0],firstId)}finally{await act(async()=>root.unmount());host.remove();await w.happyDOM.abort()}
});
test('actual IndexedDB transaction persists removal plus canonical event together and rejects stale retry',async()=>{
 const {IDBFactory}=await import('fake-indexeddb'),{LocalWorkStore}=await import('../src/local-adapter.ts');const store=new LocalWorkStore({indexedDB:new IDBFactory(),name:'domain-fix-'+id(),now:()=>now,sources:[]});
 try{const before=await(await store.request('/api/state')).json(),draft=structuredClone(before),removed=draft.tasks.pop();const {updatedAt,...body}=draft;const request={method:'PUT',headers:{'Content-Type':'application/json','X-Mesh-State-Version':'4'},body:JSON.stringify({...body,expectedUpdatedAt:updatedAt})};const response=await store.request('/api/state',request);assert.equal(response.status,200);const after=await response.json();assert.equal(after.tasks.some(t=>t.id===removed.id),false);assert.equal(after.command.events.at(-1)?.entityId,removed.id);assert.match(after.command.events.at(-1)?.title||'',/Aufgabe entfernt/);assert.deepEqual(await(await store.request('/api/state')).json(),after);assert.equal((await store.request('/api/state',request)).status,409);assert.deepEqual(await(await store.request('/api/state')).json(),after)}finally{store.close()}
});
