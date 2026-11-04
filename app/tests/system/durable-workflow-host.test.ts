import test from 'node:test';
import assert from 'node:assert/strict';

test('durable local workflows expose an explicit restart-safe host',async()=>{
 const module=await import('../../src/studio/durable-workflow-host.ts').catch(()=>({createDurableWorkflowHost:undefined}));
 assert.equal(typeof module.createDurableWorkflowHost,'function','restart-safe workflow host is missing');
});

import {emptyWork} from '../../upstream/lib/work-contract.ts';
import {createDurableWorkflowHost} from '../../src/studio/durable-workflow-host.ts';
function lockManager(){let held=false;return {async request(_name:string,_options:any,fn:any){if(held)return fn(null);held=true;try{return await fn({name:_name,mode:'exclusive'})}finally{held=false}}} as unknown as LockManager}
function memoryJournal(){let record:any=null;return {async load(){return structuredClone(record)},async save(expected:number|null,value:any){if((record?.revision??null)!==expected)throw new Error('WORKFLOW_JOURNAL_CONFLICT');record={revision:(expected??0)+1,value:structuredClone(value)};return structuredClone(record)},close(){}}}

test('reopening a paused workflow reads without executing and resumes only remaining steps',async()=>{
 const store=memoryJournal(),locks=lockManager(),work=emptyWork();
 const a=await createDurableWorkflowHost({store,locks});
 const paused=await a.start(work,[],'all',{pauseAfterStep:true});
 assert.equal(paused.state,'paused');assert.equal(paused.completedCount,1);assert.equal(a.selfTestsRun(),1);
 a.dispose();
 const b=await createDurableWorkflowHost({store,locks});
 const view=await b.load(work,[]);assert.equal(view?.state,'paused');assert.equal(view?.recoverable,true);assert.equal(b.selfTestsRun(),0);
 const result=await b.resume(work,[]);assert.equal(result.state,'completed');assert.equal(result.completedCount,4);assert.equal(result.id,paused.id);assert.deepEqual(result.outputs[0],paused.outputs[0]);assert.equal(b.selfTestsRun(),3);
 assert.equal((await store.load()).value.checkpoint.state,'completed');b.dispose();
});
test('missing exclusive-lock support blocks execution while preserving read-only results',async()=>{
 const store=memoryJournal(),host=await createDurableWorkflowHost({store,locks:null});
 assert.equal(host.available,false);assert.equal(await host.load(emptyWork(),[]),null);
 await assert.rejects(host.start(emptyWork(),[],'all'),/LOCKS_UNAVAILABLE/);assert.equal(await store.load(),null);host.dispose();
});
test('a stale snapshot cannot resume or silently replace an unfinished workflow',async()=>{
 const store=memoryJournal(),locks=lockManager(),work=emptyWork(),host=await createDurableWorkflowHost({store,locks});
 await host.start(work,[],'all',{pauseAfterStep:true});const before=await store.load();
 const changed=structuredClone(work);changed.tasks[0].title+=' changed';
 assert.equal((await host.load(changed,[]))?.stale,true);
 await assert.rejects(host.resume(changed,[]),/SNAPSHOT_CHANGED/);
 await assert.rejects(host.start(changed,[],'all'),/RECOVERY_REQUIRED/);
 assert.deepEqual(await store.load(),before);
 const stopped=await host.stopSaved();assert.equal(stopped.state,'aborted');
 await assert.rejects(host.resume(work,[]),/CHECKPOINT_TERMINAL/);host.dispose();
});

import {IDBFactory} from 'fake-indexeddb';
import {WorkflowJournalStore} from '../../src/studio/workflow-journal.ts';
import {hashJson} from '../../vendor/local-workflows/src/data.mjs';
function persistent(){const db=new IDBFactory(),name='recovery-'+crypto.randomUUID();return ()=>new WorkflowJournalStore({indexedDB:db,name})}

