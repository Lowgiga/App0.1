import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { Mesh } from 'three';
import { createGraphScene } from '../src/three-scene.ts';
import { createSpatialController } from '../src/three-controller.ts';
import { fixture, sources, MID } from './fixture.ts';
import { adaptWorkState } from '../src/model.ts';
import { defaultConfig, selectScene, limitsFor } from '../src/view.ts';
import { layoutGraph } from '../src/layouts.ts';
const props = () => { const g = adaptWorkState(fixture(), sources), config = defaultConfig(); config.renderer = 'three'; config.selectedId = 'mission:' + MID; return { scene: selectScene(g, config), layout: layoutGraph(g, 'network'), config, onSelect: (_id: string) => { }, onUnavailable: (_reason: string) => { } }; };
test('real Three scene uses bounded selectable nodes and releases shared GPU resource objects exactly once', () => { const p = props(); const built = createGraphScene(p); assert.equal(built.pickables.length, p.scene.nodes.length); assert.ok(built.pickables.every(o => o instanceof Mesh)); assert.ok(built.pickables.length <= limitsFor(p.config.quality).nodes); const resources = new Set<{
    addEventListener: (type: string, fn: () => void) => void;
}>(); built.scene.traverse((o: any) => { if (o.geometry)
    resources.add(o.geometry); if (o.material)
    for (const m of Array.isArray(o.material) ? o.material : [o.material])
        resources.add(m); }); let count = 0; for (const r of resources)
    r.addEventListener('dispose', () => count++); built.dispose(); built.dispose(); assert.equal(count, resources.size); assert.equal(built.scene.children.length, 0); });
test('on-demand controller handles updates, context loss and complete disposal without animation loops', () => { const w = new Window(); const host = w.document.createElement('div'); w.document.body.append(host); let renders = 0, disposed = 0, lost = 0, unavailable = 0; const canvas = w.document.createElement('canvas'); const renderer = { domElement: canvas as unknown as HTMLCanvasElement, setPixelRatio: (_n: number) => { }, setSize: (_a: number, _b: number) => { }, render: () => { renders++; }, dispose: () => { disposed++; }, forceContextLoss: () => { lost++; } }; const p = props(); p.onUnavailable = () => { unavailable++; }; const c = createSpatialController(host as unknown as HTMLElement, p, { createRenderer: () => renderer }); assert.ok(renders > 0); assert.equal(host.querySelectorAll('canvas').length, 1); const before = renders; c.update({ ...p, config: { ...p.config, perspective: 'front' } }); assert.ok(renders > before); canvas.dispatchEvent(new w.Event('webglcontextlost', { cancelable: true })); assert.equal(unavailable, 1); c.dispose(); c.dispose(); assert.equal(disposed, 1); assert.equal(lost, 1); assert.equal(host.children.length, 0); const after = renders; w.dispatchEvent(new w.Event('resize')); assert.equal(renders, after); });
test('renderer construction failure is reported honestly and leaves no DOM resources', () => { const w = new Window(); const host = w.document.createElement('div'); assert.throws(() => createSpatialController(host as unknown as HTMLElement, props(), { createRenderer: () => { throw Error('No WebGL2'); } }), /No WebGL2/); assert.equal(host.children.length, 0); });
test('failed scene update keeps current scene resources and can still dispose renderer', () => { const w = new Window(), host = w.document.createElement('div'); let disposed = 0; const renderer = { domElement: w.document.createElement('canvas') as unknown as HTMLCanvasElement, setPixelRatio: (_n: number) => { }, setSize: (_a: number, _b: number) => { }, render: () => { }, dispose: () => { disposed++; }, forceContextLoss: () => { } }; const p = props(), c = createSpatialController(host as unknown as HTMLElement, p, { createRenderer: () => renderer }); const bad = { ...p, scene: { ...p.scene, get nodes(): any { throw Error('bad projection'); } } }; assert.throws(() => c.update(bad), /bad projection/); c.dispose(); assert.equal(disposed, 1); assert.equal(host.children.length, 0); });
test('holographic style preserves graph IDs, makes bounded translucent geometry and stays off in clear mode', () => { const p = props(); p.config.visualStyle = 'hologram'; const a = createGraphScene(p); const b = createGraphScene({ ...p, config: { ...p.config, visualStyle: 'solid' } }); assert.deepEqual(a.pickables.map(n => n.userData.nodeId), b.pickables.map(n => n.userData.nodeId)); assert.ok(a.pickables.every(n => (n.material as any).transparent)); assert.ok(a.pickables.every(n => (n.material as any).wireframe)); a.dispose(); b.dispose(); });
test('late ResizeObserver size and pixel-ratio failures report unavailable once without uncaught errors',()=>{
 for(const method of ['setPixelRatio','setSize'] as const){
  const w=new Window(),host=w.document.createElement('div');let resize:()=>void=()=>{};let fail=false;let unavailable=0;let disposed=0;
  class FakeObserver{constructor(callback:()=>void){resize=callback}observe(){}disconnect(){}}
  Object.defineProperty(w,'ResizeObserver',{configurable:true,value:FakeObserver});
  const p=props();p.onUnavailable=()=>{unavailable++};
  const renderer={domElement:w.document.createElement('canvas') as unknown as HTMLCanvasElement,setPixelRatio:()=>{if(fail&&method==='setPixelRatio')throw Error('DPR failure')},setSize:()=>{if(fail&&method==='setSize')throw Error('Size failure')},render:()=>{},dispose:()=>{disposed++},forceContextLoss:()=>{}};
  const controller=createSpatialController(host as unknown as HTMLElement,p,{createRenderer:()=>renderer});fail=true;
  assert.doesNotThrow(()=>resize());assert.equal(unavailable,1);resize();assert.equal(unavailable,1);controller.dispose();assert.equal(disposed,1);
 }
});
test('late window resize failure also takes the controlled fallback path',()=>{const w=new Window(),host=w.document.createElement('div');Object.defineProperty(w,'ResizeObserver',{configurable:true,value:undefined});let fail=false,unavailable=0;const p=props();p.onUnavailable=()=>{unavailable++};const renderer={domElement:w.document.createElement('canvas')as unknown as HTMLCanvasElement,setPixelRatio:()=>{},setSize:()=>{if(fail)throw Error('Late failure')},render:()=>{},dispose:()=>{},forceContextLoss:()=>{}};const controller=createSpatialController(host as unknown as HTMLElement,p,{createRenderer:()=>renderer});fail=true;w.dispatchEvent(new w.Event('resize'));assert.equal(unavailable,1);controller.dispose()});

