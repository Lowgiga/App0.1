import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { exportBackup, importBackup, prepareRestore } from '../backup.mjs';

const exportedAt = '2026-09-30T12:00:00.000Z';
const updatedAt = '2026-09-30T11:00:00.000Z';
const metadata = () => ({ exportedAt, producer: { name: 'cue-command-mesh', version: '4.0-test' }, source: { revision: 'fixture-v4', workUpdatedAt: updatedAt } });
// Unit fixtures exercise transport only. The integration suite uses actual savedWorkContract.
const snapshot = () => ({ work: { stateVersion: 4, updatedAt, notes: [{ id: 'fixture', text: 'Grüße 👩🏽‍💻 漢字 e\u0301', createdAt: updatedAt }], command: { approvals: [{ status: 'approved', decidedAt: updatedAt, executed: false }], missions: [{ stage: 'Done', reviewed: true }], events: [{ sequence: 1 }], interactions: [{ reason: 'Historical fixture' }] } }, data: { schemaVersion: 1, sources: [{ id: 'fixture-source', title: 'Synthetic source' }] } });
const validateWork = work => ({ success: true, data: work });
const options = (extra = {}) => ({ validateWork, ...extra });
const make = (state = snapshot(), extra = {}) => exportBackup(state, metadata(), options(extra));
const code = expected => error => error?.code === expected;
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value !== null && typeof value === 'object' ? `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}` : JSON.stringify(value);
const resign = envelope => { const { integrity, ...body } = envelope; envelope.integrity.digest = createHash('sha256').update(canonical(body)).digest('hex'); return JSON.stringify(envelope); };

test('Unicode and every supplied field survive a detached full-field roundtrip', async () => {
  const state = snapshot(), original = structuredClone(state);
  const text = await make(state);
  const parsed = await importBackup(text, options());
  assert.deepEqual(parsed.snapshot, original);
  assert.equal(parsed.normalizationDetected, false);
  assert.equal(parsed.externalActionsAuthorized, false);
  assert.equal(parsed.decisionRecords, 'historical-only');
  assert.equal(parsed.snapshot.work.command.approvals[0].status, 'approved');
  assert.ok(Object.isFrozen(parsed.snapshot.work.command.approvals));
  assert.deepEqual(state, original);
});

test('same inputs produce deterministic bytes regardless of object key order', async () => {
  const a = snapshot(), b = { data: a.data, work: Object.fromEntries(Object.entries(a.work).reverse()) };
  assert.equal(await make(a), await make(b));
  const result = JSON.parse(await make(a));
  const { integrity, ...body } = result;
  assert.equal(integrity.algorithm, 'SHA-256');
  assert.equal(integrity.digest, createHash('sha256').update(canonical(body)).digest('hex'));
  assert.equal(integrity.payloadBytes, Buffer.byteLength(canonical(a), 'utf8'));
});

test('a payload bitflip is rejected', async () => {
  const envelope = JSON.parse(await make());
  envelope.payload.work.notes[0].text += '!';
  await assert.rejects(importBackup(JSON.stringify(envelope), options()), code('INTEGRITY_MISMATCH'));
});

test('metadata is integrity-protected too', async () => {
  const envelope = JSON.parse(await make());
  envelope.producer.version = 'tampered-version';
  await assert.rejects(importBackup(JSON.stringify(envelope), options()), code('INTEGRITY_MISMATCH'));
});

test('future envelope and app schema versions are rejected even when correctly hashed', async () => {
  for (const mutate of [e => e.formatVersion = 2, e => e.schema.version = 5]) {
    const envelope = JSON.parse(await make()); mutate(envelope);
    await assert.rejects(importBackup(resign(envelope), options()), code('UNSUPPORTED_VERSION'));
  }
});

test('incomplete required metadata is rejected on both export and import', async () => {
  for (const path of ['exportedAt', 'producer', 'source']) {
    const meta = metadata(); delete meta[path];
    await assert.rejects(exportBackup(snapshot(), meta, options()), code('INVALID_METADATA'));
    const envelope = JSON.parse(await make()); delete envelope[path];
    await assert.rejects(importBackup(resign(envelope), options()), code('INVALID_METADATA'));
  }
  for (const mutate of [e => delete e.producer.version, e => delete e.source.revision, e => e.producer.name = '', e => e.source.revision = ' ', e => e.source.workUpdatedAt = undefined]) {
    const envelope = JSON.parse(await make()); mutate(envelope);
    await assert.rejects(importBackup(resign(JSON.parse(JSON.stringify(envelope))), options()), code('INVALID_METADATA'));
  }
});

