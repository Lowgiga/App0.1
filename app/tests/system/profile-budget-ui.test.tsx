import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
const w=new Window({url:'https://localhost/'});
for(const key of ['window','document','Node','NodeFilter','Element','HTMLElement','HTMLButtonElement','HTMLInputElement','HTMLSelectElement','Event','CustomEvent','MouseEvent','KeyboardEvent','FocusEvent','MutationObserver','ResizeObserver'] as const)Object.defineProperty(globalThis,key,{configurable:true,value:key==='window'?w:(w as any)[key]});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:w.navigator});
for(const key of ['matchMedia','requestAnimationFrame','cancelAnimationFrame','getComputedStyle'] as const)Object.defineProperty(globalThis,key,{configurable:true,value:(w as any)[key].bind(w)});
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client'),{SettingPanels}=await import('../../overlay/workspace-panels.tsx'),{emptyWork}=await import('../../upstream/lib/work-contract.ts');
import type {WorkState} from '../../upstream/lib/work-contract.ts';
async function setup(){
 const work=emptyWork();work.profiles=structuredClone(work.profiles);work.profiles[0].callBudget=0;
 const saved:WorkState[]=[],host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 await act(async()=>root.render(<React.StrictMode><SettingPanels work={work} disabled={false} save={async(next)=>{saved.push(structuredClone(next));return true}} data={{}} initialTab="agents" onTabChange={()=>{}}/></React.StrictMode>));
 const input=host.querySelector('[aria-label="Aufrufbudget"]') as HTMLInputElement,panel=input.closest('section')!;
 const button=(text:string)=>Array.from(panel.querySelectorAll('button')).find(b=>b.textContent===text)!;
 const type=async(value:string,field=input)=>{await act(async()=>{Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value')!.set!.call(field,value);field.dispatchEvent(new w.Event('input',{bubbles:true}) as any)})};
 const blur=async(field=input)=>{await act(async()=>{field.focus();field.blur()})};
 return {host,work,saved,input,panel,button,type,blur,async close(){await act(async()=>root.unmount());host.remove()}};
}
test('budget 0 can be deleted and replaced with 1 without an automatic write or reset',async()=>{
 const h=await setup();try{assert.equal(h.input.value,'0');await h.type('');assert.equal(h.input.value,'');assert.equal(h.saved.length,0);assert.equal(h.button('Arbeitsprofil speichern').disabled,true);await h.type('1');assert.equal(h.input.value,'1');assert.equal(h.saved.length,0);await h.blur();assert.equal(h.saved.length,0);await act(async()=>h.button('Arbeitsprofil speichern').click());assert.equal(h.saved.length,1);assert.equal(h.saved[0].profiles[0].callBudget,1);assert.equal(h.work.profiles[0].callBudget,0)}finally{await h.close()}
});
test('select-all replacement preserves typed text; invalid values never silently clamp or save',async()=>{
 const h=await setup();try{assert.equal(h.input.inputMode,'numeric');h.input.focus();h.input.select();await h.type('17');assert.equal(h.input.value,'17');assert.equal(h.saved.length,0);for(const value of ['', '-1','1.5','1001','abc','1e2']){await h.type(value);assert.equal(h.input.value,value);await h.blur();assert.equal(h.input.getAttribute('aria-invalid'),'true');assert.match(h.panel.querySelector('[role="alert"]')?.textContent??'',/0.*1000/);assert.equal(h.button('Arbeitsprofil speichern').disabled,true);assert.equal(h.button('Profil exportieren').disabled,true);await act(async()=>h.button('Arbeitsprofil speichern').click());assert.equal(h.saved.length,0)}await h.type('1000');await h.blur();assert.notEqual(h.input.getAttribute('aria-invalid'),'true');await act(async()=>h.button('Arbeitsprofil speichern').click());assert.equal(h.saved[0].profiles[0].callBudget,1000)}finally{await h.close()}
});
test('zero stays valid; time budget accepts an empty draft and enforces its original bounds',async()=>{
 const h=await setup();try{await h.type('0');await h.blur();assert.equal(h.button('Arbeitsprofil speichern').disabled,false);const time=h.panel.querySelector('[aria-label="Zeitbudget"]') as HTMLInputElement;await h.type('',time);assert.equal(time.value,'');await h.blur(time);assert.equal(h.button('Arbeitsprofil speichern').disabled,true);for(const value of ['0','481','-1','NaN']){await h.type(value,time);await h.blur(time);assert.equal(time.getAttribute('aria-invalid'),'true');assert.equal(h.saved.length,0)}await h.type('1',time);await h.blur(time);await act(async()=>h.button('Arbeitsprofil speichern').click());assert.equal(h.saved[0].profiles[0].timeBudget,1);assert.equal(h.saved[0].profiles[0].callBudget,0)}finally{await h.close()}
});
test('default is an explicit unsaved draft and clears invalid raw-budget errors',async()=>{
 const h=await setup();try{await h.type('');await h.blur();assert.ok(h.panel.querySelector('[role="alert"]'));await act(async()=>h.button('Standard als Entwurf').click());assert.equal(h.input.value,'20');assert.equal(h.panel.querySelector('[role="alert"]'),null);assert.equal(h.saved.length,0)}finally{await h.close()}
});
test.after(()=>w.happyDOM.abort());
