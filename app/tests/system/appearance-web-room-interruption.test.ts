import test from 'node:test';
import assert from 'node:assert/strict';
import {mount,tick} from '../level/renderer-fixture.mjs';

const appearance={core:'#123456',shell:'#abcdef',orbit:'#fedcba',shape:'cube',size:'large',motion:'breathe'};
async function room(){
 const m:any=await mount({allowMotion:true}),selected:string[]=[];
 m.update({onSelect:(id:string)=>selected.push(id)});
 const renderer=m.renderer,canvas=renderer.domElement,camera=renderer.camera;
 canvas.getBoundingClientRect=()=>({left:0,top:0,width:600,height:440});
 // The existing fixture stubs GPU rendering and OrbitControls, but picking uses real Three matrices.
 camera.lookAt(0,0,0);camera.updateMatrixWorld();renderer.scene.updateMatrixWorld(true);
 const pointer=(type:string,id:number,x=300,button=0,target=canvas)=>{
  const event=new Event(type,{bubbles:true});Object.assign(event,{pointerId:id,pointerType:'touch',button,clientX:x,clientY:220});
  target.dispatchEvent(event);
  // The fixture uses EventTarget, so explicitly mirror normal DOM bubbling to the document.
  if(target===canvas)m.document.dispatchEvent(event);
 };
 const close=async()=>{m.unmount();await tick();m.restore()};
 return{m,selected,renderer,canvas,camera,pointer,close};
}

test('room primary taps still pick real node geometry and appearance edits preserve renderer and camera',async()=>{
 const h=await room();try{
  h.pointer('pointerdown',1);h.pointer('pointerup',1);assert.deepEqual(h.selected,['one']);
  const position=h.camera.position.toArray(),controls=h.m.controls.current;
  h.m.update({graph:{...h.m.props.graph,nodes:h.m.props.graph.nodes.map((n:any)=>({...n,appearance}))}});
  assert.equal(h.m.renderer,h.renderer);assert.equal(h.renderer.disposed,false);assert.equal(h.renderer.camera,h.camera);assert.equal(h.m.controls.current,controls);assert.deepEqual(h.camera.position.toArray(),position);
  h.pointer('pointerdown',2,300,2);h.pointer('pointerup',2,300,2);assert.deepEqual(h.selected,['one'],'secondary buttons do not select');
 }finally{await h.close()}
});

test('room pinch completion cannot select or replace a live appearance preview',async()=>{
 const h=await room();try{
  h.pointer('pointerdown',1);h.pointer('pointerdown',2);
  h.m.update({graph:{...h.m.props.graph,nodes:h.m.props.graph.nodes.map((n:any)=>({...n,appearance}))}});
  h.pointer('pointerup',2);h.pointer('pointerup',1);
  assert.deepEqual(h.selected,[],'neither pointer of a pinch is a tap');
  assert.equal(h.m.renderer,h.renderer);assert.equal(h.renderer.disposed,false);
  h.renderer.scene.updateMatrixWorld(true);
  h.pointer('pointerdown',3);h.pointer('pointerup',3);assert.deepEqual(h.selected,['one'],'a later genuine tap still works');
 }finally{await h.close()}
});

test('room canceled and unmatched pointer releases never select, including the remaining pinch pointer',async()=>{
 const h=await room();try{
  h.pointer('pointerup',9);
  h.pointer('pointerdown',1);h.pointer('pointercancel',1);h.pointer('pointercancel',1);h.pointer('pointerup',1);
  h.pointer('pointerdown',2);h.pointer('pointerdown',3);h.pointer('pointercancel',3);h.pointer('pointercancel',3);h.pointer('pointerup',2);
  assert.deepEqual(h.selected,[]);
  h.pointer('pointerdown',4);h.pointer('pointerup',4,300,0,h.m.document);h.pointer('pointerup',4);
  assert.deepEqual(h.selected,[],'an outside release clears its tap candidate');
  h.pointer('pointerdown',5);h.pointer('pointerup',5);assert.deepEqual(h.selected,['one']);
 }finally{await h.close()}
});

test('room drag history persists after returning over the node and the next tap is independent',async()=>{
 const h=await room();try{
  h.pointer('pointerdown',1);h.pointer('pointermove',1,350,0,h.m.document);h.pointer('pointermove',1,300,0,h.m.document);h.pointer('pointerup',1);
  assert.deepEqual(h.selected,[],'returning to the starting point does not turn a drag into a tap');
  h.pointer('pointerdown',2);h.pointer('pointerup',2);assert.deepEqual(h.selected,['one']);
 }finally{await h.close()}
});

test('room pointer cleanup is idempotent and stale events cannot select after unmount',async()=>{
 const h=await room();try{
  h.pointer('pointerdown',1);h.m.unmount();h.m.unmount();
  h.pointer('pointermove',1,350,0,h.m.document);h.pointer('pointercancel',1);h.pointer('pointerup',1);
  h.pointer('pointerdown',2);h.pointer('pointerup',2);
  assert.deepEqual(h.selected,[]);assert.equal(h.renderer.disposed,true);assert.equal(h.m.controls.current,null);
 }finally{await h.close()}
});