import { TestFrameClock } from './frame-clock.ts';
function motionHarness() {
 const w = new Window(), host = w.document.createElement('div'), clock = new TestFrameClock();
 w.document.body.append(host);
 const canvas = w.document.createElement('canvas'); let renders = 0, unavailable = 0, selections = 0;
 let latest = { position: [] as number[], quaternion: [] as number[] };
 const renderer = { domElement: canvas as unknown as HTMLCanvasElement, setPixelRatio: (_n: number) => {}, setSize: (_w: number, _h: number) => {}, render: (_scene: unknown, camera: any) => { renders++; latest = { position: camera.position.toArray(), quaternion: camera.quaternion.toArray() }; }, dispose: () => {}, forceContextLoss: () => {} };
 const p = props(); p.config.reducedMotion = false; p.config.transitions = 'smooth'; p.onSelect = () => selections++; p.onUnavailable = () => unavailable++;
 const c = createSpatialController(host as unknown as HTMLElement, p, { createRenderer: () => renderer, frameClock: clock });
 return { w, host, canvas, clock, p, c, snapshot: () => ({ ...latest, renders, unavailable, selections }) };
}

test('3D demand camera focus finishes once, preserves IDs and does not invoke selection callbacks', () => {
 const h = motionHarness(); assert.equal(h.clock.pending.size, 0);
 const before = h.snapshot(); const next = { ...h.p, config: { ...h.p.config, perspective: 'front' as const } };
 h.c.update(next); assert.equal(h.clock.pending.size, 1);
 assert.deepEqual(h.snapshot().position, before.position);
 h.clock.step(120); const middle = h.snapshot().position; assert.notDeepEqual(middle, before.position);
 h.clock.step(240); assert.equal(h.clock.pending.size, 0); const end = h.snapshot(); assert.notDeepEqual(end.position, middle);
 h.clock.step(500); assert.equal(h.snapshot().renders, end.renders); assert.equal(h.snapshot().selections, 0);
 assert.equal(next.config.selectedId, h.p.config.selectedId); h.c.dispose();
});

