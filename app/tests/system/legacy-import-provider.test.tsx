import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {IDBFactory} from 'fake-indexeddb';
import {emptyWork,type WorkState} from '../../upstream/lib/work-contract.ts';
import {LocalWorkStore,type WorkTransport} from '../../src/local-adapter.ts';

const w=new Window({url:'https://localhost/'});
for(const key of ['window','document','Node','Element','HTMLElement','HTMLDialogElement','Event','MouseEvent','MutationObserver'] as const)
 Object.defineProperty(globalThis,key,{configurable:true,value:key==='window'?w:(w as any)[key]});
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const {WorkTransportProvider}=await import('../../src/work-transport.tsx');
const {SharedWorkStateProvider,useWorkState}=await import('../../src/shared-work-state.tsx');
const {LegacyImportPanel}=await import('../../src/LegacyImportPanel.tsx');
const now=new Date('2026-10-04T08:00:00.000Z');
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done});return{promise,resolve}}
function incoming(){const work=emptyWork();work.rooms=[{id:crypto.randomUUID(),title:'Provider import',agent:'manus',project:'cue',mode:'DEEP',goal:'Verify real shared state',output:'Persisted room',sources:[],status:'Aktiv',createdAt:now.toISOString(),messages:[{id:crypto.randomUUID(),kind:'Notiz',text:'Imported through the real local store',createdAt:now.toISOString()}]}];return work}
type RequestRecord={path:string;init:RequestInit;status?:number;body?:any};
async function setup({holdCommit=false}:{holdCommit?:boolean}={}){
 const options={indexedDB:new IDBFactory(),name:'provider-import-'+crypto.randomUUID(),sources:[],now:()=>new Date(now)};
 const store=new LocalWorkStore(options),external=new LocalWorkStore(options),gate=deferred();
 const requests:RequestRecord[]=[];let reloads=0;let shared:ReturnType<typeof useWorkState>|undefined;
 const transport:WorkTransport={request:async(path,init={})=>{
  const record:RequestRecord={path,init};requests.push(record);
  // All reads, validations, CAS checks and writes use the real store. Only delivery
  // of a completed commit response can be delayed to model a lost UI response.
  const response=await store.request(path,init);record.status=response.status;record.body=await response.clone().json();
  if(holdCommit&&path==='/api/imports/commit')await gate.promise;
  return response;
 }};
 function Harness({visible}:{visible:boolean}){
  const state=useWorkState();shared=state;
  return <><output data-testid="shared-state">{JSON.stringify(state.work)}</output>{visible&&<LegacyImportPanel blocked={state.busy||state.loadingWork||state.storageError||!state.hasLoaded} active revision={state.work.updatedAt} onCommitted={()=>{reloads++;return state.loadWork()}} onExport={()=>{}}/>}</>;
 }
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const render=async(visible=true)=>act(async()=>{root.render(<React.StrictMode><WorkTransportProvider transport={transport}><SharedWorkStateProvider><Harness visible={visible}/></SharedWorkStateProvider></WorkTransportProvider></React.StrictMode>)});
 const waitFor=async(check:()=>boolean,label:string)=>{
  const deadline=Date.now()+3000;
  while(!check()&&Date.now()<deadline)await act(async()=>tick());
  assert.ok(check(),label);
 };
 const button=(text:string)=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes(text));
 const click=async(text:string)=>{const element=button(text);assert.ok(element,'Button: '+text);assert.equal(element.disabled,false,'Enabled button: '+text);await act(async()=>element.click())};
 const select=async(work:WorkState)=>{
  const raw=JSON.stringify({schemaVersion:4,work});const file={name:'synthetic.json',size:new TextEncoder().encode(raw).length,text:async()=>raw} as File;
  const input=host.querySelector<HTMLInputElement>('input[type=file]')!;assert.ok(input);Object.defineProperty(input,'files',{configurable:true,value:[file]});
  await act(async()=>input.dispatchEvent(new w.Event('change',{bubbles:true}) as unknown as Event));
  await waitFor(()=>button('Verbindlich zusammenführen')?.disabled===false,'Preview ready');return raw;
 };
 const reads=()=>requests.filter(r=>r.path==='/api/state'&&(r.init.method??'GET')==='GET').length;
 const commits=()=>requests.filter(r=>r.path==='/api/imports/commit');
 const previews=()=>requests.filter(r=>r.path==='/api/imports/preview');
 const persisted=async()=>{const response=await external.request('/api/state');assert.equal(response.status,200);return await response.json() as WorkState};
 const release=async()=>{await act(async()=>{gate.resolve();await tick()});await act(async()=>tick())};
 await render();await waitFor(()=>!!shared?.hasLoaded&&!shared.loadingWork,'Real provider loaded');
 return {host,external,requests,reads,commits,previews,button,click,select,waitFor,persisted,release,render,reloads:()=>reloads,state:()=>shared!,done:async()=>{await act(async()=>root.unmount());gate.resolve();await tick();store.close();external.close();host.remove();await w.happyDOM.abort()}};
}