for(const fault of [{write:1,after:true,confirmed:0,ran:0},{write:2,after:true,confirmed:0,ran:0},{write:3,after:false,confirmed:0,ran:1},{write:3,after:true,confirmed:1,ran:1}]){
 test(`crash at write ${fault.write} (${fault.after?'after commit':'before commit'}) preserves confirmed results and requires explicit recovery`,async()=>{
  const makeStore=persistent(),base=makeStore(),locks=lockManager(),work=emptyWork();let writes=0;
  const failing={load:()=>base.load(),close:()=>base.close(),async save(revision:number|null,value:any){const target=++writes===fault.write;if(target&&!fault.after)throw new Error('SIMULATED_PROCESS_LOSS');const saved=await base.save(revision,value);if(target)throw new Error('SIMULATED_PROCESS_LOSS');return saved}};
  const first=await createDurableWorkflowHost({store:failing,locks});
  await assert.rejects(first.start(work,[],'all'),/SIMULATED_PROCESS_LOSS/);assert.equal(first.selfTestsRun(),fault.ran);first.dispose();
  const reopened=await createDurableWorkflowHost({store:makeStore(),locks});
  const view=await reopened.load(work,[]);assert.equal(view?.state,'interrupted');assert.equal(view?.completedCount,fault.confirmed);assert.equal(reopened.selfTestsRun(),0);
  const complete=await reopened.resume(work,[]);assert.equal(complete.state,'completed');assert.equal(complete.completedCount,4);assert.equal(reopened.selfTestsRun(),4-fault.confirmed);reopened.dispose();
 });
}
test('two tabs and duplicate clicks cannot run the same journal concurrently',async()=>{
 const store=memoryJournal(),locks=lockManager(),work=emptyWork();
 const a=await createDurableWorkflowHost({store,locks}),b=await createDurableWorkflowHost({store,locks});
 const pending=a.start(work,[],'all');await assert.rejects(a.start(work,[],'all'),/CONCURRENT_RUN/);await assert.rejects(b.start(work,[],'all'),/LOCK_BUSY/);
 assert.equal((await pending).state,'completed');assert.equal(a.selfTestsRun(),4);assert.equal(b.selfTestsRun(),0);a.dispose();b.dispose();
});
test('fresh snapshot is checked between steps and a change stops remaining work',async()=>{
 const store=memoryJournal(),locks=lockManager(),work=emptyWork(),host=await createDurableWorkflowHost({store,locks});let current=work,changed=false;
 host.subscribe(()=>{if(!changed&&host.events().some((event:any)=>event.type==='step-completed')){changed=true;current=structuredClone(work);current.tasks[0].title+=' changed'}});
 const result=await host.start(work,[],'all',{getSnapshot:()=>({work:current,sources:[]})});
 assert.equal(result.state,'failed');assert.equal(result.code,'SNAPSHOT_CHANGED');assert.equal(result.completedCount,1);assert.equal(host.selfTestsRun(),1);host.dispose();
});
test('pause and emergency stop are persisted and stop cannot be weakened by pause',async()=>{
 const makeStore=persistent(),locks=lockManager(),work=emptyWork(),host=await createDurableWorkflowHost({store:makeStore(),locks});let requested=false;
 host.subscribe(()=>{if(!requested&&host.events().some((event:any)=>event.type==='step-started')){requested=true;assert.equal(host.abort(),true);assert.equal(host.pause(),true)}});
 const result=await host.start(work,[],'all');assert.equal(result.state,'aborted');assert.equal(result.completedCount,0);host.dispose();
 const reopened=await createDurableWorkflowHost({store:makeStore(),locks});assert.equal((await reopened.load(work,[]))?.state,'aborted');await assert.rejects(reopened.resume(work,[]),/CHECKPOINT_TERMINAL/);assert.equal(reopened.selfTestsRun(),0);reopened.dispose();
});
test('one continuation retains the 1000ms deadline rather than resetting per step',async()=>{
 const store=memoryJournal(),locks=lockManager(),work=emptyWork();let time=0;
 const host=await createDurableWorkflowHost({store,locks,now:()=>time});host.subscribe(()=>{if(host.events().some((event:any)=>event.type==='step-completed'))time=1000});
 const result=await host.start(work,[],'all');assert.equal(result.state,'budget-exhausted');assert.equal(result.code,'TIME_BUDGET');assert.equal(result.completedCount,1);assert.equal(host.selfTestsRun(),1);host.dispose();
});
test('a changed catalogue version remains readable and can be explicitly stopped then replanned',async()=>{
 const store=memoryJournal(),locks=lockManager(),work=emptyWork(),first=await createDurableWorkflowHost({store,locks});
 await first.start(work,[],'all',{pauseAfterStep:true});first.dispose();
 const old=await store.load(),value=old.value;value.spec.steps[0].version='99.0.0';value.checkpoint.completed[0].version='99.0.0';value.checkpoint.revisionHash=await hashJson(value.spec);await store.save(old.revision,value);
 const host=await createDurableWorkflowHost({store,locks});const view=await host.load(work,[]);assert.equal(view?.recoverable,false);assert.equal(view?.stale,true);assert.match(view?.reason??'',/Skillversion/);
 await host.stopSaved();const result=await host.start(work,[],'mission-check');assert.equal(result.state,'completed');host.dispose();
});
test('stale review cannot accidentally resume a different run created in another tab',async()=>{
 const store=memoryJournal(),locks=lockManager(),work=emptyWork(),a=await createDurableWorkflowHost({store,locks}),b=await createDurableWorkflowHost({store,locks});
 await a.start(work,[],'all',{pauseAfterStep:true});await b.load(work,[]);await a.stopSaved();await a.start(work,[],'all',{pauseAfterStep:true});
 await assert.rejects(b.resume(work,[]),/STALE_VIEW/);assert.equal(b.selfTestsRun(),0);a.dispose();b.dispose();
});

