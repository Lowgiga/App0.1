import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mount,tick} from './level/renderer-fixture.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(new URL('../package.json',import.meta.url));
const ts=require('typescript');
const {diagnoseARFailure}=require(root+'/overlay/lib/ar-runtime.ts');
const appearance={core:'#123456',shell:'#abcdef',orbit:'#fedcba',shape:'cube',size:'large',motion:'breathe'};
const pose=[1,0,0,0,0,1,0,0,0,0,1,0,2,.8,-3,1];
const frame={getViewerPose:()=>({transform:{matrix:pose,orientation:{x:0,y:0,z:0,w:1}}}),getHitTestResults:()=>[{getPose:()=>({transform:{matrix:pose}})}]};
const close=async m=>{m.unmount();await tick();m.restore()};
async function room(options={}){
 const m=await mount({allowMotion:true,...options});
 const errors=[];
 m.update({graph:{...m.props.graph,nodes:m.props.graph.nodes.map(n=>({...n,appearance}))},onError:(message,context)=>errors.push({message,context})});
 return Object.assign(m,{errors});
}
function breakRender(m){let calls=0;const stale=m.renderer.loop;m.renderer.render=()=>{calls++;throw Error('simulated late renderer failure')};return{stale,get calls(){return calls}}}
function assertQuarantined(m){assert.equal(m.states.ready,false);assert.equal(m.renderer.loop,null)}
function signalContextLoss(m){const event=new Event('webglcontextlost',{cancelable:true});m.renderer.domElement.dispatchEvent(event);assert.equal(event.defaultPrevented,true)}

// Full production MeshSpace function and callbacks; child components and React
// scheduling are deliberately controlled. This is not a browser/DOM smoke test.
function meshHarness(graph){
 const slots=[],refs=[];let stateIndex=0,refIndex=0,tree;
 const hooks={useState(initial){const i=stateIndex++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]},useRef(initial){return refs[refIndex++]??={current:initial}},useCallback:fn=>fn,useMemo:fn=>fn(),useEffect(){},lazy:()=> 'SpaceRenderer',Suspense:'Suspense'};
 const jsx=(type,props)=>({type,props});
 const passthrough=new Proxy({},{get:(_,key)=>key==='__esModule'?true:key});
 const modules={react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},'../src/appearance/AppearanceProvider.tsx':{useAppearance:()=>({value:{},ready:true})},'../src/appearance/projection.ts':{projectSpaceAppearance:g=>g},'../src/appearance/web-three.ts':{renderedAppearance:n=>n.appearance},'@/lib/space-model':{buildSpaceGraph:()=>graph,visibleSpaceGraph:g=>({...g,total:g.nodes.length}),guidedSteps:[],kindNames:{agent:'Agent'},originNames:{own:'App'},relationNames:{}},'@/lib/ar-runtime':require(root+'/overlay/lib/ar-runtime.ts')};
 const context={exports:{},require:id=>modules[id]??passthrough};
 const source=fs.readFileSync(root+'/overlay/mesh-space.tsx','utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
 const render=()=>{stateIndex=refIndex=0;tree=context.exports.default({work:{settings:{motion:'on',powerSaver:false}},known:true,data:{sources:[]},go(){},save:async()=>true});return tree};
 const descendants=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(descendants):[node,...descendants(node.props?.children)];
 const text=node=>node==null||typeof node==='boolean'?'':typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(text).join(''):text(node.props?.children);
 const find=(predicate,within)=>descendants(within??tree).find(predicate);
 const button=(label,within)=>find(n=>n.type==='Button'&&text(n)===label,within);
 render();button('Räumliches 3D').props.onClick();render();
 return{render,find,button,text,get renderer(){return find(n=>n.type==='SpaceRenderer')},get overlay(){return find(n=>n.props?.className==='space-ar-overlay')}};
}

