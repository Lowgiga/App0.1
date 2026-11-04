import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {Window} from 'happy-dom';
const w=new Window({url:'https://localhost/'});
for(const key of ['window','document','Node','NodeFilter','Element','HTMLInputElement','HTMLFormElement','HTMLTextAreaElement','HTMLSelectElement','HTMLElement','HTMLButtonElement','Event','MouseEvent','KeyboardEvent','CustomEvent','PopStateEvent','MutationObserver','ResizeObserver','localStorage','location','history'] as const)Object.defineProperty(globalThis,key,{configurable:true,value:key==='window'?w:(w as any)[key]});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:w.navigator});
for(const key of ['matchMedia','addEventListener','removeEventListener','requestAnimationFrame','cancelAnimationFrame','getComputedStyle'] as const)Object.defineProperty(globalThis,key,{configurable:true,value:(w as any)[key].bind(w)});
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true,isSecureContext:true});
const pickerCalls:any[]=[];
(w as any).showSaveFilePicker=(options:any)=>new Promise((resolve,reject)=>pickerCalls.push({options,resolve,reject}));
const React=await import('react'),{act}=React;const {createRoot}=await import('react-dom/client');
const {IDBFactory}=await import('fake-indexeddb');Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:new IDBFactory()});const {PreferencesStore}=await import('../src/preferences-store.ts');const {LocalWorkStore}=await import('../src/local-adapter.ts');
const {WorkTransportProvider}=await import('../src/work-transport.tsx');const {SharedWorkStateProvider,useWorkState}=await import('../src/shared-work-state.tsx');
const {default:SystemApp}=await import('../src/system-app.tsx');const {defaultSystemState}=await import('../src/system-state.ts');
const data=JSON.parse(fs.readFileSync(new URL('../upstream/lib/mesh-data.json',import.meta.url),'utf8'));
const wait=()=>new Promise(r=>setTimeout(r,15));
async function setup({powerSaver=false,motion='off'}={}){
 history.replaceState({},'','https://localhost/');Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:new IDBFactory()});localStorage.clear();Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:new IDBFactory()});const prefs=defaultSystemState();prefs.graph.quality='high';prefs.graph.reducedMotion=false;prefs.graph.transitions='smooth';localStorage.setItem('cue-system-preferences-v1',JSON.stringify(prefs));
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const store=new LocalWorkStore({indexedDB:new IDBFactory(),name:'review-'+crypto.randomUUID(),sources:data.sources.map((s:any)=>s.id)});let shared:any;
 function Probe(){shared=useWorkState();return null}
 await act(async()=>{root.render(<WorkTransportProvider transport={store}><SharedWorkStateProvider><Probe/><SystemApp data={data}/></SharedWorkStateProvider></WorkTransportProvider>);await wait()});
 for(let i=0;i<100&&!shared?.hasLoaded;i++)await act(async()=>wait());assert.equal(shared.hasLoaded,true);
 await act(async()=>{assert.equal(await shared.changeWork({...shared.work,settings:{...shared.work.settings,powerSaver,motion}}),true);await wait()});
 const find=(text:string)=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes(text));
 const click=async(text:string)=>{const b=find(text);assert.ok(b,'Button: '+text);for(let i=0;i<100&&b.disabled;i++)await act(async()=>wait());assert.equal(b.disabled,false,'Button enabled: '+text);await act(async()=>{b.click();await wait()})};
 const ready=async(sel:string)=>{for(let i=0;i<100&&!host.querySelector(sel);i++)await act(async()=>wait());assert.ok(host.querySelector(sel),sel)};
 const done=async()=>{await act(async()=>root.unmount());store.close();host.remove();await w.happyDOM.abort()};
 return{host,shared:()=>shared,click,ready,done};
}