test('the durable host keeps every edge of the existing valid dense work graph',async()=>{
 const {fixture}=await import('../../vendor/mesh-extensions/tests/fixture.ts');
 const {readFileSync}=await import('node:fs');const data=JSON.parse(readFileSync(new URL('../../upstream/lib/mesh-data.json',import.meta.url),'utf8'));
 const work=emptyWork();work.tasks=Array.from({length:60},(_,i)=>({...work.tasks[0],id:'task'+i,title:'Valid task '+i,dependencies:Array.from({length:Math.min(i,12)},(_,j)=>'task'+j)}));
 const prototype=fixture().command.missions[0];work.command.missions=Array.from({length:30},(_,i)=>({...prototype,id:crypto.randomUUID(),title:'Valid mission '+i,taskIds:work.tasks.slice(0,20).map(x=>x.id),sourceIds:data.sources.map((s:any)=>s.id),roomId:null}));
 const {workflowInputs}=await import('../../src/studio/workflow-runtime.ts');const expected=workflowInputs(work,data.sources)['graph-explain'].edges.length;
 const makeStore=persistent(),host=await createDurableWorkflowHost({store:makeStore(),locks:lockManager()});
 let result=await host.start(work,data.sources,'all',{pauseAfterStep:true});
 while(result.state==='paused'||result.state==='budget-exhausted')result=await host.resume(work,data.sources,{pauseAfterStep:true});
 assert.equal(result.state,'completed');assert.equal(result.outputs.filter((out:any)=>'edgeCount' in out.output).reduce((n:number,out:any)=>n+out.output.edgeCount,0),expected);host.dispose();
});

