import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {defaultMobilePreferences} from '../../src/mobile/mobile-contract.ts';
const w=new Window({url:'https://localhost/'});
for(const key of ['window','document','HTMLElement','HTMLButtonElement','Event','MouseEvent','KeyboardEvent','FocusEvent','CustomEvent','MutationObserver','ResizeObserver'] as const)Object.defineProperty(globalThis,key,{configurable:true,value:key==='window'?w:(w as any)[key]});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:w.navigator});
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const barModule:any=await import(new URL('../../src/mobile/MobileActionBar.tsx',import.meta.url).href).catch(()=>({}));
const prefsModule:any=await import(new URL('../../src/mobile/MobilePreferencesUI.tsx',import.meta.url).href).catch(()=>({}));
const hintModule:any=await import(new URL('../../src/mobile/MobileContextHint.tsx',import.meta.url).href).catch(()=>({}));
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function required(module:any,name:string){assert.equal(typeof module[name],'function',name+' is implemented');return module[name];}
async function setup(element:any){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);await act(async()=>{root.render(element);await tick()});return{host,render:async(next:any)=>act(async()=>{root.render(next);await tick()}),done:async()=>{await act(async()=>root.unmount());host.remove();}};}

test('bar exposes at most four named native buttons and reports current internal destination',async()=>{
 const Bar=required(barModule,'MobileActionBar'),chosen:any[]=[];
 const h=await setup(<Bar value={defaultMobilePreferences()} selectedAction="view:overview" onNavigate={(target:any)=>chosen.push(target)}/>);
 try {const nav=h.host.querySelector('nav[aria-label="App-Schnelltasten"]')!;assert.ok(nav);const buttons=nav.querySelectorAll('button');assert.equal(buttons.length,4);assert.equal(buttons[0].getAttribute('aria-current'),'page');for(const button of buttons){assert.equal(button.type,'button');assert.ok(button.textContent);assert.equal(button.getAttribute('role'),null);}
 await act(async()=>buttons[2].click());assert.deepEqual(chosen,[{kind:'studio',tab:'assistant'}]);
 }finally{await h.done();}
});

test('empty slots do not create dead buttons; hidden, disabled and unavailable actions never navigate',async()=>{
 const Bar=required(barModule,'MobileActionBar'),chosen:any[]=[];const onNavigate=(target:any)=>chosen.push(target),value={slots:['view:overview',null,'studio:assistant',null]};
 const h=await setup(<Bar value={value} onNavigate={onNavigate} disabled/>);
 try{assert.equal(h.host.querySelectorAll('button').length,2);await act(async()=>{for(const b of h.host.querySelectorAll('button'))b.click()});assert.equal(chosen.length,0);
 await h.render(<Bar value={value} onNavigate={onNavigate} unavailable={['studio:assistant']}/>);assert.equal(h.host.querySelectorAll('button')[1].disabled,true);
 await h.render(<Bar value={value} onNavigate={onNavigate} active={false}/>);assert.equal(h.host.querySelector('nav'),null);
 await h.render(<Bar value={{slots:[null,null,null,null]}} onNavigate={onNavigate}/>);assert.equal(h.host.querySelector('nav'),null);
 }finally{await h.done();}
});

test('bar arrow and Home/End keys move focus without executing navigation or trapping Tab',async()=>{
 const Bar=required(barModule,'MobileActionBar'),chosen:any[]=[];const h=await setup(<Bar value={defaultMobilePreferences()} onNavigate={(target:any)=>chosen.push(target)}/>);
 try{const buttons=h.host.querySelectorAll('button');buttons[0].focus();await act(async()=>buttons[0].dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}) as any));assert.equal(document.activeElement,buttons[1]);await act(async()=>buttons[1].dispatchEvent(new w.KeyboardEvent('keydown',{key:'End',bubbles:true}) as any));assert.equal(document.activeElement,buttons[3]);await act(async()=>buttons[3].dispatchEvent(new w.KeyboardEvent('keydown',{key:'Home',bubbles:true}) as any));assert.equal(document.activeElement,buttons[0]);const tab=new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});buttons[0].dispatchEvent(tab as any);assert.equal(tab.defaultPrevented,false);assert.equal(chosen.length,0);
 }finally{await h.done();}
});

test('editing focus hides the fixed bar even without VisualViewport; leaving restores it without stealing focus',async()=>{
 const Bar=required(barModule,'MobileActionBar');const h=await setup(<><input aria-label="Entwurf"/><button id="elsewhere">Anderes Ziel</button><Bar value={defaultMobilePreferences()} onNavigate={()=>{}}/></>);
 try{await act(async()=>{h.host.querySelector('input')!.focus();await tick()});assert.equal(h.host.querySelector('nav'),null);const elsewhere=h.host.querySelector<HTMLButtonElement>('#elsewhere')!;await act(async()=>{elsewhere.focus();await tick()});assert.ok(h.host.querySelector('nav'));assert.equal(document.activeElement,elsewhere);
 }finally{await h.done();}
});

test('VisualViewport resize hides occluded bar and restores it after keyboard dismissal',async()=>{
 const Bar=required(barModule,'MobileActionBar');const vv=new w.EventTarget() as any;Object.assign(vv,{height:800,offsetTop:0,scale:1});Object.defineProperty(w,'innerHeight',{configurable:true,value:800});Object.defineProperty(w,'visualViewport',{configurable:true,value:vv});
 const h=await setup(<Bar value={defaultMobilePreferences()} onNavigate={()=>{}}/>);
 try{await act(async()=>{vv.height=400;vv.dispatchEvent(new w.Event('resize'));await tick()});assert.equal(h.host.querySelector('nav'),null);await act(async()=>{vv.height=800;vv.dispatchEvent(new w.Event('resize'));await tick()});assert.ok(h.host.querySelector('nav'));}
 finally{await h.done();Object.defineProperty(w,'visualViewport',{configurable:true,value:null});}
});

