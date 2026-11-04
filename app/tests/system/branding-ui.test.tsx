import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Window} from 'happy-dom';
const w=new Window({url:'https://localhost/'});
for(const key of ['window','document','Node','NodeFilter','Element','HTMLInputElement','HTMLFormElement','HTMLTextAreaElement','HTMLSelectElement','HTMLElement','HTMLButtonElement','Event','MouseEvent','KeyboardEvent','CustomEvent','PopStateEvent','MutationObserver','ResizeObserver','localStorage','location','history'] as const)Object.defineProperty(globalThis,key,{configurable:true,value:key==='window'?w:(w as any)[key]});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:w.navigator});
for(const key of ['matchMedia','addEventListener','removeEventListener','requestAnimationFrame','cancelAnimationFrame','getComputedStyle'] as const)Object.defineProperty(globalThis,key,{configurable:true,value:(w as any)[key].bind(w)});
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true,isSecureContext:true});
const exports:{name:string;text:string}[]=[];
Object.defineProperty(w,'showSaveFilePicker',{configurable:true,value:async(options:any)=>({createWritable:async()=>({write:async(text:string)=>{exports.push({name:options.suggestedName,text})},close:async()=>{},abort:async()=>{}})})});
const React=await import('react'),{act,StrictMode}=React,{createRoot}=await import('react-dom/client');
const {IDBFactory}=await import('fake-indexeddb');
const {LocalWorkStore}=await import('../../src/local-adapter.ts');
const {WorkTransportProvider}=await import('../../src/work-transport.tsx');
const {SharedWorkStateProvider,useWorkState}=await import('../../src/shared-work-state.tsx');
const {default:SystemApp}=await import('../../src/system-app.tsx');
const data=JSON.parse(fs.readFileSync(new URL('../../upstream/lib/mesh-data.json',import.meta.url),'utf8'));
const wait=()=>new Promise(r=>setTimeout(r,15));
async function setup(){
 history.replaceState({},'','https://localhost/');Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:new IDBFactory()});localStorage.clear();exports.length=0;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),store=new LocalWorkStore({indexedDB:new IDBFactory(),name:crypto.randomUUID(),sources:data.sources.map((s:any)=>s.id)});let shared:any;
 function Probe(){shared=useWorkState();return null}
 await act(async()=>{root.render(<StrictMode><WorkTransportProvider transport={store}><SharedWorkStateProvider><Probe/><SystemApp data={data}/></SharedWorkStateProvider></WorkTransportProvider></StrictMode>);await wait()});
 const ready=async(check:()=>unknown,label:string)=>{for(let i=0;i<120&&!check();i++)await act(async()=>wait());assert.ok(check(),label)};
 await ready(()=>shared?.hasLoaded&&host.querySelector('.brand'),'App loaded');
 const click=async(element:Element|null|undefined)=>{assert.ok(element);await act(async()=>{(element as HTMLElement).click();await wait()})};
 const button=(label:string)=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent===label);
 const done=async()=>{await act(async()=>root.unmount());store.close();host.remove();await w.happyDOM.abort()};
 return{host,click,button,ready,done,state:()=>shared};
}
test('LowQuantFlow renders its exact brand in shell, preserves all 17 areas and opens renamed Studio',async()=>{
 const h=await setup();try{
  assert.equal(h.host.querySelector('.system-mode-info strong')?.textContent,'LowQuantFlow · lokal auf diesem Gerät');
  assert.match(h.host.querySelector('.brand')?.textContent??'',/^LowQuantFlow/);
  assert.equal(h.host.querySelector('.topbar-left>span')?.textContent,'LowQuantFlow');
  assert.equal(h.host.querySelector('.workspace-footer>span')?.textContent,'LowQuantFlow · Basis v1.4.2');
  assert.equal(h.host.querySelectorAll('[data-sidebar="menu-button"]').length,17);
  await h.click(h.button('Studio · Graph & Skills'));await h.ready(()=>h.host.querySelector('[aria-label="LowQuantFlow Studio"]'),'Renamed Studio');
  assert.equal(h.host.querySelector('.system-studio h1')?.textContent,'LowQuantFlow Studio');
  await h.click(h.button('Arbeitsbereiche'));assert.equal(h.host.querySelector('.system-mode-info strong')?.textContent,'LowQuantFlow · lokal auf diesem Gerät');
 }finally{await h.done()}
});
test('new handoff text uses LowQuantFlow without changing its explicit permission boundaries',async()=>{
 const h=await setup();try{
  await h.click(h.button('Übergabe erstellen'));await h.ready(()=>document.querySelector('.handoff-output pre'),'Handoff open');
  const text=document.querySelector('.handoff-output pre')!.textContent!;
  assert.match(text,/FROM: lowgiga \/ LowQuantFlow/);assert.doesNotMatch(text,/FROM: lowgiga \/ Command Mesh/);
  assert.match(text,/Keine externen Schreibaktionen/);assert.match(text,/Snapshot|kein Livezugriff/);
 }finally{await h.done()}
});
test('new snapshot and system backup filename suggestions use LowQuantFlow without changing stored work',async()=>{
 const h=await setup();try{
  const before=JSON.stringify(h.state().work);
  await h.click(h.host.querySelector('[aria-label="Snapshot exportieren"]'));await h.ready(()=>exports.length===1,'Snapshot saved to explicit picker');
  assert.equal(exports[0].name,'LowQuantFlow-snapshot.json');assert.doesNotThrow(()=>JSON.parse(exports[0].text));
  await h.click(h.button('Studio · Graph & Skills'));await h.ready(()=>h.button('Backup & Vorschau'),'Studio ready');await h.click(h.button('Backup & Vorschau'));
  await h.ready(()=>h.host.querySelector('.system-backup .actions-row button'),'Backup ready');await h.click(h.host.querySelector('.system-backup .actions-row button'));
  await h.ready(()=>exports.length===2,'System backup saved to explicit picker');assert.equal(exports[1].name,'LowQuantFlow-system-backup.json');
  assert.match(exports[1].text,/"name":\s*"cue-command-mesh-system"/);assert.equal(JSON.stringify(h.state().work),before);
 }finally{await h.done()}
});
