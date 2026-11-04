import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';

// DOM simulation only: this verifies React integration, not Android process/background behavior.
const w=new Window({url:'https://localhost/'});
for(const key of ['window','document','HTMLElement','HTMLButtonElement','Event','MouseEvent','KeyboardEvent','CustomEvent','MutationObserver','ResizeObserver','localStorage','location','history'] as const)Object.defineProperty(globalThis,key,{configurable:true,value:key==='window'?w:(w as any)[key]});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:w.navigator});
for(const key of ['matchMedia','addEventListener','removeEventListener','requestAnimationFrame','cancelAnimationFrame','getComputedStyle'] as const)Object.defineProperty(globalThis,key,{configurable:true,value:(w as any)[key].bind(w)});
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true,isSecureContext:true});
const React=await import('react'),{act}=React;
const {createRoot}=await import('react-dom/client');
const {flushSync}=await import('react-dom');
const {LocalWorkStore}=await import('../../src/local-adapter.ts');
const {PreferencesStore}=await import('../../src/preferences-store.ts');
const {WorkTransportProvider}=await import('../../src/work-transport.tsx');
const {SharedWorkStateProvider,useWorkState}=await import('../../src/shared-work-state.tsx');
const {SystemPreferencesProvider}=await import('../../src/system-preferences.tsx');
const {WorkflowPanel}=await import('../../src/studio/WorkflowPanel.tsx');
const sources=[{id:'source-one',title:'Lokale Quelle'}];
const wait=()=>new Promise(resolve=>setTimeout(resolve,10));
const originalError=console.error;let reactErrors:unknown[][]=[];
test.beforeEach(()=>{reactErrors=[];console.error=(...args)=>{reactErrors.push(args);originalError(...args)}});
test.afterEach(()=>{console.error=originalError;assert.equal(reactErrors.length,0,'Unexpected React error or warning')});
function lockManager(beforeCallback?:()=>Promise<void>){
 const held=new Set<string>();
 return {request:async(name:string,options:any,callback:any)=>{
  assert.equal(options.mode,'exclusive');assert.equal(options.ifAvailable,true);
  if(held.has(name))return callback(null);
  held.add(name);try{await beforeCallback?.();return await callback({name,mode:'exclusive'})}finally{held.delete(name)}
 }} as unknown as LockManager;
}
function install(factory:IDBFactory,locks:LockManager|null=lockManager()){
 Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:factory});
 Object.defineProperty(w.navigator,'locks',{configurable:true,value:locks});
}
async function seedPreferences(factory:IDBFactory,pauseAfterStep:boolean){
 const store=new PreferencesStore({indexedDB:factory});const current=await store.load();
 await store.save(current.revision,value=>({...value,workflow:{...value.workflow,pauseAfterStep}}));store.close();
}
async function mount(factory:IDBFactory,initialSources=sources,waitForCatalog=true){
 const element=document.createElement('div');document.body.append(element);const root=createRoot(element);
 const store=new LocalWorkStore({indexedDB:factory,name:'workflow-ui-work',sources:sources.map(s=>s.id)});
 const preferences=new PreferencesStore({indexedDB:factory});let shared:ReturnType<typeof useWorkState>;
 function Probe(){shared=useWorkState();return null}
 const tree=(nextSources=initialSources)=>(<WorkTransportProvider transport={store}><SharedWorkStateProvider><SystemPreferencesProvider store={preferences}><Probe/><WorkflowPanel sources={nextSources}/></SystemPreferencesProvider></SharedWorkStateProvider></WorkTransportProvider>);
 const render=async(nextSources=initialSources)=>{await act(async()=>{root.render(tree(nextSources));await wait()})};
 const renderNow=(nextSources=initialSources)=>flushSync(()=>root.render(tree(nextSources))); 
 const until=async(predicate:()=>unknown)=>{for(let count=0;count<100&&!predicate();count++)await act(async()=>wait());assert.ok(predicate(),(element.textContent??'empty DOM').slice(0,3200))};
 const button=(label:string)=>{const found=Array.from(element.querySelectorAll('button')).find(value=>value.textContent===label);assert.ok(found,'Missing button: '+label);return found};
 const click=async(label:string,twice=false)=>{await until(()=>!button(label).disabled);await act(async()=>{const target=button(label);target.dispatchEvent(new w.MouseEvent('click',{bubbles:true}) as any);if(twice)target.dispatchEvent(new w.MouseEvent('click',{bubbles:true}) as any);await wait()})};
 const close=async()=>{await act(async()=>root.unmount());store.close();element.remove()};
 await render();if(waitForCatalog)await until(()=>element.textContent?.includes('4 gebündelte'));
 return {element,until,button,click,close,render,renderNow,work:()=>shared!};
}