test('context hint follows selected view, is compact by default and closes when the view changes',async()=>{
 const Hint=required(hintModule,'MobileContextHint');const h=await setup(<Hint selectedAction="studio:assistant"/>);
 try{const details=h.host.querySelector('details')!;assert.equal(details.open,false);assert.match(details.querySelector('summary')!.textContent??'',/AI-Assistent/);details.open=true;await h.render(<Hint selectedAction="view:matrix"/>);assert.equal(h.host.querySelector('details')!.open,false);assert.match(h.host.querySelector('summary')!.textContent??'',/Aufgaben/);assert.doesNotMatch(h.host.textContent??'',/Projektbezogene Hilfe/);await h.render(<Hint selectedAction={null}/>);assert.equal(h.host.querySelector('details'),null);}
 finally{await h.done();}
});

test('preferences name four slots, prevent duplicate options and save only on explicit submission',async()=>{
 const Preferences=required(prefsModule,'MobilePreferencesUI'),saved:any[]=[];const h=await setup(<Preferences value={defaultMobilePreferences()} onSave={async(value:any)=>{saved.push(value)}}/>);
 try{const details=h.host.querySelector('details')!;assert.equal(details.open,false);details.open=true;const selects=h.host.querySelectorAll('select');assert.equal(selects.length,4);assert.equal(selects[0].getAttribute('aria-label'),'Schnelltaste 1');assert.equal(Array.from(selects[1].options).find(o=>o.value==='view:overview')!.disabled,true);await act(async()=>{selects[1].value='view:matrix';selects[1].dispatchEvent(new w.Event('change',{bubbles:true}) as any)});assert.equal(saved.length,0);const save=Array.from(h.host.querySelectorAll('button')).find(b=>b.textContent==='Schnelltasten speichern')!;await act(async()=>{save.click();await tick()});assert.equal(saved.length,1);assert.deepEqual(saved[0].slots,['view:overview','view:matrix','studio:assistant','view:settings']);assert.match(h.host.textContent??'',/gespeichert/);}
 finally{await h.done();}
});

test('preferences cancellation discards only the unsaved mobile draft and restores summary focus',async()=>{
 const Preferences=required(prefsModule,'MobilePreferencesUI');let writes=0;const h=await setup(<Preferences value={defaultMobilePreferences()} onSave={async()=>{writes++}}/>);
 try{const details=h.host.querySelector('details')!;details.open=true;const select=h.host.querySelector('select')!;await act(async()=>{select.value='view:matrix';select.dispatchEvent(new w.Event('change',{bubbles:true}) as any)});const cancel=Array.from(h.host.querySelectorAll('button')).find(b=>b.textContent==='Abbrechen')!;await act(async()=>cancel.click());assert.equal(details.open,false);assert.equal(document.activeElement,details.querySelector('summary'));assert.equal(select.value,'view:overview');assert.equal(writes,0);}
 finally{await h.done();}
});

test('pending save is single-flight and failures keep the draft visible without success feedback',async()=>{
 const Preferences=required(prefsModule,'MobilePreferencesUI');let writes=0,reject:any;const h=await setup(<Preferences value={defaultMobilePreferences()} onSave={()=>{writes++;return new Promise((_,r)=>{reject=r})}}/>);
 try{const select=h.host.querySelector('select')!;await act(async()=>{select.value='view:matrix';select.dispatchEvent(new w.Event('change',{bubbles:true}) as any)});const save=Array.from(h.host.querySelectorAll('button')).find(b=>b.textContent==='Schnelltasten speichern')!;await act(async()=>{save.click();save.click()});assert.equal(writes,1);assert.equal(save.disabled,true);await act(async()=>{reject(new Error('Speicher gesperrt'));await tick()});assert.match(h.host.querySelector('[role="alert"]')!.textContent??'',/Speicher gesperrt/);assert.equal(select.value,'view:matrix');assert.doesNotMatch(h.host.querySelector('[role="status"]')?.textContent??'',/gespeichert/);}
 finally{await h.done();}
});

test('external preference changes preserve a dirty draft and disable stale overwrite until explicitly reset',async()=>{
 const Preferences=required(prefsModule,'MobilePreferencesUI'),onSave=async()=>{};const h=await setup(<Preferences value={defaultMobilePreferences()} onSave={onSave}/>);
 try{const select=h.host.querySelector('select')!;await act(async()=>{select.value='view:matrix';select.dispatchEvent(new w.Event('change',{bubbles:true}) as any)});const newer=defaultMobilePreferences();newer.slots[0]='view:help';await h.render(<Preferences value={newer} onSave={onSave}/>);assert.equal(select.value,'view:matrix');assert.match(h.host.querySelector('[role="alert"]')!.textContent??'',/geändert/);assert.equal(Array.from(h.host.querySelectorAll('button')).find(b=>b.textContent==='Schnelltasten speichern')!.disabled,true);const reset=Array.from(h.host.querySelectorAll('button')).find(b=>b.textContent==='Aktuellen Stand übernehmen')!;await act(async()=>reset.click());assert.equal(select.value,'view:help');}
 finally{await h.done();}
});

test.after(()=>w.happyDOM.abort());
