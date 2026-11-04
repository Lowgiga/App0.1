import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as Three from 'three';
import * as asset from '../../src/companion/offline-asset.ts';
import * as state from '../../src/companion/state.ts';

// Real installed GLTFLoader, geometry and AnimationMixer; only WebGL is a double.
function fixture(failConstructor=false){
 const stats={created:0,disposed:0,lost:0,attached:0,removed:0,renders:0,geometryDisposals:0,materialDisposals:0};
 const canvas=Object.assign(new EventTarget(),{className:'',setAttribute(){},remove(){stats.removed++}});
 let scene:Three.Scene|null=null;
 class Renderer {
  domElement=canvas;
  constructor(){stats.created++;if(failConstructor)throw new Error('WebGL unavailable')}
  setPixelRatio(){}setClearColor(){}setSize(){}dispose(){stats.disposed++}forceContextLoss(){stats.lost++}
  render(value:Three.Scene){scene=value;stats.renders++}
 }
 const wrappedAsset={...asset,parseOfflineCompanion:async(...args:Parameters<typeof asset.parseOfflineCompanion>)=>{
  const gltf=await asset.parseOfflineCompanion(...args),seenG=new Set(),seenM=new Set();
  gltf.scene.traverse((object:any)=>{if(object.geometry&&!seenG.has(object.geometry)){seenG.add(object.geometry);object.geometry.addEventListener('dispose',()=>stats.geometryDisposals++)}for(const m of object.material?(Array.isArray(object.material)?object.material:[object.material]):[])if(!seenM.has(m)){seenM.add(m);m.addEventListener('dispose',()=>stats.materialDisposals++)}});return gltf;
 }};
 const source=fs.readFileSync(new URL('../../src/companion/three-scene.ts',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const raw=fs.readFileSync(new URL('../../src/companion/assets/paz-companion.glb',import.meta.url));
 const context={exports:{},require:(name:string)=>name==='three'?{...Three,WebGLRenderer:Renderer}:name.includes('.glb?url&inline')?{default:'data:model/gltf-binary;base64,'+raw.toString('base64')}:name==='./offline-asset.ts'?wrappedAsset:name==='./state.ts'?state:(()=>{throw new Error(name)})(),window:{devicePixelRatio:2},DOMException};
 vm.runInNewContext(code,context);
 return {stats,canvas,scene:()=>scene,create:(signal=new AbortController().signal)=>(context.exports as any).createThreeCompanion({appendChild(){stats.attached++}},signal)};
}
test('real scene uses PBR lights, real six-clip mixer and model-oriented continuous walking',async()=>{
 const h=fixture(),scene=await h.create();
 try{scene.resize(320,200);scene.update(0,0);scene.render();const world=h.scene()!;
  assert.equal(world.children.filter((x:any)=>x.isLight).length,3);
  const actor=world.children.find((x:any)=>x.type==='Group')!;
  assert.equal(actor.rotation.y,Math.PI/2);
  for(let i=0;i<130;i++)scene.update(.1,i*.1);
  assert.equal(actor.rotation.y,-Math.PI/2);assert.ok(actor.position.x<=1.15&&actor.position.x>=-1.15);
  scene.setPresentation(state.companionPresentation(state.reduceCompanion(state.initialCompanionState(),{type:'requestStarted',requestId:'r1',eventId:'1',simulation:true},0)));
  const x=actor.position.x;scene.update(.1,14);assert.equal(actor.position.x,x);assert.equal(actor.rotation.y,0);
 }finally{scene.dispose();scene.dispose()}
 assert.equal(h.stats.created,1);assert.equal(h.stats.disposed,1);assert.equal(h.stats.lost,1);assert.equal(h.stats.geometryDisposals,66);assert.ok(h.stats.materialDisposals>0);
});
test('WebGL constructor failure disposes parsed model without attaching a canvas',async()=>{
 const h=fixture(true);await assert.rejects(()=>h.create(),/WebGL unavailable/);assert.equal(h.stats.attached,0);assert.equal(h.stats.geometryDisposals,66);assert.ok(h.stats.materialDisposals>0);
});
test('lost GL is reported to owner on the next bounded frame and teardown is idempotent',async()=>{
 const h=fixture(),scene=await h.create();h.canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));assert.throws(()=>scene.update(.1,1),/unavailable/);scene.dispose();scene.dispose();assert.equal(h.stats.disposed,1);assert.equal(h.stats.removed,1);
});
