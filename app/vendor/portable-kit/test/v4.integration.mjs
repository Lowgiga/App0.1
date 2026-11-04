import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { exportBackup, importBackup, prepareRestore } from '../backup.mjs';
import { makeV4Validator } from '../examples/v4-adapter.mjs';

if (!process.env.MESH_V4_ROOT) throw new Error('Run node examples/verify-v4.mjs /absolute/path/to/v4-checkout');
const fromApp = file => import(pathToFileURL(path.join(process.env.MESH_V4_ROOT, 'lib', file)).href);
const { emptyWork, savedWorkContract } = await fromApp('work-contract.ts');
const { encodeSnapshot } = await fromApp('work-snapshots.ts');
const { workReferenceErrors } = await fromApp('work-updates.ts');
const { calculateNeuroScore } = await fromApp('neuro.ts');
const at = '2026-09-30T10:00:00.000Z';
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const validateWork = makeV4Validator({ savedWorkContract, workReferenceErrors, knownSourceIds: ['fixture-source'] });
const options = { validateWork };
const meta = { exportedAt: '2026-09-30T12:00:00.000Z', producer: { name: 'V4 read-only integration fixture', version: '0.1.0' }, source: { revision: 'fixture-only-v4', workUpdatedAt: at } };
function fixture() {
  const work = emptyWork();
  work.updatedAt = at;
  work.checks = { baseline: true, schema: false, unknown: true, env: false, paper: true, tests: true };
  work.notes = [{ id: uuid(1), text: 'Vollständig: Grüße 👩🏽‍💻 漢字 e\u0301', createdAt: at }];
  work.settings = { ...work.settings, theme: 'dark', density: 'compact', fontScale: 115, startView: 'intelligence', widgets: ['queue', 'metrics'], showSourceBanner: false, motion: 'off', powerSaver: true, chatMode: 'RESEARCH COUNCIL', chatContext: 'all', citeSources: false, neuro: { mode: 'focus', focusMissionId: uuid(3), autoPriority: true, autoConsole: false, alertThreshold: 90, signalMotion: false, progressSort: 'meaning' } };
  work.profiles = work.profiles.map((profile, i) => ({ ...profile, role: `Synthetic role ${i}`, instructions: `Fixture-only instructions ${i}`, output: `Fixture output ${i}`, maxDelegation: i % 3, callBudget: 11 + i, timeBudget: 31 + i }));
  work.rooms = [{ id: uuid(2), title: 'Synthetic mission room', agent: 'manus', project: 'cue', mode: 'BUILD', goal: 'Check all JSON fields', output: 'Historical fixture result', sources: ['fixture-source'], status: 'Archiviert', messages: [{ id: uuid(20), kind: 'Rückmeldung', text: 'Synthetic reviewed history', createdAt: at }], createdAt: at }];
  work.tasks = work.tasks.map((task, index) => index < 2 ? { ...task, status: 'Erledigt', reviewed: true, evidence: 'Documented synthetic acceptance evidence', dependencies: index ? [work.tasks[0].id] : [], archived: index === 1 } : task);
  work.learning = { evidence: true, handoff: false, baseline: true, automation: false, review: true };
  work.command.missions = [{ id: uuid(3), title: 'Historical full-field mission', goal: 'Preserve the historical source state', scope: 'Synthetic JSON fixture only', project: 'cue', owner: 'manus', reviewer: 'junior', stage: 'Done', priority: 'P1', output: 'Completed synthetic result', taskIds: work.tasks.slice(0, 2).map(task => task.id), roomId: uuid(2), sourceIds: ['fixture-source'], evidence: 'Documented independent synthetic review', reviewed: true, checkpoint: 'Preserve this original review checkpoint', archived: true, createdAt: at, deadlineAt: '2026-10-01T12:00:00.000Z', neuro_profile: calculateNeuroScore({ kind: 'mission', stage: 'Done', priority: 'P1' }) }];
  work.command.approvals = [{ id: uuid(4), missionId: uuid(3), action: 'Historical synthetic decision', target: 'Synthetic fixture target', dataSummary: 'Only synthetic data', reason: 'Preserve this historical decision exactly', expectedResult: 'No action performed', risk: 'medium', reversibility: 'yes', impact: 'Synthetic fixture only', testEvidence: 'Documented synthetic test evidence', rollback: 'No operation was performed', createdAt: at, expiresAt: '2026-10-01T12:00:00.000Z', status: 'approved', scope: 'once', decidedAt: '2026-09-30T10:01:00.000Z', decisionNote: 'Historical only; never a new permission', executed: false }];
  work.command.events = [{ id: uuid(5), sequence: 7, at, origin: 'app', entityId: uuid(3), kind: 'mission-stage', title: 'Synthetic mission completed', neuro_context: { stage: 'Done', priority: 'P1' }, neuro_profile: calculateNeuroScore({ kind: 'mission-stage', stage: 'Done', priority: 'P1' }) }, { id: uuid(6), sequence: 8, at, origin: 'app', entityId: uuid(4), kind: 'approval-decided', title: 'Synthetic decision recorded', neuro_context: { risk: 'medium', decision: 'approved' }, neuro_profile: calculateNeuroScore({ kind: 'approval-decided', risk: 'medium', decision: 'approved' }) }];
  work.command.interactions = [{ id: uuid(7), at, kind: 'risk-accepted', missionId: uuid(3), sourceId: `mission:${uuid(3)}`, fingerprint: 'synthetic-historical-fingerprint', reason: 'Historical fixture risk acceptance', taskId: null, requestId: uuid(8), requestFingerprint: 'synthetic-request-fingerprint' }];
  const normalized = savedWorkContract.parse(work);
  const data = { schemaVersion: 1, updatedAt: at, sources: [{ id: 'fixture-source', title: 'Synthetic only', file: 'fixture.md' }], agents: [{ id: 'manus', role: 'Synthetic builder' }], unknownFutureSourceField: { copiedExactly: true, list: [1, '😀', null] } };
  return { work: normalized, data };
}

