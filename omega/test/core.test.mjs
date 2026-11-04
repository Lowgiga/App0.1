import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  canonicalize, HybridLogicalClock, parseHlc, compareHlc, formatHlc,
  generateNodeKeys, signObject, verifyObject, keyId, macObject, verifyMac,
  EventEmitterNode, EventVerifier, mayLeaveNode, LeaseManager, FencedResource,
} from '../runtime/index.mjs';
import { fakeClock, makeNode } from './helpers/fixtures.mjs';

test('canonicalize: sortiert, ohne Leerraum, lehnt Sonderwerte ab', () => {
  assert.equal(canonicalize({ b: 1, a: [true, null, 'x'], c: { z: 1, y: 2 } }), '{"a":[true,null,"x"],"b":1,"c":{"y":2,"z":1}}');
  assert.equal(canonicalize({ a: undefined, b: 2 }), '{"b":2}');
  assert.equal(canonicalize({ 'ä': 1, z: 2, A: 3 }), '{"A":3,"z":2,"ä":1}');
  assert.throws(() => canonicalize({ x: NaN }));
  assert.throws(() => canonicalize({ x: new Date() }));
  assert.throws(() => canonicalize({ x: 1n }));
});

test('HLC: monoton bei stehender oder rueckspringender Uhr', () => {
  const now = fakeClock();
  const clock = new HybridLogicalClock({ node: 'android-1', now });
  const a = clock.tick();
  const b = clock.tick();
  now.advance(-5_000);
  const c = clock.tick();
  assert.equal(compareHlc(a, b), -1);
  assert.equal(compareHlc(b, c), -1);
  assert.equal(parseHlc(c).logical, 2);
  now.advance(10_000);
  assert.equal(parseHlc(clock.tick()).logical, 0);
});

test('HLC: Empfang ordnet kausal und lehnt Drift ab', () => {
  const now = fakeClock();
  const win = new HybridLogicalClock({ node: 'win-1', now });
  const phone = new HybridLogicalClock({ node: 'android-1', now, maxDriftMs: 1_000 });
  const sent = win.tick();
  const got = phone.receive(sent);
  assert.equal(compareHlc(sent, got), -1);
  const ahead = formatHlc({ wall: now() + 5_000, logical: 0, node: 'win-1' });
  assert.throws(() => phone.receive(ahead), /voraus/);
  assert.throws(() => parseHlc('kaputt'));
  assert.throws(() => new HybridLogicalClock({ node: 'Ungueltig!' }));
});

test('Ed25519: Signatur deckt jedes Feld ab', () => {
  const { publicKey, privateKey } = generateNodeKeys();
  const obj = { schema: 'x', n: 1, nested: { a: 'b' } };
  const signed = { ...obj, sig: signObject(obj, privateKey) };
  assert.equal(verifyObject(signed, publicKey), true);
  assert.equal(verifyObject({ ...signed, n: 2 }, publicKey), false);
  assert.equal(verifyObject({ ...signed, nested: { a: 'c' } }, publicKey), false);
  assert.equal(verifyObject({ ...signed, sig: 'AAAA' }, publicKey), false);
  assert.equal(verifyObject(signed, generateNodeKeys().publicKey), false);
  assert.match(keyId(publicKey), /^k1_[A-Za-z0-9_-]{16}$/);
});

test('HMAC: zeitkonstante Pruefung, Mindestlaenge des Geheimnisses', () => {
  const secret = randomBytes(32);
  const obj = { a: 1 };
  const withMac = { ...obj, mac: macObject(obj, secret) };
  assert.equal(verifyMac(withMac, secret), true);
  assert.equal(verifyMac({ ...withMac, a: 2 }, secret), false);
  assert.equal(verifyMac(withMac, randomBytes(32)), false);
  assert.throws(() => macObject(obj, Buffer.alloc(8)));
});

