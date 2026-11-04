import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {planTaskChange,taskChangeCandidate,type TaskChangePlan} from '../../src/task-change-preview.ts';
import {LocalWorkStore} from '../../src/local-adapter.ts';
import {emptyWork,savedWorkContract,type MeshTask,type WorkState} from '../../upstream/lib/work-contract.ts';
import {missionContract,approvalContract,eventContract,type Mission} from '../../upstream/lib/command-contract.ts';
import {workReferenceErrors,workChangeErrors} from '../../overlay/lib/work-updates.ts';

const at='2026-10-04T12:00:00.000Z',now=new Date('2026-10-04T13:00:00.000Z');
const sources=['source-a','source-b'] as const;
const uuid=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const clone=<T,>(value:T):T=>structuredClone(value);
const task=(id:string,dependencies:string[]=[],extra:Partial<MeshTask>={}):MeshTask=>({
 id,title:`Verified task ${id}`,category:'Funktion',priority:'P1',owner:'codex',status:'Erledigt',
 acceptance:'The local result matches the documented acceptance criteria',evidence:`Concrete checked result for ${id}`,reviewed:true,dependencies,archived:false,...extra,
});
function fixture():WorkState{
 const work=emptyWork();work.updatedAt=at;
 work.tasks=[task('precondition'),task('root',['precondition']),task('left',['root']),task('right',['root']),task('join',['left','right']),task('tail',['join']),task('open',['root'],{status:'Offen',reviewed:false,evidence:''}),task('unrelated')];
 work.rooms=[{id:uuid(20),title:'Project one',agent:'codex',project:'custom',mode:'DEEP',goal:'Keep the first project scoped',output:'Local verified result',sources:['source-a'],status:'Aktiv',messages:[],createdAt:at},{id:uuid(21),title:'Project two',agent:'manus',project:'custom',mode:'BUILD',goal:'Keep the second project scoped',output:'Separate local result',sources:['source-b'],status:'Aktiv',messages:[],createdAt:at}];
 const mission=(id:number,taskIds:string[],stage:'Done'|'Approved'|'Working',roomIndex:number)=>missionContract.parse({id:uuid(id),title:`Verified mission ${id}`,goal:'Produce a bounded local result',scope:'Only the named synthetic tasks',project:'custom',owner:'codex',reviewer:'junior',stage,priority:'P1',output:'Local checked report',taskIds,roomId:work.rooms[roomIndex].id,sourceIds:[work.rooms[roomIndex].sources[0]],evidence:'Independent review completed before this change',reviewed:stage!=='Working',checkpoint:'Keep this historical checkpoint',archived:false,createdAt:at});
 work.command.missions=[mission(30,['tail'],'Done',0),mission(31,['left'],'Approved',1),mission(32,['open'],'Working',1),mission(33,['unrelated'],'Done',1)];
 const approval=(id:number,missionId:string,status:'approved'|'denied'|'pending')=>approvalContract.parse({id:uuid(id),missionId,action:'Synthetic local approval',target:'No real external recipient',dataSummary:'Synthetic test data only',reason:'Document a historical decision',expectedResult:'Local approval remains unchanged',risk:'low',reversibility:'yes',impact:'No real external side effect',testEvidence:'Concrete prior test evidence',rollback:'Restore the prior local draft',createdAt:'2026-10-01T00:00:00.000Z',expiresAt:'2026-10-03T00:00:00.000Z',status,scope:'mission',decidedAt:status==='pending'?null:'2026-10-02T00:00:00.000Z',decisionNote:'Keep the exact historical decision',executed:false});
 work.command.approvals=[approval(40,uuid(30),'approved'),approval(41,uuid(31),'denied'),approval(42,uuid(33),'approved'),approval(43,uuid(32),'pending')];
 work.command.events=[eventContract.parse({id:uuid(50),sequence:8,at,origin:'app',entityId:'unrelated',kind:'task-updated',title:'Existing immutable app event',neuro_context:{taskStatus:'Erledigt',priority:'P1'}})];
 work.notes=[{id:uuid(60),text:'Keep unrelated project notes exactly',createdAt:at}];
 const parsed=savedWorkContract.parse(work);assert.deepEqual(workReferenceErrors(parsed,sources),[]);return parsed;
}
const getTask=(state:WorkState,id:string)=>{const value=state.tasks.find(t=>t.id===id);assert.ok(value,`Task ${id} exists`);return value};
const edit=(work:WorkState,fields:Partial<MeshTask>={title:'Changed root task title'}):MeshTask=>({...clone(getTask(work,'root')),...fields});
const sorted=(items:readonly string[])=>[...items].sort();
const semantic=(work:WorkState)=>{const value=clone(work);value.updatedAt=null;value.command.events=[];return value};
function deepFreeze<T>(value:T):T{if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))deepFreeze(child)}return value}
function validPath(path:string[],rootId:string,endpoint:string,work:WorkState){
 assert.ok(path.length>=1);assert.equal(path[0],rootId);assert.equal(path.at(-1),endpoint);assert.equal(new Set(path).size,path.length);
 for(let i=1;i<path.length;i++)assert.ok(getTask(work,path[i]).dependencies.includes(path[i-1]),`${path[i]} really depends on ${path[i-1]}`);
}
function safePlan(work:WorkState,draft:unknown):TaskChangePlan{
 const plan=planTaskChange(work,draft,sources,now);assert.deepEqual(plan.blockers,[]);assert.ok(plan.next);assert.equal(plan.version,1);assert.equal(plan.expectedUpdatedAt,work.updatedAt);assert.equal(plan.taskId,'root');
 assert.ok(savedWorkContract.safeParse(plan.next).success);assert.deepEqual(workChangeErrors(work,plan.next,now,sources),[]);return plan;
}
function assertDeclaredChanges(plan:TaskChangePlan,work:WorkState){
 assert.ok(plan.next);const changed=plan.next.tasks.flatMap(next=>{const before=getTask(work,next.id);const fields=(Object.keys(next) as (keyof MeshTask)[]).filter(key=>JSON.stringify(before[key])!==JSON.stringify(next[key]));return fields.length?[{taskId:next.id,fields:sorted(fields)}]:[]});
 assert.deepEqual(plan.changes.map(x=>({taskId:x.taskId,fields:sorted(x.fields)})).sort((a,b)=>a.taskId.localeCompare(b.taskId)),changed.sort((a,b)=>a.taskId.localeCompare(b.taskId)));
 assert.deepEqual(sorted(plan.unchangedTaskIds),sorted(work.tasks.filter(t=>!changed.some(x=>x.taskId===t.id)).map(t=>t.id)));
}

