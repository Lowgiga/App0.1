import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {Window} from 'happy-dom';
import {IDBFactory} from 'fake-indexeddb';
import {LocalWorkStore} from '../../src/local-adapter.ts';
import {WorkTransportProvider} from '../../src/work-transport.tsx';
import {SharedWorkStateProvider,useWorkState} from '../../src/shared-work-state.tsx';
const w=new Window();Object.assign(globalThis,{window:w,document:w.document,IS_REACT_ACT_ENVIRONMENT:true});
test('old view and Studio share one load and one mutation state',async()=>{const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const store=new LocalWorkStore({indexedDB:new IDBFactory(),name:'shared-'+crypto.randomUUID()});let reads=0;const transport={request:(url:string,init?:RequestInit)=>{if(!init?.method)reads++;return store.request(url,init)}};let first:ReturnType<typeof useWorkState>|undefined,second:ReturnType<typeof useWorkState>|undefined;
function OriginalView(){first=useWorkState();return <span id="old">{first.work.notes.length}</span>}
function Studio(){second=useWorkState();return <span id="new">{second.work.notes.length}</span>}
await act(async()=>{root.render(<WorkTransportProvider transport={transport}><SharedWorkStateProvider><OriginalView/><Studio/></SharedWorkStateProvider></WorkTransportProvider>);await new Promise(r=>setTimeout(r,30))});
for(let i=0;i<20&&!first?.hasLoaded;i++)await act(async()=>new Promise(r=>setTimeout(r,10)));
assert.equal(reads,1);assert.equal(first,second);assert.equal(first!.hasLoaded,true);
await act(async()=>{assert.equal(await first!.changeWork({...first!.work,notes:[{id:crypto.randomUUID(),text:'shared state',createdAt:new Date().toISOString()}]}),true)});
assert.equal(first,second);assert.equal(host.querySelector('#old')?.textContent,'1');assert.equal(host.querySelector('#new')?.textContent,'1');await act(async()=>root.unmount());store.close();host.remove();});
