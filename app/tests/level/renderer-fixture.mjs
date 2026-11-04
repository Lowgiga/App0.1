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
async function mount({pendingLocal=false,pendingSource=false,pendingCompatible=false,pendingRequest=false,pendingViewer=false,holographic=false,allowMotion=false,powerSaver=false}={}){
  const clock={value:0},requests=[];
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
  const props={graph:{nodes:[{id:'one',title:'One',kind:'agent',origin:'own',color:0xff0000,position:[0,0,0]}],edges:[]},selected:'one',highlightedEdge:null,moving:false,powerSaver,allowMotion,holographic,controls:{current:null},onReady(v){states.ready=v;if(v)ready.resolve()},onError(m){states.errors.push(m);ready.reject(new Error(m))},onSelect(){},onAR(v){states.active=v;overlay.hidden=!v},onARBusy(v){states.busy=v;overlay.hidden=!(states.active||states.busy)},onPlacement(v){states.placement=v},onARState(v){states.arState=v;states.placement=v.phase==='surface-found'?'surface-found':v.phase==='placed'?'placed':'scanning'}};
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
  const context={exports:{},require,window:{devicePixelRatio:1},document,navigator:{xr:{requestSession:async(mode,init)=>{requests.push({mode,init});requestCalls++;return pendingRequest&&requestCalls===1?request.promise:requestedSession}}},isSecureContext:true,performance:{now:()=>clock.value},DOMException,AbortController,ResizeObserver:Observer,IntersectionObserver:Observer,matchMedia:()=>media};
  vm.runInNewContext(code,context);context.exports.default(props);const cleanups=effects.map(fn=>fn()).filter(Boolean);await ready.promise;
  return{props,media,document,clock,requests,session,states,renderer:rendererRef.current,local,sourcePending,compatible,request,viewer,makeSession,setNextSession(s){requestedSession=s},overlay,get sourceCancelled(){return sourceCancelled},controls:props.controls,unmount(){for(const cleanup of cleanups)cleanup()},restore(){globalThis.XRWebGLLayer=oldLayer}};
}

export {mount,tick,deferred};