test('preview is deterministic and cannot mutate frozen current state, draft or known sources',()=>{
 const work=fixture(),draft=edit(work),before=clone(work),originalDraft=clone(draft),known=deepFreeze([...sources]);deepFreeze(work);deepFreeze(draft);
 const plan=planTaskChange(work,draft,known,now);assert.deepEqual(plan.blockers,[]);assert.ok(plan.next);assert.deepEqual(plan,planTaskChange(work,draft,known,new Date(now)));assert.deepEqual(work,before);assert.deepEqual(draft,originalDraft);assert.deepEqual(known,[...sources]);
 assert.deepEqual(plan.before,before);assert.deepEqual(plan.requested,originalDraft);assert.deepEqual(plan.next.command.events,before.command.events);assert.equal(plan.next.updatedAt,before.updatedAt);
});
test('preview snapshots do not alias subsequently edited inputs',()=>{
 const work=fixture(),draft=edit(work),plan=safePlan(work,draft),snapshot=clone(plan);work.notes[0].text='Later unrelated edit';draft.title='Later unsaved input';draft.dependencies.push('unrelated');
 assert.deepEqual(plan,snapshot);
});
test('content change clears own review and every reviewed descendant in a transitive diamond once',()=>{
 const work=fixture(),plan=safePlan(work,edit(work));assert.ok(plan.next);assert.equal(plan.needsConfirmation,true);
 for(const id of ['root','left','right','join','tail']){assert.equal(getTask(plan.next,id).reviewed,false,id);assert.equal(getTask(plan.next,id).status,'Review',id);assert.equal(getTask(plan.next,id).evidence,getTask(work,id).evidence)}
 assert.deepEqual(sorted(plan.affected.map(t=>t.taskId)),['join','left','open','right','tail']);
 assert.equal(new Set(plan.affected.map(x=>x.taskId)).size,plan.affected.length);
 for(const affected of plan.affected){validPath(affected.path,'root',affected.taskId,work);assert.equal(affected.reviewRequired,affected.taskId!=='open')}
 assert.equal(plan.affected.find(x=>x.taskId==='join')!.path.length,3);assert.equal(plan.affected.find(x=>x.taskId==='tail')!.path.length,4);
 assertDeclaredChanges(plan,work);
});
test('shared task affects both mission contexts while unrelated mission and historical approvals stay byte-for-byte unchanged',()=>{
 const work=fixture(),plan=safePlan(work,edit(work));assert.ok(plan.next);
 assert.deepEqual(sorted(plan.missions.map(m=>m.missionId)),sorted([uuid(30),uuid(31),uuid(32)]));assert.equal(new Set(plan.missions.map(m=>m.missionId)).size,plan.missions.length);
 for(const id of [30,31]){
  const mission:Mission=plan.next.command.missions.find(m=>m.id===uuid(id))!;
  assert.equal(mission.stage,'Review');assert.equal(mission.reviewed,false);
  const explanation=plan.missions.find(m=>m.missionId===mission.id)!;
  assert.equal(explanation.reviewRequired,true);assert.ok(mission.taskIds.includes(explanation.taskPath.at(-1)!));
  validPath(explanation.taskPath,'root',explanation.taskPath.at(-1)!,work);
 }
 assert.equal(plan.missions.find(m=>m.missionId===uuid(32))!.reviewRequired,false);
 for(const id of [32,33])assert.deepEqual(plan.next.command.missions.find(m=>m.id===uuid(id)),work.command.missions.find(m=>m.id===uuid(id)));
 assert.deepEqual(plan.next.command.approvals,work.command.approvals);assert.deepEqual(plan.next.command.interactions,work.command.interactions);assert.deepEqual(plan.next.rooms,work.rooms);assert.deepEqual(plan.next.notes,work.notes);assert.deepEqual(plan.next.settings,work.settings);assert.deepEqual(plan.next.profiles,work.profiles);assert.deepEqual(plan.next.learning,work.learning);assert.deepEqual(plan.next.checks,work.checks);
 for(const id of ['precondition','open','unrelated'])assert.deepEqual(getTask(plan.next,id),getTask(work,id));
});
for(const [field,value] of Object.entries({title:'A changed task title',acceptance:'Changed acceptance requires a fresh independent review',evidence:'Changed test evidence must be checked again',owner:'manus',dependencies:['precondition','unrelated']}))test(`review-relevant ${field} change cannot retain an old review even when draft asks to keep it`,()=>{
 const work=fixture(),draft=edit(work,{[field]:value} as Partial<MeshTask>),plan=safePlan(work,draft);assert.ok(plan.next);assert.equal(getTask(plan.next,'root').reviewed,false);assert.equal(getTask(plan.next,'root').status,'Review');assert.equal(getTask(plan.next,'tail').reviewed,false);assert.deepEqual(plan.next.command.approvals,work.command.approvals);assertDeclaredChanges(plan,work);
});
for(const [field,value] of Object.entries({priority:'P0',category:'Integration',archived:true}))test(`review-neutral ${field} change preserves task and mission reviews`,()=>{
 const work=fixture(),draft=edit(work,{[field]:value} as Partial<MeshTask>),plan=safePlan(work,draft);assert.ok(plan.next);assert.equal(plan.needsConfirmation,true);assert.deepEqual(getTask(plan.next,'root'),draft);assert.deepEqual(plan.affected,[]);assert.deepEqual(plan.missions,[]);assert.deepEqual(plan.next.command,work.command);
 for(const t of work.tasks.filter(t=>t.id!=='root'))assert.deepEqual(getTask(plan.next,t.id),t);assertDeclaredChanges(plan,work);
});
test('identical draft has no confirmation or collateral change',()=>{
 const work=fixture(),draft=clone(getTask(work,'root')),plan=safePlan(work,draft);assert.equal(plan.needsConfirmation,false);assert.deepEqual(plan.changes,[]);assert.deepEqual(plan.affected,[]);assert.deepEqual(plan.missions,[]);assert.deepEqual(plan.next,work);assertDeclaredChanges(plan,work);
});
test('explicit review withdrawal cascades to dependents and completed missions',()=>{
 const work=fixture(),plan=safePlan(work,edit(work,{status:'Review',reviewed:false}));assert.ok(plan.next);assert.equal(getTask(plan.next,'tail').reviewed,false);assert.equal(plan.next.command.missions.find(m=>m.id===uuid(30))!.stage,'Review');assertDeclaredChanges(plan,work);
});
test('already-unreviewed root content still invalidates an old dependent review',()=>{
 const work=fixture();work.command.missions=[];work.command.approvals=[];for(const t of work.tasks.filter(t=>t.id!=='precondition'&&t.id!=='unrelated'))t.status='Review';getTask(work,'root').reviewed=false;const plan=safePlan(work,edit(work));assert.ok(plan.next);assert.equal(getTask(plan.next,'left').reviewed,false);assert.equal(getTask(plan.next,'tail').reviewed,false);
});
test('removing a dependency uses old dependency paths to invalidate downstream reviews',()=>{
 const work=fixture(),draft=edit(work,{dependencies:[]}),plan=safePlan(work,draft);assert.ok(plan.next);assert.deepEqual(getTask(plan.next,'root').dependencies,[]);assert.equal(getTask(plan.next,'tail').reviewed,false);assert.deepEqual(getTask(plan.next,'precondition'),getTask(work,'precondition'));assertDeclaredChanges(plan,work);
});

