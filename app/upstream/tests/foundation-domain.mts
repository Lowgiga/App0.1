import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyWork, savedWorkContract, workContract } from '../lib/work-contract.ts';
import { approvalContract, approvalState, commandContract, type Mission, type Approval } from '../lib/command-contract.ts';
import { workChangeErrors, workReferenceErrors, withAppEvents, withCanonicalDecisionTimes } from '../lib/work-updates.ts';
import { decodeSnapshot, encodeSnapshot, mergeSnapshot } from '../lib/work-snapshots.ts';
import { calculateNeuroScore } from '../lib/neuro.ts';
import { createId } from '../lib/ids.ts';

const now = new Date('2026-09-30T09:00:00Z');
const sources = ['cue-init', 'make-direct'];
const mission = (changes: Partial<Mission> = {}): Mission => ({
  id: crypto.randomUUID(), title: 'Foundation acceptance', goal: 'Verify the own app data model', scope: 'Local draft and validation', project: 'cue', owner: 'manus', reviewer: 'junior', stage: 'Created', priority: 'P1', output: 'Findings and checkpoint', taskIds: [], roomId: null, sourceIds: ['cue-init'], evidence: '', reviewed: false, checkpoint: '', archived: false, createdAt: now.toISOString(), deadlineAt:null,neuro_profile:calculateNeuroScore({kind:'mission',stage:'Created',priority:'P1'}), ...changes,
});
const approval = (changes: Partial<Approval> = {}): Approval => ({
  id: crypto.randomUUID(), missionId: null, action: 'Review private app change', target: 'Own app project', dataSummary: 'Own source and test result', reason: 'Document a concrete decision', expectedResult: 'Recorded approval only', risk: 'medium', reversibility: 'yes', impact: 'Own workspace only', testEvidence: 'Local domain tests executed', rollback: 'Restore previous own version', createdAt: now.toISOString(), expiresAt: '2026-10-01T09:00:00Z', status: 'pending', scope: 'once', decidedAt: null, decisionNote: '', executed: false, ...changes,
});
const stateWith = (m: Mission) => { const s = emptyWork(); s.command.missions = [m]; return s; };
test('HTTP-preview UUID fallback keeps version-4 format and unique identifiers', () => {
  const source = { getRandomValues: crypto.getRandomValues.bind(crypto) };
  const a = createId(source), b = createId(source);
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(a, b);
});

