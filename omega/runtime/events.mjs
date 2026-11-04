// omega.event/v1: signierte, geordnete Ereignisse mit Datenklasse und Replay-Schutz (Sequenz je Knoten).
import { parseHlc, NODE_ID } from './hlc.mjs';
import { signObject, verifyObject } from './signing.mjs';
import { nodeIdFromKey } from './peers.mjs';

export const EVENT_SCHEMA = 'omega.event/v1';
/** Datenklassen (aufsteigend schutzbeduerftig). 'secret' verlaesst den Knoten nie. */
export const DATA_CLASSES = Object.freeze(['public', 'internal', 'personal', 'financial', 'secret']);
const EVENT_TYPE = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;
export const MAX_PAYLOAD_BYTES = 64 * 1024;

export function checkEventShape(ev) {
  if (ev === null || typeof ev !== 'object' || Array.isArray(ev)) return 'not-an-object';
  const allowed = new Set(['schema', 'node', 'seq', 'hlc', 'type', 'dataClass', 'payload', 'sig']);
  for (const key of Object.keys(ev)) if (!allowed.has(key)) return `unknown-field:${key}`;
  if (ev.schema !== EVENT_SCHEMA) return 'wrong-schema';
  if (typeof ev.node !== 'string' || !NODE_ID.test(ev.node)) return 'bad-node';
  if (!Number.isSafeInteger(ev.seq) || ev.seq < 1) return 'bad-seq';
  try {
    if (parseHlc(ev.hlc).node !== ev.node) return 'hlc-node-mismatch';
  } catch {
    return 'bad-hlc';
  }
  if (typeof ev.type !== 'string' || !EVENT_TYPE.test(ev.type)) return 'bad-type';
  if (!DATA_CLASSES.includes(ev.dataClass)) return 'bad-data-class';
  if (ev.payload === null || typeof ev.payload !== 'object' || Array.isArray(ev.payload)) return 'bad-payload';
  if (Buffer.byteLength(JSON.stringify(ev.payload), 'utf8') > MAX_PAYLOAD_BYTES) return 'payload-too-large';
  return null;
}

/** Darf das Ereignis an andere Knoten gehen? */
export function mayLeaveNode(ev) {
  return ev?.dataClass !== 'secret';
}

/** Erzeugt fortlaufend signierte Ereignisse eines Knotens (startSeq aus dem gespeicherten Zustand). */
export class EventEmitterNode {
  #seq;

  constructor({ clock, privateKey, startSeq = 0 }) {
    if (!Number.isSafeInteger(startSeq) || startSeq < 0) throw new RangeError('EventEmitterNode: startSeq >= 0');
    this.clock = clock;
    this.privateKey = privateKey;
    this.#seq = startSeq;
  }

  get seq() {
    return this.#seq;
  }

  emit(type, payload = {}, { dataClass = 'internal' } = {}) {
    const ev = {
      schema: EVENT_SCHEMA, node: this.clock.node, seq: this.#seq + 1, hlc: this.clock.tick(), type, dataClass, payload,
    };
    const problem = checkEventShape(ev);
    if (problem) throw new TypeError(`omega.event/v1: ${problem}`);
    this.#seq += 1;
    return { ...ev, sig: signObject(ev, this.privateKey) };
  }
}

/**
 * Prueft eingehende Ereignisse: Form, bekannter Peer (selbstzertifizierende ID), Signatur,
 * Replay, Uhrendrift. peers: Map<nodeId, publicKey> oder PeerRegistry.
 */
export class EventVerifier {
  #lastSeq = new Map();

  constructor({ peers, clock }) {
    this.peers = peers;
    this.clock = clock;
  }

  accept(ev) {
    const problem = checkEventShape(ev);
    if (problem) return { ok: false, reason: problem };
    if (typeof ev.sig !== 'string') return { ok: false, reason: 'unsigned' };
    const key = this.peers.get(ev.node);
    if (!key) return { ok: false, reason: 'unknown-peer' };
    try {
      if (nodeIdFromKey(key) !== ev.node) return { ok: false, reason: 'peer-id-mismatch' };
      if (!verifyObject(ev, key)) return { ok: false, reason: 'bad-signature' };
    } catch {
      return { ok: false, reason: 'bad-peer-key' };
    }
    if (ev.seq <= (this.#lastSeq.get(ev.node) ?? 0)) return { ok: false, reason: 'replay' };
    try {
      this.clock.receive(ev.hlc);
    } catch {
      return { ok: false, reason: 'clock-drift' };
    }
    this.#lastSeq.set(ev.node, ev.seq);
    return { ok: true };
  }

  snapshot() {
    return { schema: 'omega.verifier-state/v1', lastSeq: Object.fromEntries([...this.#lastSeq].sort()) };
  }

  /** Ein fehlender Zustand ist erlaubt (erster Start); ein defekter wird abgewiesen, nie still verworfen. */
  static restore(snapshot, options) {
    const verifier = new EventVerifier(options);
    if (snapshot === undefined) return verifier;
    if (snapshot?.schema !== 'omega.verifier-state/v1') throw new TypeError('EventVerifier: Zustand defekt');
    for (const [node, seq] of Object.entries(snapshot.lastSeq ?? {})) {
      if (!NODE_ID.test(node) || !Number.isSafeInteger(seq) || seq < 0) throw new TypeError('EventVerifier: Zustand defekt');
      verifier.#lastSeq.set(node, seq);
    }
    return verifier;
  }
}