const invalidDrafts:Array<[string,(w:WorkState)=>unknown]>=[
 ['null',()=>null],['undefined',()=>undefined],['array',()=>[]],['number',()=>7],['string',()=>'{"id":"root"}'],['partial',()=>({id:'root'})],
 ['unknown task',w=>({...edit(w),id:'missing'})],['invalid title',w=>edit(w,{title:'x'})],['unknown field',w=>({...edit(w),secret:'not-allowed'})],['invalid owner',w=>({...edit(w),owner:'foreign'})],
 ['orphan dependency',w=>edit(w,{dependencies:['missing']})],['duplicate dependencies',w=>edit(w,{dependencies:['precondition','precondition']})],['self cycle',w=>edit(w,{dependencies:['root']})],['indirect cycle',w=>edit(w,{dependencies:['tail']})],['non-string dependency',w=>({...edit(w),dependencies:[null]})],
];
for(const [label,make] of invalidDrafts)test(`invalid ${label} draft is blocked without a candidate or mutation`,()=>{
 const work=fixture(),draft=make(work),before=clone(work),draftBefore=clone(draft);let plan!:TaskChangePlan;assert.doesNotThrow(()=>{plan=planTaskChange(work,draft,sources,now)});assert.ok(plan.blockers.length>0);assert.ok(plan.blockers.every(x=>typeof x==='string'&&x.trim().length>0));assert.equal(plan.next,null);assert.equal(plan.needsConfirmation,false);assert.deepEqual(work,before);assert.deepEqual(draft,draftBefore);assert.throws(()=>taskChangeCandidate(plan,work,draft,sources,now));
});
for(const [label,corrupt] of [
 ['orphan task',(w:WorkState)=>{getTask(w,'unrelated').dependencies=['absent']}],
 ['existing cycle',(w:WorkState)=>{getTask(w,'precondition').dependencies=['tail']}],
 ['orphan mission',(w:WorkState)=>{w.command.missions[3].taskIds=['absent']}],
 ['missing source',(w:WorkState)=>{w.rooms[1].sources=['absent-source']}],
 ['duplicate task',(w:WorkState)=>{w.tasks.push(clone(w.tasks[0]))}],
 ] as const)test(`invalid existing ${label} state fails closed`,()=>{
 const work=fixture();corrupt(work);const before=clone(work);let plan!:TaskChangePlan;assert.doesNotThrow(()=>{plan=planTaskChange(work,edit(work),sources,now)});assert.ok(plan.blockers.length);assert.equal(plan.next,null);assert.deepEqual(work,before);
});

