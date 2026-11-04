import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CapabilityRegistry, validateCapability, MAX_EVIDENCE_TTL_MS } from '../runtime/index.mjs';
import { fakeClock } from './helpers/fixtures.mjs';

const T0 = Date.parse('2026-11-04T10:00:00Z');
const iso = (ms) => new Date(ms).toISOString();
const cap = (id, extra = {}) => ({
  schema: 'omega.capability/v1',
  id,
  provider: { kind: 'binary', name: id.split('.').pop() },
  node: 'n0123456789abcdef',
  effect: 'read-only',
  requires: [],
  state: 'available',
  evidence: { checkId: `probe.${id}`, status: 'passed', verifiedAt: iso(T0), expiresAt: iso(T0 + 5 * 60_000) },
  fallbacks: [],
  ...extra,
});

test('Capability: Validierung lehnt kaputte Eintraege ab', () => {
  assert.equal(validateCapability(cap('android.screen.mirror')), null);
  assert.equal(validateCapability({ ...cap('a.b'), extra: 1 }), 'unknown-field:extra');
  assert.equal(validateCapability(cap('Kein.Id')), 'bad-id');
  assert.equal(validateCapability({ ...cap('a.b'), effect: 'delete' }), 'bad-effect');
  assert.equal(validateCapability({ ...cap('a.b'), requires: ['a.b'] }), 'bad-requires');
  assert.equal(validateCapability({ ...cap('a.b'), fallbacks: ['x.y', 'x.y'] }), 'bad-fallbacks');
  assert.equal(validateCapability({ ...cap('a.b'), provider: { kind: 'binary', name: 'x', path: '/bin/sh' } }), 'bad-provider');
  const longEvidence = { checkId: 'p', status: 'passed', verifiedAt: iso(T0), expiresAt: iso(T0 + MAX_EVIDENCE_TTL_MS + 1) };
  assert.equal(validateCapability({ ...cap('a.b'), evidence: longEvidence }), 'bad-evidence-ttl');
  assert.equal(validateCapability({ ...cap('a.b'), evidence: { ...longEvidence, expiresAt: '2026-11-04' } }), 'bad-evidence-time');
});

test('Capability: Nachweis laeuft ab, Voraussetzungen wirken transitiv', () => {
  const now = fakeClock(T0 + 60_000);
  const reg = new CapabilityRegistry({ now });
  reg.upsert(cap('android.adb.authorized'));
  reg.upsert(cap('android.screen.mirror', { requires: ['android.adb.authorized'] }));
  assert.deepEqual(reg.status('android.screen.mirror'), { state: 'available', reason: 'ok' });
  reg.upsert(cap('android.adb.authorized', { state: 'degraded' }));
  assert.deepEqual(reg.status('android.screen.mirror'), { state: 'degraded', reason: 'degraded-via:android.adb.authorized' });
  reg.upsert(cap('android.adb.authorized', { evidence: { checkId: 'probe.adb', status: 'failed', verifiedAt: iso(T0), expiresAt: iso(T0 + 60_000 * 5) } }));
  assert.deepEqual(reg.status('android.screen.mirror'), { state: 'unavailable', reason: 'requires:android.adb.authorized' });
  reg.upsert(cap('android.adb.authorized'));
  now.advance(5 * 60_000);
  assert.equal(reg.status('android.screen.mirror').reason, 'evidence-expired');
  assert.equal(reg.status('nicht.da').state, 'unknown');
});

test('Capability: Zyklen werden erkannt statt endlos zu laufen', () => {
  const reg = new CapabilityRegistry({ now: () => T0 + 1_000 });
  reg.upsert(cap('a.one', { requires: ['a.two'] }));
  reg.upsert(cap('a.two', { requires: ['a.one'] }));
  assert.deepEqual(reg.status('a.one'), { state: 'unavailable', reason: 'requires-cycle' });
});

test('Capability: Fallback in Reihenfolge, Wiederholung nur fuer pure/read-only', () => {
  const reg = new CapabilityRegistry({ now: () => T0 + 1_000 });
  reg.upsert(cap('android.screen.mirror', { state: 'unavailable', fallbacks: ['android.screen.screenshot', 'android.screen.text'] }));
  reg.upsert(cap('android.screen.screenshot', { state: 'unavailable' }));
  reg.upsert(cap('android.screen.text', { effect: 'pure' }));
  reg.upsert(cap('android.settings.write', { effect: 'write' }));
  assert.deepEqual(reg.resolve('android.screen.mirror'), {
    id: 'android.screen.text', via: 'fallback', state: 'available', primaryReason: 'reported-unavailable',
  });
  assert.deepEqual(reg.resolve('android.screen.text'), { id: 'android.screen.text', via: 'primary', state: 'available' });
  assert.equal(reg.resolve('nicht.da').id, null);
  assert.equal(reg.canRetry('android.screen.text'), true);
  assert.equal(reg.canRetry('android.settings.write'), false);
  assert.equal(reg.list().length, 4);
});
