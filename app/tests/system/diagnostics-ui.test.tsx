import {AppearanceProvider} from '../../src/appearance/AppearanceProvider.tsx';
import {defaultAppearanceState} from '../../src/appearance/contracts.ts';
const appearanceStore={load:async()=>({revision:0,value:defaultAppearanceState()}),close(){}};
import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
const w=new Window({url:'https://localhost/'});
for(const key of ['window','document','Node','Element','HTMLElement','Event','MouseEvent','KeyboardEvent','MutationObserver','Storage'] as const)Object.defineProperty(globalThis,key,{configurable:true,value:key==='window'?w:(w as any)[key]});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:w.navigator});
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const {DiagnosticsPanel}=await import('../../src/studio/DiagnosticsPanel.tsx');
const input={hasLoaded:true,loadingWork:false,storageError:false,preferencesReady:true,preferencesFailed:false,work:{stateVersion:4,tasks:[{title:'SECRET-PRIVATE'}],notes:[],rooms:[],updatedAt:'2026-10-04T10:00:00Z'},system:{schema:'cue.system-state/v1',history:[{outputs:'SECRET-PRIVATE'}]},data:{sources:[{url:'SECRET-PRIVATE'}]}};
async function setup(value:unknown=input){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);await act(async()=>root.render(<DiagnosticsPanel input={value} integrations={[{id:'make',name:'SECRET-PRIVATE',auth:true,state:'verified',note:'SECRET-PRIVATE'}]}/>));return {host,root,async done(){await act(async()=>root.unmount());host.remove();await w.happyDOM.abort()}}}

test('panel has a native keyboard-focusable summary, labeled region and polite status',async()=>{
 const h=await setup();try{
  const section=h.host.querySelector('section[aria-label="Diagnose und Verbindungen"]');assert.ok(section);
  const details=section.querySelector('details');assert.ok(details);assert.equal(details.open,false);
  const summary=details.querySelector('summary');assert.equal(summary?.textContent,'Diagnose und Verbindungen');
  summary!.focus();assert.equal(document.activeElement,summary);
  await act(async()=>summary!.click());assert.equal(details.open,true);
  assert.ok(section.querySelector('[role="status"][aria-live="polite"]'));
  assert.equal(section.querySelectorAll('button,input,select,textarea,a').length,0,'Read-only view has no external action controls');
 }finally{await h.done()}
});

test('preview and DOM expose no raw content and mark four connection dimensions unknown',async()=>{
 const h=await setup();try{
  assert.ok(!h.host.innerHTML.includes('SECRET-PRIVATE'));
  const text=h.host.textContent??'';assert.match(text,/Historischer Katalogeintrag/);
  for(const label of ['Gespeicherte Konfiguration','Erreichbarkeit','Anmeldung','Aktion geprüft'])assert.match(text,new RegExp(label));
  assert.match(text,/Aktueller Lauf: unbekannt/);assert.match(text,/Historische Ergebnisse sind keine Live-Nachweise/);
  const preview=JSON.parse(h.host.querySelector('pre')!.textContent!);
  assert.equal(preview.diagnostics.workflow.historyCount,1);assert.equal(preview.diagnostics.lastConfirmedCheckAt,null);
  for(const row of preview.connections)assert.equal(row.evidence.authenticated.current,'unknown');
  assert.match(text,/Diagnoseexport ist nicht implementiert/);
 }finally{await h.done()}
});

test('blocked data renders fixed cause and safe next step rather than supplied message',async()=>{
 const h=await setup({...input,storageError:true,preferencesFailed:true,error:{code:'CONFLICT',message:'SECRET-PRIVATE'}});try{
  assert.match(h.host.textContent??'',/Speicherkonflikt/);assert.match(h.host.textContent??'',/Entwürfe/);
  assert.ok(!h.host.innerHTML.includes('SECRET-PRIVATE'));
  await act(async()=>h.root.render(<DiagnosticsPanel input={{...input,hasLoaded:false,preferencesReady:false,preferencesFailed:false,loadingWork:true}} integrations={null}/>));
  assert.match(h.host.textContent??'',/Wird geladen/);
 }finally{await h.done()}
});

test('panel performs no network requests or localStorage writes',async()=>{
 const oldFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('NETWORK_FORBIDDEN')};
 const oldSet=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw Error('PERSISTENCE_FORBIDDEN')};
 try {const h=await setup();await h.done()}finally{globalThis.fetch=oldFetch;Storage.prototype.setItem=oldSet}
});

test('Studio exposes diagnosis even when its preferences fail to load',async()=>{
 const {default:Studio}=await import('../../src/studio/Studio.tsx');
 const {SystemPreferencesProvider}=await import('../../src/system-preferences.tsx');
 const {SharedWorkStateProvider}=await import('../../src/shared-work-state.tsx');
 const {WorkTransportProvider}=await import('../../src/work-transport.tsx');
 const {emptyWork}=await import('../../upstream/lib/work-contract.ts');
 const work=emptyWork(),transport={async request(){return new Response(JSON.stringify(work),{status:200,headers:{'Content-Type':'application/json'}})}};
 const store={async load(){throw Error('synthetic preference failure')},close(){}};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try {
  await act(async()=>{root.render(<WorkTransportProvider transport={transport as any}><SharedWorkStateProvider><SystemPreferencesProvider store={store as any}><AppearanceProvider store={appearanceStore as any}><Studio data={{sources:[],integrations:[{id:'make',auth:true}]}}/></AppearanceProvider></SystemPreferencesProvider></SharedWorkStateProvider></WorkTransportProvider>);await new Promise(r=>setTimeout(r,10))});
  const section=host.querySelector('section[aria-label="Diagnose und Verbindungen"]');assert.ok(section,'Diagnostics must survive preferences loading failure');
  assert.match(section.textContent??'',/Studio-Einstellungen: Gesperrt/);
  assert.ok(!section.textContent?.includes('synthetic preference failure'));
 }finally{await act(async()=>root.unmount());host.remove();await w.happyDOM.abort()}
});