test('late inline render failure is contained, sets not-ready and reports terminal fallback once',async()=>{
 const m=await room();try{const f=breakRender(m);assert.doesNotThrow(()=>f.stale(1000));assertQuarantined(m);assert.equal(m.errors.length,1);assert.notEqual(m.errors[0].context?.retainAR,true);assert.doesNotMatch(m.errors[0].message,/AR/,'inline fallback must not imply an owned AR session');assert.equal(f.calls,1)}finally{await close(m)}
});
test('stale frame, visibility, reduced motion and appearance refresh cannot rearm a failed renderer',async()=>{
 const m=await room();try{const f=breakRender(m);try{f.stale(1000)}catch{};
  assert.doesNotThrow(()=>f.stale(2000),'stale scheduled callback must be harmless');
  assert.doesNotThrow(()=>{m.document.dispatchEvent(new Event('visibilitychange'));m.media.dispatchEvent(new Event('change'));m.update({graph:{...m.props.graph,nodes:m.props.graph.nodes.map(n=>({...n,appearance:{...appearance,core:'#654321'}}))}})});
  assertQuarantined(m);assert.equal(f.calls,1);assert.equal(m.errors.length,1);
 }finally{await close(m)}
});
test('late appearance frame exception uses the same quarantine boundary',async()=>{
 const m=await room();try{const stale=m.renderer.loop,shell=m.renderer.scene.children[0].children[0].children.find(n=>n.userData.appearanceLayer==='shell');shell.scale.setScalar=()=>{throw Error('late animate failure')};assert.doesNotThrow(()=>stale(1000));assertQuarantined(m);assert.equal(m.errors.length,1)}finally{await close(m)}
});
test('context loss quarantines inline rendering and duplicate loss reports only once',async()=>{
 const m=await room();try{const stale=m.renderer.loop;let renders=0;m.renderer.render=()=>renders++;signalContextLoss(m);signalContextLoss(m);assertQuarantined(m);stale(1000);m.document.dispatchEvent(new Event('visibilitychange'));assert.equal(renders,0);assert.equal(m.errors.length,1)}finally{await close(m)}
});
test('inline failure preserves current appearance graph in MeshSpace 2D fallback',async()=>{
 const m=await room();try{const ui=meshHarness(m.props.graph);const callbacks=ui.renderer.props;m.update({onError:callbacks.onError,onReady:callbacks.onReady});const f=breakRender(m);try{f.stale(1000)}catch{};ui.render();assert.equal(ui.renderer,undefined);const map=ui.find(n=>n.type?.name==='StructuralMap');assert.ok(map);assert.equal(map.props.graph.nodes[0].appearance,appearance);assert.ok(ui.button('3D erneut laden'))}finally{await close(m)}
});
test('active XR graphics fault keeps immersive error and explicit exit, blocks placement/zoom/new start',async()=>{
 const m=await room();try{const ui=meshHarness(m.props.graph),callbacks=ui.renderer.props;callbacks.controls.current=m.controls.current;m.update({onAR:callbacks.onAR,onARState:callbacks.onARState,onARBusy:callbacks.onARBusy,onReady:callbacks.onReady,onError:(message,context)=>{m.errors.push({message,context});callbacks.onError(message,context)}});
  await m.controls.current.ar();m.renderer.loop(500,frame);const group=m.renderer.scene.children[0],scale=group.scale.toArray();let ends=0;const end=m.session.end;m.session.end=async()=>{ends++;await end()};const f=breakRender(m);try{f.stale(1000,frame)}catch{};ui.render();
  assert.ok(ui.renderer,'fault must not unmount the XR owner');assert.equal(ui.overlay.props.hidden,false);assert.match(ui.text(ui.overlay),/Grafik/);assert.equal(ui.button('AR beenden',ui.overlay).props.disabled,false);assert.equal(ui.button('Hier platzieren',ui.overlay).props.disabled,true);assert.equal(ui.button('Größer',ui.overlay).props.disabled,true);assert.equal(ui.button('2D-Struktur').props.disabled,true);
  assert.equal(m.controls.current.placeAR(),false);m.controls.current.zoom(.85);m.controls.current.centerAR();assert.deepEqual(group.scale.toArray(),scale);assert.equal(ends,0,'fault does not auto-end or auto-retry');assert.equal(m.errors.length,1);assert.equal(m.errors[0].context?.retainAR,true);
  await ui.button('AR beenden',ui.overlay).props.onClick();ui.render();assert.equal(ends,1);assert.equal(m.requests.length,1);assert.equal(ui.renderer,undefined);assert.equal(m.errors.length,2);assert.notEqual(m.errors[1].context?.retainAR,true);assert.equal(m.renderer.loop,null);
 }finally{await close(m)}
});
test('XR context loss retains ownership through rejected end, allows only explicit end retry',async()=>{
 const m=await room();try{await m.controls.current.ar();const end=m.session.end;let ends=0;m.session.end=async()=>{ends++;throw Error('end refused')};signalContextLoss(m);assert.equal(m.states.active,true);assert.equal(m.states.arState.phase,'end-unknown');assert.equal(m.errors[0].context?.retainAR,true);await tick();assert.equal(ends,0);await assert.rejects(m.controls.current.ar(),error=>{assert.equal(diagnoseARFailure(error).message,'end refused');assert.equal(diagnoseARFailure(error).stage,'end');return true});await tick();assert.equal(ends,1);assert.equal(m.states.active,true);assert.equal(m.states.busy,false);assert.equal(m.errors.length,1);m.session.end=async()=>{ends++;await end()};await m.controls.current.ar('free');assert.equal(ends,2);assert.equal(m.requests.length,1);assert.equal(m.states.active,false);assert.equal(m.errors.length,2);assertQuarantined(m)}finally{await close(m)}
});
test('confirmed native end wins over hanging end promise after a graphics fault',async()=>{
 const m=await room();try{await m.controls.current.ar();signalContextLoss(m);const end=m.session.end;m.session.end=()=>{void end();return new Promise(()=>{})};const outcome=await Promise.race([m.controls.current.ar().then(()=>'ended'),new Promise(r=>setTimeout(()=>r('timeout'),150))]);assert.equal(outcome,'ended');assert.equal(m.states.active,false);assert.equal(m.states.busy,false);assert.equal(m.errors.length,2);assertQuarantined(m)}finally{await close(m)}
});
test('unmount after fault releases resources once and stale callbacks cannot report or render',async()=>{
 const m=await room();try{await m.controls.current.ar();const stale=m.renderer.loop;signalContextLoss(m);m.unmount();await tick();m.unmount();await tick();const errors=m.errors.length;let renders=0;m.renderer.render=()=>renders++;assert.doesNotThrow(()=>stale(2000,frame));m.document.dispatchEvent(new Event('visibilitychange'));assert.equal(m.controls.current,null);assert.equal(m.sourceCancelled,1);assert.equal(m.renderer.events.filter(e=>e==='dispose').length,1);assert.equal(m.errors.length,errors);assert.equal(renders,0)}finally{m.restore()}
});
test('pending XR end preserves fault ownership and coalesces exit gestures until native end arrives',async()=>{
 const m=await room();try{await m.controls.current.ar();const nativeEnd=m.session.end;let ends=0;m.session.end=()=>{ends++;return new Promise(()=>{})};signalContextLoss(m);const exit=m.controls.current.ar();await tick();assert.equal(ends,1);assert.equal(m.states.active,true);assert.equal(m.states.busy,true);assert.equal(m.errors[0].context?.retainAR,true);assert.equal(m.errors.length,1);await m.controls.current.ar('free');await tick();assert.equal(ends,1);assert.equal(m.requests.length,1);assert.equal(m.errors.length,1);await nativeEnd();await exit;assert.equal(m.states.active,false);assert.equal(m.states.busy,false);assert.equal(m.errors.length,2);assertQuarantined(m)}finally{await close(m)}
});
test('fulfilled end promise without native end does not report terminal fallback or release ownership',async()=>{
 const m=await room();try{await m.controls.current.ar();const nativeEnd=m.session.end;let ends=0;m.session.end=async()=>{ends++};signalContextLoss(m);await m.controls.current.ar();assert.equal(ends,1);assert.equal(m.states.active,true);assert.equal(m.states.arState.phase,'end-unknown');assert.equal(m.errors.length,1);m.session.end=async()=>{ends++;await nativeEnd()};await m.controls.current.ar();assert.equal(ends,2);assert.equal(m.states.active,false);assert.equal(m.errors.length,2);await m.controls.current.ar();assert.equal(m.requests.length,1,'quarantined owner never requests a new session')}finally{await close(m)}
});
test('XR frame accessor exception is contained before render and retains exit ownership',async()=>{
 const m=await room();try{await m.controls.current.ar();const stale=m.renderer.loop;assert.doesNotThrow(()=>stale(1000,{getViewerPose(){throw Error('stale XR frame')}}));assertQuarantined(m);assert.equal(m.states.active,true);assert.equal(m.states.arState.phase,'end-unknown');assert.equal(m.errors[0].context?.retainAR,true);await m.controls.current.ar();assert.equal(m.errors.length,2)}finally{await close(m)}
});
test('lost-context flag without a DOM event uses the same one-shot fallback',async()=>{
 const m=await room();try{const stale=m.renderer.loop;m.renderer.getContext().isContextLost=()=>true;stale(1000);assertQuarantined(m);assert.equal(m.errors.length,1);stale(2000);assert.equal(m.errors.length,1)}finally{await close(m)}
});
test('startup graphics fault cannot treat an unbound session and fulfilled end promise as confirmed end',async()=>{
 const m=await room({pendingSource:true});try{const nativeEnd=m.session.end;let ends=0;m.session.end=async()=>{ends++};const start=m.controls.current.ar();const aborted=assert.rejects(start,{name:'AbortError'});await tick();signalContextLoss(m);await aborted;assert.equal(ends,1);assert.equal(m.states.active,true);assert.equal(m.states.arState.phase,'end-unknown');assert.equal(m.errors.length,1);assert.equal(m.errors[0].context?.retainAR,true);await nativeEnd();await tick();assert.equal(m.states.active,false);assert.equal(m.errors.length,2);assertQuarantined(m)}finally{await close(m)}
});
for(const lateEnd of ['reject','hang','fulfill'])test('fault during pending request retains late session whose end will '+lateEnd,async()=>{
 const m=await room({pendingRequest:true});try{const nativeEnd=m.session.end;let ends=0;m.session.end=()=>{ends++;return lateEnd==='reject'?Promise.reject(Error('late end refused')):lateEnd==='fulfill'?Promise.resolve():new Promise(()=>{})};m.update({onError:(message,context)=>{m.errors.push({message,context});if(!context?.retainAR)m.unmount()}});
  const start=m.controls.current.ar(),aborted=assert.rejects(start,{name:'AbortError'});await tick();signalContextLoss(m);await aborted;assert.ok(m.controls.current,'unresolved request must retain its owner and exit control');assert.equal(m.states.active,true);assert.equal(m.renderer.disposed,false);assert.equal(m.errors[0].context?.retainAR,true);m.request.resolve(m.session);await tick();await tick();assert.equal(ends,1);assert.equal(m.errors.length,1);assert.ok(m.controls.current);assert.equal(m.states.arState.phase,'end-unknown');assert.equal(m.requests.length,1);
  if(lateEnd!=='hang'){m.session.end=async()=>{ends++;await nativeEnd()};await m.controls.current.ar();assert.equal(ends,2)}else{const exit=m.controls.current.ar();await tick();assert.equal(ends,1);await nativeEnd();await exit;await tick()}
  assert.equal(m.errors.length,2);assert.notEqual(m.errors[1].context?.retainAR,true);assert.equal(m.states.active,false);assert.equal(m.controls.current,null);
 }finally{await close(m)}
});
test('rejected pending request releases graphics-fault ownership only after rejection is known',async()=>{
 const m=await room({pendingRequest:true});try{const start=m.controls.current.ar(),aborted=assert.rejects(start,{name:'AbortError'});await tick();signalContextLoss(m);await aborted;assert.equal(m.errors.length,1);assert.equal(m.errors[0].context?.retainAR,true);assert.equal(m.states.active,true);m.request.reject(new DOMException('declined','NotAllowedError'));await tick();await tick();assert.equal(m.states.active,false);assert.equal(m.errors.length,2);assert.notEqual(m.errors[1].context?.retainAR,true);assert.equal(m.requests.length,1);assertQuarantined(m)}finally{await close(m)}
});
for(const callback of ['onAR','onARState'])test('native end reentering fault '+callback+' cannot be overwritten by retained fault status',async()=>{
 const m=await room();try{await m.controls.current.ar();const original=m.props[callback],nativeEnd=m.session.end;m.update({[callback]:value=>{original(value);if(callback==='onAR'?value===true:value.phase==='end-unknown')void nativeEnd()}});signalContextLoss(m);await tick();assert.equal(m.renderer.xr.getSession(),null);assert.equal(m.states.active,false);assert.equal(m.states.arState.phase,'inactive');assert.equal(m.errors.length,1);assert.notEqual(m.errors[0].context?.retainAR,true)}finally{await close(m)}
});
for(const lateEnd of ['hang','fulfill'])test('fault fallback waits for both ended active session and older late request with '+lateEnd+' end',async()=>{
 const m=await room({pendingRequest:true});try{const nativeA=m.session.end;let endsA=0;m.session.end=()=>{endsA++;return lateEnd==='hang'?new Promise(()=>{}):Promise.resolve()};const first=m.controls.current.ar(),aborted=assert.rejects(first,{name:'AbortError'});await tick();m.controls.current.cancelAR();await aborted;const second=m.makeSession();m.setNextSession(second);await m.controls.current.ar();signalContextLoss(m);await m.controls.current.ar();assert.equal(m.renderer.xr.getSession(),null);assert.equal(m.errors.length,1);assert.equal(m.states.active,true);m.request.resolve(m.session);await tick();await tick();assert.equal(endsA,1);assert.equal(m.errors.length,1);assert.equal(m.states.active,true);await nativeA();await tick();await tick();assert.equal(m.states.active,false);assert.equal(m.states.arState.phase,'inactive');assert.equal(m.errors.length,2);assertQuarantined(m)}finally{await close(m)}
});