test('real V4 full-field state and all supplied source JSON roundtrip without any loss', async () => {
  const state = fixture(), before = structuredClone(state);
  assert.equal(validateWork(state.work).success, true);
  assert.deepEqual(workReferenceErrors(state.work, ['fixture-source']), []);
  const oldSnapshot = encodeSnapshot(state.work, state.data, new Date(meta.exportedAt));
  const text = await exportBackup({ work: oldSnapshot.work, data: oldSnapshot.data }, meta, options);
  const result = await importBackup(text, options);
  assert.deepEqual(result.snapshot, before);
  for (const field of ['checks', 'notes', 'settings', 'profiles', 'rooms', 'tasks', 'learning', 'command', 'updatedAt', 'stateVersion']) assert.deepEqual(result.snapshot.work[field], before.work[field]);
  assert.equal(result.normalizationDetected, false);
  assert.deepEqual(state, before);
});

test('historical approved decisions, reviews, events and interactions remain inert and unchanged', async () => {
  const state = fixture(), text = await exportBackup(state, meta, options);
  const result = await importBackup(text, options), plan = await prepareRestore(text, null, options);
  assert.deepEqual(result.snapshot.work.command, state.work.command);
  assert.equal(result.snapshot.work.command.missions[0].stage, 'Done');
  assert.equal(result.snapshot.work.command.missions[0].reviewed, true);
  assert.equal(result.snapshot.work.command.approvals[0].status, 'approved');
  assert.equal(result.snapshot.work.command.approvals[0].executed, false);
  assert.equal(result.externalActionsAuthorized, false);
  assert.equal(plan.externalActionsAuthorized, false);
  assert.deepEqual(plan.writes, []);
});

test('real contract rejects invalid mission review and unknown nested fields', async () => {
  for (const mutate of [s => s.work.command.missions[0].reviewed = false, s => s.work.settings.liveSync = true, s => s.work.command.approvals[0].executed = true]) {
    const state = fixture(); mutate(state);
    await assert.rejects(exportBackup(state, meta, options), error => error.code === 'VALIDATION_FAILED');
  }
});

test('reference adapter rejects a missing source even though savedWorkContract accepts it', async () => {
  const state = fixture(); state.work.command.missions[0].sourceIds = ['absent-source'];
  assert.equal(savedWorkContract.safeParse(state.work).success, true);
  await assert.rejects(exportBackup(state, meta, options), error => error.code === 'VALIDATION_FAILED');
});

test('real V4 derived neuro changes and accepted defaults are reported without rewriting history', async () => {
  const state = fixture(); state.work.command.missions[0].neuro_profile.dopamine = 1; delete state.work.settings.neuro.autoConsole;
  assert.equal(savedWorkContract.safeParse(state.work).success, true);
  const result = await importBackup(await exportBackup(state, meta, options), options);
  assert.equal(result.normalizationDetected, true);
  assert.deepEqual(result.snapshot, state);
  assert.equal(result.snapshot.work.command.missions[0].neuro_profile.dopamine, 1);
  assert.equal(Object.hasOwn(result.snapshot.work.settings.neuro, 'autoConsole'), false);
});

test('existing V4 state conflicts remain visible and existing decisions are never modified', async () => {
  const incoming = fixture(), current = fixture();
  current.work.settings.theme = 'light'; current.work.command.approvals[0].decisionNote = 'Keep the original local decision note';
  const original = structuredClone(current);
  const plan = await prepareRestore(await exportBackup(incoming, meta, options), current, options);
  assert.equal(plan.targetState, 'different');
  assert.ok(plan.conflicts.some(x => x.path === '/work/command/approvals/0/decisionNote'));
  assert.ok(plan.conflicts.some(x => x.path === '/work/settings/theme'));
  assert.deepEqual(current, original);
});
