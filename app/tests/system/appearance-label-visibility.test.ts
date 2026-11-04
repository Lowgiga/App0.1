import test from 'node:test';
import assert from 'node:assert/strict';
import {readableLabelIds,containLabelBox,createLabelLayout,LABEL_FOCUS_INSET,type LabelBox} from '../../src/appearance/label-visibility.ts';
const box=(id:string,left:number,top=0):LabelBox=>({id,left,top,width:120,height:30});
test('crowded projected names remain separate while selected name wins regardless of source order',()=>{
 const boxes=[box('a',0),box('b',20),box('c',140),box('selected',25)];
 assert.deepEqual([...readableLabelIds(boxes,'selected',null)],['selected']);
 assert.deepEqual([...readableLabelIds(boxes,null,null)],['a','c']);
});
test('keyboard-focused name keeps its place ahead of a colliding selected label',()=>{
 assert.deepEqual([...readableLabelIds([box('selected',0),box('focused',20),box('other',200)],'selected','focused')],['focused','other']);
});
test('zoomed or panned separation restores labels rather than permanently dropping them',()=>{
 assert.equal(readableLabelIds([box('a',0),box('b',20)],null,null).size,1);
 assert.equal(readableLabelIds([box('a',0),box('b',125)],null,null).size,2);
 assert.equal(readableLabelIds([box('a',0),box('b',0,35)],null,null).size,2);
});
test('invalid and unmeasurable boxes do not suppress valid names; inputs stay unchanged',()=>{
 const boxes=[box('a',0),{...box('invalid',0),width:NaN},{...box('zero',0),height:0}];const before=structuredClone(boxes);
 assert.deepEqual([...readableLabelIds(boxes,null,null)],['a']);assert.deepEqual(boxes,before);
});

import {Window} from 'happy-dom';
import {adaptWorkState} from '../../vendor/mesh-extensions/src/model.ts';
import {defaultConfig,selectScene} from '../../vendor/mesh-extensions/src/view.ts';
import {layoutGraph} from '../../vendor/mesh-extensions/src/layouts.ts';
import {fixture,sources} from '../../vendor/mesh-extensions/tests/fixture.ts';
import {createSpatialController} from '../../overlay/appearance-three-controller.ts';
test('generated controller measures real label bounds, preserves selection and click callback, and restores names when resized text no longer overlaps',async()=>{
 const w=new Window(),host=w.document.createElement('div');w.document.body.append(host);Object.defineProperty(w,'ResizeObserver',{value:undefined});
 let separated=false,clicked='',cameraPose:number[]=[],index=0;
 const create=w.document.createElement.bind(w.document);
 w.document.createElement=((tag:string,...args:any[])=>{const element=create(tag as any,...args);if(tag==='button'){const ordinal=index++;element.getBoundingClientRect=()=>({left:0,top:0,width:separated?12:120,height:separated?12:30,right:separated?12:120,bottom:separated?12:30,x:0,y:0,toJSON(){}})}return element})as typeof w.document.createElement;
 const graph=adaptWorkState(fixture(),sources),config={...defaultConfig(),renderer:'three' as const,labels:'all' as const,selectedId:graph.nodes[1].id};
 const props={scene:selectScene(graph,config),layout:layoutGraph(graph,'network'),config,onSelect(id:string){clicked=id},onUnavailable(message:string){throw Error(message)}};
 const canvas=create('canvas');const c=createSpatialController(host as unknown as HTMLElement,props,{createRenderer:()=>({domElement:canvas as unknown as HTMLCanvasElement,setPixelRatio(){},setSize(){},render(_scene,camera:any){cameraPose=camera.position.toArray()},dispose(){},forceContextLoss(){}})});
 const visible=()=>[...host.querySelectorAll('button')].filter(e=>!e.hidden);
 assert.equal(visible().length,1);assert.equal(visible()[0].getAttribute('aria-pressed'),'true');visible()[0].click();assert.equal(clicked,config.selectedId);
 const pose=[...cameraPose];separated=true;w.dispatchEvent(new w.Event('resize'));assert.ok(visible().length>1);assert.deepEqual(cameraPose,pose);assert.equal(host.querySelector('canvas'),canvas);
 c.update({...props,config:{...config,labels:'selected'}});assert.equal(host.querySelectorAll('.mesh-three-label').length,1);
 c.update({...props,config:{...config,labels:'none'}});assert.equal(host.querySelectorAll('.mesh-three-label').length,0);
 c.dispose();await w.happyDOM.abort();
});

