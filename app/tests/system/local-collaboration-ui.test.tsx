// Permanent regression adapted from independent V6 delta reproduction. DOM/IO doubles only.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {Window} from 'happy-dom';
const w=new Window({url:'https://localhost/'});
const fileWrites:{name:string;text:string}[]=[];let copied='';(w as any).showSaveFilePicker=async(options:any)=>{let text='';return{createWritable:async()=>({write:async(value:string)=>{text=value},close:async()=>{fileWrites.push({name:options.suggestedName,text})},abort:async()=>{}})}};Object.defineProperty(w,'isSecureContext',{configurable:true,value:true});
for(const key of ['window','document','Node','NodeFilter','Element','HTMLInputElement','HTMLFormElement','HTMLTextAreaElement','HTMLSelectElement','HTMLElement','HTMLButtonElement','Event','MouseEvent','KeyboardEvent','CustomEvent','PopStateEvent','MutationObserver','ResizeObserver','localStorage','location','history'] as const)Object.defineProperty(globalThis,key,{configurable:true,value:key==='window'?w:(w as any)[key]});
Object.defineProperty(w.navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{copied=text}}});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:w.navigator});
for(const key of ['matchMedia','addEventListener','removeEventListener','requestAnimationFrame','cancelAnimationFrame','getComputedStyle'] as const)Object.defineProperty(globalThis,key,{configurable:true,value:(w as any)[key].bind(w)});
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true,isSecureContext:true});
const React=await import('react'),{act}=React;const {createRoot}=await import('react-dom/client');
const {IDBFactory}=await import('fake-indexeddb');const {PreferencesStore}=await import('../../src/preferences-store.ts');const {LocalWorkStore}=await import('../../src/local-adapter.ts');
const {WorkTransportProvider}=await import('../../src/work-transport.tsx');const {SharedWorkStateProvider,useWorkState}=await import('../../src/shared-work-state.tsx');
const {default:SystemApp}=await import('../../src/system-app.tsx');const {defaultSystemState}=await import('../../src/system-state.ts');
const data=JSON.parse(fs.readFileSync(new URL('../../upstream/lib/mesh-data.json',import.meta.url),'utf8'));
const wait=()=>new Promise(r=>setTimeout(r,15));
async function setup({powerSaver=false,motion='off',saved=true}={}){
 history.replaceState({},'','https://localhost/');localStorage.clear();Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:new IDBFactory()});const prefs=defaultSystemState();prefs.graph.quality='high';prefs.graph.reducedMotion=false;prefs.graph.transitions='smooth';localStorage.setItem('cue-system-preferences-v1',JSON.stringify(prefs));
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const store=new LocalWorkStore({indexedDB:new IDBFactory(),name:'review-'+crypto.randomUUID(),sources:data.sources.map((s:any)=>s.id)});let shared:any;
 function Probe(){shared=useWorkState();return null}
 await act(async()=>{root.render(<React.StrictMode><WorkTransportProvider transport={store}><SharedWorkStateProvider><Probe/><SystemApp data={data}/></SharedWorkStateProvider></WorkTransportProvider></React.StrictMode>);await wait()});
 for(let i=0;i<100&&!shared?.hasLoaded;i++)await act(async()=>wait());assert.equal(shared.hasLoaded,true);
 if(saved)await act(async()=>{assert.equal(await shared.changeWork({...shared.work,settings:{...shared.work.settings,powerSaver,motion}}),true);await wait()});
 const find=(text:string)=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes(text));
 const click=async(text:string)=>{const b=find(text);assert.ok(b,'Button: '+text);await act(async()=>{b.click();await wait()})};
 const ready=async(sel:string)=>{for(let i=0;i<100&&!host.querySelector(sel);i++)await act(async()=>wait());assert.ok(host.querySelector(sel),sel)};
 const done=async()=>{await act(async()=>root.unmount());store.close();host.remove();await w.happyDOM.abort()};
 return{host,shared:()=>shared,click,ready,done};
}
test('local provenance regression: unsaved example state cannot export a personal cooperation brief',async()=>{
 const h=await setup({saved:false});try{await h.click('Agenten');await h.ready('.coordination-panel');for(const text of ['Low-Arbeitsbrief kopieren','Brief als JSON']){const button=Array.from(h.host.querySelectorAll('button')).find(b=>b.textContent?.includes(text))!;assert.equal(button.disabled,true,text)}assert.equal(h.shared().work.updatedAt,null);assert.match(h.host.querySelector('.coordination-panel')!.textContent??'',/Lokaler Arbeitsbrief dieser Installation/)}finally{await h.done()}
});
test('local provenance regression: file and clipboard briefs retain local-installation provenance outside their UI',async()=>{
 const h=await setup();try{await h.click('Agenten');await h.ready('.coordination-panel');fileWrites.length=0;copied='';const before=JSON.stringify(h.shared().work);await h.click('Brief als JSON');await h.click('Low-Arbeitsbrief kopieren');assert.equal(fileWrites.length,1);const file=fileWrites[0];assert.equal(file.name,'mesh-low-arbeitsbrief.json');const brief=JSON.parse(file.text);const preview=JSON.parse(h.host.querySelector('.coordination-panel pre')!.textContent!);assert.equal(brief.briefHash,preview.briefHash);const {buildCollaborationBrief:websiteBrief}=await import('../../upstream/lib/collaboration-model.ts');const {reportMatchesBrief}=await import('../../src/local-collaboration.ts');assert.notEqual(brief.briefHash,websiteBrief(h.shared().work).briefHash);const copiedBrief=JSON.parse(copied.slice(copied.indexOf('{'),copied.lastIndexOf('}')+1));assert.equal(copiedBrief.briefHash,brief.briefHash);assert.deepEqual(copiedBrief.context,preview.context);assert.equal(reportMatchesBrief({...brief,briefHash:websiteBrief(h.shared().work).briefHash} as any,h.shared().work),false);assert.equal(brief.state,'prepared-not-delivered');assert.equal(brief.context.updatedAt,h.shared().work.updatedAt);assert.ok(copied.includes(brief.briefHash));assert.equal(JSON.stringify(h.shared().work),before);console.log('COOP_EXPORTED_CONTEXT',JSON.stringify(brief.context));assert.match(file.text,/device-local|local-installation|Lokaler Arbeitsbrief|lokale Installation/,'Exported JSON itself must identify device-local state; UI-only caveat is lost when shared');assert.match(copied,/device-local|local-installation|Lokaler Arbeitsbrief|lokale Installation/)}finally{await h.done()}
});
