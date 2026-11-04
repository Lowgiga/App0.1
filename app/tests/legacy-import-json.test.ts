import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {emptyWork} from '../upstream/lib/work-contract.ts';
import {LocalWorkStore} from '../src/local-adapter.ts';
import {planLegacyImport} from '../src/legacy-import.ts';

const now = new Date('2026-10-04T08:00:00.000Z');
const events = Array.from({length: 200}, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
const work = () => JSON.stringify(emptyWork());
const plan = (raw: string) => planLegacyImport(emptyWork(), raw, [], now, 'json-parser-check', events);

for (const [name, raw] of [
  ['conflicting root schema versions', () => '{"schemaVersion":99,"schemaVersion":4,"work":' + work() + '}'],
  ['escaped-equivalent root names', () => String.raw`{"schemaVersion":99,"schema\u0056ersion":4,"work":` + work() + '}'],
  ['repeated identical values', () => '{"schemaVersion":4,"schemaVersion":4,"work":' + work() + '}'],
  ['nested known work fields', () => '{"schemaVersion":4,"work":' + work().replace('"checks":{}', '"checks":{},"checks":{}') + '}'],
  ['nested metadata fields', () => '{"schemaVersion":4,"data":{"nested":{"value":1,"value":2}},"work":' + work() + '}'],
  ['escaped-equivalent nested names', () => String.raw`{"schemaVersion":4,"data":{"nested":{"value":1,"val\u0075e":2}},"work":` + work() + '}'],
] as const) {
  test(`legacy JSON rejects ${name} instead of silently selecting one value`, () => {
    assert.throws(() => plan(raw()), /doppelt|mehrdeutig/i);
  });
}

test('unambiguous legacy schema versions 1 through 4 retain their accepted semantics', () => {
  for (const schemaVersion of [1, 2, 3, 4]) {
    const preview = plan(JSON.stringify({schemaVersion, work: emptyWork()}));
    assert.equal(preview.preview.canCommit, true);
    assert.deepEqual(preview.state.rooms, []);
    assert.deepEqual(preview.state.tasks, emptyWork().tasks);
  }
});

test('key-like text and equal names in different objects are not duplicate members', () => {
  const incoming = emptyWork();
  incoming.notes = [{id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', text: '{"key":1,"key":2} and \\ " : [ ] 😀', createdAt: now.toISOString()}];
  const result = plan(JSON.stringify({schemaVersion: 4, data: [{value: 1}, {value: 2}], work: incoming}));
  assert.equal(result.state.notes[0].text, incoming.notes[0].text);
  assert.equal(result.preview.summary.importedNotes, 1);
});

test('duplicate-key hardening adds no unrelated metadata-depth limit', () => {
  const raw = '{"schemaVersion":4,"data":' + '['.repeat(2000) + '0' + ']'.repeat(2000) + ',"work":' + work() + '}';
  assert.equal(plan(raw).preview.canCommit, true);
});

test('ambiguous replacement preview preserves storage and revokes prior confirmation', async () => {
  const store = new LocalWorkStore({indexedDB: new IDBFactory(), name: 'json-' + crypto.randomUUID(), now: () => now});
  try {
    const before = await (await store.request('/api/state')).json();
    const accepted = await store.request('/api/imports/preview', {method: 'POST', body: JSON.stringify({schemaVersion: 4, work: emptyWork()})});
    assert.equal(accepted.status, 200);
    const previous = await accepted.json();
    const rejected = await store.request('/api/imports/preview', {method: 'POST', body: '{"schemaVersion":99,"schemaVersion":4,"work":' + work() + '}'});
    assert.equal(rejected.status, 400);
    assert.match((await rejected.json()).error, /doppelt|mehrdeutig/i);
    assert.deepEqual(await (await store.request('/api/state')).json(), before);
    const stale = await store.request('/api/imports/commit', {method: 'POST', body: JSON.stringify({planId: previous.planId})});
    assert.equal(stale.status, 409);
    assert.deepEqual(await (await store.request('/api/state')).json(), before);
  } finally {
    store.close();
  }
});