test('candidate exactly matches preview semantics and does not mutate plan or current state',()=>{
 const work=fixture(),draft=edit(work),plan=safePlan(work,draft),before=clone(work),planBefore=clone(plan);deepFreeze(plan);deepFreeze(work);deepFreeze(draft);
 const candidate=taskChangeCandidate(plan,work,draft,sources,new Date(now.getTime()+1000));assert.ok(plan.next);assert.deepEqual(semantic(candidate),semantic(plan.next));assert.deepEqual(candidate.command.events,work.command.events);assert.deepEqual(plan,planBefore);assert.deepEqual(work,before);assert.deepEqual(workChangeErrors(work,candidate,now,sources),[]);
});
test('candidate rejects revision drift and same-revision changes anywhere in current state',()=>{
 const work=fixture(),draft=edit(work),plan=safePlan(work,draft);
 const changes=[(w:WorkState)=>{w.updatedAt='2026-10-04T12:00:00.001Z'},(w:WorkState)=>{w.notes[0].text+=' later'},(w:WorkState)=>{getTask(w,'unrelated').priority='P0'},(w:WorkState)=>{w.command.approvals[0].decisionNote+=' forged'}];
 for(const change of changes){const current=clone(work);change(current);assert.throws(()=>taskChangeCandidate(plan,current,draft,sources,now));assert.deepEqual(plan.before,work)}
});
test('candidate rejects draft drift and known-source drift even when the changed source is unused',()=>{
 const work=fixture(),draft=edit(work),plan=safePlan(work,draft);assert.throws(()=>taskChangeCandidate(plan,work,{...draft,title:'Different unsaved title'},sources,now));assert.throws(()=>taskChangeCandidate(plan,work,draft,[...sources,'unrelated-extra-source'],now));assert.throws(()=>taskChangeCandidate(plan,work,draft,['source-a'],now));
});
for(const [label,mutate] of [
 ['version',(p:TaskChangePlan)=>{(p as any).version=2}],['expected revision',(p:TaskChangePlan)=>{p.expectedUpdatedAt=null}],['task identity',(p:TaskChangePlan)=>{p.taskId='unrelated'}],
 ['before snapshot',(p:TaskChangePlan)=>{p.before.notes[0].text+=' forged'}],['requested draft',(p:TaskChangePlan)=>{p.requested!.title+=' forged'}],['candidate',(p:TaskChangePlan)=>{p.next!.tasks[0].title+=' forged'}],
 ['change list',(p:TaskChangePlan)=>{p.changes=[]}],['affected paths',(p:TaskChangePlan)=>{p.affected[0].path=['unrelated']}],['mission impact',(p:TaskChangePlan)=>{p.missions=[]}],['unchanged list',(p:TaskChangePlan)=>{p.unchangedTaskIds=[]}],['confirmation',(p:TaskChangePlan)=>{p.needsConfirmation=false}],['blockers',(p:TaskChangePlan)=>{p.blockers=['forged blocker']}],
 ] as const)test(`candidate rejects tampered plan ${label}`,()=>{const work=fixture(),draft=edit(work),plan=clone(safePlan(work,draft));mutate(plan);assert.throws(()=>taskChangeCandidate(plan,work,draft,sources,now))});