test('version drift never skips stored spec, input or output hash verification',async()=>{
 const store=memoryJournal(),locks=lockManager(),work=emptyWork(),host=await createDurableWorkflowHost({store,locks});await host.start(work,[],'all',{pauseAfterStep:true});
 const record=await store.load(),value=record.value;value.spec.steps[0].version='99.0.0';value.checkpoint.completed[0].version='99.0.0';value.checkpoint.revisionHash=await hashJson(value.spec);value.checkpoint.completed[0].output.title='unverified result';await store.save(record.revision,value);
 await assert.rejects(host.load(work,[]),/CHECKPOINT_CORRUPT/);const persisted=await store.load();await assert.rejects(host.stopSaved());assert.deepEqual(await store.load(),persisted);host.dispose();
});
test('recovered limits remain authoritative when a stored spec has a smaller elapsed budget',async()=>{
 const store=memoryJournal(),locks=lockManager(),work=emptyWork(),a=await createDurableWorkflowHost({store,locks});await a.start(work,[],'all',{pauseAfterStep:true});a.dispose();
 const record=await store.load(),value=record.value;value.spec.limits.maxElapsedMs=1;value.checkpoint.revisionHash=await hashJson(value.spec);await store.save(record.revision,value);
 let time=0;const b=await createDurableWorkflowHost({store,locks,now:()=>time++});await b.load(work,[]);const result=await b.resume(work,[]);assert.equal(result.state,'budget-exhausted');assert.equal(b.selfTestsRun(),0);b.dispose();
});

test('terminal events close controls before publishing a stable persisted outcome',async()=>{
 const store=memoryJournal(),host=await createDurableWorkflowHost({store,locks:lockManager()});let invoked=false,accepted:unknown;
 host.subscribe(()=>{if(!invoked&&host.events().some((event:any)=>event.type==='pipeline-completed')){invoked=true;accepted=host.abort()}});
 const result=await host.start(emptyWork(),[],'mission-check');assert.equal(accepted,false);assert.equal(result.state,(await store.load()).value.checkpoint.state);assert.equal(result.state,'completed');host.dispose();
});
test('repeated pause and stop observers cannot queue an unbounded series of control writes',async()=>{
 const store=memoryJournal(),host=await createDurableWorkflowHost({store,locks:lockManager()});let calls=0;
 host.subscribe(()=>{if(host.events().some((event:any)=>event.type==='step-started')&&calls++<12)host.abort()});
 const result=await host.start(emptyWork(),[],'all');assert.equal(result.state,'aborted');assert.ok((await store.load()).revision<=5,'repeated request should not create repeated writes');host.dispose();
});

for(const [time,code] of [[1000,'TIME_BUDGET'],[Number.NaN,'CLOCK_INVALID'],[-1,'CLOCK_INVALID']] as const){
 test(`final durable commit rechecks the clock (${code}, ${time}) without losing results`,async()=>{
  const base=memoryJournal();let clock=0;const store={...base,async save(revision:number|null,value:any){const saved=await base.save(revision,value);if(value.checkpoint.state==='completed')clock=time;return saved}};
  const host=await createDurableWorkflowHost({store,locks:lockManager(),now:()=>clock});
  const result=await host.start(emptyWork(),[],'mission-check');assert.equal(result.code,code);assert.equal(result.state,code==='TIME_BUDGET'?'budget-exhausted':'failed');assert.equal(result.completedCount,1);assert.equal((await store.load()).value.checkpoint.state,result.state);host.dispose();
 });
}

for(const fault of ['missing-write','wrong-revision','wrong-value'] as const){
 test(`an untrustworthy final save acknowledgement (${fault}) cannot claim durable success`,async()=>{
  const base=memoryJournal();let failed=false;
  const store={...base,async save(revision:number|null,value:any){
   if(value.checkpoint.state==='completed'&&!failed){failed=true;if(fault==='missing-write')return {revision:(revision??0)+1,value:structuredClone(value)};
    const saved=await base.save(revision,value);if(fault==='wrong-revision')return {...saved,revision:saved.revision+1};const changed=structuredClone(saved);changed.value.checkpoint.state='paused';return changed}
   return base.save(revision,value);
  }};
  const host=await createDurableWorkflowHost({store,locks:lockManager()});await assert.rejects(host.start(emptyWork(),[],'mission-check'),/STORE_CORRUPT/);assert.equal(failed,true);const record=await base.load();assert.equal(record.value.checkpoint.state,fault==='missing-write'?'running':'completed');host.dispose();
 });
}

