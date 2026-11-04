import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventJournal, JournalCorruptError, verifyJournalText, EventEmitterNode, GENESIS } from '../runtime/index.mjs';
import { makeNode } from './helpers/fixtures.mjs';

function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), 'omega-journal-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const node = makeNode();
  const emitter = new EventEmitterNode({ clock: node.clock, privateKey: node.privateKey });
  return { path: join(dir, 'events.jsonl'), emitter };
}

test('Journal: anhaengen, verketten, nach Neustart fortsetzen', (t) => {
  const { path, emitter } = setup(t);
  const journal = new EventJournal(path);
  assert.equal(journal.head, GENESIS);
  const a = journal.append(emitter.emit('device.usb.connected'));
  const b = journal.append(emitter.emit('device.wifi.connected'));
  assert.deepEqual([a.index, b.index], [1, 2]);
  journal.close();
  assert.throws(() => journal.append(emitter.emit('device.x.y')), /geschlossen/);
  const reopened = new EventJournal(path);
  assert.equal(reopened.length, 2);
  assert.equal(reopened.head, b.hash);
  reopened.append(emitter.emit('device.usb.disconnected'));
  reopened.close();
  const check = verifyJournalText(readFileSync(path, 'utf8'));
  assert.equal(check.ok, true);
  assert.equal(check.count, 3);
});

test('Journal: Manipulation wird erkannt, Schreiben verweigert', (t) => {
  const { path, emitter } = setup(t);
  const journal = new EventJournal(path);
  journal.append(emitter.emit('wallet.position.opened', { size: 1 }, { dataClass: 'financial' }));
  journal.append(emitter.emit('wallet.position.closed', { size: 1 }, { dataClass: 'financial' }));
  journal.close();
  const lines = readFileSync(path, 'utf8').split('\n');
  const record = JSON.parse(lines[0]);
  record.event.payload.size = 100;
  writeFileSync(path, [JSON.stringify(record), ...lines.slice(1)].join('\n'));
  assert.throws(() => new EventJournal(path), (error) => error instanceof JournalCorruptError && error.reason === 'hash-mismatch' && error.line === 1);
  writeFileSync(path, `${lines[1]}\n`);
  assert.equal(verifyJournalText(readFileSync(path, 'utf8')).reason, 'bad-index');
});

test('Journal: halbe letzte Zeile nach Absturz wird abgeschnitten', (t) => {
  const { path, emitter } = setup(t);
  const journal = new EventJournal(path);
  journal.append(emitter.emit('device.usb.connected'));
  journal.close();
  appendFileSync(path, '{"index":2,"prev":"abc');
  const recovered = new EventJournal(path);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.length, 1);
  recovered.append(emitter.emit('device.usb.disconnected'));
  recovered.close();
  assert.equal(verifyJournalText(readFileSync(path, 'utf8')).count, 2);
});