const {documents}=await import('../overlay/local-documents.ts');
const {findLocalDocument}=await import('../src/local-documents.ts');
const names=['cue-team-initialisierung.md','cue-handoff.md','low-handoff.md','make-pruefung.json'];
const sourceButtons=(h:any)=>Array.from(h.host.querySelectorAll<HTMLButtonElement>('.source-card .source-link')) as HTMLButtonElement[];
const saveButton=()=>document.querySelector<HTMLButtonElement>('.local-source-document button')!;
const sourceStatus=()=>document.querySelector('.local-source-document [role="status"]');
const docText=()=>document.querySelector('.local-document-text')?.textContent;
async function source(h:any,index:number){await act(async()=>{sourceButtons(h)[index].click();await wait()})}
async function save(){await act(async()=>{saveButton().click();await wait()})}
async function close(){await act(async()=>{document.querySelector<HTMLButtonElement>('[data-slot="sheet-close"]')!.click();await wait()})}
async function settle(call:any,status:'saved'|'cancelled'|'failure'){
 let written:string|undefined,closed=0,aborted=0;
 await act(async()=>{if(status==='cancelled')call.reject(new DOMException('User cancelled','AbortError'));else call.resolve({createWritable:async()=>({write:async(text:string)=>{written=text;if(status==='failure')throw new Error('DISK_FULL')},close:async()=>{closed++},abort:async()=>{aborted++}})});await wait()});
 return{written,closed,aborted};
}
test('independent review: exact four keys and Buffer equality preserve original UTF-8 bytes',()=>{
 assert.deepEqual(Object.keys(documents).sort(),names.map(n=>'/documents/'+n).sort());
 for(const name of names){const bytes=fs.readFileSync(new URL('../upstream/public/documents/'+name,import.meta.url));assert.deepEqual(Buffer.from(findLocalDocument('/documents/'+name)!.text,'utf8'),bytes)}
 for(const value of ['/documents/cue-handoff.md/','/documents//cue-handoff.md','/DOCUMENTS/cue-handoff.md',' /documents/cue-handoff.md','/documents/cue-handoff.md\u0000','data:text/plain,hello',new String('/documents/cue-handoff.md'),['/documents/cue-handoff.md']])assert.equal(findLocalDocument(value),null);
});
test('independent review: mounted Source Sheet has no automatic fetch and uses exact original content',async()=>{
 const originalFetch=globalThis.fetch;let fetches=0;globalThis.fetch=async()=>{fetches++;throw new Error('Unexpected fetch')};const initial=pickerCalls.length;const h=await setup();
 try{await h.click('Evidenz');for(const index of [0,1,2]){await source(h,index);assert.equal(docText(),findLocalDocument(data.sources[index].file)!.text);assert.equal(document.querySelector('.local-source-document')!.querySelector('iframe,img,script,a'),null);await close()}assert.equal(fetches,0);assert.equal(pickerCalls.length,initial)}finally{globalThis.fetch=originalFetch;await h.done()}
});
test('independent review: full runtime suppresses duplicate exports and protects the next document from stale completion',async()=>{
 const h=await setup();const initial=pickerCalls.length;
 try{await h.click('Evidenz');await source(h,0);await act(async()=>{saveButton().click();saveButton().click();await wait()});assert.equal(pickerCalls.length,initial+1);assert.equal(saveButton().disabled,true);assert.equal(sourceStatus(),null);
 await close();await source(h,1);assert.equal(sourceStatus(),null);await save();assert.equal(pickerCalls.length,initial+1);assert.match(sourceStatus()!.textContent??'',/nicht bestätigt/);
 await settle(pickerCalls[initial],'cancelled');assert.match(sourceStatus()!.textContent??'',/nicht bestätigt/);assert.doesNotMatch(sourceStatus()!.textContent??'',/abgebrochen/);
 await save();assert.equal(pickerCalls.length,initial+2);assert.equal(pickerCalls[initial+1].options.suggestedName,'make-pruefung.json');const result=await settle(pickerCalls[initial+1],'saved');assert.equal(result.written,findLocalDocument('/documents/make-pruefung.json')!.text);assert.equal(result.closed,1);assert.match(sourceStatus()!.textContent??'',/am gewählten Ort gespeichert/)
 }finally{await h.done()}
});
test('independent review: cancel and write failure are distinct, with retry available after each',async()=>{
 const h=await setup();const initial=pickerCalls.length;
 try{await h.click('Evidenz');await source(h,2);await save();await settle(pickerCalls[initial],'cancelled');assert.match(sourceStatus()!.textContent??'',/abgebrochen/);assert.equal(saveButton().disabled,false);await save();const failure=await settle(pickerCalls[initial+1],'failure');assert.equal(failure.closed,0);assert.equal(failure.aborted,1);assert.match(sourceStatus()!.textContent??'',/nicht bestätigt/);assert.equal(saveButton().disabled,false);await save();await settle(pickerCalls[initial+2],'saved');assert.match(sourceStatus()!.textContent??'',/am gewählten Ort gespeichert/)
 }finally{await h.done()}
});
test('independent review: completion while original workspace is hidden leaves no document portal or stale notice on return',async()=>{
 const h=await setup();const initial=pickerCalls.length;
 try{await h.click('Evidenz');await source(h,0);await save();await h.click('Studio · Graph & Skills');assert.equal(document.querySelector('[role="dialog"]'),null);assert.equal(document.querySelector('.local-document-text'),null);await settle(pickerCalls[initial],'saved');assert.equal(document.querySelector('[role="dialog"]'),null);await h.click('Arbeitsbereiche');assert.equal(sourceStatus(),null);if(document.querySelector('[role="dialog"]'))await close();await source(h,2);assert.equal(sourceStatus(),null);assert.equal(docText(),findLocalDocument('/documents/cue-handoff.md')!.text)
 }finally{await h.done()}
});
test('independent review: pending save may settle after unmount without portals or lock leakage',async()=>{
 const h=await setup();const initial=pickerCalls.length;await h.click('Evidenz');await source(h,0);await save();await h.done();assert.equal(document.querySelector('[role="dialog"]'),null);await settle(pickerCalls[initial],'saved');assert.equal(document.querySelector('.local-document-text'),null);
 const h2=await setup();try{await h2.click('Evidenz');await source(h2,1);await save();assert.equal(pickerCalls.length,initial+2);await settle(pickerCalls[initial+1],'cancelled');assert.match(sourceStatus()!.textContent??'',/abgebrochen/)}finally{await h2.done()}
});
