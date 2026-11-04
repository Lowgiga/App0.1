// OMG-04 Ereignisjournal: nur anhaengen, hash-verkettet, jede Zeile ein signiertes omega.event/v1.
// Manipulation oder Luecken machen das Journal ungueltig (Schreiben wird verweigert);
// eine halbe letzte Zeile nach einem Absturz wird abgeschnitten und gemeldet.
import {
  closeSync, existsSync, fsyncSync, ftruncateSync, openSync, readFileSync, writeSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { canonicalize } from './canonical.mjs';
import { checkEventShape } from './events.mjs';

export const GENESIS = '0'.repeat(64);

export function hashRecord({ index, prev, event }) {
  return createHash('sha256').update(canonicalize({ index, prev, event }), 'utf8').digest('hex');
}

export class JournalCorruptError extends Error {
  constructor(reason, line) {
    super(`Journal defekt: ${reason} (Zeile ${line})`);
    this.reason = reason;
    this.line = line;
  }
}

/** Prueft den Journaltext; liefert Anzahl, Kopf-Hash und die Laenge des gueltigen Teils in Bytes. */
export function verifyJournalText(text) {
  const lastNewline = text.lastIndexOf('\n');
  const complete = lastNewline === -1 ? '' : text.slice(0, lastNewline + 1);
  const partialTail = text.length > complete.length;
  const lines = complete === '' ? [] : complete.slice(0, -1).split('\n');
  let prev = GENESIS;
  const lastSeq = {};
  const rotations = [];
  for (let i = 0; i < lines.length; i += 1) {
    const lineNo = i + 1;
    let record;
    try {
      record = JSON.parse(lines[i]);
    } catch {
      return { ok: false, reason: 'bad-json', line: lineNo };
    }
    const keys = record && typeof record === 'object' ? Object.keys(record).sort().join(',') : '';
    if (keys !== 'event,hash,index,prev') return { ok: false, reason: 'bad-record', line: lineNo };
    if (record.index !== lineNo) return { ok: false, reason: 'bad-index', line: lineNo };
    if (record.prev !== prev) return { ok: false, reason: 'broken-chain', line: lineNo };
    if (checkEventShape(record.event) !== null) return { ok: false, reason: 'bad-event', line: lineNo };
    if (record.hash !== hashRecord(record)) return { ok: false, reason: 'hash-mismatch', line: lineNo };
    prev = record.hash;
    const { node, seq } = record.event;
    if (seq > (lastSeq[node] ?? 0)) lastSeq[node] = seq;
    if (record.event.type === 'journal.rotated') rotations.push({ node, floor: record.event.payload?.floor ?? {} });
  }
  return { ok: true, count: lines.length, head: prev, lastSeq, rotations, partialTail, validBytes: Buffer.byteLength(complete, 'utf8') };
}

/**
 * Bestmoegliche Untergrenze der Sequenzen aus einem defekten Journal (jede lesbare Zeile zaehlt).
 * Eine zu hohe Grenze weist hoechstens mehr ab - sicher fuer den Replay-Schutz.
 */
export function salvageSequenceFloor(text) {
  const floor = {};
  for (const line of text.split('\n')) {
    try {
      const { node, seq } = JSON.parse(line).event;
      if (typeof node === 'string' && Number.isSafeInteger(seq) && seq > (floor[node] ?? 0)) floor[node] = seq;
    } catch {
      // unlesbare Zeile
    }
  }
  return floor;
}

export class EventJournal {
  #fd;
  #count = 0;
  #head = GENESIS;
  #lastSeq = new Map();
  #rotations = [];

  constructor(path) {
    this.path = path;
    this.recovered = false;
    if (existsSync(path)) {
      const result = verifyJournalText(readFileSync(path, 'utf8'));
      if (!result.ok) throw new JournalCorruptError(result.reason, result.line);
      this.#count = result.count;
      this.#head = result.head;
      for (const [node, seq] of Object.entries(result.lastSeq)) this.#lastSeq.set(node, seq);
      this.#rotations = result.rotations;
      if (result.partialTail) {
        const fd = openSync(path, 'r+');
        try {
          ftruncateSync(fd, result.validBytes);
          fsyncSync(fd);
        } finally {
          closeSync(fd);
        }
        this.recovered = true;
      }
    }
    this.#fd = openSync(path, 'a', 0o600);
  }

  get length() {
    return this.#count;
  }

  get head() {
    return this.#head;
  }

  /** Hoechste Sequenz je Knoten - das Journal ist die Quelle fuer den Replay-Schutz nach einem Neustart. */
  lastSeq() {
    return Object.fromEntries([...this.#lastSeq].sort());
  }

  /** Rotationen (Quarantaene) mit Sequenz-Untergrenzen; der Aufrufer prueft den Urheber. */
  rotations() {
    return structuredClone(this.#rotations);
  }

  append(event) {
    if (this.#fd === undefined) throw new Error('Journal geschlossen');
    const problem = checkEventShape(event);
    if (problem) throw new TypeError(`Journal: ${problem}`);
    const record = { index: this.#count + 1, prev: this.#head, event };
    const hash = hashRecord(record);
    writeSync(this.#fd, `${JSON.stringify({ ...record, hash })}\n`);
    fsyncSync(this.#fd);
    this.#count = record.index;
    this.#head = hash;
    if (event.seq > (this.#lastSeq.get(event.node) ?? 0)) this.#lastSeq.set(event.node, event.seq);
    if (event.type === 'journal.rotated') this.#rotations.push({ node: event.node, floor: structuredClone(event.payload?.floor ?? {}) });
    return { index: record.index, hash };
  }

  close() {
    if (this.#fd !== undefined) {
      closeSync(this.#fd);
      this.#fd = undefined;
    }
  }
}