test('DOM simulation fails closed without Web Locks while retained results remain readable',async()=>{
 const factory=new IDBFactory();install(factory,null);const ui=await mount(factory);
 try{await ui.until(()=>ui.element.textContent?.includes('Web Locks'));assert.equal(ui.button('Lokale Prüfung starten').disabled,true);assert.equal(ui.button('Gespeicherten Lauf fortsetzen').disabled,true);assert.equal(ui.button('Gespeicherten Lauf stoppen').disabled,true)}finally{await ui.close()}
});

test('DOM simulation explicitly resumes a persisted pause after unmount without automatic execution',async()=>{
 const factory=new IDBFactory();install(factory);await seedPreferences(factory,true);let ui=await mount(factory);
 try{
  await ui.click('Lokale Prüfung starten',true);await ui.until(()=>ui.element.textContent?.includes('Pausiert · 1 bestätigte Schritte'));
  assert.equal(ui.button('Lokale Prüfung starten').disabled,true);await ui.close();ui=await mount(factory);
  await ui.until(()=>ui.element.textContent?.includes('Pausiert · 1 bestätigte Schritte'));
  assert.match(ui.element.textContent??'',/0 tatsächlich ausgeführte lokale Selbsttests/);
  assert.equal(ui.button('Lokale Prüfung starten').disabled,true);assert.equal(ui.button('Gespeicherten Lauf fortsetzen').disabled,false);
  await ui.click('Gespeicherten Lauf fortsetzen',true);await ui.until(()=>ui.element.textContent?.includes('Pausiert · 2 bestätigte Schritte'));
  assert.match(ui.element.textContent??'',/1 tatsächlich ausgeführte lokale Selbsttests/);
  await ui.click('Gespeicherten Lauf stoppen',true);await ui.until(()=>ui.element.textContent?.includes('Gestoppt · 2 bestätigte Schritte'));
  await ui.until(()=>!ui.button('Lokale Prüfung starten').disabled);
 }finally{await ui.close()}
});

test('DOM simulation keeps changed-source recovery readable but requires stop before a new run',async()=>{
 const factory=new IDBFactory();install(factory);await seedPreferences(factory,true);let ui=await mount(factory);
 try{
  await ui.click('Lokale Prüfung starten');await ui.until(()=>ui.element.textContent?.includes('Pausiert · 1 bestätigte Schritte'));
  await ui.render([{...sources[0],title:'Geänderte Quelle bei gleicher Arbeitsrevision'}]);
  await ui.until(()=>ui.element.textContent?.includes('Prüfgrundlage oder Skillversion hat sich geändert'));
  assert.equal(ui.button('Gespeicherten Lauf fortsetzen').disabled,true);assert.equal(ui.button('Lokale Prüfung starten').disabled,true);
  assert.match(ui.element.textContent??'',/offline-deterministic/);await ui.click('Gespeicherten Lauf stoppen');
  await ui.until(()=>ui.element.textContent?.includes('Gestoppt · 1 bestätigte Schritte'));await ui.until(()=>!ui.button('Lokale Prüfung starten').disabled);
  await ui.click('Lokale Prüfung starten');await ui.until(()=>ui.element.textContent?.includes('Pausiert · 1 bestätigte Schritte'));
  await ui.until(()=>!ui.button('Gespeicherten Lauf fortsetzen').disabled);
  const record=await readPreferences(factory);
  assert.equal(record.value.history.length,2);assert.ok(record.value.history.some(run=>run.state==='aborted'&&run.completedCount===1));
 }finally{await ui.close()}
});

test('DOM simulation reads saved results without Web Locks after restart',async()=>{
 const factory=new IDBFactory();install(factory);let ui=await mount(factory);
 try{
  await ui.click('Lokale Prüfung starten');await ui.until(()=>ui.element.textContent?.includes('Abgeschlossen · 4 bestätigte Schritte'));
  await ui.close();install(factory,null);ui=await mount(factory);
  await ui.until(()=>ui.element.textContent?.includes('Abgeschlossen · 4 bestätigte Schritte'));
  assert.match(ui.element.textContent??'',/offline-deterministic/);assert.match(ui.element.textContent??'',/Lokal gespeichert im Laufjournal/);
  assert.equal(ui.button('Lokale Prüfung starten').disabled,true);assert.equal(ui.button('Gespeicherten Lauf fortsetzen').disabled,true);
 }finally{await ui.close()}
});

