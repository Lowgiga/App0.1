import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { NodeService, initIdentity, loadIdentity } from '../node/service.mjs';
import { startServer } from '../node/server.mjs';
import {
  EventEmitterNode, pairingCode, TaskerCommandGate, HybridLogicalClock, FencedResource, TrustKernel, fromTaskerHttp,
} from '../runtime/index.mjs';
import { makeNode } from './helpers/fixtures.mjs';

function stateDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'omega-node-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  initIdentity(dir, { label: 'win-gpu', role: 'windows' });
  return dir;
}

function paired(t) {
  const dir = stateDir(t);
  const service = new NodeService({ stateDir: dir });
  const phone = makeNode();
  const code = pairingCode(service.identity.publicKey, phone.publicKey);
  assert.deepEqual(service.addPeer({ publicKey: phone.publicKey, role: 'android', label: 'Samsung', code }), { ok: true, node: phone.node });
  const emitter = new EventEmitterNode({ clock: phone.clock, privateKey: phone.privateKey });
  return { dir, service, phone, emitter };
}

function raw(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = request(url, { method, headers }, (res) => {
      let text = '';
      res.on('data', (c) => { text += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

test('Identitaet: einmalig anlegen, Schluessel muss zur Datei passen', (t) => {
  const dir = stateDir(t);
  assert.throws(() => initIdentity(dir), /existiert bereits/);
  const identity = loadIdentity(dir);
  assert.match(identity.node, /^n[0-9a-f]{16}$/);
  const stored = JSON.parse(readFileSync(join(dir, 'identity.json'), 'utf8'));
  writeFileSync(join(dir, 'identity.json'), JSON.stringify({ ...stored, publicKey: makeNode().publicKey }));
  assert.throws(() => loadIdentity(dir), /inkonsistent/);
});

test('Kopplung: falscher Code wird abgelehnt', (t) => {
  const service = new NodeService({ stateDir: stateDir(t) });
  t.after(() => service.close());
  const phone = makeNode();
  assert.deepEqual(service.addPeer({ publicKey: phone.publicKey, role: 'android', label: 'Samsung', code: '000000' === pairingCode(service.identity.publicKey, phone.publicKey) ? '111111' : '000000' }),
    { ok: false, reason: 'pairing-code-mismatch' });
  assert.equal(service.peers.list().length, 0);
});

test('HTTP: Ereignisse annehmen, Replay/Fremde/Geheimes abweisen, Schutz gegen Browser und Rebinding', async (t) => {
  const { service, emitter } = paired(t);
  const server = await startServer(service, { port: 0 });
  t.after(async () => { await server.close(); service.close(); });
  const post = (event, headers = {}) => raw(`${server.url}/api/omega/v1/events`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(event),
  });
  const ev = emitter.emit('device.usb.connected', { source: 'usb' });
  const accepted = await post(ev);
  assert.equal(accepted.status, 202);
  assert.equal(accepted.body.index, 2, 'Index 1 ist das lokale Ereignis peer.added');
  assert.equal((await post(ev)).status, 409);
  const stranger = makeNode();
  assert.equal((await post(new EventEmitterNode({ clock: stranger.clock, privateKey: stranger.privateKey }).emit('device.usb.connected'))).status, 401);
  assert.deepEqual((await post(emitter.emit('vault.key.rotated', {}, { dataClass: 'secret' }))).body, { error: 'secret-not-transferable' });
  assert.equal((await post(emitter.emit('device.x.y'), { origin: 'https://evil.example' })).status, 403);
  assert.equal((await raw(`${server.url}/api/omega/v1/health`, { headers: { host: `evil.example:${server.port}` } })).status, 421);
  assert.equal((await raw(`${server.url}/api/omega/v1/events`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' })).status, 415);
  assert.equal((await raw(`${server.url}/api/omega/v1/events`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(100 * 1024) })).status, 413);
  assert.equal((await raw(`${server.url}/api/omega/v1/events`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{kaputt' })).status, 400);
  assert.equal((await raw(`${server.url}/api/omega/v1/events`)).status, 405);
  assert.equal((await raw(`${server.url}/nichts`)).status, 404);
  const health = await raw(`${server.url}/api/omega/v1/health`);
  assert.equal(health.status, 200);
  assert.equal(health.body.peers, 1);
  assert.equal(health.body.killed, false);
});

test('HTTP: Bind nur an Loopback, nie an alle Schnittstellen', async () => {
  assert.throws(() => startServer({}, { host: '0.0.0.0' }), /Wildcard/);
  assert.throws(() => startServer({}, { host: '192.168.1.10' }), /Loopback/);
});

test('HTTP: Ratenbegrenzung je Absender', async (t) => {
  const service = new NodeService({ stateDir: stateDir(t) });
  const server = await startServer(service, { port: 0, capacity: 3, refillPerSec: 0.001 });
  t.after(async () => { await server.close(); service.close(); });
  const codes = [];
  for (let i = 0; i < 5; i += 1) codes.push((await raw(`${server.url}/api/omega/v1/health`)).status);
  assert.deepEqual(codes, [200, 200, 200, 429, 429]);
});

test('Kill per Peer-Ereignis: sofort wirksam, uebersteht Neustart, Freigabe nur durch Menschen', (t) => {
  const { dir, service, emitter } = paired(t);
  const secret = randomBytes(32);
  assert.equal(service.issueTaskerCommand({ action: 'OMEGA_STATUS', secret }).ok, true);
  assert.equal(service.ingest(emitter.emit('control.kill', { reason: 'Notaus am Handy' })).ok, true);
  assert.equal(service.health().killed, true);
  assert.equal(service.issueTaskerCommand({ action: 'OMEGA_ADB_ON', params: { minutes: 5 }, secret, confirmed: true }).reason, 'kill-switch');
  assert.equal(service.issueTaskerCommand({ action: 'OMEGA_ADB_OFF', secret }).ok, true, 'Sicherheitsbefehl geht immer');
  service.close();
  const restarted = new NodeService({ stateDir: dir });
  t.after(() => restarted.close());
  assert.equal(restarted.health().killed, true);
  assert.throws(() => restarted.releaseKill(), /Menschen/);
  assert.deepEqual(restarted.releaseKill({ confirmedByHuman: true }), { killed: false, level: 'E1' });
});

test('Replay-Schutz nach Neustart kommt aus dem Journal', (t) => {
  const { dir, service, emitter } = paired(t);
  const ev = emitter.emit('device.usb.connected');
  assert.equal(service.ingest(ev).ok, true);
  service.close();
  const restarted = new NodeService({ stateDir: dir });
  t.after(() => restarted.close());
  assert.equal(restarted.ingest(ev).reason, 'replay');
  assert.equal(restarted.ingest(emitter.emit('device.usb.disconnected')).ok, true);
  const own = restarted.emitLocal('node.started');
  assert.ok(own.seq > 1, 'eigene Sequenz setzt nach dem Neustart fort');
});

test('Defektes Journal oder defekter Trust-Zustand: fail-safe mit Kill-Switch', (t) => {
  const { dir, service, emitter } = paired(t);
  service.ingest(emitter.emit('device.usb.connected'));
  service.close();
  const journalPath = join(dir, 'journal', 'events.jsonl');
  writeFileSync(journalPath, readFileSync(journalPath, 'utf8').replace('"usb"', '"USB"').replace('device.usb.connected', 'device.usb.c0nnected'));
  const broken = new NodeService({ stateDir: dir });
  t.after(() => broken.close());
  assert.equal(broken.health().killed, true);
  assert.equal(broken.health().ingestBlocked, true);
  assert.match(broken.health().faults.join(), /journal:hash-mismatch/);
  assert.equal(broken.ingest(emitter.emit('device.x.y')).status, 503);
  assert.throws(() => broken.releaseKill({ confirmedByHuman: true }), /defekt/);

  const dir2 = stateDir(t);
  writeFileSync(join(dir2, 'trust.json'), '{kaputt');
  const failSafe = new NodeService({ stateDir: dir2 });
  t.after(() => failSafe.close());
  assert.deepEqual([failSafe.health().killed, failSafe.health().level, failSafe.health().failSafe], [true, 'E0', true]);
});

test('Tasker-Befehle: Absender-Policy (E1) und Pruefung durch das Empfaenger-Gate', (t) => {
  const service = new NodeService({ stateDir: stateDir(t) });
  t.after(() => service.close());
  const secret = randomBytes(32);
  const status = service.issueTaskerCommand({ action: 'OMEGA_STATUS', secret });
  assert.equal(status.ok, true);
  assert.equal(service.issueTaskerCommand({ action: 'OMEGA_ADB_ON', params: { minutes: 5 }, secret }).reason, 'approval-required:matrix:E1:reversible');
  const confirmed = service.issueTaskerCommand({ action: 'OMEGA_ADB_ON', params: { minutes: 5 }, secret, confirmed: true });
  assert.equal(confirmed.ok, true);
  assert.equal(service.issueTaskerCommand({ action: 'OMEGA_ADB_ON', params: { minutes: 99 }, secret, confirmed: true }).reason, 'invalid-param:minutes');
  const gate = new TaskerCommandGate({ secret, clock: new HybridLogicalClock({ node: 'android-1' }), fence: new FencedResource(), kernel: new TrustKernel({ level: 'E2' }) });
  for (const issued of [status, confirmed]) {
    assert.equal(gate.admit(fromTaskerHttp(issued.http.body, issued.http.headers['x-omega-mac'])).ok, true);
  }
});

test('Reparatur: Journal in Quarantaene, Replay-Grenze bleibt, Kill-Switch bleibt an', (t) => {
  const { dir, service, emitter } = paired(t);
  const old = emitter.emit('device.usb.connected');
  service.ingest(old);
  service.close();
  const journalPath = join(dir, 'journal', 'events.jsonl');
  writeFileSync(journalPath, readFileSync(journalPath, 'utf8').replace('device.usb.connected', 'device.usb.c0nnected'));
  const broken = new NodeService({ stateDir: dir });
  assert.throws(() => broken.repair(), /Menschen/);
  const result = broken.repair({ confirmedByHuman: true });
  assert.deepEqual(result.repaired, ['journal-quarantined']);
  assert.equal(result.killed, true, 'Kill-Switch bleibt nach der Reparatur an');
  assert.equal(broken.ingest(old).reason, 'replay', 'altes Ereignis bleibt abgewiesen');
  assert.equal(broken.ingest(emitter.emit('device.usb.disconnected')).ok, true);
  broken.close();
  const restarted = new NodeService({ stateDir: dir });
  t.after(() => restarted.close());
  assert.deepEqual(restarted.health().faults, []);
  assert.equal(restarted.ingest(old).reason, 'replay', 'Grenze uebersteht auch den naechsten Neustart');
  assert.deepEqual(restarted.releaseKill({ confirmedByHuman: true }), { killed: false, level: 'E1' });
});

test('Reparatur: defekter Trust-Zustand wird auf E0 mit Kill-Switch gesetzt, dann freigebbar', (t) => {
  const dir = stateDir(t);
  writeFileSync(join(dir, 'trust.json'), '{kaputt');
  const service = new NodeService({ stateDir: dir });
  t.after(() => service.close());
  assert.throws(() => service.releaseKill({ confirmedByHuman: true }), /defekt/);
  assert.deepEqual(service.repair({ confirmedByHuman: true }), { repaired: ['trust-reset-E0-killed'], killed: true, level: 'E0' });
  assert.deepEqual(service.releaseKill({ confirmedByHuman: true }), { killed: false, level: 'E1' });
});

test('Rotations-Grenzen von Peers werden ignoriert (kein Sperren fremder Knoten)', (t) => {
  const { service, emitter, phone } = paired(t);
  const victim = makeNode();
  assert.equal(service.ingest(emitter.emit('journal.rotated', { floor: { [victim.node]: 1_000_000 } })).ok, true);
  service.close();
  const restarted = new NodeService({ stateDir: service.stateDir });
  t.after(() => restarted.close());
  assert.equal(restarted.verifier.snapshot().lastSeq[victim.node], undefined);
  assert.ok(restarted.verifier.snapshot().lastSeq[phone.node] >= 1);
});