test('inconsistent source revision, timestamp, state version and policy are rejected', async () => {
  const text = await make();
  await assert.rejects(importBackup(text, options({ expectedSourceRevision: 'other-revision' })), code('SOURCE_REVISION_MISMATCH'));
  for (const mutate of [e => e.source.workUpdatedAt = null, e => e.payload.work.stateVersion = 3, e => e.exportedAt = '2026-02-30T12:00:00.000Z', e => e.policy.externalActions = 'authorized']) {
    const envelope = JSON.parse(text); mutate(envelope);
    await assert.rejects(importBackup(resign(envelope), options()), code('INVALID_METADATA'));
  }
});

test('the identical total UTF-8 byte limit applies before export and import', async () => {
  const text = await make(), size = Buffer.byteLength(text, 'utf8');
  assert.ok(size > text.length, 'Unicode really exercises byte versus character limits');
  assert.equal(await make(snapshot(), { maxBytes: size }), text);
  await importBackup(text, options({ maxBytes: size }));
  await assert.rejects(make(snapshot(), { maxBytes: size - 1 }), code('SIZE_LIMIT'));
  await assert.rejects(importBackup(text, options({ maxBytes: size - 1 })), code('SIZE_LIMIT'));
  await assert.rejects(importBackup(' '.repeat(size + 1), options({ maxBytes: size })), code('SIZE_LIMIT'));
});

test('malformed JSON and non-string imports are rejected', async () => {
  for (const value of ['{', '[1,]', '{"x":NaN}', '', '{} extra', null, {}]) {
    await assert.rejects(importBackup(value, options()), code('INVALID_JSON'));
  }
});

test('prototype-pollution keys are rejected at every depth before validation', async () => {
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const state = snapshot(); state.data = JSON.parse(`{"nested":{"${key}":{"polluted":true}}}`);
    await assert.rejects(make(state), code('UNSAFE_KEY'));
    const envelope = JSON.parse(await make()); envelope.payload.data = state.data;
    await assert.rejects(importBackup(JSON.stringify(envelope), options()), code('UNSAFE_KEY'));
  }
  assert.equal({}.polluted, undefined);
});

test('known credential-bearing keys are rejected instead of silently redacted', async () => {
  for (const key of ['password', 'apiKey', 'access_token', 'refreshToken', 'private_key', 'authorization', 'cookie', 'clientSecret']) {
    const state = snapshot(); state.data = { nested: { [key]: 'synthetic-do-not-export' } };
    await assert.rejects(make(state), code('SENSITIVE_KEY'));
  }
});

test('non-JSON export data, cycles, sparse arrays and getters are rejected losslessly', async () => {
  for (const value of [undefined, NaN, Infinity, -0, 1n, new Date(), () => {}, Symbol('x'), new Map(), [, 1]]) {
    const state = snapshot(); state.data = { value };
    await assert.rejects(make(state), code('INVALID_JSON_VALUE'));
  }
  const cycle = {}; cycle.self = cycle;
  const state = snapshot(); state.data = cycle;
  await assert.rejects(make(state), code('INVALID_JSON_VALUE'));
  let getterCalled = false;
  state.data = Object.defineProperty({}, 'hidden', { enumerable: true, get() { getterCalled = true; return 'x'; } });
  await assert.rejects(make(state), code('INVALID_JSON_VALUE'));
  assert.equal(getterCalled, false);
});

test('injected schema is mandatory and a failed or throwing validator stops both paths', async () => {
  const text = await make();
  await assert.rejects(exportBackup(snapshot(), metadata(), {}), code('INVALID_OPTIONS'));
  for (const validator of [() => ({ success: false }), () => { throw new Error('private validator detail'); }, () => true]) {
    await assert.rejects(make(snapshot(), { validateWork: validator }), code('VALIDATION_FAILED'));
    await assert.rejects(importBackup(text, options({ validateWork: validator })), code('VALIDATION_FAILED'));
  }
});