test('DOM simulation archives a terminal journal before a new start even when history was absent',async()=>{
 const factory=new IDBFactory();install(factory);let ui=await mount(factory);
 try{
  await ui.click('Lokale Prüfung starten');await ui.until(()=>ui.element.textContent?.includes('Abgeschlossen · 4 bestätigte Schritte'));
  await ui.close();const writer=new PreferencesStore({indexedDB:factory});const previous=await writer.load();const oldId=previous.value.history[0].id;
  await writer.save(previous.revision,value=>({...value,history:[]}));writer.close();ui=await mount(factory);
  await ui.until(()=>ui.element.textContent?.includes('Abgeschlossen · 4 bestätigte Schritte'));
  await ui.click('Lokale Prüfung starten',true);await ui.until(()=>ui.element.textContent?.includes('Lokal gespeicherte Ergebnisverläufe (2,'));
  const record=await readPreferences(factory);
  assert.equal(record.value.history.length,2);assert.ok(record.value.history.some(run=>run.id===oldId&&run.completedCount===4));
 }finally{await ui.close()}
});

test.after(()=>w.happyDOM.abort());

// Reads while the panel is mounted run inside act: the panel may still settle the run it just
// displayed, and those updates must not land outside act (it made this file flaky).
async function readPreferences(factory:IDBFactory){let result!:Awaited<ReturnType<InstanceType<typeof PreferencesStore>['load']>>;await act(async()=>{const reader=new PreferencesStore({indexedDB:factory});try{result=await reader.load()}finally{reader.close()}await wait()});return result}
async function rawJournal(factory:IDBFactory,write?:unknown){let result:any;await act(async()=>{result=await accessRawJournal(factory,write);await wait()});return result}
async function accessRawJournal(factory:IDBFactory,write?:unknown){
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=factory.open('cue-system-workflow-journal-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('journal');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
 try{return await new Promise<any>((resolve,reject)=>{const tx=db.transaction('journal',write===undefined?'readonly':'readwrite');let result:unknown;tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(tx.error);const store=tx.objectStore('journal');if(write!==undefined)store.put(write,'current');else store.get('current').onsuccess=e=>{result=(e.target as IDBRequest).result}})}finally{db.close()}
}

test('DOM simulation preserves corrupt journals and offers explicit recheck instead of an empty success',async()=>{
 const factory=new IDBFactory();install(factory);const corrupt={revision:4,value:{schema:'future-unrecognized'}};await rawJournal(factory,corrupt);const ui=await mount(factory);
 try{
  await ui.until(()=>ui.element.textContent?.includes('Laufjournal konnte nicht sicher gelesen werden'));
  assert.match(ui.element.textContent??'',/beschädigt|nicht unterstützt/);
  assert.equal(ui.button('Lokale Prüfung starten').disabled,true);assert.equal(ui.button('Gespeicherten Lauf fortsetzen').disabled,true);
  assert.deepEqual(await rawJournal(factory),corrupt);await ui.click('Laufjournal erneut prüfen');
  assert.equal(ui.button('Lokale Prüfung starten').disabled,true);assert.deepEqual(await rawJournal(factory),corrupt);
  assert.match(ui.element.textContent??'',/0 tatsächlich ausgeführte lokale Selbsttests/);
 }finally{await ui.close()}
});

test('DOM simulation explains exclusive-lock conflicts and requires explicit recheck',async()=>{
 const factory=new IDBFactory();const locks=lockManager();install(factory,locks);const ui=await mount(factory);let release!:()=>void;
 const held=locks.request('cue.workflow-journal:v1:execution',{mode:'exclusive',ifAvailable:true},()=>new Promise<void>(resolve=>{release=resolve}));
 try{
  await ui.click('Lokale Prüfung starten');await ui.until(()=>ui.element.textContent?.includes('WORKFLOW_LOCK_BUSY'));
  assert.match(ui.element.textContent??'',/andere Sitzung/);assert.equal(ui.button('Lokale Prüfung starten').disabled,true);
  release();await held;await ui.render([...sources]);assert.equal(ui.button('Lokale Prüfung starten').disabled,true);
  await ui.click('Laufjournal erneut prüfen');await ui.until(()=>!ui.button('Lokale Prüfung starten').disabled);
  await ui.click('Lokale Prüfung starten');await ui.until(()=>ui.element.textContent?.includes('Abgeschlossen · 4 bestätigte Schritte'));
 }finally{release();await held;await ui.close()}
});

test('DOM simulation reconstructs a crashed running journal without automatically repeating a step',async()=>{
 const factory=new IDBFactory();install(factory);await seedPreferences(factory,true);let ui=await mount(factory);
 try{
  await ui.click('Lokale Prüfung starten');await ui.until(()=>ui.element.textContent?.includes('Pausiert · 1 bestätigte Schritte'));
  await ui.close();const saved=await rawJournal(factory);saved.revision++;saved.value.checkpoint.state='running';delete saved.value.checkpoint.code;saved.value.pendingStepId=saved.value.spec.steps[1].stepId;await rawJournal(factory,saved);
  ui=await mount(factory);await ui.until(()=>ui.element.textContent?.includes('Unterbrochen · 1 bestätigte Schritte'));
  assert.match(ui.element.textContent??'',/anderen Sitzung aktiv/);assert.match(ui.element.textContent??'',/0 tatsächlich ausgeführte lokale Selbsttests/);
  await ui.click('Gespeicherten Lauf fortsetzen');await ui.until(()=>ui.element.textContent?.includes('Pausiert · 2 bestätigte Schritte'));
  assert.match(ui.element.textContent??'',/1 tatsächlich ausgeführte lokale Selbsttests/);
 }finally{await ui.close()}
});

test('DOM simulation never calls a failed terminal transaction completed or archives it as successful',async()=>{
 const factory=new IDBFactory();install(factory);const ui=await mount(factory);const put=IDBObjectStore.prototype.put;
 IDBObjectStore.prototype.put=function(...args:any[]){const request=put.apply(this,args as any);if(this.name==='journal'&&args[0]?.value?.checkpoint?.state==='completed')request.addEventListener('success',()=>this.transaction.abort());return request};
 try{
  await ui.click('Lokale Prüfung starten');await ui.until(()=>ui.element.textContent?.includes('WORKFLOW_JOURNAL_WRITE_FAILED'));
  await ui.until(()=>ui.element.textContent?.includes('Unterbrochen · 4 bestätigte Schritte'));
  assert.doesNotMatch(ui.element.querySelector('[aria-live="polite"]')?.textContent??'',/Abgeschlossen/);
  assert.equal(ui.button('Gespeicherten Lauf fortsetzen').disabled,true);
  assert.equal((await readPreferences(factory)).value.history.length,0);
  IDBObjectStore.prototype.put=put;await ui.render([...sources]);assert.equal(ui.button('Gespeicherten Lauf fortsetzen').disabled,true);
  await ui.click('Laufjournal erneut prüfen');await ui.click('Gespeicherten Lauf fortsetzen');
  await ui.until(()=>ui.element.textContent?.includes('Abgeschlossen · 4 bestätigte Schritte'));
  assert.match(ui.element.textContent??'',/4 tatsächlich ausgeführte lokale Selbsttests/);
 }finally{IDBObjectStore.prototype.put=put;await ui.close()}
});

test('DOM simulation updates live source snapshot refs independently of action buttons',async()=>{
 const factory=new IDBFactory();install(factory);const ui=await mount(factory);const put=IDBObjectStore.prototype.put;let sawFirst!:()=>void;const first=new Promise<void>(resolve=>{sawFirst=resolve});let signalled=false;
 IDBObjectStore.prototype.put=function(...args:any[]){const request=put.apply(this,args as any);const checkpoint=args[0]?.value?.checkpoint;if(this.name==='journal'&&!signalled&&checkpoint?.state==='running'&&checkpoint.completed.length===1){signalled=true;request.addEventListener('success',sawFirst)}return request};
 try{
  await ui.until(()=>!ui.button('Lokale Prüfung starten').disabled);
  await act(async()=>{ui.button('Lokale Prüfung starten').dispatchEvent(new w.MouseEvent('click',{bubbles:true}) as any);await first;ui.renderNow([{...sources[0],title:'Während laufender Prüfung geändert'}]);await wait()});
  await ui.until(()=>ui.element.textContent?.includes('Fehlgeschlagen · 1 bestätigte Schritte'));
  assert.match(ui.element.textContent??'',/während der Prüfung geändert/);assert.match(ui.element.textContent??'',/1 tatsächlich ausgeführte lokale Selbsttests/);
  assert.equal((await rawJournal(factory)).value.checkpoint.code,'SNAPSHOT_CHANGED');
 }finally{IDBObjectStore.prototype.put=put;await ui.close()}
});

test('DOM simulation unmount pauses the active host and leaves a resumable local checkpoint',async()=>{
 const factory=new IDBFactory();install(factory);let ui=await mount(factory);const put=IDBObjectStore.prototype.put;let sawFirst!:()=>void;const first=new Promise<void>(resolve=>{sawFirst=resolve});let signalled=false;
 IDBObjectStore.prototype.put=function(...args:any[]){const request=put.apply(this,args as any);const checkpoint=args[0]?.value?.checkpoint;if(this.name==='journal'&&!signalled&&checkpoint?.state==='running'&&checkpoint.completed.length===1){signalled=true;request.addEventListener('success',sawFirst)}return request};
 try{
  await ui.until(()=>!ui.button('Lokale Prüfung starten').disabled);
  await act(async()=>{ui.button('Lokale Prüfung starten').dispatchEvent(new w.MouseEvent('click',{bubbles:true}) as any);await first;await ui.close();await wait()});
  IDBObjectStore.prototype.put=put;let saved=await rawJournal(factory);for(let count=0;count<100&&saved?.value.checkpoint.state!=='paused';count++){await wait();saved=await rawJournal(factory)}
  assert.equal(saved.value.checkpoint.state,'paused');assert.equal(saved.value.checkpoint.completed.length,1);
  ui=await mount(factory);await ui.until(()=>ui.element.textContent?.includes('Pausiert · 1 bestätigte Schritte'));
  assert.match(ui.element.textContent??'',/0 tatsächlich ausgeführte lokale Selbsttests/);
  await ui.click('Gespeicherten Lauf fortsetzen');await ui.until(()=>ui.element.textContent?.includes('Abgeschlossen · 4 bestätigte Schritte'));
  assert.match(ui.element.textContent??'',/3 tatsächlich ausgeführte lokale Selbsttests/);
 }finally{IDBObjectStore.prototype.put=put;await ui.close()}
});

test('DOM simulation labels pause and stop as requested until their journal transaction is confirmed',async()=>{
 for(const [button,label,state] of [['Pausieren','Pause angefordert','paused'],['Stoppen','Stop angefordert','aborted']] as const){
  const factory=new IDBFactory();let release!:()=>void;const waiting=new Promise<void>(resolve=>{release=resolve});install(factory,lockManager(()=>waiting));const ui=await mount(factory);
  try{
   await ui.click('Lokale Prüfung starten');await ui.click(button,true);
   assert.match(ui.element.querySelector('[aria-live="polite"]')?.textContent??'',new RegExp(label));
   assert.equal(ui.button('Pausieren').disabled,true);assert.equal(ui.button('Stoppen').disabled,button==='Stoppen');assert.equal(await rawJournal(factory),undefined);
   release();await ui.until(()=>ui.element.textContent?.includes(state==='paused'?'Pausiert · 0 bestätigte Schritte':'Gestoppt · 0 bestätigte Schritte'));
   assert.equal((await rawJournal(factory)).value.checkpoint.state,state);
  }finally{release();await ui.close()}
 }
});

test('DOM simulation refuses to replace a terminal journal if archiving its old results fails',async()=>{
 const factory=new IDBFactory();install(factory);let ui=await mount(factory);const put=IDBObjectStore.prototype.put;
 try{
  await ui.click('Lokale Prüfung starten');await ui.until(()=>ui.element.textContent?.includes('Abgeschlossen · 4 bestätigte Schritte'));
  await ui.close();const original=await rawJournal(factory);const writer=new PreferencesStore({indexedDB:factory});const prior=await writer.load();await writer.save(prior.revision,value=>({...value,history:[]}));writer.close();ui=await mount(factory);
  await ui.until(()=>ui.element.textContent?.includes('Abgeschlossen · 4 bestätigte Schritte'));
  IDBObjectStore.prototype.put=function(...args:any[]){if(this.name==='preferences')throw new DOMException('Simulated storage full','QuotaExceededError');return put.apply(this,args as any)};
  await ui.click('Lokale Prüfung starten');await ui.until(()=>ui.element.textContent?.includes('Studio-Speicherung gesperrt'));
  assert.deepEqual(await rawJournal(factory),original);assert.equal(ui.button('Lokale Prüfung starten').disabled,true);
  assert.match(ui.element.textContent??'',/0 tatsächlich ausgeführte lokale Selbsttests/);
 }finally{IDBObjectStore.prototype.put=put;await ui.close()}
});

test('DOM simulation never presents previous confirmed steps as progress of a newly requested run',async()=>{
 const factory=new IDBFactory();let hold=false,release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve});install(factory,lockManager(()=>hold?pending:Promise.resolve()));const ui=await mount(factory);
 try{
  await ui.click('Lokale Prüfung starten');await ui.until(()=>ui.element.textContent?.includes('Abgeschlossen · 4 bestätigte Schritte'));
  await ui.until(()=>!ui.button('Lokale Prüfung starten').disabled);hold=true;await ui.click('Lokale Prüfung starten');
  assert.doesNotMatch(ui.element.querySelector('[aria-live="polite"]')?.textContent??'',/4 bestätigte Schritte/);
  assert.match(ui.element.textContent??'',/Vorherige gespeicherte Ergebnisse/);
  release();await ui.until(()=>ui.element.textContent?.includes('Abgeschlossen · 4 bestätigte Schritte'));
 }finally{release();await ui.close()}
});

