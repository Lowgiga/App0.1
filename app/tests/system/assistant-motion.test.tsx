import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Window} from 'happy-dom';
const w=new Window({url:'https://localhost/'});
for(const key of ['window','document','Node','Element','HTMLElement','HTMLButtonElement','Event','CustomEvent','MouseEvent','KeyboardEvent','MutationObserver','ResizeObserver'] as const)Object.defineProperty(globalThis,key,{configurable:true,value:key==='window'?w:(w as any)[key]});
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
let hidden=false,reduced=false;
Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});
const mediaListeners=new Set<()=>void>();
Object.defineProperty(window,'matchMedia',{configurable:true,value:()=>({get matches(){return reduced},addEventListener:(_type:string,fn:()=>void)=>mediaListeners.add(fn),removeEventListener:(_type:string,fn:()=>void)=>mediaListeners.delete(fn)})});
const observers=new Set<FakeIntersection>();
class FakeIntersection {
 target:Element|null=null;
 constructor(readonly callback:IntersectionObserverCallback){observers.add(this)}
 observe(target:Element){this.target=target}
 disconnect(){observers.delete(this);this.target=null}
 emit(visible:boolean){if(this.target)this.callback([{target:this.target,isIntersecting:visible,intersectionRatio:visible?1:0} as IntersectionObserverEntry],this as unknown as IntersectionObserver)}
}
Object.defineProperty(globalThis,'IntersectionObserver',{configurable:true,value:FakeIntersection});
type Call={target:Element;frames:Keyframe[];options:KeyframeAnimationOptions;cancelled:boolean;animation:Animation};
let calls:Call[]=[];
Object.defineProperty(w.Element.prototype,'animate',{configurable:true,value:function(this:Element,frames:Keyframe[],options:KeyframeAnimationOptions){
 const call={target:this,frames,options,cancelled:false,animation:null as unknown as Animation};
 call.animation={cancel(){call.cancelled=true},onfinish:null,oncancel:null} as unknown as Animation;calls.push(call);return call.animation;
}});
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const {useFiniteMotion}=await import('../../src/motion/use-finite-motion.ts');
const {CubeFormation}=await import('../../src/motion/CubeFormation.tsx');
const {AssistantFormation}=await import('../../src/motion/AssistantFormation.tsx');
import type {FiniteMotionOptions} from '../../src/motion/use-finite-motion.ts';
import type {AssistantSessionState} from '../../src/assistant/use-assistant-session.ts';
import {defaultAssistantConfig} from '../../src/assistant/config.ts';
import {canonicalValue} from '../../src/assistant/contracts.ts';
function Surface(props:FiniteMotionOptions){const ref=React.useRef<HTMLDivElement>(null);useFiniteMotion(ref,props);return <div ref={ref}><button type="button">Sofort bedienbar</button><p role="status">Vollständiger Status</p></div>}
async function mount(node:React.ReactNode){
 hidden=false;reduced=false;calls=[];const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const render=async(value:React.ReactNode)=>{await act(async()=>root.render(<React.StrictMode>{value}</React.StrictMode>))};await render(node);
 return {host,render,async visible(value=true){await act(async()=>{for(const observer of [...observers])observer.emit(value)})},async close(){await act(async()=>root.unmount());host.remove()}};
}
const opts:FiniteMotionOptions={eventKey:'preview:one',kind:'surface',mode:'subtle',powerSaver:false};
test('StrictMode plays one finite effect only once, keeps content and controls available, and cancels on unmount',async()=>{
 const h=await mount(<Surface {...opts}/>);try{assert.equal(calls.length,0);assert.match(h.host.textContent??'',/Vollständiger Status/);assert.equal((h.host.querySelector('button') as HTMLButtonElement).disabled,false);await h.visible();assert.equal(calls.length,1);assert.ok(Number(calls[0].options.duration)<=300);await h.render(<Surface {...opts}/>);await h.visible();assert.equal(calls.length,1);calls[0].animation.onfinish?.call(calls[0].animation,{} as AnimationPlaybackEvent);assert.equal(calls[0].cancelled,true)}finally{await h.close()}assert.equal(observers.size,0);assert.equal(mediaListeners.size,0);
});
test('off, power saver, explicit pause and disabled state cancel WAAPI without replaying the same event',async()=>{
 for(const change of [{mode:'off' as const},{powerSaver:true},{paused:true},{enabled:false}]){
  const h=await mount(<Surface {...opts}/>);try{await h.visible();assert.equal(calls.length,1);await h.render(<Surface {...opts} {...change}/>);assert.ok(calls.every(x=>x.cancelled));await h.render(<Surface {...opts}/>);await h.visible();assert.equal(calls.length,1);await h.render(<Surface {...opts} eventKey="preview:two"/>);await h.visible();assert.equal(calls.length,2)}finally{await h.close()}
 }
});
test('document hide, OS reduction and element hiding stop handles; restoring visibility never replays completed or interrupted events',async()=>{
 for(const stop of ['document','os','element']){const h=await mount(<Surface {...opts}/>);try{await h.visible();assert.equal(calls.length,1);await act(async()=>{if(stop==='document'){hidden=true;document.dispatchEvent(new w.Event('visibilitychange') as any)}else if(stop==='os'){reduced=true;for(const fn of mediaListeners)fn()}});if(stop==='element')await h.visible(false);assert.ok(calls.every(x=>x.cancelled));await act(async()=>{hidden=false;reduced=false;document.dispatchEvent(new w.Event('visibilitychange') as any);for(const fn of mediaListeners)fn()});await h.visible();assert.equal(calls.length,1)}finally{await h.close()}}
});
test('new events replace an active sequence, no new timers or RAFs are scheduled and completion has no domain side effect',async()=>{
 let timers=0,frames=0;const timer=window.setTimeout,raf=window.requestAnimationFrame;window.setTimeout=((...args:Parameters<typeof timer>)=>{timers++;return timer.apply(window,args)}) as typeof timer;window.requestAnimationFrame=((callback:FrameRequestCallback)=>{frames++;return raf.call(window,callback)}) as typeof raf;
 const h=await mount(<Surface {...opts}/>);try{await h.visible();const first=calls[0];await h.render(<Surface {...opts} eventKey="preview:new"/>);assert.equal(first.cancelled,true);await h.visible();assert.equal(calls.length,2);calls[1].animation.onfinish?.call(calls[1].animation,{} as AnimationPlaybackEvent);assert.equal(h.host.textContent,'Sofort bedienbarVollständiger Status');assert.equal(timers,0);assert.equal(frames,0)}finally{await h.close();window.setTimeout=timer;window.requestAnimationFrame=raf}
});
test('bounded own cube geometry uses transform/opacity, theme classes and finite budgets in both modes',async()=>{
 for(const mode of ['subtle','hologram'] as const)for(const kind of ['gather','dock'] as const){const h=await mount(<CubeFormation kind={kind} eventKey="one" mode={mode} powerSaver={false}/>);try{const expected=kind==='gather'?(mode==='hologram'?24:12):(mode==='hologram'?16:8);assert.equal(h.host.querySelectorAll('[data-motion-piece]').length,expected);assert.equal(h.host.querySelector('[aria-hidden="true"]')?.getAttribute('data-formation'),kind);await h.visible();assert.equal(calls.length,expected);for(const call of calls){assert.ok(Number(call.options.duration)+Number(call.options.delay??0)<=900);assert.equal(call.options.iterations,1);assert.deepEqual([...new Set(call.frames.flatMap(f=>Object.keys(f)))].sort(),['opacity','transform'])}}finally{await h.close()}}
});
test('initially disabled, offscreen and unsupported environments retain static content without delayed animation',async()=>{
 const h=await mount(<Surface {...opts} mode="off"/>);try{await h.visible();assert.equal(calls.length,0);await h.render(<Surface {...opts}/>);await h.visible();assert.equal(calls.length,0);await h.render(<Surface {...opts} eventKey="offscreen"/>);await h.visible(false);await h.visible(true);assert.equal(calls.length,0)}finally{await h.close()}
 const animate=w.Element.prototype.animate;Object.defineProperty(w.Element.prototype,'animate',{configurable:true,value:undefined});const fallback=await mount(<Surface {...opts}/>);try{await fallback.visible();assert.equal(calls.length,0);assert.match(fallback.host.textContent??'',/Sofort bedienbar/)}finally{await fallback.close();Object.defineProperty(w.Element.prototype,'animate',{configurable:true,value:animate})}
});
async function proofFixture(){
 const context={contextId:crypto.randomUUID(),contextCreatedAt:new Date().toISOString()},config=defaultAssistantConfig(context);config.revision=1;config.continuation.detail='detailed';const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalValue(config)))),x=>x.toString(16).padStart(2,'0')).join('');const operationId=crypto.randomUUID(),basis={workUpdatedAt:null,memoryRevision:0,configRevision:0};
 const state:AssistantSessionState={phase:'saved',snapshot:null,context:null,preview:null,result:null,review:null,error:'',notice:'',events:[],operationId,proof:{receipt:{schema:'lowquantflow.assistant-receipt/v1',operationId,proposalId:crypto.randomUUID(),proposalHash:'a'.repeat(64),context,basis,beforeRevision:0,afterRevision:1,changedFields:['continuation.detail'],configHash:hash,committedAt:new Date().toISOString()},config,basis:{...basis,configRevision:1},verification:'verified',storage:{deviceLocal:true,includedInSystemBackup:false}}};return {state,context};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,5));
