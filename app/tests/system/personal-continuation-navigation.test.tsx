import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Window} from 'happy-dom';

const w=new Window({url:'https://localhost/'});
for(const key of ['window','document','Node','NodeFilter','Element','HTMLElement','HTMLButtonElement','HTMLFormElement','HTMLInputElement','HTMLSelectElement','HTMLTextAreaElement','Event','MouseEvent','KeyboardEvent','CustomEvent','PopStateEvent','MutationObserver','ResizeObserver','localStorage','location','history'] as const)Object.defineProperty(globalThis,key,{configurable:true,value:key==='window'?w:(w as any)[key]});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:w.navigator});
for(const key of ['matchMedia','addEventListener','removeEventListener','requestAnimationFrame','cancelAnimationFrame','getComputedStyle'] as const)Object.defineProperty(globalThis,key,{configurable:true,value:(w as any)[key].bind(w)});
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true,isSecureContext:true});
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client'),{IDBFactory}=await import('fake-indexeddb');
const {LocalWorkStore}=await import('../../src/local-adapter.ts');
const {WorkTransportProvider}=await import('../../src/work-transport.tsx');
const {SharedWorkStateProvider}=await import('../../src/shared-work-state.tsx');
const {emptyWork}=await import('../../upstream/lib/work-contract.ts');
const navigation:any=await import(new URL('../../src/personal-continuation-navigation.ts',import.meta.url).href).catch(()=>({}));
const {default:SystemApp}=await import('../../src/system-app.tsx');
const {navigateStudioTab}=await import('../../src/mobile/mobile-navigation.ts');
const {navigateOriginal}=await import('../../src/system-navigation.ts');
const data=JSON.parse(fs.readFileSync(new URL('../../upstream/lib/mesh-data.json',import.meta.url),'utf8'));
const AT='2026-10-04T12:00:00.000Z',ID='b1111111-1111-4111-8111-111111111111',OTHER='c1111111-1111-4111-8111-111111111111';
const context={contextId:ID,contextCreatedAt:AT};
const saved={schema:'lowquantflow.personal-view/v1',revision:1,updatedAt:AT,...context};
const contextQuery=(id=ID,at=AT)=>`contextId=${id}&contextCreatedAt=${encodeURIComponent(at)}`;
const wait=()=>new Promise(r=>setTimeout(r,10));
const required=()=>{assert.equal(typeof navigation.readContinuationContext,'function','Continuation route guards are implemented');return navigation};

test('continuation route guards bind a unique UUID and canonical real ISO incarnation',()=>{
 const {readContinuationContext:read}=required();
 assert.deepEqual(read('https://localhost/'),{kind:'none'});
 assert.deepEqual(read('https://localhost/?'+contextQuery()),{kind:'valid',context});
 for(const query of ['contextId='+ID,'contextCreatedAt='+AT,contextQuery('project-title'),contextQuery(ID,'2026-02-30T12:00:00.000Z'),contextQuery(ID,'2026-10-04T12:00:00+00:00'),contextQuery()+'&contextId='+OTHER,contextQuery()+'&contextCreatedAt='+AT])assert.equal(read('https://localhost/?'+query).kind,'invalid',query);
});
test('canonical memory route retains historical workspace view and query but rejects foreign active destinations',()=>{
 const {readContinuationContext:read}=required();
 assert.deepEqual(read('https://localhost/?studio=1&studioTab=memory&view=matrix&q=old&'+contextQuery()),{kind:'valid',context});
 for(const prefix of ['view=matrix&','q=old&','studio=0&','studio=1&studioTab=assistant&','studioTab=graph&','studio=1&studioTab=memory&studioTab=assistant&'])assert.equal(read('https://localhost/?'+prefix+contextQuery()).kind,'invalid',prefix);
});
test('explicit memory destination builder uses studioTab, clears old search, and never serializes arbitrary text',()=>{
 const {continuationMemoryHref}=required();
 const result=new URL(continuationMemoryHref('https://localhost/?view=matrix&q=old&source=local#anchor',{...context,text:'PRIVATE-DRAFT'}));
 assert.equal(result.searchParams.get('studioTab'),'memory');assert.equal(result.searchParams.get('studio'),'1');
 assert.equal(result.searchParams.has('view'),false);assert.equal(result.searchParams.has('q'),false);
 assert.equal(result.searchParams.get('source'),'local');assert.equal(result.hash,'#anchor');assert.ok(!result.href.includes('PRIVATE-DRAFT'));
 assert.throws(()=>continuationMemoryHref('https://localhost/',{...context,contextId:'invalid'}));
});
test('every explicit navigation key blocks stored fallback even when its value is empty or unrecognized',()=>{
 const {hasExplicitContinuationNavigation:explicit}=required();
 assert.equal(explicit('https://localhost/?source=local#anchor'),false);
 for(const key of ['view','q','studio','studioTab','contextId','contextCreatedAt','tab'])assert.equal(explicit('https://localhost/?'+key+'='),true,key);
});