test('accepted schema derivations are reported without replacing original fields', async () => {
  const derive = work => ({ success: true, data: { ...work, derivedDefault: true } });
  const text = await make(snapshot(), { validateWork: derive });
  const parsed = await importBackup(text, options({ validateWork: derive }));
  assert.equal(parsed.normalizationDetected, true);
  assert.deepEqual(parsed.snapshot, snapshot());
});

test('validator receives a detached read-only value and cannot mutate the source', async () => {
  const state = snapshot(), before = structuredClone(state);
  await assert.rejects(make(state, { validateWork: work => { work.notes[0].text = 'changed'; return { success: true, data: work }; } }), code('VALIDATION_FAILED'));
  assert.deepEqual(state, before);
});

test('integrity metadata rejects incorrect payload byte count and unknown fields', async () => {
  const envelope = JSON.parse(await make()); envelope.integrity.payloadBytes++;
  await assert.rejects(importBackup(JSON.stringify(envelope), options()), code('INVALID_METADATA'));
  for (const mutate of [e => e.surprise = true, e => e.integrity.algorithm = 'MD5', e => e.integrity.extra = true, e => e.schema.extra = true]) {
    const e = JSON.parse(await make()); mutate(e);
    await assert.rejects(importBackup(resign(e), options()), code('INVALID_METADATA'));
  }
});

test('restore preparation exposes conflicts in a populated target without changing either side', async () => {
  const current = snapshot(); current.work.notes[0].text = 'Keep this local note'; current.data.sources.push({ id: 'local-only', title: 'Keep local source' });
  const before = structuredClone(current), incoming = snapshot(), text = await make(incoming);
  const plan = await prepareRestore(text, current, options());
  assert.equal(plan.mode, 'preview-only');
  assert.equal(plan.targetState, 'different');
  assert.equal(plan.requiresExplicitRestoreAuthorization, true);
  assert.equal(plan.externalActionsAuthorized, false);
  assert.equal(plan.decisionRecords, 'historical-only');
  assert.deepEqual(plan.writes, []);
  assert.ok(plan.conflicts.some(c => c.path === '/work/notes/0/text' && c.kind === 'changed'));
  assert.ok(plan.conflicts.some(c => c.path === '/data/sources/1' && c.kind === 'removed'));
  assert.equal(plan.inventory.current['/data/sources'], 2);
  assert.deepEqual(current, before); assert.deepEqual(incoming, snapshot());
  assert.ok(Object.isFrozen(plan.conflicts));
  assert.equal(plan.currentPayloadDigest, createHash('sha256').update(canonical(current)).digest('hex'));
});

test('a missing target must be explicit; absent and identical targets remain preview-only', async () => {
  const text = await make();
  await assert.rejects(prepareRestore(text, undefined, options()), code('TARGET_REQUIRED'));
  const absent = await prepareRestore(text, null, options());
  assert.equal(absent.targetState, 'absent'); assert.deepEqual(absent.conflicts, []);
  const identical = await prepareRestore(text, snapshot(), options());
  assert.equal(identical.targetState, 'identical'); assert.equal(identical.differenceCount, 0);
  assert.deepEqual(identical.writes, []);
});

test('invalid or oversized current state cannot be used as a restore baseline', async () => {
  const text = await make();
  const invalid = snapshot(); invalid.work.stateVersion = 5;
  await assert.rejects(prepareRestore(text, invalid, options()), code('INVALID_METADATA'));
  const current = snapshot(); current.data.extra = 'x'.repeat(10000);
  await assert.rejects(prepareRestore(text, current, options({ maxBytes: Buffer.byteLength(text) })), code('SIZE_LIMIT'));
});

test('deeply nested untrusted JSON fails with a controlled bound', async () => {
  const state = snapshot(); state.data = JSON.parse('['.repeat(101) + '0' + ']'.repeat(101));
  await assert.rejects(make(state), code('DEPTH_LIMIT'));
});

