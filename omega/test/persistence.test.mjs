import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  writeJsonAtomic, readJson, TrustKernel, LeaseManager, FencedResource, EventVerifier, EventEmitterNode,
  TaskerCommandGate, HybridLogicalClock, buildTaskerCommand,
} from '../runtime/index.mjs';
import { fakeClock, makeNode } from './helpers/fixtures.mjs';

function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'omega-state-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('Speicher: atomar schreiben, fehlend = undefined, defekt = Fehler', (t) => {
  const dir = tempDir(t);
  const file = join(dir, 'sub', 'state.json');
  assert.deepEqual(readJson(file), { ok: true, value: undefined });
  writeJsonAtomic(file, { a: 1 });
  writeJsonAtomic(file, { a: 2 });
  assert.deepEqual(readJson(file), { ok: true, value: { a: 2 } });
  assert.deepEqual(readdirSync(join(dir, 'sub')), ['state.json'], 'keine Temp-Dateien uebrig');
  if (process.platform !== 'win32') assert.equal(statSync(file).mode & 0o777, 0o600);
  writeFileSync(file, '{kaputt');
  assert.equal(readJson(file).ok, false);
});

test('Kill-Switch ueberlebt einen Neustart', (t) => {
  const file = join(tempDir(t), 'trust.json');
  const kernel = new TrustKernel({ level: 'E3' });
  kernel.engageKillSwitch();
  writeJsonAtomic(file, kernel.snapshot());
  const restarted = TrustKernel.restore(readJson(file).value);
  assert.equal(restarted.killed, true);
  assert.equal(restarted.level, 'E3');
  assert.equal(restarted.failSafe, false);
  assert.equal(restarted.decide({ cls: 'reversible' }).reason, 'kill-switch');
});

test('Trust-Zustand fehlt oder ist defekt: Start auf E0 mit Kill-Switch (fail-safe)', () => {
  for (const snapshot of [undefined, null, {}, { schema: 'omega.trust-state/v1', level: 'E4', killed: false }, { schema: 'x' }]) {
    const kernel = TrustKernel.restore(snapshot);
    assert.equal(kernel.killed, true, JSON.stringify(snapshot));
    assert.equal(kernel.level, 'E0');
    assert.equal(kernel.failSafe, true);
  }
});

test('Leases und Fencing: Tokens bleiben nach Neustart hoeher', () => {
  const now = fakeClock();
  const leases = new LeaseManager({ now });
  const fence = new FencedResource();
  const before = leases.acquire('t', 'win-1', 60_000).lease;
  fence.admit('t', before.fencingToken);
  const leasesAfter = LeaseManager.restore(JSON.parse(JSON.stringify(leases.snapshot())), { now });
  const fenceAfter = FencedResource.restore(JSON.parse(JSON.stringify(fence.snapshot())));
  assert.deepEqual(leasesAfter.check('t', before.fencingToken), { ok: true }, 'aktiver Lease bleibt gueltig');
  assert.equal(leasesAfter.acquire('t', 'android-1', 1_000).reason, 'held');
  now.advance(60_001);
  const next = leasesAfter.acquire('t', 'android-1', 1_000).lease;
  assert.ok(next.fencingToken > before.fencingToken);
  assert.equal(fenceAfter.admit('t', before.fencingToken - 1).reason, 'fenced');
  assert.throws(() => LeaseManager.restore({ schema: 'x' }), /defekt/);
  assert.throws(() => FencedResource.restore({ schema: 'omega.fence-state/v1', highest: { t: -1 } }), /defekt/);
});

test('Leases ohne gespeicherten Zustand: neue Tokens liegen ueber den alten (Uhrzeit-Basis)', () => {
  const now = fakeClock();
  const first = new LeaseManager({ now }).acquire('t', 'win-1', 1_000).lease;
  now.advance(5);
  const afterCrash = new LeaseManager({ now }).acquire('t', 'win-1', 1_000).lease;
  assert.ok(afterCrash.fencingToken > first.fencingToken);
});

test('Replay-Schutz ueberlebt einen Neustart (Ereignisse und Tasker-Befehle)', () => {
  const now = fakeClock();
  const phone = makeNode(now);
  const win = makeNode(now);
  const peers = new Map([[phone.node, phone.publicKey]]);
  const verifier = new EventVerifier({ peers, clock: win.clock });
  const ev = new EventEmitterNode({ clock: phone.clock, privateKey: phone.privateKey }).emit('device.usb.connected');
  assert.equal(verifier.accept(ev).ok, true);
  const restoredVerifier = EventVerifier.restore(JSON.parse(JSON.stringify(verifier.snapshot())), { peers, clock: win.clock });
  assert.equal(restoredVerifier.accept(ev).reason, 'replay');
  assert.throws(() => EventVerifier.restore({ schema: 'x' }, { peers, clock: win.clock }), /defekt/);

  const secret = randomBytes(32);
  const kernel = new TrustKernel({ level: 'E2' });
  const gate = new TaskerCommandGate({ secret, clock: new HybridLogicalClock({ node: 'android-1', now }), fence: new FencedResource(), kernel });
  const lease = new LeaseManager({ now }).acquire('t', 'win-1', 60_000).lease;
  const cmd = buildTaskerCommand({ action: 'OMEGA_STATUS', lease, hlc: new HybridLogicalClock({ node: 'win-1', now }).tick() }, secret);
  assert.equal(gate.admit(cmd).ok, true);
  const state = JSON.parse(JSON.stringify(gate.snapshot()));
  const gateAfter = new TaskerCommandGate({ secret, clock: new HybridLogicalClock({ node: 'android-1', now }), fence: FencedResource.restore(state.fence), kernel });
  gateAfter.restoreState(state);
  assert.equal(gateAfter.admit(cmd).reason, 'replay');
  assert.throws(() => gateAfter.restoreState({ schema: 'omega.gate-state/v1', lastHlc: { 'win-1': 'kaputt' } }));
});