test('legacy saved records gain isolated empty command defaults and version 4', () => {
  const old = { checks: {}, notes: [], updatedAt: null };
  const first = savedWorkContract.parse(old), second = savedWorkContract.parse(old);
  assert.equal(first.stateVersion, 4); assert.equal(first.profiles.length, 4);
  first.command.missions.push(mission()); assert.equal(second.command.missions.length, 0);
});
test('future state versions and unknown nested fields are rejected', () => {
  assert.equal(savedWorkContract.safeParse({ ...emptyWork(), stateVersion: 5 }).success, false);
  assert.equal(commandContract.safeParse({ ...emptyWork().command, liveConnected: true }).success, false);
  assert.equal(approvalContract.safeParse({ ...approval(), executed: true }).success, false);
});
test('legacy PUT remains supported without command fields', () => {
  assert.equal(workContract.safeParse({ checks: {}, notes: [], expectedUpdatedAt: null }).success, true);
});
test('unknown mission task, room and source references are rejected', () => {
  const s = stateWith(mission({ taskIds: ['absent'], roomId: crypto.randomUUID(), sourceIds: ['absent'] }));
  assert.equal(workReferenceErrors(s, sources).length, 3);
});
test('new missions cannot bypass the Created phase', () => {
  const next = stateWith(mission({ stage: 'Working' }));
  assert.ok(workChangeErrors(emptyWork(), next, now, sources).some(s => s.includes('beginnt')));
});
test('legal phase changes are accepted and illegal jumps rejected', () => {
  const old = stateWith(mission()); const next = structuredClone(old); next.command.missions[0].stage = 'Planned';
  assert.deepEqual(workChangeErrors(old, next, now, sources), []);
  next.command.missions[0].stage = 'Done'; assert.ok(workChangeErrors(old, next, now, sources).length);
});
test('approval and completion require proof and independent review', () => {
  for (const changes of [{ stage: 'Done' }, { stage: 'Approved', reviewed: true, evidence: 'Confirmed local review', reviewer: 'manus' }]) {
    assert.equal(savedWorkContract.safeParse(stateWith(mission(changes as Partial<Mission>))).success, false);
  }
});
test('changing a task prerequisite cannot leave a mission completed', () => {
  const m = mission({ stage: 'Done', reviewed: true, evidence: 'Independent test result documented', taskIds: ['tune-controls'] });
  const old = stateWith(m); old.tasks[0] = { ...old.tasks[0], status: 'Erledigt', reviewed: true, evidence: 'Concrete local acceptance test' };
  const next = structuredClone(old); next.tasks[0].status = 'Offen';
  assert.ok(workChangeErrors(old, next, now, sources).some(s => s.includes('abgeschlossen')));
});
test('closed mission content must return to review before editing', () => {
  const old = stateWith(mission({ stage: 'Done', reviewed: true, evidence: 'Documented independent findings' }));
  const next = structuredClone(old); next.command.missions[0].goal = 'Different goal after completion';
  assert.ok(workChangeErrors(old, next, now, sources).some(s => s.includes('inhaltlichen')));
  next.command.missions[0].stage = 'Review'; next.command.missions[0].reviewed = false;
  assert.deepEqual(workChangeErrors(old, next, now, sources), []);
});
test('completed mission review binds task acceptance evidence and dependencies', () => {
  const old = stateWith(mission({ stage: 'Done', reviewed: true, evidence: 'Documented independent findings', taskIds: ['tune-controls'] }));
  old.tasks[0] = { ...old.tasks[0], status: 'Erledigt', reviewed: true, evidence: 'Concrete acceptance check' };
  const next = structuredClone(old); next.tasks[0].acceptance = 'Entirely different acceptance criteria';
  assert.ok(workChangeErrors(old, next, now, sources).some(s => s.includes('abnahmerelevante')));
  next.command.missions[0].stage = 'Review'; next.command.missions[0].reviewed = false;
  assert.deepEqual(workChangeErrors(old, next, now, sources), []);
});
test('expired pending request may be declined without extending validity', () => {
  const old = emptyWork(); old.command.approvals = [approval({ createdAt: '2026-09-29T09:00:00Z', expiresAt: '2026-09-30T08:00:00Z' })];
  const next = structuredClone(old); next.command.approvals[0].status = 'denied'; next.command.approvals[0].decidedAt = now.toISOString();
  assert.equal(savedWorkContract.safeParse(next).success, true);
  assert.deepEqual(workChangeErrors(old, next, now, sources), []);
});
test('completed mission protects transitive prerequisite proof until review reopens', () => {
  const old = emptyWork();
  for (let i = 0; i < 3; i++) old.tasks[i] = { ...old.tasks[i], status: 'Erledigt', reviewed: true, evidence: 'Concrete accepted prerequisite proof', dependencies: i < 2 ? [old.tasks[i + 1].id] : [] };
  old.command.missions = [mission({ stage: 'Done', reviewed: true, evidence: 'Documented independent findings', taskIds: [old.tasks[0].id] })];
  assert.equal(savedWorkContract.safeParse(old).success, true);
  const next = structuredClone(old); next.tasks[2].evidence = 'Replacement evidence after completion';
  assert.ok(workChangeErrors(old, next, now, sources).some(s => s.includes('abnahmerelevante')));
  next.command.missions[0].stage = 'Review'; next.command.missions[0].reviewed = false;
  assert.deepEqual(workChangeErrors(old, next, now, sources), []);
});
test('pending mission approval prevents completion', () => {
  const s = stateWith(mission({ stage: 'Done', reviewed: true, evidence: 'Documented independent findings' }));
  s.command.approvals = [approval({ missionId: s.command.missions[0].id })];
  assert.equal(savedWorkContract.safeParse(s).success, false);
});
test('decision is bound to immutable content and cannot be created as approved', () => {
  const old = emptyWork(); old.command.approvals = [approval()];
  const next = structuredClone(old); next.command.approvals[0].status = 'approved'; next.command.approvals[0].decidedAt = now.toISOString();
  assert.deepEqual(workChangeErrors(old, next, now, sources), []);
  next.command.approvals[0].target = 'Changed target'; assert.ok(workChangeErrors(old, next, now, sources).length);
  assert.ok(workChangeErrors(emptyWork(), next, now, sources).some(s => s.includes('offene Anfrage')));
});
test('closed decision cannot be altered or removed', () => {
  const old = emptyWork(); old.command.approvals = [approval({ status: 'denied', decidedAt: now.toISOString() })];
  const next = structuredClone(old); next.command.approvals[0].reason = 'Changed purpose';
  assert.ok(workChangeErrors(old, next, now, sources).some(s => s.includes('unveränderlich')));
  next.command.approvals = []; assert.ok(workChangeErrors(old, next, now, sources).length);
});
test('expired request cannot be approved using a backdated client decision', () => {
  const old = emptyWork(); old.command.approvals = [approval({ createdAt: '2026-09-29T09:00:00Z', expiresAt: '2026-09-30T08:00:00Z' })];
  const next = structuredClone(old); next.command.approvals[0].status = 'approved'; next.command.approvals[0].decidedAt = '2026-09-29T10:00:00Z';
  const canonical = withCanonicalDecisionTimes(old, next, now);
  assert.equal(canonical.command.approvals[0].decidedAt, now.toISOString());
  assert.ok(workChangeErrors(old, canonical, now, sources).some(s => s.includes('abgelaufen')));
  assert.equal(approvalState(old.command.approvals[0], now.getTime()), 'expired');
});
test('app event timestamps, sequence and provenance derive from accepted changes', () => {
  const old = emptyWork(), next = stateWith(mission());
  const result = withAppEvents(old, next, now);
  assert.equal(result.command.events.length, 1); assert.equal(result.command.events[0].sequence, 1);
  assert.equal(result.command.events[0].origin, 'app'); assert.equal(result.command.events[0].at, now.toISOString());
  const next2 = structuredClone(result); next2.command.missions[0].stage = 'Planned';
  assert.equal(withAppEvents(result, next2, now).command.events.at(-1)?.sequence, 2);
});
test('client cannot insert or reset canonical events', () => {
  const old = withAppEvents(emptyWork(), stateWith(mission()), now); const next = structuredClone(old); next.command.events = [];
  assert.ok(workChangeErrors(old, next, now, sources).some(s => s.includes('Server')));
});
test('event limit preserves monotonic sequence after rotation', () => {
  let old = emptyWork();
  for (let i = 0; i < 205; i++) { const next = structuredClone(old); next.checks.baseline = i % 2 === 0; old = withAppEvents(old, next, now); }
  assert.equal(old.command.events.length, 200); assert.equal(old.command.events.at(-1)?.sequence, 205);
  assert.equal(old.command.events[0].sequence, 6);
});
test('v1 v2 v3 exports decode and future/string versions fail', () => {
  for (const schemaVersion of [1, 2, 3, 4]) assert.equal(decodeSnapshot({ schemaVersion, work: { checks: {}, notes: [], updatedAt: null } }).stateVersion, 4);
  assert.throws(() => decodeSnapshot({ schemaVersion: 5, work: emptyWork() }));
  assert.throws(() => decodeSnapshot({ schemaVersion: '3', work: emptyWork() }));
  assert.equal(encodeSnapshot(emptyWork(), {}, now).schemaVersion, 4);
});
test('import preserves current IDs, profiles, settings and canonical event log', () => {
  const current = withAppEvents(emptyWork(), stateWith(mission()), now); current.settings.theme = 'dark';
  const incoming = structuredClone(current); incoming.settings.theme = 'light'; incoming.command.events = [];
  incoming.command.missions[0].goal = 'Untrusted replacement'; incoming.profiles[0].role = 'Different role';
  const next = mergeSnapshot(current, incoming, sources, now);
  assert.equal(next.command.missions[0].goal, current.command.missions[0].goal); assert.equal(next.settings.theme, 'dark');
  assert.deepEqual(next.profiles, current.profiles); assert.deepEqual(next.command.events, current.command.events);
});
test('imported decisions are re-proposed, mission review and stage reset', () => {
  const incoming = stateWith(mission({ stage: 'Done', reviewed: true, evidence: 'Historical independent findings' }));
  incoming.command.approvals = [approval({ missionId: incoming.command.missions[0].id, status: 'approved', decidedAt: now.toISOString() })];
  const next = mergeSnapshot(emptyWork(), incoming, sources, now);
  assert.equal(next.command.missions[0].stage, 'Created'); assert.equal(next.command.missions[0].reviewed, false);
  assert.equal(next.command.approvals[0].status, 'pending'); assert.equal(next.command.approvals[0].executed, false);
  assert.deepEqual(workChangeErrors(emptyWork(), next, now, sources), []);
});
test('combined snapshot capacity and unknown sources are validated', () => {
  const current = emptyWork(), incoming = emptyWork();
  current.command.missions = Array.from({ length: 20 }, () => mission()); incoming.command.missions = Array.from({ length: 20 }, () => mission());
  assert.throws(() => mergeSnapshot(current, incoming, sources, now));
  assert.throws(() => mergeSnapshot(emptyWork(), stateWith(mission({ sourceIds: ['missing'] })), sources, now));
});
