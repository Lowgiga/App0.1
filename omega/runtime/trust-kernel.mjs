// Trust Kernel - zwei Achsen wie in docs/31 (Abschnitt "Selbstentwicklung"):
//  1. Aktionen am Geraet: Klassen safety/observe/reversible/sensitive/irreversible je Autonomiestufe E0-E3.
//  2. Selbstentwicklung (cls 'self-modify'): die Art der Aenderung bestimmt die noetige Stufe und
//     die Nachweise. E4 (Trust Kernel, Policy) ist nie autonom - nur mit Signatur des Eigentuemers.
// Unverrueckbar: irreversible Aktionen brauchen immer eine Freigabe; Sicherheitsaktionen gehen
// immer durch; eine Freigabe ohne Antwort verfaellt als Ablehnung; ein unlesbarer Zustand startet
// mit aktivem Kill-Switch.
import { createHash, randomUUID } from 'node:crypto';
import { signObject, verifyObject } from './signing.mjs';

export const LEVELS = Object.freeze(['E0', 'E1', 'E2', 'E3', 'E4']);
export const GRANTABLE_LEVELS = Object.freeze(['E0', 'E1', 'E2', 'E3']);
export const ACTION_CLASSES = Object.freeze(['safety', 'observe', 'reversible', 'sensitive', 'irreversible']);
export const CLASSES = Object.freeze([...ACTION_CLASSES, 'self-modify']);

/** Art der Aenderung -> noetige Stufe (docs/31, Tabelle Selbstentwicklung). */
export const CHANGE_KINDS = Object.freeze({
  proposal: 'E1',
  config: 'E2',
  prompt: 'E2',
  'capability-read-only': 'E2',
  adapter: 'E3',
  module: 'E3',
  'trust-kernel': 'E4',
  policy: 'E4',
});

/** Nachweise je Stufe: E2 = Tests gruen + unabhaengiges Review, E3 = E2 + Canary + automatische Ruecknahme. */
export const CHANGE_EVIDENCE = Object.freeze({
  E1: Object.freeze(['sandboxed']),
  E2: Object.freeze(['testsPassed', 'independentReview']),
  E3: Object.freeze(['testsPassed', 'independentReview', 'canaryPassed', 'rollbackReady']),
  E4: Object.freeze([]),
});

const ACTION_MATRIX = Object.freeze({
  E0: Object.freeze({ observe: 'allow', reversible: 'deny', sensitive: 'deny', irreversible: 'deny' }),
  E1: Object.freeze({ observe: 'allow', reversible: 'approve', sensitive: 'approve', irreversible: 'approve' }),
  E2: Object.freeze({ observe: 'allow', reversible: 'allow', sensitive: 'approve', irreversible: 'approve' }),
  E3: Object.freeze({ observe: 'allow', reversible: 'allow', sensitive: 'allow', irreversible: 'approve' }),
});

export const HIGH_RISK = 8;
export const TRUST_STATE_SCHEMA = 'omega.trust-state/v1';
const rank = (level) => LEVELS.indexOf(level);

export class TrustKernel {
  #killed = false;
  #level = 'E1';

  constructor({ level = 'E1', killed = false } = {}) {
    this.setLevel(level);
    this.#killed = killed === true;
    this.failSafe = false;
  }

  get level() {
    return this.#level;
  }

  get killed() {
    return this.#killed;
  }

  setLevel(level) {
    if (level === 'E4') throw new RangeError('TrustKernel: E4 ist nie autonom - jede Systemaenderung braucht die Signatur des Eigentuemers');
    if (!GRANTABLE_LEVELS.includes(level)) throw new RangeError(`TrustKernel: Stufe ${level} unbekannt`);
    this.#level = level;
  }

  engageKillSwitch() {
    this.#killed = true;
  }

  /** Nur durch ausdrueckliche menschliche Handlung; setzt zusaetzlich auf E1 zurueck. */
  releaseKillSwitch({ confirmedByHuman } = {}) {
    if (confirmedByHuman !== true) throw new Error('TrustKernel: Freigabe des Kill-Switch nur durch einen Menschen');
    this.#killed = false;
    this.#level = 'E1';
    this.failSafe = false;
  }

