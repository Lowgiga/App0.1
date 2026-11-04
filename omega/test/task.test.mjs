import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  validateTask, canTransition, transitionTask, LeaseManager, ApprovalBroker, HybridLogicalClock, MISSION_STAGES, STAGE_TRANSITIONS,
} from '../runtime/index.mjs';

const node = 'n0123456789abcdef';
const baseTask = (extra = {}) => ({
  schema: 'omega.task/v1', taskId: 'task-1', kind: 'device.mirror', cls: 'observe', risk: 2, stage: 'Working',
  profile: 'codex', createdHlc: new HybridLogicalClock({ node }).tick(), origin: node, ...extra,
});

test('Task: Validierung inkl. Kopplung von self-modify und change', () => {
  assert.equal(validateTask(baseTask()), null);
  assert.equal(validateTask(baseTask({ stage: 'Fertig' })), 'bad-stage');
  assert.equal(validateTask(baseTask({ profile: 'gpt' })), 'bad-profile');
  assert.equal(validateTask(baseTask({ cls: 'self-modify' })), 'change-iff-self-modify');
  assert.equal(validateTask(baseTask({ change: 'config' })), 'change-iff-self-modify');
  assert.equal(validateTask(baseTask({ cls: 'self-modify', change: 'config' })), null);
  assert.equal(validateTask(baseTask({ lease: {} })), 'unknown-field:lease');
});

test('Task: Uebergaenge genau wie in der App', () => {
  assert.equal(MISSION_STAGES.length, 10);
  assert.equal(canTransition('Working', 'Review'), true);
  assert.equal(canTransition('Created', 'Done'), false);
  assert.equal(canTransition('toString', 'Done'), false);
  for (const [from, targets] of Object.entries(STAGE_TRANSITIONS)) {
    for (const to of targets) assert.ok(MISSION_STAGES.includes(to), `${from} -> ${to}`);
  }
});

test('Task: jeder Stufenwechsel braucht den aktuellen Fencing-Token', () => {
  const leases = new LeaseManager();
  const { lease } = leases.acquire('task-1', node, 60_000);
  const task = baseTask();
  assert.equal(transitionTask(task, 'Review', { leases, fencingToken: lease.fencingToken }).stage, 'Review');
  assert.throws(() => transitionTask(task, 'Done', { leases, fencingToken: lease.fencingToken }), /nicht erlaubt/);
  assert.throws(() => transitionTask(task, 'Review', { leases, fencingToken: lease.fencingToken - 1 }), /stale-token/);
  leases.revokeAll();
  assert.throws(() => transitionTask(task, 'Review', { leases, fencingToken: lease.fencingToken }), /no-lease/);
});

test('Task: Abnahme nur mit verbrauchter menschlicher Freigabe, genau einmal', () => {
  const leases = new LeaseManager();
  const approvals = new ApprovalBroker();
  const { lease } = leases.acquire('task-1', node, 60_000);
  const opts = { leases, fencingToken: lease.fencingToken, approvals };
  assert.throws(() => transitionTask(baseTask({ stage: 'Review' }), 'Approved', opts), /ohne Freigabe/);
  const approvalId = approvals.request({ subject: 'task-1' });
  const review = baseTask({ stage: 'Review', approvalId });
  assert.throws(() => transitionTask(review, 'Approved', opts), /pending/);
  approvals.resolve(approvalId, 'approve', 'lowgiga');
  assert.equal(transitionTask(review, 'Approved', opts).stage, 'Approved');
  assert.throws(() => transitionTask(review, 'Approved', opts), /consumed/);
  assert.throws(() => transitionTask(baseTask({ stage: 'Review', approvalId: randomUUID() }), 'Approved', opts), /unknown/);
});