for(const lateFailure of [false,true]){
 test(`late pause-to-stop escalation drains all control commits before reporting (${lateFailure?'write failure':'success'})`,async()=>{
  const base=memoryJournal();let writes=0,notify!:()=>void,release!:()=>void,requested=false;
  const reached=new Promise<void>(resolve=>notify=resolve),barrier=new Promise<void>(resolve=>release=resolve);
  const store={...base,async save(revision:number|null,value:any){const n=++writes;if(n===5){notify();await barrier}if(n===6&&lateFailure)throw new Error('LATE_ABORT_WRITE_FAILED');return base.save(revision,value)}};
  const host=await createDurableWorkflowHost({store,locks:lockManager()});
  host.subscribe(()=>{if(!requested&&host.events().some((event:any)=>event.type==='checkpoint-saved'&&event.revision===4&&event.state==='paused')){requested=true;host.pause()}});
  const pending=host.start(emptyWork(),[],'all',{pauseAfterStep:true});await reached;assert.equal(host.abort(),true);release();
  if(lateFailure)await assert.rejects(pending,/LATE_ABORT_WRITE_FAILED/);else{const result=await pending;assert.equal(result.state,'aborted');assert.equal(result.state,(await base.load()).value.checkpoint.state)}host.dispose();
 });
}

// Newly reconstructed regression definitions, 2026-10-04.
// Append after the preserved 27-case host test intermediate.
// Derived from the preserved review repros and requirements; not asserted to be
// the lost original test bytes. Current execution is required before approval.

test('real journal instances share exclusion and disposal keeps the lock through confirmed pause',async()=>{
 const makeStore=persistent(),base=makeStore(),other=makeStore(),work=emptyWork();
 let held=false,closed=false,blocked=false,notify!:()=>void,release!:()=>void;
 const reached=new Promise<void>(resolve=>notify=resolve),barrier=new Promise<void>(resolve=>release=resolve);
 const locks={async request(name:string,options:any,callback:any){
  assert.equal(options.mode,'exclusive');assert.equal(options.ifAvailable,true);
  if(held)return callback(null);held=true;
  try{return await callback({name,mode:'exclusive'})}finally{held=false}
 }} as unknown as LockManager;
 const store={load:()=>base.load(),close(){assert.equal(held,false);closed=true;base.close()},async save(expected:number|null,value:any){
  assert.equal(held,true);
  if(!blocked&&value.pendingStepId===null&&value.checkpoint.completed.length===1&&value.checkpoint.state==='running'){blocked=true;notify();await barrier}
  assert.equal(closed,false);return base.save(expected,value);
 }};
 const first=await createDurableWorkflowHost({store,locks}),second=await createDurableWorkflowHost({store:other,locks});
 const pending=first.start(work,[],'all');await reached;first.dispose();
 assert.equal(held,true);assert.equal(closed,false);
 await assert.rejects(second.start(work,[],'all'),/LOCK_BUSY/);assert.equal(second.selfTestsRun(),0);
 release();const result=await pending;
 assert.equal(result.state,'paused');assert.equal(held,false);assert.equal(closed,true);assert.equal(first.selfTestsRun(),1);
 const view=await second.load(work,[]);assert.equal(view?.state,'paused');assert.equal(view?.completedCount,result.completedCount);assert.equal(second.selfTestsRun(),0);
 second.dispose();
});

test('a lost terminal IndexedDB response remains completed after reopening without execution',async()=>{
 const makeStore=persistent(),base=makeStore(),locks=lockManager(),work=emptyWork();
 const failing={load:()=>base.load(),close:()=>base.close(),async save(expected:number|null,value:any){
  const saved=await base.save(expected,value);if(value.checkpoint.state==='completed')throw new Error('TERMINAL_RESPONSE_LOSS');return saved;
 }};
 const first=await createDurableWorkflowHost({store:failing,locks});
 await assert.rejects(first.start(work,[],'mission-check'),/TERMINAL_RESPONSE_LOSS/);assert.equal(first.selfTestsRun(),1);first.dispose();
 const reopened=await createDurableWorkflowHost({store:makeStore(),locks});
 const view=await reopened.load(work,[]);assert.equal(view?.state,'completed');assert.equal(view?.completedCount,1);assert.equal(view?.outputs.length,1);assert.equal(reopened.selfTestsRun(),0);
 await assert.rejects(reopened.resume(work,[]),/CHECKPOINT_TERMINAL/);assert.equal(reopened.selfTestsRun(),0);reopened.dispose();
});