async function setup(options:{url?:string;view?:unknown;strict?:boolean;delayView?:boolean;delayWork?:boolean;workFailure?:boolean;viewFailure?:boolean;room?:'missing'|'reincarnated'|'archived';startView?:'matrix'|'overview'}={}){
 history.replaceState({retained:'history'},'',options.url??'https://localhost/');localStorage.clear();
 Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:new IDBFactory()});
 const store=new LocalWorkStore({indexedDB:new IDBFactory(),name:'continuation-navigation-'+crypto.randomUUID(),sources:data.sources.map((s:any)=>s.id)});
 const work=emptyWork();work.settings.startView=options.startView??'overview';
 work.rooms=options.room==='missing'?[]:[{id:ID,title:'Project A',agent:'codex',project:'custom',mode:'DEEP',goal:'Scoped project',output:'Local',sources:[],status:options.room==='archived'?'Archiviert':'Aktiv',messages:[],createdAt:options.room==='reincarnated'?'2026-10-05T12:00:00.000Z':AT}];
 const {updatedAt,...rest}=work;assert.equal((await store.request('/api/state',{method:'PUT',body:JSON.stringify({...rest,expectedUpdatedAt:null})})).status,200);
 const before=await (await store.request('/api/state')).json();
 const calls:{path:string;operation?:string}[]=[],viewResolvers:((r:Response)=>void)[]=[],workResolvers:(()=>void)[]=[];
 const transport={async request(path:string,init?:RequestInit){
  const body=init?.body?JSON.parse(String(init.body)):undefined;calls.push({path,operation:body?.operation});
  if(path==='/api/personal-continuation'&&body.operation==='read-view'){
   if(options.delayView)return new Promise<Response>(resolve=>viewResolvers.push(resolve));
   return options.viewFailure?Response.json({error:'PRIVATE-UNTRUSTED-ERROR'},{status:503}):Response.json(options.view??saved);
  }
  if(path==='/api/state'&&!init?.method){if(options.delayWork)await new Promise<void>(resolve=>workResolvers.push(resolve));if(options.workFailure)return Response.json({error:'Arbeitsstand nicht erreichbar'},{status:503});}
  return store.request(path,init);
 }};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const render=()=>{const app=<WorkTransportProvider transport={transport}><SharedWorkStateProvider><SystemApp data={data}/></SharedWorkStateProvider></WorkTransportProvider>;root.render(options.strict?<React.StrictMode>{app}</React.StrictMode>:app)};
 await act(async()=>{render();await wait()});
 const ready=async(check:()=>unknown,label:string)=>{for(let i=0;i<150&&!check();i++)await act(async()=>wait());assert.ok(check(),label+' | '+host.textContent?.slice(0,500))};
 const releaseView=async(value:unknown=options.view??saved)=>act(async()=>{for(const resolve of viewResolvers.splice(0))resolve(Response.json(value));await wait()});
 const releaseViewAt=async(index:number,value:unknown)=>act(async()=>{const resolve=viewResolvers.splice(index,1)[0];assert.ok(resolve,'Pending view read '+index);resolve(Response.json(value));await wait()});
 const releaseWork=async()=>act(async()=>{for(const resolve of workResolvers.splice(0))resolve();await wait()});
 const click=async(label:string)=>{const button=Array.from(host.querySelectorAll('button')).find(b=>b.textContent===label);assert.ok(button,label);await act(async()=>{button.click();await wait()})};
 return{host,calls,store,before,ready,click,releaseView,releaseViewAt,releaseWork,async reload(){await act(async()=>{root.render(null);await wait()});await act(async()=>{render();await wait()})},async done(){await act(async()=>root.unmount());for(const r of viewResolvers)r(Response.json(saved));for(const r of workResolvers)r();store.close();host.remove();await w.happyDOM.abort()}};
}
const current=()=>new URL(location.href).searchParams;
test('correcting an invalid context clears its warning when pushState replaces forward history at equal length',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(history,'length');Object.defineProperty(history,'length',{configurable:true,get:()=>3});
 const h=await setup({strict:true,startView:'matrix',url:'https://localhost/?studio=1&studioTab=memory&contextId=invalid'});
 try{await h.ready(()=>h.host.querySelector('[aria-label="Projektkontext"]'),'project selector ready');assert.match(h.host.textContent??'',/Der Projektlink ist unvollständig/);const select=h.host.querySelector('[aria-label="Projektkontext"]') as HTMLSelectElement;await act(async()=>{select.value=ID;select.dispatchEvent(new w.Event('change',{bubbles:true}) as any);await wait()});await h.ready(()=>h.host.textContent?.includes('Revision 0'),'valid context loaded');assert.equal(history.length,3);assert.ok(!h.host.textContent?.includes('Der Projektlink ist unvollständig'));assert.equal(h.calls.filter(call=>call.operation==='read-view').length,1)}finally{await h.done();if(descriptor)Object.defineProperty(history,'length',descriptor);else delete (history as any).length}
});
test('explicit valid project selection clears obsolete startup warning without restarting stored resume',async()=>{
 const h=await setup({strict:true,startView:'matrix',url:'https://localhost/?studio=1&studioTab=memory&contextId=invalid'});
 try{await h.ready(()=>h.host.querySelector('[aria-label="Projektkontext"]'),'project selection ready');assert.match(h.host.textContent??'',/Der Projektlink ist unvollständig/);const select=h.host.querySelector('[aria-label="Projektkontext"]') as HTMLSelectElement;await act(async()=>{select.value=ID;select.dispatchEvent(new w.Event('change',{bubbles:true}) as any);await wait()});await h.ready(()=>h.host.textContent?.includes('Revision 0'),'selected valid context loaded');assert.equal(current().get('contextId'),ID);assert.ok(!h.host.textContent?.includes('Der Projektlink ist unvollständig'));assert.equal(h.calls.some(call=>call.operation==='read-view'),true,'explicit selection may read its own CAS view before remembering, not during startup');assert.equal(h.calls.filter(call=>call.operation==='read-view').length,1)}finally{await h.done()}
});