test('3D rapid toggles finish at the last immediate camera target and policy changes settle immediately', () => {
 const h = motionHarness();
 const front = { ...h.p, config: { ...h.p.config, perspective: 'front' as const } };
 h.c.update(front); h.clock.step(80); h.c.update(h.p); h.clock.step(160); h.c.update(front); h.clock.step(500);
 const animatedEnd = h.snapshot().position;
 h.c.update({ ...front, config: { ...front.config, reducedMotion: true } }); h.c.fit();
 assert.deepEqual(h.snapshot().position, animatedEnd); assert.equal(h.clock.pending.size, 0);
 for (const policy of [{ reducedMotion: true }, { quality: 'low' as const }, { transitions: 'off' as const }]) {
  h.c.update(front); h.c.update(h.p); assert.equal(h.clock.pending.size, 1);
  h.c.update({ ...h.p, config: { ...h.p.config, ...policy } }); assert.equal(h.clock.pending.size, 0);
 }
 h.c.dispose();
});

test('3D Escape and camera gestures cancel without fighting the user or scheduling a delayed fit', () => {
 const h = motionHarness(), front = { ...h.p, config: { ...h.p.config, perspective: 'front' as const } };
 h.c.update(front); assert.equal(h.clock.pending.size, 1); h.clock.step(80);
 h.host.dispatchEvent(new h.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); assert.equal(h.clock.pending.size, 0);
 h.c.update(h.p); h.clock.step(120);
 h.canvas.dispatchEvent(new h.w.PointerEvent('pointerdown', { clientX: 20, clientY: 20, button: 0, pointerId: 1 }));
 assert.equal(h.clock.pending.size, 0);
 h.c.update(front); assert.equal(h.clock.pending.size, 0);
 h.canvas.dispatchEvent(new h.w.PointerEvent('pointercancel', { pointerId: 1 }));
 h.clock.step(500); assert.equal(h.clock.pending.size, 0); assert.equal(h.snapshot().selections, 0);
 h.c.dispose();
});

test('3D context loss and disposal clear all transition frames including stale callbacks', () => {
 for (const reason of ['context', 'dispose'] as const) {
  const h = motionHarness(); h.c.update({ ...h.p, config: { ...h.p.config, perspective: 'front' as const } });
  assert.equal(h.clock.pending.size, 1);
  if (reason === 'context') h.canvas.dispatchEvent(new h.w.Event('webglcontextlost', { cancelable: true })); else h.c.dispose();
  const before = h.snapshot(); assert.equal(h.clock.pending.size, 0);
  for (const callback of h.clock.canceled) callback(500);
  h.clock.step(1000); assert.equal(h.snapshot().renders, before.renders);
  assert.equal(h.snapshot().unavailable, reason === 'context' ? 1 : 0); h.c.dispose(); assert.equal(h.host.children.length, 0);
 }
});

test('3D selection focus is bounded and a missing or cleared selection cancels the old destination', () => {
 const h = motionHarness(), selectedId = h.p.scene.nodes.find(n => n.id !== h.p.config.selectedId)!.id;
 const next = { ...h.p, config: { ...h.p.config, selectedId } };
 const before = h.snapshot().position;
 h.c.update(next); assert.equal(h.clock.pending.size, 1);
 h.clock.step(120); assert.notDeepEqual(h.snapshot().position, before);
 h.c.update({ ...next, config: { ...next.config, selectedId: null } }); assert.equal(h.clock.pending.size, 0);
 const held = h.snapshot().position; h.clock.step(999); assert.deepEqual(h.snapshot().position, held);
 h.c.update(h.p); assert.equal(h.clock.pending.size, 1);
 h.c.update({ ...h.p, scene: { ...h.p.scene, nodes: h.p.scene.nodes.filter(n => n.id !== h.p.config.selectedId) } });
 assert.equal(h.clock.pending.size, 0); assert.equal(h.snapshot().selections, 0); h.c.dispose();
});

test('3D hidden document and a renderer error during an animated frame stop scheduling immediately', () => {
 const h = motionHarness();
 h.c.update({ ...h.p, config: { ...h.p.config, perspective: 'front' as const } }); assert.equal(h.clock.pending.size, 1);
 Object.defineProperty(h.w.document, 'hidden', { configurable: true, value: true });
 h.w.document.dispatchEvent(new h.w.Event('visibilitychange')); assert.equal(h.clock.pending.size, 0);
 h.c.update(h.p); assert.equal(h.clock.pending.size, 0); h.c.dispose();
 const w = new Window(), host = w.document.createElement('div'), clock = new TestFrameClock();
 let fail = false, unavailable = 0;
 const p = props(); p.config.reducedMotion = false; p.config.transitions = 'brief'; p.onUnavailable = () => unavailable++;
 const c = createSpatialController(host as unknown as HTMLElement, p, { frameClock: clock, createRenderer: () => ({ domElement: w.document.createElement('canvas') as unknown as HTMLCanvasElement, setPixelRatio: () => {}, setSize: () => {}, render: () => { if (fail) throw Error('frame failure'); }, dispose: () => {}, forceContextLoss: () => {} }) });
 c.update({ ...p, config: { ...p.config, perspective: 'front' } }); assert.equal(clock.pending.size, 1); fail = true;
 assert.doesNotThrow(() => clock.step(80)); assert.equal(unavailable, 1); assert.equal(clock.pending.size, 0); c.dispose();
});

