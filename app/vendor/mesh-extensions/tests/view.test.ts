import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptWorkState } from '../src/model.ts';
import { defaultConfig, parseConfig, serializeConfig, updateConfig, selectScene, limitsFor } from '../src/view.ts';
import { layoutGraph } from '../src/layouts.ts';
import { fixture, sources, MID } from './fixture.ts';
test('view config roundtrips and layout changes preserve selection and filters', () => { const c = defaultConfig(); c.selectedId = 'mission:' + MID; c.filters.query = 'workflow'; const next = updateConfig(c, { layout: 'workflow' }); assert.equal(next.selectedId, c.selectedId); assert.deepEqual(next.filters, c.filters); assert.equal(c.layout, 'network'); assert.deepEqual(parseConfig(serializeConfig(next)), next); });
test('config rejects unknown versions, inherited extras, NaN and oversized queries', () => { assert.throws(() => parseConfig({ ...defaultConfig(), version: 2 })); assert.throws(() => parseConfig({ ...defaultConfig(), quality: NaN })); assert.throws(() => parseConfig({ ...defaultConfig(), filters: { ...defaultConfig().filters, query: 'x'.repeat(201) } })); assert.throws(() => parseConfig({ ...defaultConfig(), secret: 'no' })); assert.throws(() => parseConfig('not json')); });
test('filtering never clears selection and classifies hidden versus missing', () => { const graph = adaptWorkState(fixture(), sources); const config = defaultConfig(); config.selectedId = 'mission:' + MID; config.filters.kinds = ['source']; const view = selectScene(graph, config); assert.equal(view.selectionState, 'filtered'); assert.equal(view.selected?.id, config.selectedId); assert.ok(view.nodes.every(n => n.kind === 'source')); assert.equal(config.selectedId, 'mission:' + MID); config.selectedId = 'task:removed'; assert.equal(selectScene(graph, config).selectionState, 'missing'); });
test('scene caps nodes/edges, prioritizes selected node and reports exact omissions', () => { const graph = adaptWorkState(fixture(), sources); const sample = graph.nodes.find(n => n.kind === 'source')!; graph.nodes = Array.from({ length: 400 }, (_, i) => ({ ...sample, id: 'source:n' + String(i).padStart(3, '0') })); graph.edges = graph.nodes.slice(1).map((n, i) => ({ id: 'edge:' + i, from: graph.nodes[0].id, to: n.id, relation: 'reads' as const })); const c = defaultConfig(); c.selectedId = graph.nodes[399].id; c.quality = 'low'; const v = selectScene(graph, c); assert.equal(v.nodes.length, limitsFor('low').nodes); assert.ok(v.nodes.some(n => n.id === c.selectedId)); assert.equal(v.omittedNodes, 400 - v.nodes.length); assert.equal(v.omittedEdges, graph.edges.length - v.edges.length); assert.ok(v.edges.length <= limitsFor('low').edges); assert.ok(v.edges.every(e => v.nodes.some(n => n.id === e.from) && v.nodes.some(n => n.id === e.to))); });
test('each layout is finite and deterministic independent of input order', () => { const graph = adaptWorkState(fixture(), sources); const outputs = []; for (const name of ['network', 'workflow', 'evidence'] as const) {
    const a = layoutGraph(graph, name);
    const b = layoutGraph({ ...graph, nodes: [...graph.nodes].reverse(), edges: [...graph.edges].reverse() }, name);
    assert.deepEqual(a, b);
    assert.equal(Object.keys(a.positions).length, graph.nodes.length);
    for (const p of Object.values(a.positions))
        assert.ok([p.x, p.y, p.z].every(Number.isFinite));
    outputs.push(JSON.stringify(a.positions));
} assert.equal(new Set(outputs).size, 3); });
test('evidence layout places task prerequisites before dependent tasks and tolerates cycles', () => { const w = fixture(); const g = adaptWorkState(w, sources); const l = layoutGraph(g, 'evidence'); assert.ok(l.positions['task:' + w.tasks[0].id].x < l.positions['task:' + w.tasks[1].id].x); g.edges = [...g.edges, { id: 'cycle', from: 'task:' + w.tasks[0].id, to: 'task:' + w.tasks[1].id, relation: 'depends-on' }]; assert.ok(Object.values(layoutGraph(g, 'evidence').positions).every(p => Number.isFinite(p.x))); });
test('empty graph has safe nonzero bounds in every layout', () => { const g = adaptWorkState(null, null); for (const l of ['network', 'workflow', 'evidence'] as const) {
    const b = layoutGraph(g, l).bounds;
    assert.ok(b.width > 0 && b.height > 0);
} });
test('focus mode shows the selected node and immediate recorded relations without clearing filters', () => { const g = adaptWorkState(fixture(), sources), c = defaultConfig(); c.selectedId = 'task:' + fixture().tasks[0].id; c.mode = 'focus'; const v = selectScene(g, c); const related = new Set([c.selectedId, ...g.edges.flatMap(e => e.from === c.selectedId ? [e.to] : e.to === c.selectedId ? [e.from] : [])]); assert.ok(v.nodes.every(n => related.has(n.id))); assert.ok(v.focusedOutNodes > 0); assert.equal(v.filtered.length, g.nodes.length); assert.equal(v.selectionState, 'visible'); });

test('legacy V1 config gains safe opt-in transition defaults and rejects malformed animation settings', () => {
 const legacy = { ...defaultConfig() } as Record<string, unknown>;
 delete legacy.transitions;
 const decoded = parseConfig(legacy);
 assert.equal(decoded.transitions, 'off');
 assert.equal(decoded.version, 1);
 for (const invalid of [null, false, 'always', 999]) assert.throws(() => parseConfig({ ...legacy, transitions: invalid }));
 assert.equal(parseConfig({ ...legacy, transitions: 'brief' }).transitions, 'brief');
});

test('legacy export strips only additive transition settings while ordinary export roundtrips', () => {
 const config = { ...defaultConfig(), transitions: 'smooth' as const, selectedId: 'mission:' + MID };
 assert.equal(parseConfig(serializeConfig(config)).transitions, 'smooth');
 const raw = JSON.parse(serializeConfig(config, { legacyV1: true }));
 assert.equal('transitions' in raw, false);
 assert.equal(raw.selectedId, config.selectedId);
 assert.equal(parseConfig(raw).transitions, 'off');
});