test('DOM simulation refreshes the latest snapshot when it changes during the final journal reload',async()=>{
 const {WorkflowJournalStore}=await import('../../src/studio/workflow-journal.ts');
 const factory=new IDBFactory();install(factory);const ui=await mount(factory);const load=WorkflowJournalStore.prototype.load;
 let sawTerminal!:()=>void,release!:()=>void,held=false,terminalReads=0;const terminal=new Promise<void>(resolve=>{sawTerminal=resolve}),pending=new Promise<void>(resolve=>{release=resolve});
 WorkflowJournalStore.prototype.load=async function(){const record=await load.call(this);if(!held&&record?.value.checkpoint.state==='completed'&&++terminalReads===2){held=true;sawTerminal();await pending}return record};
 try{
  await ui.until(()=>!ui.button('Lokale Prüfung starten').disabled);
  await act(async()=>{ui.button('Lokale Prüfung starten').dispatchEvent(new w.MouseEvent('click',{bubbles:true}) as any);await terminal;ui.renderNow([{...sources[0],title:'Nach Abschluss geändert'}]);release();await wait()});
  await ui.until(()=>!ui.button('Lokale Prüfung starten').disabled);
  assert.match(ui.element.textContent??'',/Prüfgrundlage oder Skillversion hat sich geändert/);
  assert.doesNotMatch(ui.element.textContent??'',/Gespeichertes Laufjournal wird geprüft/);
 }finally{WorkflowJournalStore.prototype.load=load;release();await ui.close()}
});