test('3D two-pointer gesture retains priority after one pointer is canceled', () => {
 const h = motionHarness();
 for (const pointerId of [1, 2]) h.canvas.dispatchEvent(new h.w.PointerEvent('pointerdown', { pointerType: 'touch', pointerId, clientX: pointerId * 20, clientY: 20, bubbles: true }));
 h.canvas.dispatchEvent(new h.w.PointerEvent('pointercancel', { pointerType: 'touch', pointerId: 2, bubbles: true }));
 h.c.update({ ...h.p, config: { ...h.p.config, perspective: 'front' } });
 assert.equal(h.clock.pending.size, 0);
 h.canvas.dispatchEvent(new h.w.PointerEvent('pointercancel', { pointerType: 'touch', pointerId: 1, bubbles: true }));
 h.c.update(h.p); assert.equal(h.clock.pending.size, 1); h.c.dispose();
});

test('3D selection-only framing retains zoom and caps its full translation at twenty percent', () => {
 const h = motionHarness(), p = h.p;
 const points = p.scene.nodes.map(node => p.layout.positions[node.id]);
 const center = [
  (Math.min(...points.map(v => v.x)) + Math.max(...points.map(v => v.x))) / 200,
  -(Math.min(...points.map(v => v.y)) + Math.max(...points.map(v => v.y))) / 200,
  (Math.min(...points.map(v => v.z)) + Math.max(...points.map(v => v.z))) / 200,
 ];
 const before = h.snapshot(), distance = Math.hypot(...before.position.map((v, i) => v - center[i]));
 const selectedId = p.scene.nodes.find(node => node.id !== p.config.selectedId)!.id;
 h.c.update({ ...p, config: { ...p.config, selectedId } }); h.clock.step(240);
 const after = h.snapshot(), translation = Math.hypot(...after.position.map((v, i) => v - before.position[i]));
 assert.ok(translation > 0); assert.ok(translation <= distance * .2 + 1e-10);
 after.quaternion.forEach((value, i) => assert.ok(Math.abs(value - before.quaternion[i]) < 1e-10));
 assert.equal(h.clock.pending.size, 0); h.c.dispose();
});

function largeFramingHarness() {
 const graph = adaptWorkState(fixture(), sources), sample = graph.nodes.find(n => n.kind === 'source')!;
 graph.nodes = Array.from({ length: 300 }, (_, i) => ({ ...sample, id: 'source:frame-' + i })); graph.edges = [];
 const config = { ...defaultConfig(), renderer: 'three' as const, quality: 'high' as const, transitions: 'smooth' as const, reducedMotion: false, selectedId: graph.nodes[0].id };
 const w = new Window(), host = w.document.createElement('div'), clock = new TestFrameClock(); w.document.body.append(host);
 let latest = { position: [] as number[], near: 0, far: 0 };
 const renderer = { domElement: w.document.createElement('canvas') as unknown as HTMLCanvasElement, setPixelRatio: () => {}, setSize: () => {}, render: (_scene: unknown, camera: any) => { latest = { position: camera.position.toArray(), near: camera.near, far: camera.far }; }, dispose: () => {}, forceContextLoss: () => {} };
 const p = { scene: selectScene(graph, config), layout: layoutGraph(graph, 'network'), config, onSelect: (_id: string) => {}, onUnavailable: (_reason: string) => {} };
 const c = createSpatialController(host as unknown as HTMLElement, p, { createRenderer: () => renderer, frameClock: clock });
 const focused = { ...p, config: { ...config, mode: 'focus' as const } }; focused.scene = selectScene(graph, focused.config);
 return { graph, w, host, clock, p, focused, c, snapshot: () => structuredClone(latest) };
}