test('StrictMode startup resumes the saved exact context once using replace without changing shared work',async()=>{
 const beforeLength=history.length,h=await setup({strict:true,startView:'matrix'});
 try{await h.ready(()=>current().get('contextId')===ID,'Saved context resumed');await h.ready(()=>h.host.querySelector('main[aria-label="LowQuantFlow Studio"]:not([hidden])'),'Studio visible');await h.ready(()=>h.host.textContent?.includes('Revision 0'),'Exact project loaded');assert.equal(current().get('studioTab'),'memory');assert.equal(history.length,beforeLength);let after:unknown;await act(async()=>{after=await (await h.store.request('/api/state')).json();await wait()});assert.deepEqual(after,h.before);assert.ok(h.calls.filter(c=>c.path==='/api/personal-continuation').every(c=>c.operation==='read-view'||c.operation==='read'));assert.equal(h.host.querySelectorAll('[data-sidebar="menu-button"]').length,17)}finally{await h.done()}
});
test('startup waits for successful shared work before applying a stored route',async()=>{
 const h=await setup({delayWork:true});try{await act(async()=>wait());assert.equal(current().has('contextId'),false);await h.releaseWork();await h.ready(()=>current().get('contextId')===ID,'Resumed only after shared work loaded')}finally{await h.done()}
});
test('empty personal navigation preserves the configured original start without inventing a project',async()=>{
 const h=await setup({startView:'matrix',view:{schema:'lowquantflow.personal-view/v1',revision:0,updatedAt:null,contextId:null,contextCreatedAt:null}});
 try{await h.ready(()=>current().get('view')==='matrix','Existing startView retained');assert.equal(current().has('contextId'),false);assert.equal(current().has('studio'),false);assert.ok(h.calls.filter(c=>c.path==='/api/personal-continuation').every(c=>c.operation==='read-view'))}finally{await h.done()}
});
test('reload warning distinguishes confirmed draft recovery from unsaved input and automatic process execution',async()=>{
 const h=await setup({url:'https://localhost/?view=overview'}),previous=window.confirm;let warning='';window.confirm=(message?:string)=>{warning=message??'';return false};
 try{await h.click('Neu laden');assert.match(warning,/bestätigt gesicherte persönliche Entwürfe/);assert.match(warning,/noch nicht gesicherte Eingaben/);assert.match(warning,/Projektkontext.*wieder geöffnet/);assert.match(warning,/Prüfprozesse starten nicht automatisch/)}finally{window.confirm=previous;await h.done()}
});
test('valid direct context alone takes precedence and opens canonical memory without consulting saved navigation',async()=>{
 const h=await setup({url:'https://localhost/?'+contextQuery(),view:{...saved,contextId:OTHER}});try{await h.ready(()=>current().get('studioTab')==='memory','Direct memory route opened');assert.equal(current().get('contextId'),ID);assert.equal(h.calls.some(c=>c.operation==='read-view'),false)}finally{await h.done()}
});
for(const query of ['view=matrix','view=overview','q=abc','studio=0','studio=1&studioTab=backup','studioTab=memory','contextId=invalid','studio=1&studioTab=assistant&'+contextQuery(),'studio=1&studioTab=memory&view=matrix&q=old&'+contextQuery()])test('explicit startup request is retained instead of stored navigation: '+query,async()=>{
 const h=await setup({url:'https://localhost/?'+query});try{await h.ready(()=>h.host.querySelector('[data-sidebar="menu-button"]'),'Original workspace mounted');assert.equal(h.calls.some(c=>c.operation==='read-view'),false);if(query.includes('studioTab=backup'))assert.equal(current().get('studioTab'),'backup');if(query.includes('studioTab=assistant'))assert.equal(current().get('studioTab'),'assistant');if(query==='contextId=invalid')assert.equal(current().get('contextId'),'invalid');if(query.startsWith('view=matrix'))assert.equal(current().get('view'),'matrix');if(query.includes('q='))assert.equal(current().get('q'),query.includes('q=old')?'old':'abc')}finally{await h.done()}
});
for(const kind of ['missing','reincarnated'] as const)test('unavailable saved project '+kind+' explains fallback and preserves the configured original start',async()=>{
 const h=await setup({room:kind,startView:'matrix'});try{await h.ready(()=>h.host.textContent?.includes('gespeicherte Projektkontext'),'Visible fallback explanation');assert.equal(current().has('contextId'),false);await h.ready(()=>current().get('view')==='matrix','Configured start retained');assert.ok(h.calls.filter(c=>c.path==='/api/personal-continuation').every(c=>c.operation==='read-view'))}finally{await h.done()}
});
for(const kind of ['view-failure','unknown-schema','malformed-incarnation','work-failure'] as const)test('unreliable startup '+kind+' keeps the safe start with no writes',async()=>{
 const h=await setup({viewFailure:kind==='view-failure',workFailure:kind==='work-failure',view:kind==='unknown-schema'?{...saved,schema:'lowquantflow.personal-view/v999'}:kind==='malformed-incarnation'?{...saved,contextCreatedAt:null}:saved});
 try{await h.ready(()=>h.host.querySelector('[data-sidebar="menu-button"]'),'Safe workspace mounted');assert.equal(current().has('contextId'),false);assert.ok(!h.host.textContent?.includes('PRIVATE-UNTRUSTED-ERROR'));assert.ok(h.calls.filter(c=>c.path==='/api/personal-continuation').every(c=>c.operation==='read-view'));if(kind!=='work-failure')assert.match(h.host.textContent??'',/Startpunkt.*nicht.*geladen/)}finally{await h.done()}
});
test('archived saved project can reopen without a write',async()=>{
 const h=await setup({room:'archived'});try{await h.ready(()=>current().get('contextId')===ID,'Archived context resumed');await h.ready(()=>h.host.textContent?.includes('Revision 0'),'Archived snapshot loaded');assert.match(h.host.textContent??'',/Nur lesen: Projektkontext archiviert/);assert.ok(h.host.querySelector('fieldset')?.disabled);assert.equal(current().get('studioTab'),'memory');assert.ok(h.calls.filter(c=>c.path==='/api/personal-continuation').every(c=>c.operation==='read-view'||c.operation==='read'))}finally{await h.done()}
});
for(const action of ['studio','original','back','same-url-popstate','silent-history-push'] as const)test('delayed startup response cannot override intervening navigation '+action,async()=>{
 const h=await setup({delayView:true,strict:true});try{await h.ready(()=>h.calls.some(c=>c.operation==='read-view'),'Read started');await act(async()=>{if(action==='studio')navigateStudioTab('backup');else if(action==='original')navigateOriginal({view:'matrix',query:'chosen'});else if(action==='silent-history-push')history.pushState({},'','/?view=chats');else{if(action==='back')history.replaceState({},'','/?view=chats');window.dispatchEvent(new PopStateEvent('popstate'));}await wait()});const navigatedHref=location.href;await h.releaseView();await h.ready(()=>h.host.querySelector('[data-sidebar="menu-button"]'),'Workspace mounted after navigation');assert.equal(location.href,navigatedHref);assert.equal(current().has('contextId'),false);if(action==='original'){assert.equal(current().get('view'),'matrix');assert.equal(current().get('q'),'chosen')}}finally{await h.done()}
});
test('StrictMode ignores the discarded first startup response when the newer read is still pending',async()=>{
 const h=await setup({strict:true,delayView:true});try{await h.ready(()=>h.calls.filter(c=>c.operation==='read-view').length===2,'Two StrictMode reads');await h.releaseViewAt(0,{...saved,contextId:OTHER});assert.equal(current().has('contextId'),false);assert.ok(h.host.textContent?.includes('Startpunkt wird geprüft'));await h.releaseViewAt(0,saved);await h.ready(()=>current().get('contextId')===ID,'Only current request resumed')}finally{await h.done()}
});
test('Back and Forward after automatic resume follow history without reopening a remembered route or adding entries',async()=>{
 const h=await setup();try{await h.ready(()=>current().get('contextId')===ID,'Initial resume');const resumed=location.href;await h.click('Arbeitsbereiche');const workspace=location.href,reads=h.calls.filter(c=>c.operation==='read-view').length,length=history.length;let pushes=0;const push=history.pushState.bind(history);history.pushState=((...args:Parameters<History['pushState']>)=>{pushes++;return push(...args)}) as History['pushState'];try{await act(async()=>{history.back();await wait()});await h.ready(()=>location.href===resumed,'Browser Back returned to resumed entry');assert.equal(current().get('studioTab'),'memory');assert.equal(h.host.querySelector('main[aria-label="LowQuantFlow Studio"]')?.hasAttribute('hidden'),false);await act(async()=>{history.forward();await wait()});await h.ready(()=>location.href===workspace,'Browser Forward returned to workspace');assert.equal(current().has('studio'),false);assert.equal(pushes,0);assert.equal(history.length,length);assert.equal(h.calls.filter(c=>c.operation==='read-view').length,reads)}finally{history.pushState=push}}finally{await h.done()}
});
test.after(()=>w.happyDOM.abort());


