import test from 'node:test';
import assert from 'node:assert/strict';
import {mount,tick} from '../level/renderer-fixture.mjs';
const appearance={core:'#123456',shell:'#abcdef',orbit:'#fedcba',shape:'cube',size:'large',motion:'breathe'};
test('room appearance updates retain camera, renderer and active XR session while updating actual layers',async()=>{
 const m:any=await mount({allowMotion:true,holographic:true});try{
 await m.controls.current!.ar('free');const renderer=m.renderer!,camera=renderer.camera,controls=m.controls.current,group=renderer.scene.children[0],mark=group.children[0],mesh=mark.children[0];const before=camera.position.toArray();
 const graph={...m.props.graph,nodes:m.props.graph.nodes.map((n:any)=>({...n,color:0x123456,appearance}))};m.update({graph});await tick();assert.equal(renderer.disposed,false,'color edits must not dispose the renderer');assert.equal(m.controls.current,controls);assert.equal(renderer.xr.getSession(),m.session);assert.equal(renderer.camera,camera);assert.deepEqual(camera.position.toArray(),before);assert.equal(group.children[0],mark);assert.equal(mark.children[0],mesh);assert.equal(mesh.geometry.type,'BoxGeometry');assert.equal(mesh.material.uniforms.tint.value.getHexString(),'123456');assert.equal(mark.children.find((n:any)=>n.userData.appearanceLayer==='shell').material.color.getHexString(),'abcdef');assert.equal(mark.scale.x,1.25*1.22);
 }finally{m.unmount();await tick();m.restore()}
});
test('room breathe respects global policy and OS reduced motion without moving node centers',async()=>{
 const m:any=await mount({allowMotion:true});try{
 m.update({graph:{...m.props.graph,nodes:m.props.graph.nodes.map((n:any)=>({...n,appearance}))}});const mark=m.renderer!.scene.children[0].children[0],center=mark.position.toArray();assert.equal(typeof m.renderer!.loop,'function','breathe must schedule frames when allowed');m.renderer!.loop(1000);assert.equal(mark.scale.x,1.25*1.22);assert.ok(mark.children.find((n:any)=>n.userData.appearanceLayer==='shell').scale.x>1);assert.deepEqual(mark.position.toArray(),center);m.media.matches=true;m.media.dispatchEvent(new Event('change'));assert.equal(m.renderer!.loop,null);assert.equal(mark.scale.x,1.25*1.22);m.media.matches=false;m.media.dispatchEvent(new Event('change'));m.update({allowMotion:false});assert.equal(m.renderer!.loop,null);assert.equal(mark.scale.x,1.25*1.22);
 }finally{m.unmount();await tick();m.restore()}
});