test('viewport edges constrain label boxes without changing their associated node identity',()=>{
 const bounds={left:10,top:20,width:300,height:200};
 assert.deepEqual(containLabelBox(box('selected',280,210),bounds),box('selected',190,190));
 assert.deepEqual(containLabelBox(box('other',-100,-50),bounds),box('other',10,20));
});

import {TestFrameClock} from '../../vendor/mesh-extensions/tests/frame-clock.ts';
test('normal-motion breathing reuses label measurements and keyboard focus instead of revealing and measuring every frame',async()=>{
 const w=new Window(),host=w.document.createElement('div'),clock=new TestFrameClock();w.document.body.append(host);Object.defineProperty(w,'ResizeObserver',{value:undefined});const fonts=new w.EventTarget();Object.defineProperty(w.document,'fonts',{value:fonts});
 let measurements=0;const create=w.document.createElement.bind(w.document);
 w.document.createElement=((tag:string,...args:any[])=>{const element=create(tag as any,...args);if(tag==='button')element.getBoundingClientRect=()=>{measurements++;return {left:0,top:0,width:60,height:27,right:60,bottom:27,x:0,y:0,toJSON(){}}};return element})as typeof w.document.createElement;
 const base=adaptWorkState(fixture(),sources),graph={...base,nodes:base.nodes.map(n=>({...n,appearance:{core:'#336699',shell:'#336699',orbit:'#336699',shape:'cube' as const,size:'normal' as const,motion:'breathe' as const}}))};
 const config={...defaultConfig(),renderer:'three' as const,labels:'all' as const,reducedMotion:false,transitions:'off' as const,selectedId:graph.nodes[0].id};
 const p={scene:selectScene(graph,config),layout:layoutGraph(graph,'network'),config,onSelect(){},onUnavailable(message:string){throw Error(message)}};
 const canvas=create('canvas'),c=createSpatialController(host as unknown as HTMLElement,p,{frameClock:clock,createRenderer:()=>({domElement:canvas as unknown as HTMLCanvasElement,setPixelRatio(){},setSize(){},render(){},dispose(){},forceContextLoss(){}})});
 try{
  assert.equal(clock.pending.size,1,'normal-motion breathe is active');const focused=[...host.querySelectorAll('button')].find(button=>button.getAttribute('aria-pressed')==='true')!;focused.focus();const first=measurements;assert.ok(first>0);
  for(let i=1;i<=120;i++)clock.step(i*16);
  assert.equal(measurements,first,'120 animation frames must not measure the labels again');assert.equal(w.document.activeElement,focused);assert.equal(focused.hidden,false);
  c.update({...p});assert.equal(w.document.activeElement,focused,'appearance rerender retains the focused DOM button');assert.equal(measurements,first,'unchanged content does not invalidate measured sizes');
  w.dispatchEvent(new w.Event('resize'));assert.ok(measurements>first,'viewport changes trigger a new batched measurement');const resized=measurements;for(let i=121;i<=180;i++)clock.step(i*16);assert.equal(measurements,resized);fonts.dispatchEvent(new w.Event('loadingdone'));assert.ok(measurements>resized,'font loading invalidates cached measurements');assert.equal(w.document.activeElement,focused);
 }finally{c.dispose();await w.happyDOM.abort()}
});

test('320 labels are measured in one batch and reused across 120 continuous frames including hidden labels',async()=>{
 const w=new Window(),container=w.document.createElement('div');w.document.body.append(container);const nodes=new Map<string,HTMLButtonElement>(),layout=createLabelLayout(container as unknown as HTMLElement,nodes);let reads=0;
 const input=Array.from({length:320},(_,i)=>({id:String(i),title:'Dense label '+i}));layout.sync(input,'all','0',()=>{});layout.resize(390,370);
 for(const button of nodes.values())button.getBoundingClientRect=()=>{reads++;assert.ok([...nodes.values()].every(b=>!b.hidden),'all reveal writes precede measurement reads');return{left:0,top:0,width:120,height:30,right:120,bottom:30,x:0,y:0,toJSON(){}}};
 const projected=input.map((node,i)=>({id:node.id,x:(i%16)/8-1,y:Math.floor(i/16)/10-1,visible:true}));layout.draw(projected,'0');assert.equal(reads,320);assert.ok([...nodes.values()].some(b=>b.hidden));
 for(let frame=0;frame<120;frame++)layout.draw(projected,'0');assert.equal(reads,320,'hidden labels are not repeatedly revealed and measured');
 layout.invalidate();layout.draw(projected,'0');assert.equal(reads,640);assert.ok(LABEL_FOCUS_INSET>=6,'the full 3px outline plus 3px offset remains inside the viewport');
 await w.happyDOM.abort();
});
