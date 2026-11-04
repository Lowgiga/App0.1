import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createModelGrant, validateModelGrant, ModelGrantLedger } from '../runtime/index.mjs';
import { fakeClock, makeNode } from './helpers/fixtures.mjs';

const T0 = Date.parse('2026-11-04T08:00:00Z');
function setup(extra = {}) {
  const now = fakeClock(T0);
  const owner = makeNode(now);
  const grant = createModelGrant({
    bindingId: 'ollama.qwen3', execution: 'local', model: 'qwen3:8b', dataClasses: ['internal', 'financial'],
    maxInputTokens: 8_000, maxOutputTokens: 1_000, maxCallsPerDay: 3, maxCostPerDayCents: 100,
    issuedAt: T0, expiresAt: T0 + 7 * 86_400_000, ...extra,
  }, owner);
  const ledger = new ModelGrantLedger({ trustedIssuers: new Map([[owner.node, owner.publicKey]]), now });
  const request = { bindingId: 'ollama.qwen3', execution: 'local', dataClass: 'financial', inputTokens: 2_000, maxOutputTokens: 500, estimatedCostCents: 30 };
  return { now, owner, grant, ledger, request };
}

test('Grant: gueltige Anfrage wird gebucht, Budgets greifen je UTC-Tag', () => {
  const { now, grant, ledger, request } = setup();
  assert.deepEqual(ledger.authorize(grant, request), { ok: true, remainingCalls: 2, remainingCostCents: 70 });
  assert.equal(ledger.authorize(grant, request).ok, true);
  assert.equal(ledger.authorize(grant, { ...request, estimatedCostCents: 50 }).reason, 'daily-budget-exhausted');
  assert.equal(ledger.authorize(grant, request).ok, true);
  assert.equal(ledger.authorize(grant, { ...request, estimatedCostCents: 0 }).reason, 'daily-calls-exhausted');
  now.advance(24 * 3_600_000);
  assert.equal(ledger.authorize(grant, request).ok, true, 'neuer UTC-Tag, neues Budget');
});

test('Grant: Grenzen fuer Tokens, Datenklasse, Bindung, Ablauf, Widerruf', () => {
  const { now, grant, ledger, request } = setup();
  assert.equal(ledger.authorize(grant, { ...request, inputTokens: 9_000 }).reason, 'input-tokens');
  assert.equal(ledger.authorize(grant, { ...request, maxOutputTokens: 2_000 }).reason, 'output-tokens');
  assert.equal(ledger.authorize(grant, { ...request, dataClass: 'personal' }).reason, 'data-class-not-granted');
  assert.equal(ledger.authorize(grant, { ...request, bindingId: 'andere' }).reason, 'binding-mismatch');
  assert.equal(ledger.authorize(grant, { ...request, execution: 'remote' }).reason, 'execution-mismatch');
  assert.equal(ledger.authorize({ ...grant, maxCallsPerDay: 999 }, request).reason, 'bad-signature');
  ledger.revoke(grant.grantId);
  assert.equal(ledger.authorize(grant, request).reason, 'revoked');
  const fresh = setup();
  fresh.now.advance(8 * 86_400_000);
  assert.equal(fresh.ledger.authorize(fresh.grant, fresh.request).reason, 'expired');
  assert.ok(now() > 0);
});

test('Grant: geheime Daten gehen nie an ein entferntes Modell', () => {
  const { owner } = setup();
  assert.throws(() => createModelGrant({
    bindingId: 'vendor.api', execution: 'remote', model: 'x', dataClasses: ['secret'], maxInputTokens: 1, maxOutputTokens: 1,
    maxCallsPerDay: 1, maxCostPerDayCents: 1, issuedAt: T0, expiresAt: T0 + 1_000,
  }, owner), /secret-never-remote/);
  const { grant, ledger, request } = setup({ execution: 'remote', bindingId: 'vendor.api', dataClasses: ['internal'] });
  assert.equal(ledger.authorize(grant, { ...request, bindingId: 'vendor.api', execution: 'remote', dataClass: 'secret' }).reason, 'secret-never-remote');
  assert.equal(validateModelGrant({ ...grant, expiresAt: grant.issuedAt + 31 * 86_400_000 }), 'bad-lifetime');
});

test('Grant: fremder Aussteller und Zustand nach Neustart', () => {
  const { grant, now, request, owner } = setup();
  const stranger = makeNode(now);
  const foreignLedger = new ModelGrantLedger({ trustedIssuers: new Map([[stranger.node, stranger.publicKey]]), now });
  assert.equal(foreignLedger.authorize(grant, request).reason, 'untrusted-issuer');
  const ledger = new ModelGrantLedger({ trustedIssuers: new Map([[owner.node, owner.publicKey]]), now });
  ledger.authorize(grant, request);
  ledger.authorize(grant, request);
  ledger.settle(grant.grantId, 20);
  const restored = ModelGrantLedger.restore(JSON.parse(JSON.stringify(ledger.snapshot())), { trustedIssuers: new Map([[owner.node, owner.publicKey]]), now });
  assert.equal(restored.authorize(grant, { ...request, estimatedCostCents: 30 }).reason, 'daily-budget-exhausted');
  assert.deepEqual(restored.authorize(grant, { ...request, estimatedCostCents: 20 }), { ok: true, remainingCalls: 0, remainingCostCents: 0 });
});
