// omega.model-grant/v1 - Modellaufrufe nur mit gueltiger, signierter Freigabe (OMG-07 Budgets).
// Begrenzt Tokens, Aufrufe und Kosten pro UTC-Tag, Datenklassen und Laufzeit einer Modellbindung.
// Harte Regel: Daten der Klasse 'secret' gehen nie an ein entferntes Modell.
import { randomUUID } from 'node:crypto';
import { NODE_ID } from './hlc.mjs';
import { DATA_CLASSES } from './events.mjs';
import { nodeIdFromKey } from './peers.mjs';
import { signObject, verifyObject } from './signing.mjs';

export const MODEL_GRANT_SCHEMA = 'omega.model-grant/v1';
/** execution wie modelCapabilitiesContract in app/src/assistant/contracts.ts, ohne 'deterministic' (braucht keinen Grant). */
export const GRANT_EXECUTIONS = Object.freeze(['local', 'remote']);
const BINDING_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/; // = identifier in app/src/assistant/contracts.ts
const MAX_GRANT_MS = 30 * 24 * 60 * 60_000;
const posInt = (value) => Number.isSafeInteger(value) && value >= 1;

export function validateModelGrant(grant) {
  if (grant === null || typeof grant !== 'object' || Array.isArray(grant)) return 'not-an-object';
  const allowed = new Set(['schema', 'grantId', 'bindingId', 'execution', 'model', 'dataClasses', 'maxInputTokens',
    'maxOutputTokens', 'maxCallsPerDay', 'maxCostPerDayCents', 'issuedAt', 'expiresAt', 'issuer', 'sig']);
  for (const key of Object.keys(grant)) if (!allowed.has(key)) return `unknown-field:${key}`;
  if (grant.schema !== MODEL_GRANT_SCHEMA) return 'wrong-schema';
  if (typeof grant.grantId !== 'string' || grant.grantId.length !== 36) return 'bad-grant-id';
  if (typeof grant.bindingId !== 'string' || !BINDING_ID.test(grant.bindingId)) return 'bad-binding';
  if (!GRANT_EXECUTIONS.includes(grant.execution)) return 'bad-execution';
  if (typeof grant.model !== 'string' || grant.model.length < 1 || grant.model.length > 128) return 'bad-model';
  if (!Array.isArray(grant.dataClasses) || grant.dataClasses.length === 0
    || new Set(grant.dataClasses).size !== grant.dataClasses.length
    || !grant.dataClasses.every((c) => DATA_CLASSES.includes(c))) return 'bad-data-classes';
  if (grant.execution === 'remote' && grant.dataClasses.includes('secret')) return 'secret-never-remote';
  for (const key of ['maxInputTokens', 'maxOutputTokens', 'maxCallsPerDay']) if (!posInt(grant[key])) return `bad-${key}`;
  if (!Number.isSafeInteger(grant.maxCostPerDayCents) || grant.maxCostPerDayCents < 0) return 'bad-maxCostPerDayCents';
  if (!Number.isSafeInteger(grant.issuedAt) || !Number.isSafeInteger(grant.expiresAt)) return 'bad-time';
  if (grant.expiresAt <= grant.issuedAt || grant.expiresAt - grant.issuedAt > MAX_GRANT_MS) return 'bad-lifetime';
  if (typeof grant.issuer !== 'string' || !NODE_ID.test(grant.issuer)) return 'bad-issuer';
  if (typeof grant.sig !== 'string') return 'unsigned';
  return null;
}

export function createModelGrant(fields, issuer) {
  const grant = { schema: MODEL_GRANT_SCHEMA, grantId: randomUUID(), ...fields, issuer: nodeIdFromKey(issuer.publicKey) };
  const signed = { ...grant, sig: signObject(grant, issuer.privateKey) };
  const problem = validateModelGrant(signed);
  if (problem) throw new TypeError(`omega.model-grant/v1: ${problem}`);
  return signed;
}

const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);

export class ModelGrantLedger {
  #usage = new Map();
  #revoked = new Set();

  /** trustedIssuers: Map<nodeId, publicKey> (Eigentuemer bzw. eigener Knoten). */
  constructor({ trustedIssuers, now = () => Date.now() }) {
    this.trustedIssuers = trustedIssuers;
    this.now = now;
  }