test('DOM simulation enables pause and stop only after the host has started executing',async()=>{
 const {WorkflowJournalStore}=await import('../../src/studio/workflow-journal.ts');const factory=new IDBFactory();install(factory);const ui=await mount(factory);await ui.until(()=>!ui.button('Lokale Prüfung starten').disabled);
 const load=WorkflowJournalStore.prototype.load;let release!:()=>void,sawPreflight!:()=>void,held=false;const pending=new Promise<void>(resolve=>{release=resolve}),preflight=new Promise<void>(resolve=>{sawPreflight=resolve});
 WorkflowJournalStore.prototype.load=async function(){const record=await load.call(this);if(!held){held=true;sawPreflight();await pending}return record};
 try{
  await act(async()=>{ui.button('Lokale Prüfung starten').dispatchEvent(new w.MouseEvent('click',{bubbles:true}) as any);await preflight;await wait()});
  assert.equal(ui.button('Pausieren').disabled,true);assert.equal(ui.button('Stoppen').disabled,true);
  assert.match(ui.element.querySelector('[aria-live="polite"]')?.textContent??'',/vorbereitet/);
  await act(async()=>{release();await wait()});await ui.until(()=>ui.element.textContent?.includes('Abgeschlossen · 4 bestätigte Schritte'));
 }finally{WorkflowJournalStore.prototype.load=load;release();await ui.close()}
});

