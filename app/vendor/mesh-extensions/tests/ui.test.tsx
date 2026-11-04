import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import React, { act } from 'react';
import { fixture, sources, MID } from './fixture.ts';
import { adaptWorkState } from '../src/model.ts';
import { defaultConfig } from '../src/view.ts';
import { GraphExplorer } from '../src/GraphExplorer.tsx';
const window = new Window({ url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'SVGElement', 'Event', 'MouseEvent', 'KeyboardEvent'] as const)
    Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? window : window[key] });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: window.navigator });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot } = await import('react-dom/client');
let root: ReturnType<typeof createRoot> | null = null;
let host: HTMLDivElement;
async function render(props: React.ComponentProps<typeof GraphExplorer>) { host = document.createElement('div'); document.body.append(host); root = createRoot(host); await act(async () => root!.render(<GraphExplorer {...props}/>)); }
const find = (selector: string) => { const e = host.querySelector(selector); assert.ok(e, selector); return e as HTMLElement; };
async function click(e: HTMLElement) { await act(async () => e.dispatchEvent(new window.MouseEvent('click', { bubbles: true }) as unknown as MouseEvent)); }
async function change(selector: string, value: string) { const e = find(selector) as HTMLSelectElement; e.value = value; await act(async () => e.dispatchEvent(new window.Event('change', { bubbles: true }) as unknown as Event)); }
afterEach(async () => { if (root)
    await act(async () => root!.unmount()); root = null; document.body.innerHTML = ''; });