test('receipt formation requires hash-verified current readback; simulation, stale revision, forged hash and missing proof cannot dock',async()=>{
 const fixture=await proofFixture();for(const invalid of [ {...fixture.state,phase:'ready' as const}, {...fixture.state,phase:'uncertain' as const}, {...fixture.state,proof:null}, {...fixture.state,proof:{...fixture.state.proof!,verification:'superseded' as const}}, {...fixture.state,proof:{...fixture.state.proof!,receipt:{...fixture.state.proof!.receipt!,configHash:'0'.repeat(64)}}}, {...fixture.state,proof:{...fixture.state.proof!,basis:{...fixture.state.proof!.basis,configRevision:9}}} ]){
 const h=await mount(<AssistantFormation {...fixture} state={invalid} blocked={false} mode="subtle" powerSaver={false}/>);try{await act(async()=>tick());await h.visible();assert.equal(h.host.querySelector('[data-formation="dock"]'),null);assert.equal(calls.length,0)}finally{await h.close()}}
 const h=await mount(<AssistantFormation {...fixture} blocked={false} mode="subtle" powerSaver={false}/>);try{await act(async()=>tick());assert.ok(h.host.querySelector('[data-formation="dock"]'));await h.visible();assert.equal(calls.length,8);await h.render(<AssistantFormation {...fixture} state={{...fixture.state,proof:structuredClone(fixture.state.proof)}} blocked={false} mode="subtle" powerSaver={false}/>);await act(async()=>tick());await h.visible();assert.equal(calls.length,8);await h.render(<AssistantFormation {...fixture} blocked mode="subtle" powerSaver={false}/>);assert.equal(h.host.querySelector('[data-formation="dock"]'),null);assert.ok(calls.every(x=>x.cancelled))}finally{await h.close()}
});
test('late receipt validation cannot animate a newer phase or a different context',async()=>{
 const fixture=await proofFixture(),digest=crypto.subtle.digest.bind(crypto.subtle);let release!:()=>void;const barrier=new Promise<void>(r=>release=r);crypto.subtle.digest=async(...args:Parameters<SubtleCrypto['digest']>)=>{await barrier;return digest(...args)};
 const h=await mount(<AssistantFormation {...fixture} blocked={false} mode="subtle" powerSaver={false}/>);try{await h.render(<AssistantFormation {...fixture} state={{...fixture.state,phase:'error'}} blocked={false} mode="subtle" powerSaver={false}/>);release();await act(async()=>tick());await h.visible();assert.equal(h.host.querySelector('[data-formation="dock"]'),null);assert.equal(calls.length,0)}finally{release?.();crypto.subtle.digest=digest;await h.close()}
});
test('scoped CSS keeps geometry and interaction static, and defines off/reduced fallbacks without loops or new palette',()=>{
 const css=fs.readFileSync(new URL('../../src/motion/assistant-motion.css',import.meta.url),'utf8');assert.match(css,/pointer-events:\s*none/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/data-motion[=\s]/);assert.match(css,/var\(--primary/);assert.match(css,/button:active:not\(:disabled\)>.lq-button-visual/);assert.match(css,/hover:hover/);assert.doesNotMatch(css,/\binfinite\b|transition:\s*all|#[a-f\d]{3,8}\b/i);
});