  decide({ cls, risk = 1, change, evidence = {} } = {}) {
    if (!CLASSES.includes(cls)) return { verdict: 'deny', reason: 'unknown-class' };
    if (!Number.isInteger(risk) || risk < 1 || risk > 10) return { verdict: 'deny', reason: 'bad-risk' };
    if (cls === 'safety') return { verdict: 'allow', reason: 'safety-always' };
    if (this.#killed && cls !== 'observe') return { verdict: 'deny', reason: 'kill-switch' };
    if (cls === 'self-modify') return this.#decideChange(change, evidence);
    let verdict = ACTION_MATRIX[this.#level][cls];
    let reason = `matrix:${this.#level}:${cls}`;
    if (verdict === 'allow' && risk >= HIGH_RISK && cls !== 'observe') {
      verdict = 'approve';
      reason = 'high-risk-escalation';
    }
    return { verdict, reason };
  }

  #decideChange(change, evidence) {
    const stage = typeof change === 'string' && Object.hasOwn(CHANGE_KINDS, change) ? CHANGE_KINDS[change] : undefined;
    if (!stage) return { verdict: 'deny', reason: 'unknown-change' };
    if (stage === 'E4') return { verdict: 'owner-signature', reason: 'e4-never-autonomous', stage };
    const missing = CHANGE_EVIDENCE[stage].filter((key) => evidence?.[key] !== true);
    if (missing.length > 0) return { verdict: 'deny', reason: `evidence-missing:${missing.join(',')}`, stage };
    if (rank(stage) > rank(this.#level)) return { verdict: 'approve', reason: `above-level:${stage}`, stage };
    return { verdict: 'allow', reason: `change:${change}`, stage };
  }

  snapshot() {
    return { schema: TRUST_STATE_SCHEMA, level: this.#level, killed: this.#killed };
  }

  /** Fail-safe: fehlender, defekter oder unbekannter Zustand startet auf E0 mit aktivem Kill-Switch. */
  static restore(snapshot) {
    try {
      if (snapshot?.schema !== TRUST_STATE_SCHEMA || typeof snapshot.killed !== 'boolean') throw new Error('state');
      return new TrustKernel({ level: snapshot.level, killed: snapshot.killed });
    } catch {
      const kernel = new TrustKernel({ level: 'E0', killed: true });
      kernel.failSafe = true;
      return kernel;
    }
  }
}

export const OWNER_APPROVAL_SCHEMA = 'omega.owner-approval/v1';

/** Inhaltsbezogener Fingerabdruck einer Aenderung (z. B. Patch oder Policy-Datei). */
export function changeDigest(content) {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

/** Signatur des Eigentuemers fuer genau eine E4-Aenderung (Inhalt per Digest gebunden, mit Ablauf). */
export function createOwnerApproval({ change, digest, expiresAt, approvalId = randomUUID() }, ownerPrivateKey) {
  if (CHANGE_KINDS[change] !== 'E4') throw new RangeError('Eigentuemer-Freigabe nur fuer E4-Aenderungen');
  const approval = { schema: OWNER_APPROVAL_SCHEMA, approvalId, change, digest, expiresAt };
  return { ...approval, sig: signObject(approval, ownerPrivateKey) };
}

export function verifyOwnerApproval(approval, { ownerPublicKey, change, digest, now = Date.now() }) {
  if (approval?.schema !== OWNER_APPROVAL_SCHEMA) return { ok: false, reason: 'wrong-schema' };
  if (approval.change !== change || CHANGE_KINDS[change] !== 'E4') return { ok: false, reason: 'wrong-change' };
  if (typeof approval.digest !== 'string' || approval.digest !== digest) return { ok: false, reason: 'digest-mismatch' };
  if (!Number.isSafeInteger(approval.expiresAt) || approval.expiresAt <= now) return { ok: false, reason: 'expired' };
  if (!verifyObject(approval, ownerPublicKey)) return { ok: false, reason: 'bad-signature' };
  return { ok: true };
}

/** Einmal verwendbare Freigaben mit Ablaufzeit; Schweigen = Ablehnung; begrenzte Anzahl offener Anfragen. */
export class ApprovalBroker {
  #entries = new Map();

  constructor({ now = () => Date.now(), maxPending = 64, retentionMs = 10 * 60_000 } = {}) {
    this.now = now;
    this.maxPending = maxPending;
    this.retentionMs = retentionMs;
  }

  request({ subject, ttlMs = 120_000 }) {
    if (!Number.isSafeInteger(ttlMs) || ttlMs < 1_000 || ttlMs > 3_600_000) {
      throw new RangeError('ApprovalBroker: ttlMs muss 1 s bis 1 h sein');
    }
    this.sweep();
    const pending = [...this.#entries.values()].filter((entry) => entry.state === 'pending').length;
    if (pending >= this.maxPending) throw new RangeError('ApprovalBroker: zu viele offene Freigaben');
    const id = randomUUID();
    this.#entries.set(id, { subject, expiresAt: this.now() + ttlMs, state: 'pending', by: null, settledAt: null });
    return id;
  }

  #expire(entry) {
    if (entry.state === 'pending' && entry.expiresAt <= this.now()) {
      entry.state = 'expired';
      entry.settledAt = this.now();
    }
  }

  resolve(id, decision, by) {
    if (decision !== 'approve' && decision !== 'reject') throw new RangeError('ApprovalBroker: approve|reject');
    const entry = this.#entries.get(id);
    if (!entry) return false;
    this.#expire(entry);
    if (entry.state !== 'pending') return false;
    entry.state = decision === 'approve' ? 'approved' : 'rejected';
    entry.by = by;
    entry.settledAt = this.now();
    return true;
  }

  /** Liefert genau einmal 'approved'; danach ist die Freigabe verbraucht. */
  consume(id) {
    const entry = this.#entries.get(id);
    if (!entry) return 'unknown';
    this.#expire(entry);
    if (entry.state === 'approved') {
      entry.state = 'consumed';
      entry.settledAt = this.now();
      return 'approved';
    }
    return entry.state;
  }

  peek(id) {
    const entry = this.#entries.get(id);
    if (!entry) return undefined;
    this.#expire(entry);
    return { subject: entry.subject, state: entry.state, by: entry.by, expiresAt: entry.expiresAt };
  }

  /** Entfernt erledigte Eintraege nach der Aufbewahrungszeit (begrenzt den Speicher). */
  sweep() {
    let removed = 0;
    for (const [id, entry] of this.#entries) {
      this.#expire(entry);
      if (entry.state !== 'pending' && entry.settledAt !== null && entry.settledAt + this.retentionMs <= this.now()) {
        this.#entries.delete(id);
        removed += 1;
      }
    }
    return removed;
  }
}