test('DOM simulation preserves readable old-version results and permits stopping only',async()=>{
 const factory=new IDBFactory();install(factory);await seedPreferences(factory,true);let ui=await mount(factory);
 try{
  await ui.click('Lokale Prüfung starten');await ui.until(()=>ui.element.textContent?.includes('Pausiert · 1 bestätigte Schritte'));
  await ui.close();const saved=await rawJournal(factory);saved.value.spec.steps[1].versionHash='sha256:'+'a'.repeat(64);const {hashJson}=await import('../../vendor/local-workflows/src/data.mjs');saved.value.checkpoint.revisionHash=await hashJson(saved.value.spec);await rawJournal(factory,saved);ui=await mount(factory);
  await ui.until(()=>ui.element.textContent?.includes('gespeicherte Skillversion'));
  assert.equal(ui.button('Gespeicherten Lauf fortsetzen').disabled,true);assert.equal(ui.button('Lokale Prüfung starten').disabled,true);
  assert.match(ui.element.textContent??'',/offline-deterministic/);await ui.click('Gespeicherten Lauf stoppen');
  await ui.until(()=>ui.element.textContent?.includes('Gestoppt · 1 bestätigte Schritte'));
 }finally{await ui.close()}
});

test('DOM simulation explains checkpoint hash corruption and preserves the journal without execution',async()=>{
 const factory=new IDBFactory();install(factory);await seedPreferences(factory,true);let ui=await mount(factory);
 try{
  await ui.click('Lokale Prüfung starten');await ui.until(()=>ui.element.textContent?.includes('Pausiert · 1 bestätigte Schritte'));
  await ui.close();const saved=await rawJournal(factory);saved.value.checkpoint.completed[0].outputHash='sha256:'+'a'.repeat(64);await rawJournal(factory,saved);ui=await mount(factory);
  await ui.until(()=>ui.element.textContent?.includes('CHECKPOINT_CORRUPT'));
  assert.match(ui.element.textContent??'',/beschädigt oder widersprüchlich/);assert.equal(ui.button('Lokale Prüfung starten').disabled,true);
  assert.deepEqual(await rawJournal(factory),saved);assert.match(ui.element.textContent??'',/0 tatsächlich ausgeführte lokale Selbsttests/);
 }finally{await ui.close()}
});

