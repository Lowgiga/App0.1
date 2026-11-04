// omega.task/v1 - Aufgaben nach dem Missionsmodell der App (10 Stufen, 4 Profile).
// Jeder Schreibzugriff (Stufenwechsel) traegt einen gueltigen Fencing-Token (OMG-03).
import { parseHlc, NODE_ID } from './hlc.mjs';
import { CLASSES, CHANGE_KINDS } from './trust-kernel.mjs';

export const TASK_SCHEMA = 'omega.task/v1';
// Spiegel von app/upstream/lib/command-contract.ts (missionStages, stageTransitions) und
// app/upstream/lib/work-constants.ts (agentIds). Drift-Test: test/app-link.test.mjs.
export const MISSION_STAGES = Object.freeze(['Created', 'Planned', 'Assigned', 'Working', 'Waiting', 'Blocked', 'Review', 'Approved', 'Done', 'Error']);
export const STAGE_TRANSITIONS = Object.freeze({
  Created: Object.freeze(['Planned', 'Blocked']),
  Planned: Object.freeze(['Created', 'Assigned', 'Blocked']),
  Assigned: Object.freeze(['Planned', 'Working', 'Blocked']),
  Working: Object.freeze(['Waiting', 'Blocked', 'Review', 'Error']),
  Waiting: Object.freeze(['Working', 'Blocked', 'Review', 'Error']),
  Blocked: Object.freeze(['Planned', 'Assigned', 'Working']),
  Review: Object.freeze(['Working', 'Approved', 'Error']),
  Approved: Object.freeze(['Review', 'Done']),
  Done: Object.freeze(['Review']),
  Error: Object.freeze(['Planned', 'Working', 'Blocked']),
});
export const AGENT_PROFILES = Object.freeze(['zimt', 'manus', 'junior', 'codex']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const KIND = /^[a-z][a-z0-9.-]{0,63}$/;

export function validateTask(task) {
  if (task === null || typeof task !== 'object' || Array.isArray(task)) return 'not-an-object';
  const allowed = new Set(['schema', 'taskId', 'kind', 'cls', 'change', 'risk', 'stage', 'profile', 'createdHlc', 'origin', 'input', 'approvalId']);
  for (const key of Object.keys(task)) if (!allowed.has(key)) return `unknown-field:${key}`;
  if (task.schema !== TASK_SCHEMA) return 'wrong-schema';
  if (typeof task.taskId !== 'string' || task.taskId.length < 1 || task.taskId.length > 128) return 'bad-task-id';
  if (typeof task.kind !== 'string' || !KIND.test(task.kind)) return 'bad-kind';
  if (!CLASSES.includes(task.cls)) return 'bad-class';
  if ((task.cls === 'self-modify') !== (task.change !== undefined)) return 'change-iff-self-modify';
  if (task.change !== undefined && !Object.hasOwn(CHANGE_KINDS, task.change)) return 'bad-change';
  if (!Number.isInteger(task.risk) || task.risk < 1 || task.risk > 10) return 'bad-risk';
  if (!MISSION_STAGES.includes(task.stage)) return 'bad-stage';
  if (!AGENT_PROFILES.includes(task.profile)) return 'bad-profile';
  try {
    parseHlc(task.createdHlc);
  } catch {
    return 'bad-hlc';
  }
  if (typeof task.origin !== 'string' || !NODE_ID.test(task.origin)) return 'bad-origin';
  if (task.input !== undefined && (task.input === null || typeof task.input !== 'object' || Array.isArray(task.input))) return 'bad-input';
  if (task.approvalId !== undefined && !UUID.test(task.approvalId)) return 'bad-approval-id';
  return null;
}

export function canTransition(from, to) {
  return Object.hasOwn(STAGE_TRANSITIONS, from) && STAGE_TRANSITIONS[from].includes(to);
}

/**
 * Stufenwechsel als Schreibzugriff: nur mit gueltigem Lease-Token; 'Approved' (Abgenommen)
 * nur mit verbrauchter menschlicher Freigabe (ApprovalBroker.consume -> 'approved').
 */
export function transitionTask(task, to, { leases, fencingToken, approvals } = {}) {
  const problem = validateTask(task);
  if (problem) throw new TypeError(`omega.task/v1: ${problem}`);
  if (!canTransition(task.stage, to)) throw new RangeError(`omega.task/v1: ${task.stage} -> ${to} nicht erlaubt`);
  const lease = leases.check(task.taskId, fencingToken);
  if (!lease.ok) throw new Error(`omega.task/v1: Lease ${lease.reason}`);
  if (to === 'Approved') {
    if (!task.approvalId) throw new Error('omega.task/v1: Abnahme ohne Freigabe');
    const state = approvals.consume(task.approvalId);
    if (state !== 'approved') throw new Error(`omega.task/v1: Freigabe ${state}`);
  }
  return { ...task, stage: to };
}
