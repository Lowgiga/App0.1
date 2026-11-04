// OMG-01 Node-Identitaet und Kopplung (omega.peer/v1).
// Die Knoten-ID ist selbstzertifizierend: 'n' + 16 Hex-Zeichen von SHA-256(oeffentlicher Schluessel).
// Ein Peer wird nur vertrauenswuerdig, wenn ein Mensch auf beiden Geraeten denselben
// sechsstelligen Kopplungscode gesehen und bestaetigt hat (Short Authentication String).
import { createHash } from 'node:crypto';
import { NODE_ID, parseHlc } from './hlc.mjs';
import { importPublicKey, keyId, signObject, verifyObject } from './signing.mjs';

export const PEER_SCHEMA = 'omega.peer/v1';
export const PEER_ROLES = Object.freeze(['windows', 'android', 'relay', 'witness']);
const B64URL_32 = /^[A-Za-z0-9_-]{43}$/;
const LABEL = /^[\p{L}\p{N} ._-]{1,40}$/u;

export function nodeIdFromKey(publicKeyX) {
  importPublicKey(publicKeyX); // prueft Format und Kurve
  return `n${createHash('sha256').update(Buffer.from(publicKeyX, 'base64url')).digest('hex').slice(0, 16)}`;
}

/** Sechsstelliger Kopplungscode; reihenfolgeunabhaengig, auf beiden Geraeten gleich. */
export function pairingCode(publicKeyA, publicKeyB) {
  for (const key of [publicKeyA, publicKeyB]) importPublicKey(key);
  if (publicKeyA === publicKeyB) throw new RangeError('Kopplung: zwei verschiedene Schluessel noetig');
  const [a, b] = [publicKeyA, publicKeyB].sort();
  const digest = createHash('sha256').update(`omega-pair/v1\n${a}\n${b}`, 'utf8').digest();
  return String(digest.readUInt32BE(0) % 1_000_000).padStart(6, '0');
}

export function validatePeerEntry(entry) {
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return 'not-an-object';
  const allowed = new Set(['schema', 'node', 'publicKey', 'keyId', 'role', 'label', 'addedHlc', 'confirmedBy', 'sig']);
  for (const key of Object.keys(entry)) if (!allowed.has(key)) return `unknown-field:${key}`;
  if (entry.schema !== PEER_SCHEMA) return 'wrong-schema';
  if (typeof entry.publicKey !== 'string' || !B64URL_32.test(entry.publicKey)) return 'bad-key';
  if (entry.node !== nodeIdFromKey(entry.publicKey)) return 'node-id-mismatch';
  if (entry.keyId !== keyId(entry.publicKey)) return 'key-id-mismatch';
  if (!PEER_ROLES.includes(entry.role)) return 'bad-role';
  if (typeof entry.label !== 'string' || !LABEL.test(entry.label)) return 'bad-label';
  try {
    parseHlc(entry.addedHlc);
  } catch {
    return 'bad-hlc';
  }
  if (typeof entry.confirmedBy !== 'string' || !NODE_ID.test(entry.confirmedBy)) return 'bad-confirmer';
  if (typeof entry.sig !== 'string') return 'unsigned';
  return null;
}

/** Erzeugt einen vom bestaetigenden Knoten signierten Peer-Eintrag. */
export function createPeerEntry({ publicKey, role, label, addedHlc }, confirmer) {
  const entry = {
    schema: PEER_SCHEMA,
    node: nodeIdFromKey(publicKey),
    publicKey,
    keyId: keyId(publicKey),
    role,
    label,
    addedHlc,
    confirmedBy: nodeIdFromKey(confirmer.publicKey),
  };
  const signed = { ...entry, sig: signObject(entry, confirmer.privateKey) };
  const problem = validatePeerEntry(signed);
  if (problem) throw new TypeError(`omega.peer/v1: ${problem}`);
  return signed;
}

export class PeerRegistry {
  #peers = new Map();
  #revoked = new Set();

  /** trustedConfirmers: Map<nodeId, publicKey> - normalerweise nur der eigene Knoten. */
  constructor({ trustedConfirmers }) {
    this.trustedConfirmers = trustedConfirmers;
  }

  add(entry, { confirmedByHuman, pairingCodeMatched } = {}) {
    if (confirmedByHuman !== true || pairingCodeMatched !== true) return { ok: false, reason: 'human-confirmation-missing' };
    return this.#admit(entry);
  }

  #admit(entry) {
    const problem = validatePeerEntry(entry);
    if (problem) return { ok: false, reason: problem };
    if (this.#revoked.has(entry.node)) return { ok: false, reason: 'revoked' };
    const confirmerKey = this.trustedConfirmers.get(entry.confirmedBy);
    if (!confirmerKey || nodeIdFromKey(confirmerKey) !== entry.confirmedBy) return { ok: false, reason: 'untrusted-confirmer' };
    if (!verifyObject(entry, confirmerKey)) return { ok: false, reason: 'bad-signature' };
    this.#peers.set(entry.node, structuredClone(entry));
    return { ok: true, node: entry.node };
  }

  /** Widerruf ist endgueltig: derselbe Schluessel kann nicht erneut gekoppelt werden. */
  revoke(node) {
    if (!NODE_ID.test(node)) return false;
    this.#revoked.add(node);
    return this.#peers.delete(node);
  }

  /** Map-kompatibel (EventVerifier): oeffentlicher Schluessel oder undefined. */
  get(node) {
    if (this.#revoked.has(node)) return undefined;
    return this.#peers.get(node)?.publicKey;
  }

  has(node) {
    return this.get(node) !== undefined;
  }

  entry(node) {
    return this.has(node) ? structuredClone(this.#peers.get(node)) : undefined;
  }

  list() {
    return [...this.#peers.values()].map((entry) => ({ node: entry.node, role: entry.role, label: entry.label, keyId: entry.keyId }));
  }

  snapshot() {
    return { schema: 'omega.peer-state/v1', peers: [...this.#peers.values()], revoked: [...this.#revoked].sort() };
  }

  /** Stellt Peers wieder her und prueft jede Signatur erneut; ungueltige Eintraege werden verworfen. */
  static restore(snapshot, options) {
    const registry = new PeerRegistry(options);
    const rejected = [];
    if (snapshot?.schema !== 'omega.peer-state/v1') return { registry, rejected: ['state:wrong-schema'] };
    for (const node of snapshot.revoked ?? []) if (typeof node === 'string' && NODE_ID.test(node)) registry.#revoked.add(node);
    for (const entry of snapshot.peers ?? []) {
      const result = registry.#admit(entry);
      if (!result.ok) rejected.push(`${entry?.node ?? '?'}:${result.reason}`);
    }
    return { registry, rejected };
  }
}