test('unknown state is explicit and never shown as live or loaded-empty', async () => { await render({ graph: adaptWorkState(null, null) }); assert.match(host.textContent ?? '', /Datenstand unbekannt/); assert.equal(host.querySelectorAll('[data-node-id]').length, 0); });
test('keyboard node selection survives layout/filter changes and inspector shows real evidence', async () => { await render({ graph: adaptWorkState(fixture(), sources) }); const node = find('[data-node-id="mission:' + MID + '"]'); await act(async () => node.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }) as unknown as KeyboardEvent)); assert.match(find('[data-inspector]').textContent ?? '', /Actual evidence content/); await change('[aria-label="Layout"]', 'evidence'); assert.equal(find('[data-inspector]').getAttribute('data-selected-id'), 'mission:' + MID); await click(find('[aria-label="Missionen anzeigen"]')); assert.match(find('[data-inspector]').textContent ?? '', /durch Filter ausgeblendet/); assert.equal(find('[data-inspector]').getAttribute('data-selected-id'), 'mission:' + MID); });
test('navigation and preparation emit typed intents only after explicit clicks', async () => { const nav: unknown[] = []; const prep: unknown[] = []; const graph = adaptWorkState(fixture(), sources); const config = defaultConfig(); config.selectedId = 'mission:' + MID; await render({ graph, initialConfig: config, onNavigate: t => { nav.push(t); }, onPrepare: t => { prep.push(t); } }); assert.equal(nav.length + prep.length, 0); await click(find('[data-action="navigate"]')); await click(find('[data-action="prepare"]')); assert.deepEqual(nav[0], { view: 'missions', entityId: MID, nodeId: 'mission:' + MID, query: 'Inspect actual workflow' }); assert.deepEqual(prep[0], { kind: 'review-evidence', entity: 'mission', entityId: MID, nodeId: 'mission:' + MID, expectedUpdatedAt: graph.updatedAt }); assert.equal(graph.nodes.find(n => n.id === 'mission:' + MID)?.status, 'Working'); });
test('save callback is explicit, exports serializable config and exposes rejection', async () => { let count = 0; await render({ graph: adaptWorkState(fixture(), sources), onSaveView: async () => { count++; throw Error('Storage is read-only'); } }); assert.equal(count, 0); await change('[aria-label="Layout"]', 'workflow'); assert.equal(count, 0); await click(find('[data-action="save"]')); assert.equal(count, 1); assert.match(host.textContent ?? '', /Speichern fehlgeschlagen/); await click(find('[data-action="export"]')); const raw = (find('[aria-label="Ansichtskonfiguration JSON"]') as HTMLTextAreaElement).value; assert.equal(JSON.parse(raw).layout, 'workflow'); });
test('retained activity tells the truth about incomplete history and current graph', async () => { await render({ graph: adaptWorkState(fixture(), sources) }); assert.match(host.textContent ?? '', /Keine Zustandsrekonstruktion/); assert.match(host.textContent ?? '', /Actual retained stage record/); assert.match(host.textContent ?? '', /#51/); });
test('host data removal leaves an explicit missing selection rather than selecting another node', async () => { const c = defaultConfig(); c.selectedId = 'mission:' + MID; await render({ graph: adaptWorkState(fixture(), sources), initialConfig: c }); await act(async () => root!.render(<GraphExplorer graph={adaptWorkState(null, null)} initialConfig={c}/>)); assert.match(find('[data-inspector]').textContent ?? '', /nicht im aktuellen Datenstand/); });
test('3D failure falls back to usable SVG and preserves selected node', async () => { const c = defaultConfig(); c.selectedId = 'mission:' + MID; c.renderer = 'three'; function Failing({ onUnavailable }: {
    onUnavailable: (message: string) => void;
}) { React.useEffect(() => onUnavailable('GPU unavailable'), [onUnavailable]); return <p>Attempting renderer</p>; } await render({ graph: adaptWorkState(fixture(), sources), initialConfig: c, render3D: p => <Failing onUnavailable={p.onUnavailable}/> }); assert.ok(host.querySelector('svg')); assert.match(host.textContent ?? '', /GPU unavailable/); assert.equal(find('[data-inspector]').getAttribute('data-selected-id'), 'mission:' + MID); });
test('holographic style is labelled visual and can be turned off without changing selected entity', async () => { const c = defaultConfig(); c.selectedId = 'mission:' + MID; await render({ graph: adaptWorkState(fixture(), sources), initialConfig: c }); await change('[aria-label="Visueller Stil"]', 'hologram'); assert.ok(find('.mesh-explorer').classList.contains('mesh-style-hologram')); assert.equal(find('[data-inspector]').getAttribute('data-selected-id'), c.selectedId); await change('[aria-label="Visueller Stil"]', 'solid'); assert.ok(find('.mesh-explorer').classList.contains('mesh-style-solid')); });
test('primary text and controls scale with the host root font setting',async()=>{const {readFileSync}=await import('node:fs');const style=document.createElement('style');style.textContent=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');document.head.append(style);try{await render({graph:adaptWorkState(fixture(),sources)});document.documentElement.style.fontSize='16px';const control=find('[aria-label="Layout"]');const standard=parseFloat(window.getComputedStyle(control as any).fontSize);document.documentElement.style.fontSize='20px';const enlarged=parseFloat(window.getComputedStyle(control as any).fontSize);assert.ok(standard>=16,'primary controls must be at least 1rem at default root size');assert.equal(enlarged/standard,1.25);assert.doesNotMatch(style.textContent,/font-size\s*:\s*[\d.]+px/)}finally{style.remove();document.documentElement.style.fontSize=''}});

import { TestFrameClock } from './frame-clock.ts';
import { layoutGraph } from '../src/layouts.ts';
function installMotionClock() {
 const clock = new TestFrameClock();
 const originals = { request: window.requestAnimationFrame, cancel: window.cancelAnimationFrame, now: window.performance.now, match: globalThis.matchMedia };
 Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, value: clock.request });
 Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, value: clock.cancel });
 Object.defineProperty(window.performance, 'now', { configurable: true, value: clock.now });
 const media = new window.EventTarget() as any; media.matches = false;
 Object.defineProperty(globalThis, 'matchMedia', { configurable: true, value: () => media });
 return { clock, media, restore: () => {
  Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, value: originals.request });
  Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, value: originals.cancel });
  Object.defineProperty(window.performance, 'now', { configurable: true, value: originals.now });
  Object.defineProperty(globalThis, 'matchMedia', { configurable: true, value: originals.match });
 } };
}