test('DOM simulation closes a host whose catalog initialization completes after unmount',{timeout:10_000},async()=>{
 const {WorkflowJournalStore}=await import('../../src/studio/workflow-journal.ts');const factory=new IDBFactory();install(factory);
 const digest=crypto.subtle.digest,close=WorkflowJournalStore.prototype.close;let release!:()=>void,sawInit!:()=>void,held=false,closed=0;
 const pending=new Promise<void>(resolve=>{release=resolve}),initializing=new Promise<void>(resolve=>{sawInit=resolve});
 // The digest delay models an unfinished package verification; close delegates to the real resource cleanup.
 crypto.subtle.digest=(async(...args:any[])=>{const result=await digest.apply(crypto.subtle,args as any);if(!held){held=true;sawInit();await pending}return result}) as typeof digest;
 WorkflowJournalStore.prototype.close=function(){closed++;return close.call(this)};
 let ui:Awaited<ReturnType<typeof mount>>|undefined;
 try{
  ui=await mount(factory,sources,false);await act(async()=>{await initializing});assert.match(ui.element.textContent??'',/Paketintegrität wird geprüft/);
  await ui.close();ui=undefined;await act(async()=>{release();await wait()});
  for(let count=0;count<100&&closed===0;count++)await act(async()=>wait());assert.equal(closed,1,'Late initialized host must release its journal');
  assert.equal(await rawJournal(factory),undefined);
  crypto.subtle.digest=digest;WorkflowJournalStore.prototype.close=close;ui=await mount(factory);await ui.click('Lokale Prüfung starten');
  await ui.until(()=>ui!.element.textContent?.includes('Abgeschlossen · 4 bestätigte Schritte'));
 }finally{release();crypto.subtle.digest=digest;WorkflowJournalStore.prototype.close=close;if(ui)await ui.close()}
});

