import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Window} from 'happy-dom';
import type {WorkTransport} from '../../src/local-adapter.ts';

const w=new Window({url:'https://localhost/'});
for(const key of ['window','document','Node','Element','HTMLElement','HTMLDialogElement','Event','MouseEvent','MutationObserver'] as const)
 Object.defineProperty(globalThis,key,{configurable:true,value:key==='window'?w:(w as any)[key]});
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const {WorkTransportProvider}=await import('../../src/work-transport.tsx');
const panelModule=await import('../../src/LegacyImportPanel.tsx').catch((error:NodeJS.ErrnoException)=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {LegacyImportPanel:null};throw error});
const {LegacyImportPanel}=panelModule;
const summary={newRooms:2,retainedRooms:1,importedPosts:4,skippedPosts:7,duplicatePosts:2,duplicateRecords:3,importedNotes:5,importedTasks:6,defaultedTasks:11,resetMissions:2,resetApprovals:1,importedMarkers:8,importedLearning:9,ignoredEvents:10,ignoredInteractions:11,rejectedRecords:0,retainedMarkers:2,retainedLearning:3,evictedEvents:4};
const preview=(overrides:Record<string,unknown>={})=>({planId:'plan-a',expectedUpdatedAt:'2026-10-01T00:00:00.000Z',summary,inputBytes:123,targetBytes:456,budgetBytes:1750000,remainingBytes:1749544,canCommit:true,...overrides});
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(reason:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
const file=(raw=' { "version": 4 } ',options:Partial<File>={})=>({name:'snapshot.json',size:new TextEncoder().encode(raw).length,text:async()=>raw,...options}) as File;
async function setup(handle:(path:string,init:RequestInit)=>Promise<Response>=async()=>Response.json(preview())){
 assert.equal(typeof LegacyImportPanel,'function','The legacy import preview panel must exist');
 const Panel=LegacyImportPanel!;
 const requests:{path:string;init:RequestInit}[]=[];let reloads=0,exports=0;let onReload:(()=>unknown|Promise<unknown>)|undefined;
 const transport:WorkTransport={request:async(path,init={})=>{requests.push({path,init});return handle(path,init)}};
 let props={blocked:false,active:true,revision:'2026-10-01T00:00:00.000Z' as string|null};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const render=async()=>act(async()=>root.render(<React.StrictMode><WorkTransportProvider transport={transport}><Panel {...props} onCommitted={async()=>{reloads++;return onReload?.()}} onExport={()=>{exports++}}/></WorkTransportProvider></React.StrictMode>));
 await render();
 const button=(text:string)=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes(text));
 const click=async(text:string)=>{const b=button(text);assert.ok(b,'Button: '+text);await act(async()=>b.click())};
 const select=async(value?:File)=>{const input=host.querySelector<HTMLInputElement>('input[type=file]')!;assert.ok(input);Object.defineProperty(input,'files',{configurable:true,value:value?[value]:[]});await act(async()=>input.dispatchEvent(new w.Event('change',{bubbles:true}) as unknown as Event))};
 const emit=async(name:string)=>act(async()=>w.dispatchEvent(new w.Event(name)));
 let closed=false;
 return{host,requests,button,click,select,emit,reloads:()=>reloads,exports:()=>exports,whenReload:(fn:()=>unknown|Promise<unknown>)=>{onReload=fn},update:async(next:Partial<typeof props>)=>{props={...props,...next};await render()},done:async()=>{if(closed)return;closed=true;await act(async()=>root.unmount());host.remove();await w.happyDOM.abort()}};
}