test('duplicate JSON properties including escaped equivalents are rejected as ambiguous', async () => {
  const text = await make();
  for (const changed of [
    text.replace('"formatVersion":1', '"formatVersion":999,"formatVersion":1'),
    text.replace('"version":"4.0-test"', '"version":"other","ver\\u0073ion":"4.0-test"'),
    text.replace('"sequence":1', '"sequence":2,"sequence":1'),
  ]) await assert.rejects(importBackup(changed, options()), code('DUPLICATE_KEY'));
});

test('valid UTC timestamps without milliseconds and with higher precision roundtrip', async () => {
  for (const time of ['2026-09-30T11:00:00Z', '2026-09-30T11:00:00.123456Z']) {
    const state = snapshot(); state.work.updatedAt = time;
    const meta = metadata(); meta.source.workUpdatedAt = time;
    const text = await exportBackup(state, meta, options());
    assert.deepEqual((await importBackup(text, options())).snapshot, state);
  }
});

test('async schema acceptance works and array order stays significant', async () => {
  const state = snapshot(); state.data = { values: ['b', 'a'] };
  const text = await make(state, { validateWork: async work => ({ success: true, data: work }) });
  assert.deepEqual((await importBackup(text, options())).snapshot.data.values, ['b', 'a']);
  const reversed = structuredClone(state); reversed.data.values.reverse();
  assert.notEqual(await make(reversed), text);
});

test('null update timestamp is preserved and invalid options are rejected', async () => {
  const state = snapshot(); state.work.updatedAt = null;
  const meta = metadata(); meta.source.workUpdatedAt = null;
  const text = await exportBackup(state, meta, options());
  assert.equal((await importBackup(text, options())).snapshot.work.updatedAt, null);
  for (const maxBytes of [0, -1, 1.5, Infinity, 64_000_001, '1000']) {
    await assert.rejects(make(snapshot(), { maxBytes }), code('INVALID_OPTIONS'));
  }
});

test('credential-bearing import is rejected even with a recomputed checksum', async () => {
  const envelope = JSON.parse(await make()); envelope.payload.data.apiKey = 'synthetic-only';
  await assert.rejects(importBackup(resign(envelope), options()), code('SENSITIVE_KEY'));
});

test('large comparisons report bounded details with accurate conflict totals', async () => {
  const current = snapshot(), incoming = snapshot();
  current.data = { values: Array.from({ length: 300 }, (_, n) => n) };
  incoming.data = { values: Array.from({ length: 300 }, (_, n) => n + 1) };
  const plan = await prepareRestore(await make(incoming), current, options());
  assert.equal(plan.differenceCount, 300); assert.equal(plan.conflictCount, 300);
  assert.equal(plan.changes.length, 250); assert.equal(plan.conflicts.length, 250); assert.equal(plan.truncated, true);
});

test('source timestamp ordering retains sub-millisecond precision', async () => {
  const state = snapshot(); state.work.updatedAt = '2026-09-30T11:00:00.0009Z';
  const meta = metadata(); meta.source.workUpdatedAt = state.work.updatedAt;
  meta.exportedAt = '2026-09-30T11:00:00.0001Z';
  await assert.rejects(exportBackup(state, meta, options()), code('INVALID_METADATA'));
  const envelope = JSON.parse(await make());
  envelope.payload.work.updatedAt = state.work.updatedAt; envelope.source.workUpdatedAt = state.work.updatedAt; envelope.exportedAt = meta.exportedAt;
  await assert.rejects(importBackup(resign(envelope), options()), code('INVALID_METADATA'));
  for (const [updatedAt, exportedAt] of [
    ['2026-09-30T11:00:00.0001Z', '2026-09-30T11:00:00.0009Z'],
    ['2026-09-30T11:00:00.1Z', '2026-09-30T11:00:00.1000Z'],
    ['2026-09-30T11:00:00Z', '2026-09-30T11:00:00.0000Z'],
    ['2026-09-30T11:00:00.9999999999Z', '2026-09-30T11:00:01Z'],
  ]) {
    state.work.updatedAt = updatedAt; meta.source.workUpdatedAt = updatedAt; meta.exportedAt = exportedAt;
    assert.deepEqual((await importBackup(await exportBackup(state, meta, options()), options())).snapshot, state);
  }
});
