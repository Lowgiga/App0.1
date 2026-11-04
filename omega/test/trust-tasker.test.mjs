import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  TrustKernel, ApprovalBroker, LEVELS, GRANTABLE_LEVELS, CHANGE_KINDS, HybridLogicalClock, LeaseManager, FencedResource,
  TASKER_ACTIONS, validateTaskerParams, buildTaskerCommand, TaskerCommandGate,
  generateNodeKeys, changeDigest, createOwnerApproval, verifyOwnerApproval,
} from '../runtime/index.mjs';
import { fakeClock } from './helpers/fixtures.mjs';

test('Trust Kernel: irreversible Aktionen brauchen auf jeder Stufe eine Freigabe', () => {
  const kernel = new TrustKernel();
  for (const level of GRANTABLE_LEVELS) {
    kernel.setLevel(level);
    const { verdict } = kernel.decide({ cls: 'irreversible' });
    assert.ok(verdict === 'approve' || verdict === 'deny', `${level}: ${verdict}`);
    assert.equal(kernel.decide({ cls: 'safety' }).verdict, 'allow');
    assert.equal(kernel.decide({ cls: 'observe' }).verdict, 'allow');
  }
});

test('Trust Kernel: E4 ist nie als Autonomiestufe setzbar (docs/31)', () => {
  assert.deepEqual(LEVELS, ['E0', 'E1', 'E2', 'E3', 'E4']);
  assert.throws(() => new TrustKernel({ level: 'E4' }), /nie autonom/);
  assert.throws(() => new TrustKernel().setLevel('E9'), /unbekannt/);
});

test('Trust Kernel: Aktionsmatrix und Risiko-Eskalation', () => {
  const kernel = new TrustKernel({ level: 'E0' });
  assert.equal(kernel.decide({ cls: 'reversible' }).verdict, 'deny');
  kernel.setLevel('E1');
  assert.equal(kernel.decide({ cls: 'reversible' }).verdict, 'approve');
  kernel.setLevel('E2');
  assert.equal(kernel.decide({ cls: 'reversible' }).verdict, 'allow');
  assert.equal(kernel.decide({ cls: 'reversible', risk: 9 }).reason, 'high-risk-escalation');
  assert.equal(kernel.decide({ cls: 'sensitive' }).verdict, 'approve');
  kernel.setLevel('E3');
  assert.equal(kernel.decide({ cls: 'sensitive' }).verdict, 'allow');
  assert.equal(kernel.decide({ cls: 'unbekannt' }).verdict, 'deny');
  assert.equal(kernel.decide({ cls: 'observe', risk: 11 }).reason, 'bad-risk');
});

test('Trust Kernel: Selbstentwicklung nach Art der Aenderung und Nachweisen', () => {
  const kernel = new TrustKernel({ level: 'E2' });
  const e2 = { testsPassed: true, independentReview: true };
  const e3 = { ...e2, canaryPassed: true, rollbackReady: true };
  assert.equal(kernel.decide({ cls: 'self-modify', change: 'proposal', evidence: { sandboxed: true } }).verdict, 'allow');
  assert.equal(kernel.decide({ cls: 'self-modify', change: 'proposal' }).reason, 'evidence-missing:sandboxed');
  assert.equal(kernel.decide({ cls: 'self-modify', change: 'prompt', evidence: e2 }).verdict, 'allow');
  assert.equal(kernel.decide({ cls: 'self-modify', change: 'config', evidence: { testsPassed: true } }).reason, 'evidence-missing:independentReview');
  assert.equal(kernel.decide({ cls: 'self-modify', change: 'adapter', evidence: e2 }).reason, 'evidence-missing:canaryPassed,rollbackReady');
  assert.deepEqual(kernel.decide({ cls: 'self-modify', change: 'adapter', evidence: e3 }), { verdict: 'approve', reason: 'above-level:E3', stage: 'E3' });
  kernel.setLevel('E3');
  assert.equal(kernel.decide({ cls: 'self-modify', change: 'module', evidence: e3 }).verdict, 'allow');
  for (const change of ['trust-kernel', 'policy']) {
    assert.equal(kernel.decide({ cls: 'self-modify', change, evidence: e3 }).verdict, 'owner-signature');
  }
  assert.equal(kernel.decide({ cls: 'self-modify', change: 'toString' }).reason, 'unknown-change');
  assert.equal(kernel.decide({ cls: 'self-modify' }).reason, 'unknown-change');
  assert.deepEqual(Object.values(CHANGE_KINDS).filter((s) => s === 'E4').length, 2);
});