test('confirmed import persists and reloads the actual shared provider',async()=>{
 const h=await setup();try{
  const source=incoming(),before=await h.persisted(),reads=h.reads();await h.select(source);
  assert.deepEqual(h.state().work,before);assert.deepEqual(await h.persisted(),before);assert.equal(h.commits().length,0);
  await h.click('Verbindlich zusammenführen');await h.waitFor(()=>h.state().work.rooms.length===1&&!h.state().loadingWork,'Provider contains committed room');
  const saved=await h.persisted();assert.deepEqual(h.state().work,saved);assert.deepEqual(saved.rooms,source.rooms);
  assert.deepEqual(JSON.parse(h.host.querySelector('[data-testid="shared-state"]')!.textContent!),saved);
  assert.equal(h.commits().length,1);assert.equal(h.commits()[0].status,200);assert.equal(h.reloads(),1);assert.equal(h.reads()-reads,1);assert.ok(h.host.querySelector('[aria-label="Importbeleg"]'));
 }finally{await h.done()}
});

test('external write causes real 409, provider reload and fresh preview before another confirmation',async()=>{
 const h=await setup();try{
  const source=incoming(),raw=await h.select(source),reads=h.reads();const external=await h.persisted();
  external.settings.theme='dark';external.notes=[{id:crypto.randomUUID(),text:'Written by another local store',createdAt:now.toISOString()}];
  const{updatedAt,...body}=external;const write=await h.external.request('/api/state',{method:'PUT',body:JSON.stringify({...body,expectedUpdatedAt:updatedAt})});assert.equal(write.status,200);const intervening=await write.json();
  assert.equal(h.state().work.updatedAt,null);await h.click('Verbindlich zusammenführen');
  await h.waitFor(()=>h.previews().length===2&&h.button('Verbindlich zusammenführen')?.disabled===false&&!h.state().loadingWork,'Fresh preview after actual shared-state reload');
  assert.equal(h.commits().length,1);assert.equal(h.commits()[0].status,409);assert.equal(h.reloads(),1);assert.equal(h.reads()-reads,1);
  assert.deepEqual(h.state().work,intervening);assert.deepEqual(await h.persisted(),intervening);assert.equal(h.state().storageError,false);
  assert.equal(h.previews()[1].init.body,raw);assert.equal(h.previews()[1].body.expectedUpdatedAt,intervening.updatedAt);assert.notEqual(h.previews()[1].body.planId,h.previews()[0].body.planId);
  assert.match(h.host.textContent??'',/erneut.*bestätigen/i);assert.equal(h.host.querySelector('[aria-label="Importbeleg"]'),null);
  await h.click('Verbindlich zusammenführen');await h.waitFor(()=>h.state().work.rooms.length===1&&!h.state().loadingWork,'Explicit second confirmation reaches provider');
  assert.equal(h.commits().length,2);assert.equal(h.commits()[1].status,200);assert.equal(h.state().work.settings.theme,'dark');assert.deepEqual(h.state().work.notes,intervening.notes);assert.deepEqual(h.state().work,await h.persisted());
 }finally{await h.done()}
});

test('cancel after persistence reloads the provider once and never repeats the held commit',async()=>{
 const h=await setup({holdCommit:true});try{
  await h.select(incoming());const reads=h.reads();await h.click('Verbindlich zusammenführen');await h.waitFor(()=>h.commits()[0]?.status===200,'Commit persisted before response delivery');
  const saved=await h.persisted();assert.equal(saved.rooms.length,1);assert.equal(h.state().work.rooms.length,0);
  await h.click('Abbrechen');await h.waitFor(()=>h.state().work.rooms.length===1&&!h.state().loadingWork,'Cancel reconciles persisted result');
  assert.deepEqual(h.state().work,saved);assert.equal(h.reloads(),1);assert.equal(h.reads()-reads,1);assert.equal(h.commits()[0].init.signal?.aborted,true);assert.equal(h.commits().length,1);
  assert.match(h.host.textContent??'',/Ausgang.*unklar/);assert.equal(h.host.querySelector('[aria-label="Importbeleg"]'),null);
  await h.release();assert.equal(h.reloads(),1);assert.equal(h.reads()-reads,1);assert.equal(h.commits().length,1);assert.deepEqual(h.state().work,saved);assert.equal(h.host.querySelector('dialog'),null);assert.equal(h.host.querySelector('[aria-label="Importbeleg"]'),null);
 }finally{await h.done()}
});

test('unmounting only the panel after persistence reloads its surviving real provider',async()=>{
 const h=await setup({holdCommit:true});try{
  await h.select(incoming());const reads=h.reads();await h.click('Verbindlich zusammenführen');await h.waitFor(()=>h.commits()[0]?.status===200,'Commit persisted before panel unmount');
  const saved=await h.persisted();assert.equal(h.state().work.rooms.length,0);await h.render(false);
  await h.waitFor(()=>h.state().work.rooms.length===1&&!h.state().loadingWork,'Surviving provider reconciles unmounted panel');
  assert.equal(h.host.querySelector('[aria-label="Legacy-Arbeitsstand importieren"]'),null);assert.ok(h.host.querySelector('[data-testid="shared-state"]'));
  assert.deepEqual(h.state().work,saved);assert.deepEqual(JSON.parse(h.host.querySelector('[data-testid="shared-state"]')!.textContent!),saved);
  assert.equal(h.reloads(),1);assert.equal(h.reads()-reads,1);assert.equal(h.commits()[0].init.signal?.aborted,true);
  await h.release();assert.equal(h.reloads(),1);assert.equal(h.reads()-reads,1);assert.equal(h.commits().length,1);assert.deepEqual(h.state().work,saved);
 }finally{await h.done()}
});