test('opt-in 2D transitions animate layout positions and selection with exact ends but never host actions', async () => {
 const harness = installMotionClock();
 try {
  const graph = adaptWorkState(fixture(), sources), config = { ...defaultConfig(), reducedMotion: false, transitions: 'smooth' as const };
  let callbacks = 0, configChanges = 0;
  await render({ graph, initialConfig: config, onConfigChange: () => { configChanges++; }, onSaveView: () => { callbacks++; }, onNavigate: () => { callbacks++; }, onPrepare: () => { callbacks++; } });
  assert.equal(harness.clock.pending.size, 0);
  const selector = '[data-node-id="mission:' + MID + '"]';
  const before = find(selector).getAttribute('transform');
  await change('[aria-label="Layout"]', 'workflow'); assert.equal(harness.clock.pending.size, 1);
  assert.equal(find(selector).getAttribute('transform'), before);
  await act(async () => harness.clock.step(120)); assert.notEqual(find(selector).getAttribute('transform'), before);
  await act(async () => harness.clock.step(240)); assert.equal(harness.clock.pending.size, 0);
  const end = layoutGraph(graph, 'workflow').positions['mission:' + MID];
  assert.equal(find(selector).getAttribute('transform'), `translate(${end.x} ${end.y})`);
  await click(find(selector)); assert.equal(find(selector).getAttribute('aria-pressed'), 'true');
  assert.equal(find(selector).querySelector('circle')?.getAttribute('r'), '14');
  await act(async () => harness.clock.step(480)); assert.equal(find(selector).querySelector('circle')?.getAttribute('r'), '19');
  assert.equal(callbacks, 0); assert.equal(configChanges, 2); assert.equal(harness.clock.pending.size, 0);
 } finally { await act(async () => root!.unmount()); root = null; harness.restore(); }
});

test('2D rapid layout changes, Escape, system preference, energy saving and unmount leave no pending frames', async () => {
 const h = installMotionClock();
 try {
  const graph = adaptWorkState(fixture(), sources);
  await render({ graph, initialConfig: { ...defaultConfig(), transitions: 'smooth', reducedMotion: false } });
  await change('[aria-label="Layout"]', 'workflow'); await act(async () => h.clock.step(80));
  await change('[aria-label="Layout"]', 'evidence'); assert.equal(h.clock.pending.size, 1);
  await act(async () => find('.mesh-map').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }) as any));
  assert.equal(h.clock.pending.size, 0);
  const p = layoutGraph(graph, 'evidence').positions['mission:' + MID];
  assert.equal(find('[data-node-id="mission:' + MID + '"]').getAttribute('transform'), `translate(${p.x} ${p.y})`);
  await change('[aria-label="Layout"]', 'network'); assert.equal(h.clock.pending.size, 1);
  await act(async () => { h.media.matches = true; h.media.dispatchEvent(new window.Event('change')); });
  assert.equal(h.clock.pending.size, 0);
  await change('[aria-label="Layout"]', 'workflow'); assert.equal(h.clock.pending.size, 0);
  await act(async () => { h.media.matches = false; h.media.dispatchEvent(new window.Event('change')); });
  await change('[aria-label="Layout"]', 'network'); assert.equal(h.clock.pending.size, 1);
  await change('[aria-label="Qualität"]', 'low'); assert.equal(h.clock.pending.size, 0);
  await change('[aria-label="Qualität"]', 'balanced'); await change('[aria-label="Layout"]', 'workflow'); assert.equal(h.clock.pending.size, 1);
  await act(async () => root!.unmount()); root = null; assert.equal(h.clock.pending.size, 0);
  await act(async () => { for (const callback of h.clock.canceled) callback(999); h.clock.step(1000); });
  assert.equal(h.clock.pending.size, 0);
 } finally { if (root) { await act(async () => root!.unmount()); root = null; } h.restore(); }
});

