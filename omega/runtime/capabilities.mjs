// OMG-02 Capability-Registry mit Nachweis (omega.capability/v1, Form wie docs/31 "Vertraege").
// Eine Faehigkeit gilt nur, solange ihr Nachweis frisch ist und alle Voraussetzungen gelten.
// Faellt sie aus, wird der erste verfuegbare Fallback gewaehlt (degradierter Betrieb statt Fehler).
import { NODE_ID } from './hlc.mjs';

export const CAPABILITY_SCHEMA = 'omega.capability/v1';
/** Gleich OperationEffect in app/src/assistant/policy.ts (Drift-Test: test/app-link.test.mjs). */
export const OPERATION_EFFECTS = Object.freeze(['pure', 'read-only', 'write', 'unknown']);
export const PROVIDER_KINDS = Object.freeze(['binary', 'app', 'service', 'plugin', 'model', 'os']);
export const CAPABILITY_STATES = Object.freeze(['available', 'degraded', 'unavailable']);
const EVIDENCE_STATUS = ['passed', 'failed', 'skipped'];
export const CAPABILITY_ID = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;
const CHECK_ID = /^[a-z][a-z0-9.-]{0,127}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
export const MAX_EVIDENCE_TTL_MS = 24 * 60 * 60_000;
const FUTURE_TOLERANCE_MS = 60_000;

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function checkIdList(list, self) {
  if (!Array.isArray(list) || list.length > 16) return false;
  if (new Set(list).size !== list.length) return false;
  return list.every((id) => typeof id === 'string' && CAPABILITY_ID.test(id) && id !== self);
}

export function validateCapability(cap) {
  if (!isPlainObject(cap)) return 'not-an-object';
  const allowed = new Set(['schema', 'id', 'provider', 'node', 'effect', 'requires', 'state', 'evidence', 'fallbacks']);
  for (const key of Object.keys(cap)) if (!allowed.has(key)) return `unknown-field:${key}`;
  if (cap.schema !== CAPABILITY_SCHEMA) return 'wrong-schema';
  if (typeof cap.id !== 'string' || !CAPABILITY_ID.test(cap.id)) return 'bad-id';
  const { provider } = cap;
  if (!isPlainObject(provider) || Object.keys(provider).some((k) => k !== 'kind' && k !== 'name')
    || !PROVIDER_KINDS.includes(provider.kind) || typeof provider.name !== 'string'
    || provider.name.length < 1 || provider.name.length > 64) return 'bad-provider';
  if (typeof cap.node !== 'string' || !NODE_ID.test(cap.node)) return 'bad-node';
  if (!OPERATION_EFFECTS.includes(cap.effect)) return 'bad-effect';
  if (!checkIdList(cap.requires, cap.id)) return 'bad-requires';
  if (!checkIdList(cap.fallbacks, cap.id)) return 'bad-fallbacks';
  if (!CAPABILITY_STATES.includes(cap.state)) return 'bad-state';
  const ev = cap.evidence;
  if (!isPlainObject(ev) || Object.keys(ev).some((k) => !['checkId', 'status', 'verifiedAt', 'expiresAt'].includes(k))) return 'bad-evidence';
  if (typeof ev.checkId !== 'string' || !CHECK_ID.test(ev.checkId) || !EVIDENCE_STATUS.includes(ev.status)) return 'bad-evidence';
  if (!ISO_UTC.test(ev.verifiedAt ?? '') || !ISO_UTC.test(ev.expiresAt ?? '')) return 'bad-evidence-time';
  const ttl = Date.parse(ev.expiresAt) - Date.parse(ev.verifiedAt);
  if (!(ttl > 0) || ttl > MAX_EVIDENCE_TTL_MS) return 'bad-evidence-ttl';
  return null;
}

export class CapabilityRegistry {
  #caps = new Map();

  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
  }

  upsert(cap) {
    const problem = validateCapability(cap);
    if (problem) throw new TypeError(`omega.capability/v1: ${problem}`);
    this.#caps.set(cap.id, structuredClone(cap));
  }

  remove(id) {
    return this.#caps.delete(id);
  }

  get(id) {
    const cap = this.#caps.get(id);
    return cap ? structuredClone(cap) : undefined;
  }

  status(id) {
    return this.#status(id, new Set());
  }

  #status(id, visiting) {
    const cap = this.#caps.get(id);
    if (!cap) return { state: 'unknown', reason: 'not-registered' };
    if (visiting.has(id)) return { state: 'unavailable', reason: 'requires-cycle' };
    const t = this.now();
    if (cap.evidence.status !== 'passed') return { state: 'unavailable', reason: `evidence-${cap.evidence.status}` };
    if (Date.parse(cap.evidence.expiresAt) <= t) return { state: 'unavailable', reason: 'evidence-expired' };
    if (Date.parse(cap.evidence.verifiedAt) > t + FUTURE_TOLERANCE_MS) return { state: 'unavailable', reason: 'evidence-from-future' };
    if (cap.state === 'unavailable') return { state: 'unavailable', reason: 'reported-unavailable' };
    visiting.add(id);
    let degraded = cap.state === 'degraded';
    let reason = degraded ? 'reported-degraded' : 'ok';
    try {
      for (const req of cap.requires) {
        const sub = this.#status(req, visiting);
        if (sub.state === 'unavailable' || sub.state === 'unknown') {
          return { state: 'unavailable', reason: sub.reason === 'requires-cycle' ? 'requires-cycle' : `requires:${req}` };
        }
        if (sub.state === 'degraded' && !degraded) {
          degraded = true;
          reason = `degraded-via:${req}`;
        }
      }
    } finally {
      visiting.delete(id);
    }
    return { state: degraded ? 'degraded' : 'available', reason };
  }

  /** Waehlt die Faehigkeit selbst oder den ersten nutzbaren Fallback (eine Ebene, in Reihenfolge). */
  resolve(id) {
    const primary = this.status(id);
    if (primary.state === 'available' || primary.state === 'degraded') return { id, via: 'primary', state: primary.state };
    const cap = this.#caps.get(id);
    for (const fallback of cap?.fallbacks ?? []) {
      const sub = this.status(fallback);
      if (sub.state === 'available' || sub.state === 'degraded') {
        return { id: fallback, via: 'fallback', state: sub.state, primaryReason: primary.reason };
      }
    }
    return { id: null, via: 'none', state: 'unavailable', primaryReason: primary.reason };
  }

  /** Wiederholung nur fuer 'pure' und 'read-only' (wie canRetry in app/src/assistant/policy.ts). */
  canRetry(id) {
    const effect = this.#caps.get(id)?.effect;
    return effect === 'pure' || effect === 'read-only';
  }

  list() {
    return [...this.#caps.keys()].sort().map((id) => ({ id, ...this.status(id), effect: this.#caps.get(id).effect }));
  }
}