test('real Studio Memory to Assistant click reloads without warning and returns through retained exact History identity',async()=>{
 const h=await setup({strict:true,url:'https://localhost/?studio=1&studioTab=memory&'+contextQuery()});try{
  await h.ready(()=>h.host.textContent?.includes('Revision 0'),'Memory loaded');await h.click('Assistent');
  assert.equal(current().get('studioTab'),'assistant');assert.equal(current().has('contextId'),false);assert.equal(current().has('contextCreatedAt'),false);
  await h.reload();await h.ready(()=>h.host.querySelector('[aria-label="Assistenten-Projektkontext"] option[value="'+ID+'"]'),'Assistant after reload');
  assert.ok(!h.host.textContent?.includes('Der Projektlink ist unvollständig'));assert.equal((h.host.querySelector('[aria-label="Assistenten-Projektkontext"]') as HTMLSelectElement).value,'');
  await h.click('Projektgedächtnis');await h.ready(()=>h.host.textContent?.includes('Revision 0'),'Memory returned after reload');assert.equal(current().get('contextId'),ID);assert.equal(current().get('contextCreatedAt'),AT);
 }finally{await h.done()}
});

test('History return never assigns the old Memory incarnation to a recreated room UUID after Assistant reload',async()=>{
 const h=await setup({strict:true,url:'https://localhost/?studio=1&studioTab=memory&'+contextQuery()});try{
  await h.ready(()=>h.host.textContent?.includes('Revision 0'),'Memory loaded');await h.click('Assistent');
  const {updatedAt,...state}=await(await h.store.request('/api/state')).json();const response=await h.store.request('/api/state',{method:'PUT',body:JSON.stringify({...state,rooms:state.rooms.map((r:any)=>({...r,createdAt:'2026-10-05T12:00:00.000Z'})),expectedUpdatedAt:updatedAt})});assert.equal(response.status,200);
  await h.reload();await h.ready(()=>h.host.querySelector('[aria-label="Assistenten-Projektkontext"]'),'Assistant reloaded');await h.click('Projektgedächtnis');await h.ready(()=>h.host.textContent?.includes('Projekt nicht mehr vorhanden'),'old project read-only');
  assert.equal(current().get('contextCreatedAt'),AT);assert.equal((h.host.querySelector('[aria-label="Projektkontext"]') as HTMLSelectElement).value,'');assert.ok((h.host.querySelector('[aria-label="Gedächtnistext"]') as HTMLTextAreaElement).closest('fieldset')!.disabled);
 }finally{await h.done()}
});