test('omega.event/v1: Ende-zu-Ende inkl. Manipulation, Replay, fremder Knoten, Datenklasse', () => {
  const now = fakeClock();
  const phone = makeNode(now);
  const win = makeNode(now);
  const emitter = new EventEmitterNode({ clock: phone.clock, privateKey: phone.privateKey });
  const verifier = new EventVerifier({ peers: new Map([[phone.node, phone.publicKey]]), clock: win.clock });
  const e1 = emitter.emit('device.usb.connected', { source: 'usb' });
  const e2 = emitter.emit('wallet.health.changed', { hf: 1.42 }, { dataClass: 'financial' });
  assert.equal(e1.dataClass, 'internal');
  assert.equal(e2.dataClass, 'financial');
  assert.deepEqual(verifier.accept(e1), { ok: true });
  assert.deepEqual(verifier.accept(e1), { ok: false, reason: 'replay' });
  assert.deepEqual(verifier.accept({ ...e2, dataClass: 'public' }), { ok: false, reason: 'bad-signature' });
  assert.deepEqual(verifier.accept(e2), { ok: true });
  assert.equal(verifier.accept({ ...e2, extra: 1 }).reason, 'unknown-field:extra');
  const stranger = makeNode(now);
  const strangerEmitter = new EventEmitterNode({ clock: stranger.clock, privateKey: stranger.privateKey });
  assert.equal(verifier.accept(strangerEmitter.emit('device.usb.connected')).reason, 'unknown-peer');
  assert.throws(() => emitter.emit('Kein Typ'), /bad-type/);
  assert.throws(() => emitter.emit('device.x', {}, { dataClass: 'geheim' }), /bad-data-class/);
  assert.equal(mayLeaveNode(emitter.emit('vault.key.rotated', {}, { dataClass: 'secret' })), false);
  assert.equal(mayLeaveNode(e1), true);
});

test('omega.event/v1: Peer-Map mit falscher Zuordnung wird erkannt', () => {
  const now = fakeClock();
  const phone = makeNode(now);
  const other = makeNode(now);
  const emitter = new EventEmitterNode({ clock: phone.clock, privateKey: phone.privateKey });
  const verifier = new EventVerifier({ peers: new Map([[phone.node, other.publicKey]]), clock: makeNode(now).clock });
  assert.equal(verifier.accept(emitter.emit('device.usb.connected')).reason, 'peer-id-mismatch');
  const broken = new EventVerifier({ peers: new Map([[phone.node, 'kaputt']]), clock: makeNode(now).clock });
  assert.equal(broken.accept(emitter.emit('device.usb.connected')).reason, 'bad-peer-key');
});

test('Lease: exklusiv, Fencing, Ablauf, Kill-Switch, Tokens >= Uhrzeit', () => {
  const now = fakeClock();
  const leases = new LeaseManager({ now, maxTtlMs: 60_000 });
  const a = leases.acquire('t1', 'win-1', 10_000);
  assert.equal(a.ok, true);
  assert.ok(a.lease.fencingToken >= now(), 'Token mindestens die aktuelle Uhrzeit');
  assert.equal(leases.acquire('t1', 'android-1', 10_000).reason, 'held');
  assert.deepEqual(leases.check('t1', a.lease.fencingToken), { ok: true });
  now.advance(10_001);
  assert.equal(leases.check('t1', a.lease.fencingToken).reason, 'expired');
  const b = leases.acquire('t1', 'android-1', 10_000);
  assert.ok(b.lease.fencingToken > a.lease.fencingToken);
  assert.equal(leases.check('t1', a.lease.fencingToken).reason, 'stale-token');
  assert.equal(leases.renew('t1', a.lease.leaseId, 1_000).reason, 'no-lease');
  assert.equal(leases.renew('t1', b.lease.leaseId, 20_000).ok, true);
  assert.throws(() => leases.acquire('t2', 'x', 0));
  assert.throws(() => leases.acquire('t2', 'x', 120_000));
  assert.equal(leases.revokeAll(), 1);
  assert.equal(leases.check('t1', b.lease.fencingToken).reason, 'no-lease');
  const c = leases.acquire('t1', 'win-1', 1_000);
  assert.ok(c.lease.fencingToken > b.lease.fencingToken, 'Tokens laufen nach Kill-Switch weiter');
  assert.equal(leases.release('t1', 'falsch'), false);
  assert.equal(leases.release('t1', c.lease.leaseId), true);
});

test('Lease: auch bei stehender Uhr streng steigend', () => {
  const now = fakeClock();
  const leases = new LeaseManager({ now });
  const tokens = [];
  for (let i = 0; i < 5; i += 1) {
    const { lease } = leases.acquire('t', 'win-1', 1_000);
    tokens.push(lease.fencingToken);
  }
  assert.deepEqual(tokens, [...tokens].sort((x, y) => x - y));
  assert.equal(new Set(tokens).size, 5);
});

test('FencedResource: kleinere Tokens werden abgewiesen', () => {
  const fence = new FencedResource();
  assert.equal(fence.admit('r', 2).ok, true);
  assert.equal(fence.admit('r', 2).ok, true);
  assert.equal(fence.admit('r', 1).reason, 'fenced');
  assert.equal(fence.admit('r', 3).ok, true);
  assert.equal(fence.admit('r', 0).reason, 'bad-token');
});