test('Eigentuemer-Freigabe (E4): an Inhalt gebunden, mit Ablauf, nur gueltige Signatur', () => {
  const owner = generateNodeKeys();
  const digest = changeDigest('policy: allow everything');
  const approval = createOwnerApproval({ change: 'policy', digest, expiresAt: Date.now() + 60_000 }, owner.privateKey);
  const opts = { ownerPublicKey: owner.publicKey, change: 'policy', digest };
  assert.deepEqual(verifyOwnerApproval(approval, opts), { ok: true });
  assert.equal(verifyOwnerApproval(approval, { ...opts, digest: changeDigest('anderer Inhalt') }).reason, 'digest-mismatch');
  assert.equal(verifyOwnerApproval(approval, { ...opts, change: 'trust-kernel' }).reason, 'wrong-change');
  assert.equal(verifyOwnerApproval(approval, { ...opts, now: approval.expiresAt }).reason, 'expired');
  assert.equal(verifyOwnerApproval(approval, { ...opts, ownerPublicKey: generateNodeKeys().publicKey }).reason, 'bad-signature');
  assert.throws(() => createOwnerApproval({ change: 'config', digest, expiresAt: 1 }, owner.privateKey));
});

test('Kill-Switch: blockiert alles ausser Sicherheit/Beobachtung, Freigabe nur durch Menschen', () => {
  const kernel = new TrustKernel({ level: 'E3' });
  kernel.engageKillSwitch();
  assert.equal(kernel.decide({ cls: 'reversible' }).reason, 'kill-switch');
  assert.equal(kernel.decide({ cls: 'self-modify', change: 'proposal', evidence: { sandboxed: true } }).reason, 'kill-switch');
  assert.equal(kernel.decide({ cls: 'safety' }).verdict, 'allow');
  assert.equal(kernel.decide({ cls: 'observe' }).verdict, 'allow');
  assert.throws(() => kernel.releaseKillSwitch());
  kernel.releaseKillSwitch({ confirmedByHuman: true });
  assert.equal(kernel.level, 'E1', 'nach dem Kill-Switch zurueck auf E1');
});

test('ApprovalBroker: Schweigen = Ablehnung, einmalig, begrenzt, bereinigt', () => {
  const now = fakeClock();
  const broker = new ApprovalBroker({ now, maxPending: 2, retentionMs: 1_000 });
  const silent = broker.request({ subject: 'x', ttlMs: 5_000 });
  now.advance(5_001);
  assert.equal(broker.consume(silent), 'expired');
  assert.equal(broker.resolve(silent, 'approve', 'du'), false);
  const ok = broker.request({ subject: 'y', ttlMs: 5_000 });
  assert.equal(broker.consume(ok), 'pending');
  assert.equal(broker.resolve(ok, 'approve', 'du'), true);
  assert.equal(broker.consume(ok), 'approved');
  assert.equal(broker.consume(ok), 'consumed');
  const a = broker.request({ subject: 'a' });
  broker.request({ subject: 'b' });
  assert.throws(() => broker.request({ subject: 'c' }), /zu viele/);
  broker.resolve(a, 'reject', 'du');
  assert.equal(broker.consume(a), 'rejected');
  assert.equal(broker.consume('gibt-es-nicht'), 'unknown');
  assert.throws(() => broker.request({ subject: 'a', ttlMs: 10 }));
  assert.throws(() => broker.resolve(a, 'vielleicht', 'du'));
  now.advance(1_001);
  assert.equal(broker.sweep(), 3);
  assert.equal(broker.peek(ok), undefined);
});

test('Tasker-Allowlist: nur OMEGA_-Tasks, strikte Parameter', () => {
  assert.ok(Object.keys(TASKER_ACTIONS).every((name) => name.startsWith('OMEGA_')));
  assert.equal(validateTaskerParams('OMEGA_ADB_ON', { minutes: 10 }), null);
  assert.equal(validateTaskerParams('OMEGA_ADB_ON', { minutes: 31 }), 'invalid-param:minutes');
  assert.equal(validateTaskerParams('OMEGA_ADB_ON', {}), 'missing-param:minutes');
  assert.equal(validateTaskerParams('OMEGA_ADB_ON', { minutes: 5, cmd: 'rm -rf /' }), 'unknown-param:cmd');
  assert.equal(validateTaskerParams('RUN_SHELL', {}), 'action-not-allowlisted');
  assert.equal(validateTaskerParams('OMEGA_NOTIFY', { title: 'a\u0000', text: 'b' }), 'invalid-param:title');
  assert.equal(validateTaskerParams('toString', {}), 'action-not-allowlisted');
});

function setup(level = 'E2') {
  const now = fakeClock();
  const secret = randomBytes(32);
  const leases = new LeaseManager({ now });
  const sender = new HybridLogicalClock({ node: 'win-1', now });
  const kernel = new TrustKernel({ level });
  const gate = new TaskerCommandGate({
    secret, clock: new HybridLogicalClock({ node: 'android-1', now }), fence: new FencedResource(), kernel,
  });
  return { now, secret, leases, sender, kernel, gate };
}

