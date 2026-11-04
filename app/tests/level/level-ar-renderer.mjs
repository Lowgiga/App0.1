import fs from 'node:fs';
import { createRequire } from 'node:module';
const nativeRequire=createRequire(import.meta.url);
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from '../../node_modules/typescript/lib/typescript.js';
import * as Three from '../../node_modules/three/build/three.module.js';
import { WebXRManager } from '../../node_modules/three/src/renderers/webxr/WebXRManager.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return{promise,resolve,reject}};
const tick=()=>new Promise(r=>setImmediate(r));
class Emitter extends EventTarget {}
const scenarios=[];
async function mount({pendingLocal=false,pendingSource=false,pendingCompatible=false,pendingRequest=false,pendingViewer=false}={}){
  const local=deferred(),sourcePending=deferred(),compatible=deferred(),request=deferred(),viewer=deferred(); let sourceCancelled=0;
 function makeSession(){let ended=false;
  const session=new Emitter();session.inputSources=[];session.enabledFeatures=['hit-test','dom-overlay'];session.renderState={};session.environmentBlendMode='alpha-blend';
  session.updateRenderState=s=>Object.assign(session.renderState,s);
  session.requestReferenceSpace=async type=>type==='viewer'&&pendingViewer?viewer.promise:type==='local'&&pendingLocal?local.promise:{};
  session.requestHitTestSource=async()=>pendingSource?sourcePending.promise:{cancel(){sourceCancelled++}};
  session.requestAnimationFrame=()=>1;session.cancelAnimationFrame=()=>{};
  session.end=async()=>{if(ended)throw new DOMException('Already ended','InvalidStateError');ended=true;session.dispatchEvent(new Event('end'))};
 return session;} const session=makeSession();let requestedSession=session,requestCalls=0;
  const overlay=Object.assign(new Emitter(),{hidden:true}),host={clientWidth:600,clientHeight:440,appendChild(){},closest(){return{querySelector(){return overlay}}}};
  const ready=deferred(),states={ready:false,active:false,busy:false,placement:'scanning',errors:[]};
  const props={graph:{nodes:[{id:'one',title:'One',kind:'agent',origin:'own',color:0xff0000,position:[0,0,0]}],edges:[]},selected:'one',highlightedEdge:null,moving:false,powerSaver:false,allowMotion:false,controls:{current:null},onReady(v){states.ready=v;if(v)ready.resolve()},onError(m){states.errors.push(m);ready.reject(new Error(m))},onSelect(){},onAR(v){states.active=v;overlay.hidden=!v},onARBusy(v){states.busy=v;overlay.hidden=!(states.active||states.busy)},onPlacement(v){states.placement=v},onARState(v){states.arState=v;states.placement=v.phase==='surface-found'?'surface-found':v.phase==='placed'?'placed':'scanning'}};
  const rendererRef={current:null};
  const gl={getContextAttributes:()=>({xrCompatible:!pendingCompatible,alpha:true,depth:false,antialias:false,stencil:false}),isContextLost:()=>false,makeXRCompatible:()=>compatible.promise};
  class FakeRenderer{
    constructor(){rendererRef.current=this;this.domElement=new Emitter();Object.assign(this.domElement,{setAttribute(){},remove(){},getBoundingClientRect(){return{x:0,y:0,width:600,height:440}}});this.xr=new WebXRManager(this,gl);this.info={render:{calls:1}};this.pixel=1;this.width=600;this.height=440;this.alpha=1;this.disposed=false;this.events=[];}
    setAnimationLoop(fn){this.loop=fn;}
    dispose(){this.disposed=true;this.events.push('dispose');}
    setPixelRatio(v){this.pixel=v} getPixelRatio(){return this.pixel}
    setSize(w,h){this.width=w;this.height=h;this.events.push(['setSize',w,h,this.disposed])} getSize(vec){return vec.set(this.width,this.height)}
    setClearColor(){}setClearAlpha(v){this.alpha=v}getContext(){return gl}
    getRenderTarget(){return null}setRenderTarget(){} render(scene,camera){this.scene=scene;this.camera=camera;this.info.render.calls=1}
  }
  class Orbit{constructor(camera){this.camera=camera;this.target=new Three.Vector3();}update(){}saveState(){}reset(){}dispose(){}addEventListener(){}}
  class Observer{observe(){}disconnect(){}}
  const effects=[];let refs=0;
  const hooks={useRef(v){return{current:refs++===0?host:v}},useEffect(fn){effects.push(fn)}};
  const document=Object.assign(new Emitter(),{hidden:false,createElement(){return{width:0,height:0,getContext(){return{measureText(){return{width:20}},fillText(){}}}}}});
  const media=Object.assign(new Emitter(),{matches:false});
  const oldLayer=globalThis.XRWebGLLayer;
  globalThis.XRWebGLLayer=class{constructor(){this.framebufferWidth=800;this.framebufferHeight=600;this.ignoreDepthValues=false}};
  const require=id=>id==='react'?hooks:id==='react/jsx-runtime'?{jsx(){return null}}:id==='three'?{...Three,WebGLRenderer:FakeRenderer}:id.includes('OrbitControls')?{OrbitControls:Orbit}:id.startsWith('@/lib/')?nativeRequire(new URL(`../../overlay/lib/${id.slice('@/lib/'.length)}.ts`,import.meta.url).pathname):(()=>{throw new Error(id)})();
  const code=ts.transpileModule(fs.readFileSync(new URL('../../overlay/space-renderer.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const context={exports:{},require,window:{devicePixelRatio:1},document,navigator:{xr:{requestSession:async()=>{requestCalls++;return pendingRequest&&requestCalls===1?request.promise:requestedSession}}},isSecureContext:true,performance,DOMException,AbortController,ResizeObserver:Observer,IntersectionObserver:Observer,matchMedia:()=>media};
  vm.runInNewContext(code,context);context.exports.default(props);const cleanups=effects.map(fn=>fn()).filter(Boolean);await ready.promise;
  return{session,states,renderer:rendererRef.current,local,sourcePending,compatible,request,viewer,makeSession,setNextSession(s){requestedSession=s},overlay,get sourceCancelled(){return sourceCancelled},controls:props.controls,unmount(){for(const cleanup of cleanups)cleanup()},restore(){globalThis.XRWebGLLayer=oldLayer}};
}
// Real installed Three.js XR manager and application control flow; browser/GPU edges are controlled doubles.
const checks=[];
{
 const m=await mount({pendingLocal:true});const start=m.controls.current.ar();const rejected=assert.rejects(start,{name:'AbortError'});await tick();await m.session.end();m.local.resolve({});await rejected;await tick();
 checks.push(['ended local-space race',!m.states.active&&!m.states.busy&&!m.renderer.xr.isPresenting&&m.renderer.xr.getSession()===null]);m.unmount();m.restore();
}
{
 const m=await mount();await m.controls.current.ar();m.unmount();await tick();
 checks.push(['effect cleanup clears parent AR state',!m.states.active&&!m.states.busy&&m.overlay.hidden&&m.controls.current===null&&m.sourceCancelled===1]);m.restore();
}
{
 const m=await mount({pendingSource:true});const start=m.controls.current.ar();const rejected=assert.rejects(start,{name:'AbortError'});await tick();
 checks.push(['pending start has an explicit cancellation control',typeof m.controls.current.cancelAR==='function']);
 if(m.controls.current.cancelAR) await m.controls.current.cancelAR(); else await m.session.end();
 let terminal=false;void rejected.then(()=>terminal=true);await tick();checks.push(['source acquisition ends immediately without waiting for browser promise',terminal&&!m.states.busy]);
 m.sourcePending.resolve({cancel(){}});await rejected;m.unmount();m.restore();
}
{
 const m=await mount({pendingLocal:true});const start=m.controls.current.ar();const rejected=assert.rejects(start,{name:'AbortError'});await tick();m.unmount();
 checks.push(['renderer disposal waits for pending Three binding',!m.renderer.disposed]);
 m.local.resolve({});await rejected;await tick();checks.push(['late binding cannot resurrect disposed renderer',m.renderer.disposed&&!m.renderer.xr.isPresenting&&!m.states.active&&!m.states.busy&&m.renderer.xr.getSession()===null]);
 checks.push(['no Three resize after renderer disposal',!m.renderer.events.some(e=>Array.isArray(e)&&e[0]==='setSize'&&e[3])]);m.restore();
}
for (const fail of [false,true]) {
 const m=await mount({pendingCompatible:true});const start=m.controls.current.ar();const rejected=assert.rejects(start,{name:'AbortError'});await tick();await m.session.end();
 if(fail)m.compatible.reject(new Error('Compatibility failed late'));else m.compatible.resolve();
 await rejected;await tick();checks.push(['makeXRCompatible '+(fail?'reject':'resolve')+' restores inline pixel ratio and size',m.renderer.pixel===1&&m.renderer.width===600&&m.renderer.height===440&&!m.renderer.xr.isPresenting&&m.renderer.xr.getSession()===null&&!m.states.busy]);m.unmount();m.restore();
}
{
 const m=await mount({pendingLocal:true});const start=m.controls.current.ar();const rejected=assert.rejects(start,{name:'AbortError'});await tick();m.controls.current.cancelAR();m.local.reject(new Error('Space failed late'));await rejected;await tick();
 checks.push(['late local-space rejection remains terminal',!m.states.busy&&!m.states.active&&!m.renderer.xr.isPresenting&&m.renderer.xr.getSession()===null]);m.unmount();m.restore();
}
{
 const m=await mount();const position=m.renderer.camera.position.clone(),quaternion=m.renderer.camera.quaternion.clone();await m.controls.current.ar();const group=m.renderer.scene.children[0],reticle=m.renderer.scene.children[1];assert.equal(group.visible,false);assert.equal(m.states.placement,'scanning');const pose=x=>[1,0,0,0,0,1,0,0,0,0,1,0,x,0,-1,1];const frame=matrix=>({getViewerPose(){return{transform:{matrix:pose(0),orientation:{x:0,y:0,z:0,w:1}}}},getHitTestResults(){return matrix?[{getPose(){return{transform:{matrix}}}}]:[]}});m.renderer.loop(1,frame(pose(2)));assert.equal(m.states.placement,'surface-found');assert.equal(reticle.visible,true);m.renderer.loop(2,frame(null));m.controls.current.placeAR();assert.equal(m.states.placement,'scanning');assert.equal(group.visible,false);m.renderer.loop(3,frame(pose(3)));m.controls.current.placeAR();assert.equal(m.states.placement,'placed');assert.equal(group.visible,true);assert.equal(reticle.visible,false);const x=group.position.x,z=group.position.z;m.controls.current.zoom(.85);assert.equal(group.position.x,x);assert.equal(group.position.z,z);m.controls.current.centerAR();assert.equal(group.visible,false);assert.equal(m.states.placement,'scanning');m.controls.current.placeAR();assert.equal(group.visible,false);m.renderer.camera.position.set(9,9,9);m.renderer.camera.quaternion.set(1,0,0,0);await m.controls.current.ar();assert.equal(m.states.active,false);assert.deepEqual(m.renderer.camera.position,position);assert.deepEqual(m.renderer.camera.quaternion.toArray(),quaternion.toArray());assert.equal(m.sourceCancelled,1);scenarios.push({scenario:'normal scan-loss-place-zoom-reposition-exit',result:'PASS',sourceCancelled:m.sourceCancelled});m.unmount();m.restore();
}
{
 for(const stage of ['source','viewer','request','binding']){
 const m=await mount({pendingSource:stage==='source',pendingViewer:stage==='viewer',pendingRequest:stage==='request',pendingLocal:stage==='binding'});const start=m.controls.current.ar();await tick();m.controls.current.cancelAR();const outcome=await Promise.race([start.then(()=> 'resolved',e=>e.name),new Promise(r=>setTimeout(()=>r('TIMEOUT'),100))]);assert.equal(outcome,'AbortError',stage);assert.equal(m.states.busy,false,stage);let lateCancelled=0;if(stage==='source')m.sourcePending.resolve({cancel(){lateCancelled++}});if(stage==='viewer')m.viewer.resolve({});if(stage==='request')m.request.resolve(m.session);if(stage==='binding')m.local.resolve({});await tick();assert.equal(m.renderer.xr.isPresenting,false,stage);if(stage==='source')assert.equal(lateCancelled,1);scenarios.push({scenario:`explicit cancel while ${stage} pending`,result:'PASS',lateCancelled});m.unmount();m.restore();
 }
 {
 const m=await mount({pendingLocal:true});const start=m.controls.current.ar();await tick();await m.session.end();m.local.resolve({});await assert.rejects(start,{name:'AbortError'});await tick();const second=m.makeSession();m.setNextSession(second);await m.controls.current.ar();assert.equal(m.states.active,true);assert.equal(m.renderer.xr.getSession(),second);await m.controls.current.ar();assert.equal(m.states.active,false);assert.equal(m.renderer.xr.isPresenting,false);assert.equal(m.renderer.pixel,1);scenarios.push({scenario:'normal second session after late first binding',result:'PASS'});m.unmount();m.restore();
 }
 {
 const m=await mount({pendingRequest:true});const start=m.controls.current.ar();await tick();m.controls.current.cancelAR();await assert.rejects(start,{name:'AbortError'});const second=m.makeSession();m.setNextSession(second);await m.controls.current.ar();m.request.resolve(m.session);await tick();assert.equal(m.states.active,true);assert.equal(m.renderer.xr.getSession(),second);await m.controls.current.ar();scenarios.push({scenario:'cancelled request resolves after next session became active',result:'PASS'});m.unmount();m.restore();
 }
}
if(process.env.REVIEW_ROTATION){const m=await mount({pendingLocal:true});m.renderer.scene.children[0].rotation.y=.8;const start=m.controls.current.ar();await tick();await m.session.end();m.local.resolve({});await assert.rejects(start,{name:'AbortError'});await tick();scenarios.push({scenario:'inline group rotation after repeated late-binding restore',rotationY:m.renderer.scene.children[0].rotation.y,expected:.8});m.unmount();m.restore();}
{
 const m=await mount({pendingLocal:true});const group=m.renderer.scene.children[0];group.rotation.y=.8;
 const start=m.controls.current.ar();const rejected=assert.rejects(start,{name:'AbortError'});await tick();await m.session.end();m.local.resolve({});await rejected;await tick();
 checks.push(['repeated terminal cleanup preserves the prior inline rotation',Math.abs(group.rotation.y-.8)<1e-8]);m.unmount();m.restore();
}
console.log(JSON.stringify([...checks.map(([name,pass])=>({name,pass})),...scenarios],null,2));
assert.ok(checks.every(([,pass])=>pass),'Every AR lifecycle invariant must pass');