test('DOM simulation rechecks current sources if they change during an explicit journal retry',async()=>{
 const {WorkflowJournalStore}=await import('../../src/studio/workflow-journal.ts');const factory=new IDBFactory();install(factory);await seedPreferences(factory,true);let ui=await mount(factory);
 await ui.click('Lokale Prüfung starten');await ui.until(()=>ui.element.textContent?.includes('Pausiert · 1 bestätigte Schritte'));await ui.close();
 const load=WorkflowJournalStore.prototype.load;let reads=0,release!:()=>void,sawRetry!:()=>void;
 const pending=new Promise<void>(resolve=>{release=resolve}),retry=new Promise<void>(resolve=>{sawRetry=resolve});
 WorkflowJournalStore.prototype.load=async function(){reads++;if(reads===1)throw new Error('WORKFLOW_JOURNAL_READ_FAILED');const record=await load.call(this);if(reads===2){sawRetry();await pending}return record};
 try{
  ui=await mount(factory);await ui.until(()=>ui.element.textContent?.includes('WORKFLOW_JOURNAL_READ_FAILED'));
  await act(async()=>{ui.button('Laufjournal erneut prüfen').dispatchEvent(new w.MouseEvent('click',{bubbles:true}) as any);await retry;ui.renderNow([{...sources[0],title:'Während erneuter Prüfung geändert'}]);release();await wait()});
  await ui.until(()=>!ui.element.textContent?.includes('Gespeichertes Laufjournal wird geprüft'));
  assert.match(ui.element.textContent??'',/Prüfgrundlage oder Skillversion hat sich geändert/);
  assert.equal(ui.button('Gespeicherten Lauf fortsetzen').disabled,true);assert.equal(ui.button('Gespeicherten Lauf stoppen').disabled,false);
  assert.match(ui.element.textContent??'',/0 tatsächlich ausgeführte lokale Selbsttests/);
 }finally{WorkflowJournalStore.prototype.load=load;release();await ui.close()}
});

test('DOM simulation escalates a pending pause to stop without repeating identical control writes',async()=>{
 const {WorkflowJournalStore}=await import('../../src/studio/workflow-journal.ts');const save=WorkflowJournalStore.prototype.save;
 const revisions:number[]=[];
 for(const duplicate of [false,true]){
  const factory=new IDBFactory();install(factory);const ui=await mount(factory);
  let releaseStep!:()=>void,releasePause!:()=>void,sawStep!:()=>void,sawPause!:()=>void,heldStep=false,heldPause=false;
  const step=new Promise<void>(resolve=>{sawStep=resolve}),stepPending=new Promise<void>(resolve=>{releaseStep=resolve}),pause=new Promise<void>(resolve=>{sawPause=resolve}),pausePending=new Promise<void>(resolve=>{releasePause=resolve});
  WorkflowJournalStore.prototype.save=async function(revision,value){
   if(!heldStep&&value.pendingStepId){heldStep=true;sawStep();await stepPending}
   if(!heldPause&&value.checkpoint.state==='paused'){heldPause=true;sawPause();await pausePending}
   return save.call(this,revision,value);
  };
  try{
   await ui.until(()=>!ui.button('Lokale Prüfung starten').disabled);
   await act(async()=>{ui.button('Lokale Prüfung starten').dispatchEvent(new w.MouseEvent('click',{bubbles:true}) as any);await step;await wait()});
   await ui.click('Pausieren',duplicate);assert.equal(ui.button('Pausieren').disabled,true);assert.equal(ui.button('Stoppen').disabled,false);
   await act(async()=>{releaseStep();await pause;await wait()});
   assert.match(ui.element.querySelector('[aria-live="polite"]')?.textContent??'',/Pause angefordert/);
   await ui.click('Stoppen',duplicate);assert.equal(ui.button('Pausieren').disabled,true);assert.equal(ui.button('Stoppen').disabled,true);
   assert.match(ui.element.querySelector('[aria-live="polite"]')?.textContent??'',/Stop angefordert/);
   await act(async()=>{releasePause();await wait()});await ui.until(()=>ui.element.textContent?.includes('Gestoppt · 0 bestätigte Schritte'));
   const saved=await rawJournal(factory);assert.equal(saved.value.checkpoint.state,'aborted');assert.equal(saved.value.checkpoint.completed.length,0);revisions.push(saved.revision);
  }finally{releaseStep();releasePause();WorkflowJournalStore.prototype.save=save;await ui.close()}
 }
 assert.equal(revisions[1],revisions[0],'Repeated identical clicks must not add control writes');
});

test('DOM simulation names measured elapsed time and session-scoped events precisely',async()=>{
 const factory=new IDBFactory();install(factory);const ui=await mount(factory);
 try{assert.match(ui.element.textContent??'',/1\.000 ms gemessene Laufzeit einschließlich Speicherprüfung pro Fortsetzung/);assert.match(ui.element.textContent??'',/Echte Ereignisse dieser Sitzung/)}finally{await ui.close()}
});
