import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {Window} from 'happy-dom';
const w=new Window({url:'https://localhost/'});
for(const key of ['window','document','HTMLElement','HTMLButtonElement','Event','MouseEvent','KeyboardEvent','CustomEvent','MutationObserver','ResizeObserver','localStorage','location','history'] as const)Object.defineProperty(globalThis,key,{configurable:true,value:key==='window'?w:(w as any)[key]});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:w.navigator});
// HappyDOM has no Web Locks; this exclusive, ifAvailable-only double models the browser contract.
const heldLocks=new Set<string>();Object.defineProperty(w.navigator,'locks',{configurable:true,value:{async request(name:string,options:any,callback:any){assert.equal(options.mode,'exclusive');assert.equal(options.ifAvailable,true);if(heldLocks.has(name))return callback(null);heldLocks.add(name);try{return await callback({name,mode:'exclusive'})}finally{heldLocks.delete(name)}}}});
for(const key of ['matchMedia','addEventListener','removeEventListener','requestAnimationFrame','cancelAnimationFrame','getComputedStyle'] as const)Object.defineProperty(globalThis,key,{configurable:true,value:(w as any)[key].bind(w)});
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true,isSecureContext:true});
const React=await import('react'),{act}=React;const {createRoot}=await import('react-dom/client');
const {IDBFactory}=await import('fake-indexeddb');Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:new IDBFactory()});
const {LocalWorkStore}=await import('../../src/local-adapter.ts');
const {WorkTransportProvider}=await import('../../src/work-transport.tsx');
const {SharedWorkStateProvider}=await import('../../src/shared-work-state.tsx');
const {default:SystemApp}=await import('../../src/system-app.tsx');
const data=JSON.parse(fs.readFileSync(new URL('../../upstream/lib/mesh-data.json',import.meta.url),'utf8'));
const wait=()=>new Promise(r=>setTimeout(r,25));
test('real integrated DOM opens Studio, computes actual checks and returns to original Academy',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const store=new LocalWorkStore({indexedDB:new IDBFactory(),name:'ui-'+crypto.randomUUID(),sources:data.sources.map((s:any)=>s.id)});const oldFetch=globalThis.fetch;const oldError=console.error;const errors:unknown[][]=[];console.error=(...args)=>{errors.push(args);oldError(...args)};let fetches=0;globalThis.fetch=async()=>{fetches++;throw new Error('Unexpected external fetch')};
 const click=async(text:string)=>{const button=Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes(text));assert.ok(button,'button '+text);await act(async()=>{button.dispatchEvent(new w.MouseEvent('click',{bubbles:true}) as any);await wait()})};
 try{await act(async()=>{root.render(<WorkTransportProvider transport={store}><SharedWorkStateProvider><SystemApp data={data}/></SharedWorkStateProvider></WorkTransportProvider>);await wait()});for(let i=0;i<10&&!host.textContent?.includes('Lokaler Arbeitsstand bereit');i++)await act(async()=>wait());
  await click('Studio · Graph & Skills');for(let i=0;i<10&&!host.textContent?.includes('Gemeinsame Arbeitsansicht');i++)await act(async()=>wait());assert.ok(host.querySelector('[aria-label="Gemeinsamer Graph Explorer"]'));
  await click('Kombinierte Fläche');assert.ok(host.querySelector('[aria-label="Adaptive Studio-Fläche"]'));assert.match(host.textContent??'',/Interne Schema-Version 1/);await click('Skills & Prüfprozesse');for(let i=0;i<10&&!host.textContent?.includes('4 gebündelte');i++)await act(async()=>wait());for(let i=0;i<20&&Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Lokale Prüfung starten')?.disabled;i++)await act(async()=>wait());await click('Lokale Prüfung starten');for(let i=0;i<20&&!host.textContent?.includes('4 bestätigte Schritte');i++)await act(async()=>wait());assert.match(host.textContent??'',/Abgeschlossen · 4 bestätigte Schritte/);assert.match(host.textContent??'',/offline-deterministic/);
  await click('Backup & Vorschau');assert.ok(host.querySelector('[aria-label="Vollständige Backup-Vorschau"]'));assert.match(host.textContent??'',/Vorschau ohne Wiederherstellung/);
  await click('Bestehendes 3D, AR & Academy');for(let i=0;i<10&&!host.querySelector('[aria-label="Mesh Academy"]');i++)await act(async()=>wait());assert.ok(host.querySelector('[aria-label="Mesh Academy"]'));assert.equal(new URL(location.href).searchParams.has('studio'),false);assert.equal(new URL(location.href).searchParams.get('view'),'space');assert.equal(fetches,0);assert.equal(errors.length,0,'Unexpected React error or warning');const {PreferencesStore}=await import('../../src/preferences-store.ts');const prefsStore=new PreferencesStore();assert.equal((await prefsStore.load()).value.historyPolicy,'historical-only-no-resume');prefsStore.close();
 }finally{await act(async()=>root.unmount());store.close();globalThis.fetch=oldFetch;console.error=oldError;host.remove();w.happyDOM.abort();}
});
