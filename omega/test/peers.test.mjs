import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nodeIdFromKey, pairingCode, keyId, createPeerEntry, PeerRegistry, EventEmitterNode, EventVerifier, generateNodeKeys,
} from '../runtime/index.mjs';
import { makeNode } from './helpers/fixtures.mjs';

test('Knoten-ID: selbstzertifizierend und stabil', () => {
  const keys = generateNodeKeys();
  assert.match(nodeIdFromKey(keys.publicKey), /^n[0-9a-f]{16}$/);
  assert.equal(nodeIdFromKey(keys.publicKey), nodeIdFromKey(keys.publicKey));
  assert.notEqual(nodeIdFromKey(keys.publicKey), nodeIdFromKey(generateNodeKeys().publicKey));
  assert.throws(() => nodeIdFromKey('kein-schluessel'));
});

// Oeffentliche Schluessel der Testvektoren 1-3 aus RFC 8032 (Abschnitt 7.1). Die Sollwerte wurden
// unabhaengig mit Python (hashlib) nachgerechnet; jede Implementierung (Java, Tasker) muss sie treffen.
const RFC8032 = [
  '11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo',
  'PUAXw-hDiVqStwqnTRt-vJyYLM8uxJaMwM1V8Sr0Zgw',
  '_FHNjmIYoaONpH7QAjDwWAgW7RO6MwOsXeuRFUiQgCU',
];

test('Knoten-ID und Kopplungscode: feste Sollwerte (RFC-8032-Schluessel)', () => {
  assert.deepEqual(RFC8032.map(nodeIdFromKey), ['n21fe31dfa154a261', 'n39f713d0a644253f', 'ndac073e0123bdea5']);
  assert.deepEqual(RFC8032.map(keyId), ['k1_48rNXC2TEpWmT2w7', 'k1_d_Hh5ZM8MeBcI9JZ', 'k1_hYDefhI3TldDELUg']);
  assert.equal(pairingCode(RFC8032[0], RFC8032[1]), '378724');
  assert.equal(pairingCode(RFC8032[0], RFC8032[2]), '723644');
  assert.equal(pairingCode(RFC8032[1], RFC8032[2]), '203809');
});

test('Kopplungscode: 6 Ziffern, reihenfolgeunabhaengig, nie fuer denselben Schluessel', () => {
  const a = generateNodeKeys().publicKey;
  const b = generateNodeKeys().publicKey;
  assert.match(pairingCode(a, b), /^\d{6}$/);
  assert.equal(pairingCode(a, b), pairingCode(b, a));
  assert.equal(pairingCode(RFC8032[1], RFC8032[0]), '378724');
  assert.throws(() => pairingCode(a, a));
  assert.throws(() => pairingCode(a, 'kein-schluessel'));
});

test('PeerRegistry: nur mit menschlicher Bestaetigung und vertrauenswuerdiger Signatur', () => {
  const win = makeNode();
  const phone = makeNode();
  const registry = new PeerRegistry({ trustedConfirmers: new Map([[win.node, win.publicKey]]) });
  const entry = createPeerEntry({ publicKey: phone.publicKey, role: 'android', label: 'Samsung S24', addedHlc: win.clock.tick() }, win);
  assert.equal(registry.add(entry).reason, 'human-confirmation-missing');
  assert.equal(registry.add(entry, { confirmedByHuman: true }).reason, 'human-confirmation-missing');
  assert.equal(registry.add({ ...entry, role: 'windows' }, { confirmedByHuman: true, pairingCodeMatched: true }).reason, 'bad-signature');
  const mallory = makeNode();
  const forged = createPeerEntry({ publicKey: phone.publicKey, role: 'android', label: 'Fake', addedHlc: mallory.clock.tick() }, mallory);
  assert.equal(registry.add(forged, { confirmedByHuman: true, pairingCodeMatched: true }).reason, 'untrusted-confirmer');
  assert.deepEqual(registry.add(entry, { confirmedByHuman: true, pairingCodeMatched: true }), { ok: true, node: phone.node });
  assert.equal(registry.get(phone.node), phone.publicKey);
  assert.deepEqual(registry.list(), [{ node: phone.node, role: 'android', label: 'Samsung S24', keyId: entry.keyId }]);
});

test('PeerRegistry: Widerruf ist endgueltig und wirkt sofort auf Ereignisse', () => {
  const win = makeNode();
  const phone = makeNode();
  const registry = new PeerRegistry({ trustedConfirmers: new Map([[win.node, win.publicKey]]) });
  const entry = createPeerEntry({ publicKey: phone.publicKey, role: 'android', label: 'Samsung', addedHlc: win.clock.tick() }, win);
  registry.add(entry, { confirmedByHuman: true, pairingCodeMatched: true });
  const verifier = new EventVerifier({ peers: registry, clock: win.clock });
  const emitter = new EventEmitterNode({ clock: phone.clock, privateKey: phone.privateKey });
  assert.equal(verifier.accept(emitter.emit('device.usb.connected')).ok, true);
  assert.equal(registry.revoke(phone.node), true);
  assert.equal(verifier.accept(emitter.emit('device.usb.connected')).reason, 'unknown-peer');
  assert.equal(registry.add(entry, { confirmedByHuman: true, pairingCodeMatched: true }).reason, 'revoked');
});

test('PeerRegistry: Wiederherstellung prueft jede Signatur erneut', () => {
  const win = makeNode();
  const phone = makeNode();
  const relay = makeNode();
  const options = { trustedConfirmers: new Map([[win.node, win.publicKey]]) };
  const registry = new PeerRegistry(options);
  for (const [peer, role] of [[phone, 'android'], [relay, 'relay']]) {
    registry.add(createPeerEntry({ publicKey: peer.publicKey, role, label: role, addedHlc: win.clock.tick() }, win),
      { confirmedByHuman: true, pairingCodeMatched: true });
  }
  const snapshot = JSON.parse(JSON.stringify(registry.snapshot()));
  snapshot.peers[1].role = 'windows';
  const { registry: restored, rejected } = PeerRegistry.restore(snapshot, options);
  assert.equal(restored.list().length, 1);
  assert.equal(rejected.length, 1);
  assert.match(rejected[0], /bad-signature/);
  assert.deepEqual(PeerRegistry.restore({ schema: 'falsch' }, options).rejected, ['state:wrong-schema']);
});