test('large-to-small and small-to-large camera fits retain frame zero and safe clipping until exact completion', () => {
 const a = largeFramingHarness(), immediate = largeFramingHarness();
 const nearly = (x: number[], y: number[]) => x.forEach((v, i) => assert.ok(Math.abs(v - y[i]) < 1e-10, JSON.stringify({ x, y })));
 try {
  for (const next of [a.focused, a.p]) {
   const before = a.snapshot();
   immediate.c.update({ ...next, config: { ...next.config, transitions: 'off' } }); const expected = immediate.snapshot();
   a.c.update(next); assert.equal(a.clock.pending.size, 1); nearly(a.snapshot().position, before.position);
   assert.ok(a.snapshot().near <= Math.min(before.near, expected.near));
   assert.ok(a.snapshot().far >= Math.max(before.far, expected.far));
   a.clock.step(a.clock.time + 160);
   assert.ok(a.snapshot().near <= Math.min(before.near, expected.near));
   assert.ok(a.snapshot().far >= Math.max(before.far, expected.far));
   a.clock.step(a.clock.time + 160); const end = a.snapshot();
   nearly(end.position, expected.position); assert.equal(end.near, expected.near); assert.equal(end.far, expected.far); assert.equal(a.clock.pending.size, 0);
  }
  a.c.update(a.focused); a.clock.step(a.clock.time + 160);
  a.host.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); const held = a.snapshot();
  a.clock.step(a.clock.time + 1000); assert.deepEqual(a.snapshot(), held); assert.equal(a.clock.pending.size, 0);
 } finally { a.c.dispose(); immediate.c.dispose(); }
});

test('only a genuine single-pointer primary tap selects; pinch, cancellation and drag-return do not', () => {
 const graph = adaptWorkState(fixture(), sources); graph.nodes = [graph.nodes[0]]; graph.edges = [];
 const config = { ...defaultConfig(), renderer: 'three' as const }, w = new Window(), host = w.document.createElement('div'); w.document.body.append(host);
 const canvas = w.document.createElement('canvas'); let selections = 0;
 Object.defineProperty(canvas, 'clientWidth', { value: 640 }); Object.defineProperty(canvas, 'clientHeight', { value: 440 });
 canvas.getBoundingClientRect = () => new w.DOMRect(0, 0, 640, 440);
 const c = createSpatialController(host as unknown as HTMLElement, { scene: selectScene(graph, config), layout: layoutGraph(graph, 'network'), config, onSelect: () => selections++, onUnavailable: () => {} }, { createRenderer: () => ({ domElement: canvas as unknown as HTMLCanvasElement, setPixelRatio: () => {}, setSize: () => {}, render: (scene, camera) => { camera.updateMatrixWorld(); scene.updateMatrixWorld(); }, dispose: () => {}, forceContextLoss: () => {} }) });
 const pointer = (type: string, id: number, x = 320) => canvas.dispatchEvent(new w.PointerEvent(type, { pointerType: 'touch', pointerId: id, button: 0, clientX: x, clientY: 220, bubbles: true }));
 try {
  pointer('pointerdown', 1); pointer('pointerdown', 2); pointer('pointerup', 2); assert.equal(selections, 0);
  pointer('pointerup', 1); assert.equal(selections, 0);
  pointer('pointerdown', 3); pointer('pointercancel', 3); pointer('pointerup', 3); assert.equal(selections, 0);
  pointer('pointerdown', 4); pointer('pointermove', 4, 340); pointer('pointermove', 4); pointer('pointerup', 4); assert.equal(selections, 0);
  c.fit(false); pointer('pointerdown', 5); pointer('pointerup', 5); assert.equal(selections, 1);
 } finally { c.dispose(); }
});

test('camera transition far envelope also includes translated destination geometry', () => {
 const h = largeFramingHarness();
 try {
  const selectedId = 'source:frame-99', config = { ...h.p.config, mode: 'focus' as const, perspective: 'top' as const, selectedId };
  const focused = { ...h.p, config, scene: selectScene(h.graph, config) }; h.c.update(focused); h.clock.step(320);
  const from = h.snapshot(), layout = layoutGraph(h.graph, 'workflow'), point = layout.positions[selectedId];
  const distance = Math.hypot(from.position[0] - point.x / 100, from.position[1] + point.y / 100, from.position[2] - point.z / 100);
  h.c.update({ ...focused, layout, config: { ...config, layout: 'workflow' } });
  assert.ok(h.snapshot().far > distance, 'new layout geometry must remain inside the transition far envelope');
  h.clock.step(480); assert.ok(h.snapshot().far > distance);
  h.clock.step(640); assert.equal(h.snapshot().far, 100); assert.equal(h.clock.pending.size, 0);
 } finally { h.c.dispose(); }
});