test('legacy import previews unchanged file text without writes before confirmation',async()=>{
 const raw='\n { "title": "ä", "version":4 }\n',h=await setup();try{await h.select(file(raw));assert.deepEqual(h.requests.map(r=>r.path),['/api/imports/preview']);assert.equal(h.requests[0].init.method,'POST');assert.equal(h.requests[0].init.body,raw);assert.ok(h.requests[0].init.signal);assert.ok(h.host.querySelector('dialog[open]'));assert.equal(h.button('Verbindlich zusammenführen')?.disabled,false);assert.match(h.host.textContent??'',/Vorhandene Räume.*vollständig/i);assert.match(h.host.textContent??'',/kein Vollrestore/i);assert.match(h.host.textContent??'',/Einstellungen.*erhalten/)}finally{await h.done()}
});
test('preview exposes budget and accurate skipped-post and evicted-event counts',async()=>{
 const h=await setup(async()=>Response.json(preview({canCommit:false,targetBytes:1750100,remainingBytes:-100})));try{await h.select(file());assert.equal(h.button('Verbindlich zusammenführen')?.disabled,true);assert.match(h.host.textContent??'',/1[.\s]?750[.\s]?100/);assert.match(h.host.textContent??'',/1[.\s]?750[.\s]?000/);assert.match(h.host.textContent??'',/7.*übersprungen/);assert.match(h.host.textContent??'',/4.*Beiträge.*übernommen/);assert.match(h.host.textContent??'',/4.*älteste.*Ereignisse/);assert.match(h.host.textContent??'',/200/);await h.click('Verbindlich zusammenführen');assert.equal(h.requests.length,1)}finally{await h.done()}
});
test('cancel aborts pending preview and ignores late transport results',async()=>{
 const pending=deferred<Response>(),h=await setup(()=>pending.promise);try{await h.select(file());await h.click('Abbrechen');assert.equal(h.requests[0].init.signal?.aborted,true);await act(async()=>pending.resolve(Response.json(preview())));assert.equal(h.host.querySelector('dialog'),null);assert.equal(h.button('Verbindlich zusammenführen'),undefined);assert.equal(h.requests.length,1)}finally{await h.done()}
});
for(const event of ['popstate','cue:navigate'])test(event+' clears preview and suppresses late results',async()=>{
 const pending=deferred<Response>(),h=await setup(()=>pending.promise);try{await h.select(file());await h.emit(event);await act(async()=>pending.resolve(Response.json(preview())));assert.equal(h.host.querySelector('dialog'),null);assert.equal(h.requests[0].init.signal?.aborted,true);assert.equal(h.requests.length,1)}finally{await h.done()}
});
test('native Escape/cancel closes the labelled dialog without committing',async()=>{
 const h=await setup();try{await h.select(file());const dialog=h.host.querySelector('dialog')!;assert.ok(dialog.getAttribute('aria-labelledby'));await act(async()=>dialog.dispatchEvent(new w.Event('cancel',{cancelable:true}) as unknown as Event));assert.equal(h.host.querySelector('dialog'),null);assert.equal(h.requests.length,1)}finally{await h.done()}
});
test('changing files aborts the old preview and only commits the latest plan',async()=>{
 const pending=deferred<Response>();const h=await setup(async(path,init)=>path.endsWith('commit')?Response.json({state:{},receipt:preview({planId:'plan-b'})}):init.body==='first'?pending.promise:Response.json(preview({planId:'plan-b'})));
 try{await h.select(file('first'));await h.select(file('second'));assert.equal(h.requests[0].init.signal?.aborted,true);await act(async()=>pending.resolve(Response.json(preview())));await h.click('Verbindlich zusammenführen');assert.equal(JSON.parse(h.requests[2].init.body as string).planId,'plan-b');assert.equal(h.reloads(),1)}finally{await h.done()}
});
test('file reads resolving after cancellation never open a preview',async()=>{
 const read=deferred<string>(),h=await setup();try{await h.select(file('',{text:()=>read.promise}));await h.click('Abbrechen');await act(async()=>read.resolve('late'));assert.equal(h.requests.length,0);assert.equal(h.host.querySelector('dialog'),null)}finally{await h.done()}
});
test('oversized files are rejected before reading and erase older previews',async()=>{
 let reads=0;const h=await setup();try{await h.select(file());await h.select(file('',{size:3*1024*1024+1,text:async()=>{reads++;return '{}'}}));assert.equal(reads,0);assert.equal(h.requests.length,1);assert.equal(h.button('Verbindlich zusammenführen'),undefined);assert.match(h.host.textContent??'',/3 MiB/);assert.ok(h.host.querySelector('[role=alert]'))}finally{await h.done()}
});
test('empty selection and native file-picker cancellation discard previous previews',async()=>{
 const h=await setup();try{await h.select(file());await h.select();assert.equal(!!h.button('Verbindlich zusammenführen'),false);await h.select(file());const input=h.host.querySelector('input[type=file]')!;await act(async()=>input.dispatchEvent(new w.Event('cancel',{bubbles:true}) as unknown as Event));assert.equal(!!h.button('Verbindlich zusammenführen'),false);assert.equal(h.requests.length,2)}finally{await h.done()}
});
test('invalid preview errors clear prior approval while retaining the export action',async()=>{
 let n=0;const h=await setup(async()=>++n===1?Response.json(preview()):Response.json({error:'Ungültiges JSON.',code:'VALIDATION'},{status:400}));try{await h.select(file());await h.select(file('invalid'));assert.match(h.host.querySelector('[role=alert]')?.textContent??'',/Ungültiges JSON/);assert.equal(h.button('Verbindlich zusammenführen'),undefined);await h.click('Bisherigen Stand exportieren');assert.equal(h.exports(),1)}finally{await h.done()}
});
test('inactive and blocked transitions invalidate previews even when restored',async()=>{
 for(const prop of ['active','blocked'] as const){const pending=deferred<Response>(),h=await setup(()=>pending.promise);try{await h.select(file());await h.update({[prop]:prop==='blocked'});await h.update({[prop]:prop==='active'});await act(async()=>pending.resolve(Response.json(preview())));assert.equal(h.host.querySelector('dialog'),null);assert.equal(h.requests[0].init.signal?.aborted,true)}finally{await h.done()}}
});
test('unmount aborts pending work and late results cannot write or call back',async()=>{
 const pending=deferred<Response>(),h=await setup(()=>pending.promise);await h.select(file());await h.done();assert.equal(h.requests[0].init.signal?.aborted,true);await act(async()=>pending.resolve(Response.json(preview())));assert.equal(h.requests.length,1);assert.equal(h.reloads(),0)
});
test('unmount during commit reloads the surviving owner once and ignores the late receipt',async()=>{
 const pending=deferred<Response>(),h=await setup(async(path)=>path.endsWith('commit')?pending.promise:Response.json(preview()));
 await h.select(file());await h.click('Verbindlich zusammenführen');await h.done();
 assert.equal(h.requests[1].init.signal?.aborted,true);assert.equal(h.reloads(),1,'Unmounted commit outcome must be reconciled by its surviving state owner');
 await act(async()=>pending.resolve(Response.json({state:{updatedAt:'new'},receipt:preview()})));
 assert.equal(h.reloads(),1);assert.equal(h.requests.filter(r=>r.path.endsWith('commit')).length,1);assert.equal(h.host.textContent,'')
});
test('synchronous duplicate confirmation sends one commit and preserves its receipt',async()=>{
 const commit=deferred<Response>(),h=await setup(async(path)=>path.endsWith('commit')?commit.promise:Response.json(preview()));try{await h.select(file());const button=h.button('Verbindlich zusammenführen')!;await act(async()=>{button.click();button.click()});assert.equal(h.requests.filter(r=>r.path.endsWith('commit')).length,1);await act(async()=>commit.resolve(Response.json({state:{updatedAt:'new'},receipt:preview()})));assert.equal(h.reloads(),1);assert.equal(h.host.querySelector('dialog'),null);assert.match(h.host.querySelector('[aria-label="Importbeleg"]')?.textContent??'',/7.*übersprungen/);assert.match(h.host.textContent??'',/Raum-ID gewinnt/);assert.match(h.host.textContent??'',/4.*Beiträge.*übernommen/);await h.select(file());await h.click('Abbrechen');assert.ok(h.host.querySelector('[aria-label="Importbeleg"]'))}finally{await h.done()}
});
test('revision changes re-preview original text and require fresh confirmation',async()=>{
 const pending=deferred<Response>();let n=0;const h=await setup(async()=>++n===1?Response.json(preview()):pending.promise);try{await h.select(file('unaltered original'));await h.update({revision:'2026-10-01T00:00:01.000Z'});assert.equal(h.requests.length,2);assert.equal(h.requests[1].init.body,'unaltered original');assert.equal(h.button('Verbindlich zusammenführen'),undefined);assert.match(h.host.textContent??'',/erneut.*bestätigen/i);await act(async()=>pending.resolve(Response.json(preview({planId:'new-revision'}))));assert.equal(h.button('Verbindlich zusammenführen')?.disabled,false);assert.equal(h.requests.filter(r=>r.path.endsWith('commit')).length,0)}finally{await h.done()}
});
test('409 refreshes retained text and does not automatically retry the commit',async()=>{
 let checks=0;const h=await setup(async(path)=>path.endsWith('commit')?Response.json({error:'Stand geändert',code:'CONFLICT'},{status:409}):Response.json(preview({planId:++checks===1?'old':'fresh'})));try{await h.select(file('original'));await h.click('Verbindlich zusammenführen');assert.equal(h.requests.filter(r=>r.path.endsWith('commit')).length,1);assert.equal(h.requests.filter(r=>r.path.endsWith('preview')).length,2);assert.equal(h.requests[2].init.body,'original');assert.match(h.host.textContent??'',/erneut.*bestätigen/i);assert.equal(h.button('Verbindlich zusammenführen')?.disabled,false);assert.equal(h.host.querySelector('[aria-label="Importbeleg"]'),null)}finally{await h.done()}
});
test('409 survives the shared loading gate and revision transition during its own reload',async()=>{
 const loading=deferred<boolean>();const h=await setup(async(path)=>path.endsWith('commit')?Response.json({error:'Stand geändert'},{status:409}):Response.json(preview()));
 try{h.whenReload(()=>loading.promise);await h.select(file('retained raw'));await h.click('Verbindlich zusammenführen');await h.update({blocked:true});await h.update({revision:'2026-10-02T00:00:00.000Z'});await act(async()=>loading.resolve(true));assert.equal(h.requests.length,2);await h.update({blocked:false});assert.equal(h.requests.length,3);assert.equal(h.requests[2].init.body,'retained raw');assert.equal(h.button('Verbindlich zusammenführen')?.disabled,false);assert.equal(h.requests.filter(r=>r.path.endsWith('commit')).length,1)}finally{await h.done()}
});
test('Legacy-generated task templates are disclosed separately from imported records',async()=>{
 const h=await setup();try{await h.select(file());assert.match(h.host.textContent??'',/Vom Legacy-Format ergänzte Aufgabenvorlagen: 11 \(keine Datensätze der Datei\)/)}finally{await h.done()}
});
test('lost commit response reloads state and warns without an automatic retry',async()=>{
 const h=await setup(async(path)=>{if(path.endsWith('commit'))throw new Error('Antwort verloren');return Response.json(preview())});try{await h.select(file());await h.click('Verbindlich zusammenführen');assert.equal(h.reloads(),1);assert.equal(h.requests.filter(r=>r.path.endsWith('commit')).length,1);assert.equal(h.button('Verbindlich zusammenführen'),undefined);assert.equal(h.host.querySelector('[aria-label="Importbeleg"]'),null);assert.match(h.host.textContent??'',/Ausgang.*unklar/);assert.match(h.host.textContent??'',/vor.*Wiederholung.*prüfen/i)}finally{await h.done()}
});
test('explicit write failure shows the preservation error without claiming success',async()=>{
 const h=await setup(async(path)=>path.endsWith('commit')?Response.json({error:'Schreiben fehlgeschlagen. Bestand bleibt erhalten.',code:'STORAGE_UNAVAILABLE'},{status:503}):Response.json(preview()));try{await h.select(file());await h.click('Verbindlich zusammenführen');assert.match(h.host.querySelector('[role=alert]')?.textContent??'',/Bestand bleibt erhalten/);assert.equal(h.host.querySelector('[aria-label="Importbeleg"]'),null);assert.equal(h.button('Verbindlich zusammenführen'),undefined)}finally{await h.done()}
});
test('final overlay replaces every legacy direct-merge UI path with the new panel',()=>{
 const source=fs.readFileSync(new URL('../../overlay/mesh-app.tsx',import.meta.url),'utf8');assert.match(source,/<LegacyImportPanel blocked=\{busy\|\|loadingWork\|\|storageError\|\|!hasLoaded\}/);assert.doesNotMatch(source,/async function importJSON|async function mergeImport|importRef|detail\?\.kind==='import'|decodeSnapshot|mergeSnapshot/);assert.equal((source.match(/<LegacyImportPanel /g)??[]).length,1);const generator=fs.readFileSync(new URL('../../scripts/build-overlay.mjs',import.meta.url),'utf8');assert.match(generator,/await import\('\.\/build-legacy-import-overlay\.mjs'\);\s*$/)
});