  revoke(grantId) {
    this.#revoked.add(grantId);
  }

  /** Prueft eine Anfrage gegen den Grant und bucht sie bei Erfolg (Aufruf + geschaetzte Kosten). */
  authorize(grant, request) {
    const problem = validateModelGrant(grant);
    if (problem) return { ok: false, reason: problem };
    const key = this.trustedIssuers.get(grant.issuer);
    if (!key || nodeIdFromKey(key) !== grant.issuer) return { ok: false, reason: 'untrusted-issuer' };
    if (!verifyObject(grant, key)) return { ok: false, reason: 'bad-signature' };
    if (this.#revoked.has(grant.grantId)) return { ok: false, reason: 'revoked' };
    const t = this.now();
    if (t < grant.issuedAt - 60_000) return { ok: false, reason: 'not-yet-valid' };
    if (t >= grant.expiresAt) return { ok: false, reason: 'expired' };
    const { bindingId, execution, dataClass, inputTokens, maxOutputTokens, estimatedCostCents } = request ?? {};
    if (bindingId !== grant.bindingId) return { ok: false, reason: 'binding-mismatch' };
    if (execution !== grant.execution) return { ok: false, reason: 'execution-mismatch' };
    if (execution === 'remote' && dataClass === 'secret') return { ok: false, reason: 'secret-never-remote' };
    if (!grant.dataClasses.includes(dataClass)) return { ok: false, reason: 'data-class-not-granted' };
    if (!posInt(inputTokens) || inputTokens > grant.maxInputTokens) return { ok: false, reason: 'input-tokens' };
    if (!posInt(maxOutputTokens) || maxOutputTokens > grant.maxOutputTokens) return { ok: false, reason: 'output-tokens' };
    if (!Number.isSafeInteger(estimatedCostCents) || estimatedCostCents < 0) return { ok: false, reason: 'bad-cost' };
    const slot = `${grant.grantId}|${utcDay(t)}`;
    const used = this.#usage.get(slot) ?? { calls: 0, costCents: 0 };
    if (used.calls + 1 > grant.maxCallsPerDay) return { ok: false, reason: 'daily-calls-exhausted' };
    if (used.costCents + estimatedCostCents > grant.maxCostPerDayCents) return { ok: false, reason: 'daily-budget-exhausted' };
    const next = { calls: used.calls + 1, costCents: used.costCents + estimatedCostCents };
    this.#usage.set(slot, next);
    return {
      ok: true,
      remainingCalls: grant.maxCallsPerDay - next.calls,
      remainingCostCents: grant.maxCostPerDayCents - next.costCents,
    };
  }

  /** Nachbuchung, wenn die tatsaechlichen Kosten hoeher waren als geschaetzt (nie Gutschrift unter 0). */
  settle(grantId, extraCostCents) {
    if (!Number.isSafeInteger(extraCostCents) || extraCostCents < 0) throw new RangeError('settle: Kosten >= 0');
    const slot = `${grantId}|${utcDay(this.now())}`;
    const used = this.#usage.get(slot) ?? { calls: 0, costCents: 0 };
    this.#usage.set(slot, { calls: used.calls, costCents: used.costCents + extraCostCents });
  }

  snapshot() {
    const today = utcDay(this.now());
    const usage = Object.fromEntries([...this.#usage].filter(([slot]) => slot.endsWith(`|${today}`)));
    return { schema: 'omega.grant-usage/v1', usage, revoked: [...this.#revoked].sort() };
  }

  static restore(snapshot, options) {
    const ledger = new ModelGrantLedger(options);
    if (snapshot?.schema !== 'omega.grant-usage/v1') return ledger;
    for (const [slot, used] of Object.entries(snapshot.usage ?? {})) {
      if (Number.isSafeInteger(used?.calls) && Number.isSafeInteger(used?.costCents)) ledger.#usage.set(slot, { calls: used.calls, costCents: used.costCents });
    }
    for (const id of snapshot.revoked ?? []) if (typeof id === 'string') ledger.#revoked.add(id);
    return ledger;
  }
}