test('candidate rejects absent, malformed or blocked plans rather than returning a fallback',()=>{
 const work=fixture(),draft=edit(work);for(const plan of [null,undefined,{},[],{version:1,next:work}] as unknown[])assert.throws(()=>taskChangeCandidate(plan as TaskChangePlan,work,draft,sources,now));const blocked=planTaskChange(work,edit(work,{dependencies:['root']}),sources,now);assert.throws(()=>taskChangeCandidate(blocked,work,draft,sources,now));
});

async function seed(factory:IDBFactory,name:string,state:WorkState){
 assert.ok(savedWorkContract.safeParse(state).success);assert.deepEqual(workReferenceErrors(state,sources),[]);
 await new Promise<void>((resolve,reject)=>{const request=factory.open(name,1);request.onupgradeneeded=()=>request.result.createObjectStore('work');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('work','readwrite');tx.objectStore('work').put({formatVersion:1,stateVersion:4,state},'local-default');tx.oncomplete=()=>{db.close();resolve()};tx.onabort=()=>{db.close();reject(tx.error)}}});
}
async function storeFixture(){const options={indexedDB:new IDBFactory(),name:'task-preview-'+crypto.randomUUID(),sources,now:()=>new Date(now)};await seed(options.indexedDB,options.name,fixture());return{store:new LocalWorkStore(options),options}}
const read=async(store:LocalWorkStore)=>{const r=await store.request('/api/state');assert.equal(r.status,200);return await r.json() as WorkState};
const put=(store:LocalWorkStore,state:WorkState,expectedUpdatedAt=state.updatedAt)=>{const{updatedAt,...body}=state;return store.request('/api/state',{method:'PUT',headers:{'X-Mesh-State-Version':'4'},body:JSON.stringify({...body,expectedUpdatedAt})})};
test('preview and candidate construction do not save or append app events',async()=>{
 const h=await storeFixture();try{const work=await read(h.store),draft=edit(work),plan=safePlan(work,draft);taskChangeCandidate(plan,work,draft,sources,now);assert.deepEqual(await read(h.store),work)}finally{h.store.close()}
});
test('one normal PUT atomically commits exactly previewed semantics plus canonical events and revision',async()=>{
 const h=await storeFixture();try{const before=await read(h.store),draft=edit(before),plan=safePlan(before,draft),candidate=taskChangeCandidate(plan,before,draft,sources,now);const response=await put(h.store,candidate,plan.expectedUpdatedAt);assert.equal(response.status,200,await response.clone().text());const actual=await response.json() as WorkState;assert.ok(plan.next);assert.deepEqual(semantic(actual),semantic(plan.next));assert.ok(actual.updatedAt!>before.updatedAt!);assert.deepEqual(actual.command.events.slice(0,before.command.events.length),before.command.events);
  const appended=actual.command.events.slice(before.command.events.length);assert.deepEqual(sorted(appended.filter(e=>e.kind==='task-updated').map(e=>e.entityId!)),sorted(plan.changes.map(c=>c.taskId)));assert.deepEqual(sorted(appended.filter(e=>e.kind==='mission-stage').map(e=>e.entityId!)),sorted([uuid(30),uuid(31)]));assert.equal(appended.length,plan.changes.length+2);assert.equal(new Set(actual.command.events.map(e=>e.id)).size,actual.command.events.length);assert.ok(appended.every((e,i)=>e.sequence===9+i&&e.origin==='app'));assert.deepEqual(actual.command.approvals,before.command.approvals);assert.deepEqual(await read(h.store),actual);
 }finally{h.store.close()}
});
test('two tabs with same revision produce exactly one successful atomic preview commit',async()=>{
 const h=await storeFixture(),other=new LocalWorkStore(h.options);try{const a=await read(h.store),b=await read(other);assert.deepEqual(a,b);const drafts=[edit(a,{title:'Tab A changed title'}),edit(b,{acceptance:'Tab B changed acceptance criteria'})],plans=drafts.map(d=>safePlan(a,d)),candidates=plans.map((p,i)=>taskChangeCandidate(p,a,drafts[i],sources,now));const responses=await Promise.all([put(h.store,candidates[0],plans[0].expectedUpdatedAt),put(other,candidates[1],plans[1].expectedUpdatedAt)]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);const winner=responses.findIndex(r=>r.status===200),loser=1-winner,actual=await read(h.store);assert.ok(plans[winner].next);assert.deepEqual(semantic(actual),semantic(plans[winner].next!));assert.deepEqual(await read(other),actual);assert.equal(actual.command.events.length,a.command.events.length+plans[winner].changes.length+2);assert.equal((await put(other,candidates[loser],plans[loser].expectedUpdatedAt)).status,409);assert.deepEqual(await read(h.store),actual);
 }finally{h.store.close();other.close()}
});
test('unrelated saved edit invalidates an old preview without overwriting either project',async()=>{
 const h=await storeFixture(),other=new LocalWorkStore(h.options);try{const before=await read(h.store),draft=edit(before),plan=safePlan(before,draft),candidate=taskChangeCandidate(plan,before,draft,sources,now),unrelated=clone(before);unrelated.notes[0].text='A newer note from the other tab';const saved=await put(other,unrelated);assert.equal(saved.status,200);const latest=await saved.json() as WorkState;assert.throws(()=>taskChangeCandidate(plan,latest,draft,sources,now));assert.equal((await put(h.store,candidate,plan.expectedUpdatedAt)).status,409);assert.deepEqual(await read(h.store),latest);assert.deepEqual(latest.tasks,before.tasks);
 }finally{h.store.close();other.close()}
});
test('normal store still rejects bypassing the cascade with stale retained reviews',async()=>{
 const h=await storeFixture();try{const before=await read(h.store),bypass=clone(before);getTask(bypass,'root').title='Changed without review withdrawal';const response=await put(h.store,bypass);assert.equal(response.status,400);assert.deepEqual(await read(h.store),before)}finally{h.store.close()}
});
test('legal historical app-event IDs cannot collide with deterministic preview sizing IDs',()=>{
 const work=fixture();work.command.events[0].id='ffffffff-ffff-4fff-8fff-000000000000';
 assert.ok(savedWorkContract.safeParse(work).success);
 const draft=edit(work),plan=safePlan(work,draft);assert.ok(plan.next);
 assert.deepEqual(plan.next.command.events,work.command.events);
 assert.deepEqual(taskChangeCandidate(plan,work,draft,sources,now).command.events,work.command.events);
});