test('Tasker-Gate: gueltiger Befehl passiert, Manipulation/Replay/Fencing nicht', () => {
  const { secret, leases, sender, gate } = setup();
  const lease1 = leases.acquire('adb', 'win-1', 60_000).lease;
  const cmd = buildTaskerCommand({ action: 'OMEGA_ADB_ON', params: { minutes: 10 }, lease: lease1, hlc: sender.tick() }, secret);
  assert.equal(cmd.leaseExpiresAt, lease1.expiresAt);
  assert.equal(gate.admit(cmd).ok, true);
  assert.equal(gate.admit(cmd).reason, 'replay');
  const tampered = buildTaskerCommand({ action: 'OMEGA_ADB_ON', params: { minutes: 10 }, lease: lease1, hlc: sender.tick() }, secret);
  assert.equal(gate.admit({ ...tampered, params: { minutes: 30 } }).reason, 'bad-mac');
  assert.equal(gate.admit({ ...tampered, leaseExpiresAt: tampered.leaseExpiresAt + 3_600_000 }).reason, 'bad-mac');
  const foreign = buildTaskerCommand({ action: 'OMEGA_STATUS', lease: lease1, hlc: sender.tick() }, randomBytes(32));
  assert.equal(gate.admit(foreign).reason, 'bad-mac');
  leases.revokeAll();
  const lease2 = leases.acquire('adb', 'win-1', 60_000).lease;
  assert.equal(gate.admit(buildTaskerCommand({ action: 'OMEGA_STATUS', lease: lease2, hlc: sender.tick() }, secret)).ok, true);
  const stale = buildTaskerCommand({ action: 'OMEGA_STATUS', lease: lease1, hlc: sender.tick() }, secret);
  assert.equal(gate.admit(stale).reason, 'fenced');
  assert.equal(gate.admit({ ...stale, extra: 1 }).reason, 'unknown-field:extra');
  assert.throws(() => buildTaskerCommand({ action: 'RUN_SHELL', lease: lease2, hlc: sender.tick() }, secret));
});

test('Tasker-Gate: abgelaufener Lease wird abgewiesen', () => {
  const { now, secret, leases, sender, gate } = setup();
  const lease = leases.acquire('t', 'win-1', 5_000).lease;
  const cmd = buildTaskerCommand({ action: 'OMEGA_STATUS', lease, hlc: sender.tick() }, secret);
  now.advance(5_000);
  assert.equal(gate.admit(cmd).reason, 'lease-expired');
});

test('Tasker-Gate: Replay-Schutz je Absender (zwei Knoten mit versetzten Uhren)', () => {
  const { now, secret, leases, gate } = setup();
  const fast = new HybridLogicalClock({ node: 'win-1', now: () => now() + 30_000 });
  const slow = new HybridLogicalClock({ node: 'relay-1', now });
  const lease = leases.acquire('t', 'win-1', 60_000).lease;
  assert.equal(gate.admit(buildTaskerCommand({ action: 'OMEGA_STATUS', lease, hlc: fast.tick() }, secret)).ok, true);
  assert.equal(gate.admit(buildTaskerCommand({ action: 'OMEGA_STATUS', lease, hlc: slow.tick() }, secret)).ok, true,
    'ein Absender mit spaeterer Uhr blockiert keinen anderen');
});

test('Tasker-Gate: Kill-Switch laesst nur Sicherheitsbefehle durch', () => {
  const { secret, leases, sender, kernel, gate } = setup('E3');
  const lease = leases.acquire('dev', 'win-1', 60_000).lease;
  kernel.engageKillSwitch();
  const on = buildTaskerCommand({ action: 'OMEGA_ADB_ON', params: { minutes: 5 }, lease, hlc: sender.tick() }, secret);
  assert.equal(gate.admit(on).reason, 'kill-switch');
  const off = buildTaskerCommand({ action: 'OMEGA_ADB_OFF', lease, hlc: sender.tick() }, secret);
  assert.equal(gate.admit(off).ok, true);
  const approval = buildTaskerCommand({
    action: 'OMEGA_SCENE_APPROVAL',
    params: { approvalId: randomUUID(), title: 'Swap', summary: '0,5 ETH -> USDC', risk: 7, timeoutSec: 60 },
    lease,
    hlc: sender.tick(),
  }, secret);
  assert.equal(gate.admit(approval).reason, 'kill-switch');
});

test('Tasker-Gate: hohes Risiko eskaliert zur Freigabe', () => {
  const { secret, leases, sender, gate } = setup('E3');
  const lease = leases.acquire('n', 'win-1', 60_000).lease;
  const cmd = buildTaskerCommand({ action: 'OMEGA_NOTIFY', params: { title: 'HF', text: 'Health Factor 1,25' }, lease, hlc: sender.tick() }, secret);
  const res = gate.admit(cmd, { risk: 9 });
  assert.equal(res.ok, true);
  assert.equal(res.verdict, 'approve');
});
