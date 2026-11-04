import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
const w=new Window({url:'https://localhost/'});
for(const k of ['window','document','Node','Element','HTMLElement','HTMLButtonElement','Event','CustomEvent','MouseEvent','KeyboardEvent','MutationObserver','ResizeObserver'] as const)Object.defineProperty(globalThis,k,{configurable:true,value:k==='window'?w:(w as any)[k]});
for(const k of ['matchMedia','requestAnimationFrame','cancelAnimationFrame'] as const)Object.defineProperty(globalThis,k,{configurable:true,value:(w as any)[k].bind(w)});
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const {CompanionPanel}=await import('../../src/companion/CompanionPanel.tsx');
import type {CompanionPanelProps} from '../../src/companion/CompanionPanel.tsx';
async function mount(extra:Partial<CompanionPanelProps>={}){
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 let props:CompanionPanelProps={enabled:true,motionEnabled:false,powerSaver:false,...extra};
 const render=async()=>{await act(async()=>root.render(<React.StrictMode><CompanionPanel {...props}/></React.StrictMode>))};await render();
 return {host,async set(p:Partial<CompanionPanelProps>){props={...props,...p};await render()},async close(){await act(async()=>root.unmount());host.remove()}};
}
test('optional panel defaults hidden; static mode offers the full accessible status',async()=>{
 const h=await mount({enabled:false});try{assert.equal(h.host.textContent,'');await h.set({enabled:true});assert.match(h.host.textContent??'',/kein Auftrag/);assert.ok(h.host.querySelector('[role="status"]'));assert.ok(h.host.querySelector('svg'));assert.equal(h.host.querySelector('canvas'),null)}finally{await h.close()}
});
test('simulation and hostile markup are rendered as labeled plain text with no action rights',async()=>{
 const h=await mount({event:{type:'simulatedResult',eventId:'sim',requestId:'r1',summary:'<button onclick="commit()">Gespeichert</button>'}});
 try{const bubble=h.host.querySelector('[role="status"]')!;assert.match(bubble.textContent??'',/Offline-Simulation/);assert.match(bubble.textContent??'',/<button/);assert.equal(bubble.querySelector('button'),null);await act(async()=>bubble.dispatchEvent(new w.MouseEvent('click',{bubbles:true}) as any));assert.equal(h.host.querySelectorAll('[data-receipt]').length,0)}finally{await h.close()}
});
test('pause control changes presentation only; warnings remain visible',async()=>{
 const h=await mount({motionEnabled:true,powerSaver:true,event:{type:'awaitingConfirmation',eventId:'confirm',requestId:'r1'}});
 try{assert.match(h.host.textContent??'',/ausdrückliche Bestätigung/);const button=h.host.querySelector('[aria-label="Begleiterbewegung pausieren"]') as HTMLButtonElement;assert.ok(button);await act(async()=>button.click());assert.match(h.host.textContent??'',/ausdrückliche Bestätigung/);assert.equal(h.host.querySelector('canvas'),null);assert.equal(h.host.querySelector('[aria-pressed="true"]')?.textContent,'Bewegung fortsetzen')}finally{await h.close()}
});
