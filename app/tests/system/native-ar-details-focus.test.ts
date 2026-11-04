import {AppearanceProvider} from '../../src/appearance/AppearanceProvider.tsx';
import {defaultAppearanceState} from '../../src/appearance/contracts.ts';
const appearanceStore={load:async()=>({revision:0,value:defaultAppearanceState()}),close(){}};
// Real React/StrictMode MeshSpace, mocked native service boundary. No browser pixel/device claim.
// Included in the regular integration suite.
import type {NativeSnapshot,NativeARResult} from '../../src/platform/native-ar';
import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(new URL('../../package.json',import.meta.url));const {Window}=require('happy-dom');
const w=new Window({url:'https://localhost/'});for(const k of ['window','document','Node','Element','HTMLElement','HTMLInputElement','HTMLSelectElement','Event','MouseEvent','KeyboardEvent','CustomEvent','MutationObserver','ResizeObserver','localStorage','location','history'])Object.defineProperty(globalThis,k,{configurable:true,value:k==='window'?w:w[k]});Object.defineProperty(globalThis,'navigator',{configurable:true,value:w.navigator});for(const k of ['matchMedia','addEventListener','removeEventListener','requestAnimationFrame','cancelAnimationFrame','getComputedStyle'])Object.defineProperty(globalThis,k,{configurable:true,value:w[k].bind(w)});Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true,isSecureContext:true});
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client');const {default:MeshSpace}=await import('../../overlay/mesh-space.tsx');const{emptyWork}=await import('../../upstream/lib/work-contract.ts');const{nativeARService:service}=await import('../../src/platform/native-ar-runtime.ts');
for(const transition of ['none','hidden','revision'])test('native detail focus respects latest context: '+transition,async()=>{
 let finish!:(result:NativeARResult)=>void,snapshot!:NativeSnapshot,scrolls=0,writes=0;const original={native:service.native,open:service.open};Object.defineProperty(w.HTMLElement.prototype,'scrollIntoView',{configurable:true,value(){if(this.classList.contains('node-inspector'))scrolls++}});service.native=true;service.open=async s=>{snapshot=s;return new Promise(r=>finish=r)};const data={sources:[]};let active=true,work=emptyWork();work.updatedAt='2026-10-01T00:00:00Z';const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const tree=()=>React.createElement(React.StrictMode,null,React.createElement(AppearanceProvider,{store:appearanceStore as any},React.createElement(MeshSpace,{active,work,known:true,disabled:false,save:async()=>{writes++;return false},data,go:()=>{}})));
 try{
  await act(async()=>root.render(tree()));const button=[...host.querySelectorAll('button')].find(b=>b.textContent==='AR-Hinweise öffnen');assert.ok(button);assert.equal(button.disabled,false);await act(async()=>button.click());assert.ok(finish);const id=snapshot.nodes[1].id;
  await act(async()=>{finish({status:'closed',placed:false,snapshotRevision:snapshot.snapshotRevision,selectedNodeId:id,openDetails:true});if(transition==='hidden')active=false;if(transition==='revision')work={...work,updatedAt:'2026-10-01T00:00:01Z'};root.render(tree())});
  assert.equal(scrolls,transition==='none'?1:0,'only current active detail intent may focus');
  if(transition==='hidden'){await act(async()=>{active=true;root.render(tree())});assert.equal(scrolls,0,'superseded request must not revive on re-entry')}
  assert.equal(writes,0);
 }finally{await act(async()=>root.unmount());host.remove();Object.assign(service,original);await w.happyDOM.abort()}
});
