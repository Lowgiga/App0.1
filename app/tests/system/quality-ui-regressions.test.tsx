import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Window} from 'happy-dom';
const w=new Window({url:'https://localhost/?view=matrix'});
for(const key of ['window','document','Node','NodeFilter','Element','HTMLInputElement','HTMLFormElement','HTMLTextAreaElement','HTMLSelectElement','HTMLElement','HTMLButtonElement','Event','MouseEvent','KeyboardEvent','CustomEvent','PopStateEvent','MutationObserver','ResizeObserver','localStorage','location','history'] as const)Object.defineProperty(globalThis,key,{configurable:true,value:key==='window'?w:(w as any)[key]});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:w.navigator});
for(const key of ['matchMedia','addEventListener','removeEventListener','requestAnimationFrame','cancelAnimationFrame','getComputedStyle'] as const)Object.defineProperty(globalThis,key,{configurable:true,value:(w as any)[key].bind(w)});
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true,isSecureContext:true});
const React=await import('react'),{act,StrictMode}=React,{createRoot}=await import('react-dom/client');
const{IDBFactory}=await import('fake-indexeddb');
const{LocalWorkStore}=await import('../../src/local-adapter.ts');
const{WorkTransportProvider}=await import('../../src/work-transport.tsx');
const{SharedWorkStateProvider,useWorkState}=await import('../../src/shared-work-state.tsx');
const{default:SystemApp}=await import('../../src/system-app.tsx');
const data=JSON.parse(fs.readFileSync(new URL('../../upstream/lib/mesh-data.json',import.meta.url),'utf8'));
const wait=()=>new Promise(r=>setTimeout(r,15));
async function setup(view='matrix'){
 history.replaceState({},'','https://localhost/?view='+view);Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:new IDBFactory()});localStorage.clear();
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),store=new LocalWorkStore({indexedDB:new IDBFactory(),name:crypto.randomUUID(),sources:data.sources.map((s:any)=>s.id)});let shared:any;
 function Probe(){shared=useWorkState();return null}
 await act(async()=>{root.render(<StrictMode><WorkTransportProvider transport={store}><SharedWorkStateProvider><Probe/><SystemApp data={data}/></SharedWorkStateProvider></WorkTransportProvider></StrictMode>);await wait()});
 const ready=async(check:()=>unknown,label:string)=>{for(let i=0;i<120&&!check();i++)await act(async()=>wait());assert.ok(check(),label)};
 await ready(()=>shared?.hasLoaded&&(view==='matrix'?host.querySelector('.task-card'):Array.from(host.querySelectorAll('button')).some(b=>b.textContent?.includes(view==='missions'?'Mission anlegen':'Anfrage vorbereiten'))),'Workspace loaded');
 const click=async(element:Element|null)=>{assert.ok(element);await act(async()=>{(element as HTMLElement).click();await wait()})};
 const open=async()=>{await click(host.querySelector('.task-card'));await ready(()=>document.querySelector('[role="dialog"]'),'Task dialog opened')};
 const done=async()=>{await act(async()=>root.unmount());store.close();host.remove();await w.happyDOM.abort()};
 return{host,click,open,ready,done,state:()=>shared};
}
test('R1: StrictMode task portal is hidden in Studio and its draft survives returning',async()=>{
 const h=await setup();try{await h.open();const title=(document.querySelector('[aria-label="Aufgabentitel"]') as HTMLInputElement).value;
  await h.click(Array.from(h.host.querySelectorAll('button')).find(b=>b.textContent==='Studio · Graph & Skills')!);
  await h.ready(()=>h.host.querySelector('[aria-label="LowQuantFlow Studio"]'),'Studio mounted');
  assert.equal(document.querySelectorAll('[role="dialog"]').length,0,'Inactive matrix must not expose a body portal');
  assert.equal(document.body.style.pointerEvents,'','Dismissed portal must release body interaction');
  await h.click(Array.from(h.host.querySelectorAll('button')).find(b=>b.textContent==='Arbeitsbereiche')!);
  await h.ready(()=>document.querySelector('[role="dialog"]'),'Draft restored on return');assert.equal((document.querySelector('[aria-label="Aufgabentitel"]') as HTMLInputElement).value,title);
 }finally{await h.done()}
});
for(const [view,label]of [['missions','Mission anlegen'],['approvals','Anfrage vorbereiten']])test(`R1: ${view} editor portal follows active workspace and preserves its draft`,async()=>{
 const h=await setup(view);try{await h.click(Array.from(h.host.querySelectorAll('button')).find(b=>b.textContent?.includes(label))!);await h.ready(()=>document.querySelector('[role="dialog"]'),'Editor open');
  await act(async()=>{history.pushState({},'',`https://localhost/?view=${view}&studio=1`);window.dispatchEvent(new PopStateEvent('popstate'));await wait()});assert.equal(document.querySelectorAll('[role="dialog"]').length,0,'Inactive workspace portal must close');
  await act(async()=>{history.pushState({},'',`https://localhost/?view=${view}`);window.dispatchEvent(new PopStateEvent('popstate'));await wait()});await h.ready(()=>document.querySelector('[role="dialog"]'),'Editor draft returns');
 }finally{await h.done()}
});
test('R1: popstate to Studio closes task portal and popstate back restores the draft',async()=>{
 const h=await setup();try{await h.open();await act(async()=>{history.pushState({},'','https://localhost/?view=matrix&studio=1');window.dispatchEvent(new PopStateEvent('popstate'));await wait()});
  assert.equal(document.querySelectorAll('[role="dialog"]').length,0,'History must apply active state to task portal');
  await act(async()=>{history.pushState({},'','https://localhost/?view=matrix');window.dispatchEvent(new PopStateEvent('popstate'));await wait()});await h.ready(()=>document.querySelector('[role="dialog"]'),'History returns to draft');
 }finally{await h.done()}
});
test('R1: explicitly closing the task dialog does not reopen it after mode switches',async()=>{
 const h=await setup();try{await h.open();const close=Array.from(document.querySelectorAll('[role="dialog"] button')).find(b=>/Close|Schließen/.test(b.textContent??''));assert.ok(close);await h.click(close);await h.ready(()=>!document.querySelector('[role="dialog"]'),'Dialog closed');
  for(const text of ['Studio · Graph & Skills','Arbeitsbereiche'])await h.click(Array.from(h.host.querySelectorAll('button')).find(b=>b.textContent===text)!);assert.equal(document.querySelectorAll('[role="dialog"]').length,0);
 }finally{await h.done()}
});
test('R2: task editor clears the review and reopens completion when content changes',async()=>{
 const h=await setup();try{await act(async()=>{const state=structuredClone(h.state().work);Object.assign(state.tasks[0],{status:'Erledigt',reviewed:true,evidence:'Original reviewed evidence'});assert.equal(await h.state().changeWork(state),true);await wait()});await h.click(Array.from(h.host.querySelectorAll('.task-card')).find(card=>card.querySelector('h3')?.textContent===h.state().work.tasks[0].title)!);await h.ready(()=>document.querySelector('[role="dialog"]'),'Reviewed task opened');assert.equal((document.querySelector('[aria-label="Aufgabenstatus"]') as HTMLSelectElement).value,'Erledigt');assert.equal(document.querySelector('.task-editor [role="switch"]')!.getAttribute('aria-checked'),'true');
  const title=document.querySelector('[aria-label="Aufgabentitel"]') as HTMLInputElement;
  await act(async()=>{Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value')!.set!.call(title,'Changed task title after review');title.dispatchEvent(new w.Event('input',{bubbles:true}) as any);await wait()});
  const review=Array.from(document.querySelectorAll('.task-editor [role="switch"]')).find(e=>e.closest('.toggle-row')?.textContent?.includes('Review bestätigt'))??document.querySelector('.task-editor [role="switch"]');assert.ok(review);assert.equal(review.getAttribute('aria-checked'),'false','Editing must visibly clear confirmation');
  assert.equal((document.querySelector('[aria-label="Aufgabenstatus"]') as HTMLSelectElement).value,'Review');
  await h.click(Array.from(document.querySelectorAll('.task-editor button')).find(b=>b.textContent?.includes('Änderung prüfen'))!);await h.click(Array.from(document.querySelectorAll('.task-editor button')).find(b=>b.textContent==='Gezeigte Änderung übernehmen')!);await h.ready(()=>!document.querySelector('[role="dialog"]'),'Updated unreviewed content saved');assert.equal(h.state().work.tasks[0].reviewed,false);assert.equal(h.state().work.tasks[0].title,'Changed task title after review');
 }finally{await h.done()}
});
test('R4: backup screen describes the bounded schema check without claiming semantic validation of historical extras',async()=>{
 const h=await setup();try{await h.click(Array.from(h.host.querySelectorAll('button')).find(b=>b.textContent==='Studio · Graph & Skills')!);await h.ready(()=>Array.from(h.host.querySelectorAll('button')).find(b=>b.textContent==='Backup & Vorschau'),'Studio navigation');await h.click(Array.from(h.host.querySelectorAll('button')).find(b=>b.textContent==='Backup & Vorschau')!);await h.ready(()=>h.host.querySelector('.system-backup'),'Backup screen');const text=h.host.querySelector('.system-backup')!.textContent!;assert.doesNotMatch(text,/vollständig prüfen|Vollständige validierte/);assert.match(text,/Zusätzliche Snapshotfelder bleiben historische Daten/);assert.match(text,/Quellen-IDs und Referenzen/);
 }finally{await h.done()}
});