test('a host CAS conflict preserves a competing journal and executes no further step',async()=>{
 const makeStore=persistent(),base=makeStore(),competitor=makeStore(),work=emptyWork();let injected=false,competing:any;
 const store={load:()=>base.load(),close:()=>base.close(),async save(expected:number|null,value:any){
  if(!injected&&value.pendingStepId!==null&&value.checkpoint.completed.length===1){
   injected=true;const current=await competitor.load();assert.ok(current);
   competing=await competitor.save(current.revision,{...current.value,pendingStepId:null,checkpoint:{...current.value.checkpoint,state:'paused',code:'PAUSED'}});
  }
  return base.save(expected,value);
 }};
 const host=await createDurableWorkflowHost({store,locks:lockManager()});
 await assert.rejects(host.start(work,[],'all'),/JOURNAL_CONFLICT/);
 assert.equal(injected,true);assert.equal(host.selfTestsRun(),1);assert.equal(competing.value.checkpoint.completed.length,1);
 assert.deepEqual(await competitor.load(),competing);host.dispose();competitor.close();
});

test('closing controls is atomic with draining across forty nested microtask depths',async()=>{
 let acceptedCount=0,rejectedCount=0;
 for(let depth=0;depth<40;depth++){
  const store=memoryJournal();let accepted=false;
  const host=await createDurableWorkflowHost({store,locks:lockManager()});
  host.subscribe(()=>{
   const event=host.events().at(-1);
   if(event?.type==='checkpoint-saved'&&event.revision===4)host.pause();
   if(event?.type==='checkpoint-saved'&&event.revision===5){
    let request=()=>{accepted=host.abort()};
    for(let i=0;i<depth;i++){const next=request;request=()=>queueMicrotask(next)}request();
   }
  });
  const result=await host.start(emptyWork(),[],'all',{pauseAfterStep:true});
  await new Promise(resolve=>setTimeout(resolve,0));const saved=await store.load();
  assert.equal(result.state,saved.value.checkpoint.state,'returned and saved state at depth '+depth);
  if(accepted){acceptedCount++;assert.equal(result.state,'aborted','accepted stop at depth '+depth)}else rejectedCount++;
  host.dispose();
 }
 assert.ok(acceptedCount>0,'at least one stop must reach the active control phase');
 assert.ok(rejectedCount>0,'at least one stop must reach the closed control phase');
});

test('fractional UTC source revisions survive pause, reopen and resume verbatim',async()=>{
 for(const fraction of ['1234','123456789','123456789123456789123456789123']){
  const work={...emptyWork(),updatedAt:'2026-10-04T00:00:00.'+fraction+'Z'},makeStore=persistent(),locks=lockManager();
  const first=await createDurableWorkflowHost({store:makeStore(),locks});
  const paused=await first.start(work,[],'all',{pauseAfterStep:true});assert.equal(paused.state,'paused');assert.equal(paused.sourceUpdatedAt,work.updatedAt);first.dispose();
  const reopened=await createDurableWorkflowHost({store:makeStore(),locks});
  const view=await reopened.load(work,[]);assert.equal(view?.stale,false);assert.equal(view?.recoverable,true);assert.equal(view?.sourceUpdatedAt,work.updatedAt);assert.equal(reopened.selfTestsRun(),0);
  const result=await reopened.resume(work,[]);assert.equal(result.state,'completed');assert.equal(result.sourceUpdatedAt,work.updatedAt);assert.equal(reopened.selfTestsRun(),3);reopened.dispose();
 }
});