test('transition settings are labelled, serialized and have a legacy export without additive fields', async () => {
 await render({ graph: adaptWorkState(fixture(), sources) });
 await change('[aria-label="Übergänge"]', 'brief');
 await click(find('[data-action="export"]'));
 assert.equal(JSON.parse((find('[aria-label="Ansichtskonfiguration JSON"]') as HTMLTextAreaElement).value).transitions, 'brief');
 await click(find('[aria-label="Export für ursprüngliche V1-Ansicht"]'));
 assert.equal('transitions' in JSON.parse((find('[aria-label="Ansichtskonfiguration JSON"]') as HTMLTextAreaElement).value), false);
});

test('legacy typed initial views remain valid without the additive setting', async () => {
 const { transitions: _transitions, ...legacy } = defaultConfig();
 await render({ graph: adaptWorkState(fixture(), sources), initialConfig: legacy });
 assert.equal((find('[aria-label="Übergänge"]') as HTMLSelectElement).value, 'off');
});

test('2D focus frames only visible recorded neighbors and camera controls settle before panning', async () => {
 const h = installMotionClock();
 try {
  const graph = adaptWorkState(fixture(), sources), c = { ...defaultConfig(), selectedId: 'mission:' + MID, transitions: 'brief' as const, reducedMotion: false };
  await render({ graph, initialConfig: c });
  const before = find('svg').getAttribute('viewBox');
  await change('[aria-label="Arbeitsmodus"]', 'focus'); assert.equal(h.clock.pending.size, 1);
  await act(async () => h.clock.step(160)); assert.equal(h.clock.pending.size, 0);
  assert.notEqual(find('svg').getAttribute('viewBox'), before);
  assert.equal(find('[data-inspector]').getAttribute('data-selected-id'), c.selectedId);
  await change('[aria-label="Layout"]', 'workflow'); assert.equal(h.clock.pending.size, 1);
  await click(find('[aria-label="Karte rechts"]')); assert.equal(h.clock.pending.size, 0);
  const held = find('svg').getAttribute('viewBox'); await act(async () => h.clock.step(999)); assert.equal(find('svg').getAttribute('viewBox'), held);
 } finally { if (root) { await act(async () => root!.unmount()); root = null; } h.restore(); }
});

test('2D hiding the document settles and cannot restart animation until visible', async () => {
 const h = installMotionClock();
 try {
  await render({ graph: adaptWorkState(fixture(), sources), initialConfig: { ...defaultConfig(), reducedMotion: false, transitions: 'brief' } });
  await change('[aria-label="Layout"]', 'workflow'); assert.equal(h.clock.pending.size, 1);
  Object.defineProperty(window.document, 'hidden', { configurable: true, value: true });
  await act(async () => window.document.dispatchEvent(new window.Event('visibilitychange'))); assert.equal(h.clock.pending.size, 0);
  await change('[aria-label="Layout"]', 'evidence'); assert.equal(h.clock.pending.size, 0);
 } finally { delete (window.document as any).hidden; if (root) { await act(async () => root!.unmount()); root = null; } h.restore(); }
});

test('2D pan interrupts a transition using the settled target viewport dimensions', async () => {
 const h = installMotionClock();
 try {
  const graph = adaptWorkState(fixture(), sources);
  await render({ graph, initialConfig: { ...defaultConfig(), reducedMotion: false, transitions: 'smooth' } });
  await change('[aria-label="Layout"]', 'workflow'); assert.equal(h.clock.pending.size, 1);
  await click(find('[aria-label="Karte rechts"]'));
  const viewport = find('svg').getAttribute('viewBox')!.split(' ').map(Number), bounds = layoutGraph(graph, 'workflow').bounds;
  assert.equal(viewport[0], bounds.x + bounds.width * .15); assert.equal(h.clock.pending.size, 0);
 } finally { if (root) { await act(async () => root!.unmount()); root = null; } h.restore(); }
});
