import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { emptyWork, savedWorkContract, taskContract } from '../lib/work-contract.ts';
import { withAppEvents, workReferenceErrors } from '../lib/work-updates.ts';
import { encodeSnapshot, decodeSnapshot, mergeSnapshot } from '../lib/work-snapshots.ts';
import { buildSpaceGraph, visibleSpaceGraph, guidedSteps, relationNames } from '../lib/space-model.ts';
import { lessons, gradeChallenge, suggestLesson, makeLearningTask, learningResultText, createLearningTransfer, learningMissionCandidates } from '../lib/academy.ts';
import { missionContract } from '../lib/command-contract.ts';

const sources = JSON.parse(fs.readFileSync(new URL('../lib/mesh-data.json', import.meta.url), 'utf8')).sources;
const now = new Date('2026-09-30T18:00:00.000Z');
test('all existing learning IDs remain compatible with State v4', () => {
  assert.deepEqual(lessons.map(l => l.id), ['evidence', 'handoff', 'baseline', 'automation', 'review']);
  const s = emptyWork(); s.learning = { evidence: true, review: true };
  const loaded = savedWorkContract.parse(s);
  assert.deepEqual(loaded.learning, s.learning); assert.equal(loaded.stateVersion, 4);
});
test('lesson references point only to actual supplied source snapshots', () => {
  const ids = new Set(sources.map((s: {id: string}) => s.id));
  assert.ok(lessons.every(l => l.sourceIds.length && l.sourceIds.every(id => ids.has(id))));
});
test('spatial graph names are unique and edges have existing endpoints', () => {
  const g = buildSpaceGraph(emptyWork(), sources, true), ids = new Set(g.nodes.map(n => n.id));
  assert.equal(ids.size, g.nodes.length); assert.ok(g.edges.every(e => ids.has(e.from) && ids.has(e.to)));
  assert.equal(new Set(g.edges.map(e => e.id)).size, g.edges.length);
});
test('unknown state never labels personal nodes or edges as loaded work', () => {
  const g = buildSpaceGraph(emptyWork(), sources, false);
  assert.ok(!g.nodes.some(n => n.origin === 'own')); assert.ok(!g.edges.some(e => e.origin === 'own'));
  assert.ok(g.nodes.some(n => n.origin === 'template'));
});
test('source evidence retains snapshot origin even with loaded personal state', () => {
  const g = buildSpaceGraph(emptyWork(), sources, true);
  assert.ok(g.nodes.filter(n => n.kind === 'source').every(n => n.origin === 'snapshot'));
});
test('external systems and agent handoffs stay explicit planning relationships', () => {
  const g = buildSpaceGraph(emptyWork(), sources, true);
  assert.deepEqual(g.nodes.filter(n => n.kind === 'system').map(n => n.origin), ['plan', 'plan', 'plan']);
  assert.ok(g.edges.filter(e => ['delegates', 'requests-review', 'integrates'].includes(e.relation)).every(e => e.origin === 'plan'));
  assert.equal(relationNames['requests-review'], 'gibt zur Gegenprüfung');
});
test('team scope includes four app profiles and three planned systems', () => {
  const g = visibleSpaceGraph(buildSpaceGraph(emptyWork(), sources, true), 'team', 'agent:zimt', false);
  assert.equal(g.nodes.length, 7); assert.ok(g.nodes.every(n => ['agent', 'system'].includes(n.kind)));
});
test('neighbour isolation includes only direct relationships and selected node', () => {
  const g = buildSpaceGraph(emptyWork(), sources, true);
  const v = visibleSpaceGraph(g, 'all', 'system:make', true);
  assert.deepEqual(new Set(v.nodes.map(n => n.id)), new Set(['system:make', 'agent:manus']));
});
test('large graph is bounded while selected node survives the cap', () => {
  const s = emptyWork(); s.tasks = Array.from({length: 60}, (_, i) => ({...s.tasks[0], id: 'large-' + i, title: 'Own task ' + i}));
  const g = buildSpaceGraph(s, sources, true), v = visibleSpaceGraph(g, 'all', 'task:large-59', false);
  assert.ok(v.total > 60); assert.equal(v.nodes.length, 32); assert.ok(v.nodes.some(n => n.id === 'task:large-59'));
  const ids = new Set(v.nodes.map(n => n.id)); assert.ok(v.edges.every(e => ids.has(e.from) && ids.has(e.to)));
});
test('ordinary node selection keeps identical topology and camera layout', () => {
  const g = buildSpaceGraph(emptyWork(), sources, true);
  const a = visibleSpaceGraph(g, 'team', 'agent:zimt', false), b = visibleSpaceGraph(g, 'team', 'agent:manus', false);
  assert.deepEqual({nodes:a.nodes, edges:a.edges}, {nodes:b.nodes, edges:b.edges});
});
test('archived work disappears without dangling dependency edges', () => {
  const s = emptyWork(); s.tasks[0].archived = true; s.tasks[1].dependencies = [s.tasks[0].id];
  const g = buildSpaceGraph(s, sources, true);
  assert.ok(!g.nodes.some(n => n.id === 'task:' + s.tasks[0].id)); assert.ok(!g.edges.some(e => e.to === 'task:' + s.tasks[0].id));
});
test('graph reflects the current configured role instead of a static role claim', () => {
  const s = emptyWork(); s.profiles[1].role = 'Own configured analytical role';
  assert.ok(buildSpaceGraph(s, sources, true).nodes.find(n => n.id === 'agent:manus')?.detail.includes(s.profiles[1].role));
});
test('guided steps refer to actual planned edges and return the review to Zimt', () => {
  const g = buildSpaceGraph(emptyWork(), sources, true);
  assert.ok(guidedSteps.every(s => g.nodes.some(n => n.id === s.node)));
  assert.ok(guidedSteps.filter(s => s.edge).every(s => g.edges.some(e => e.id === s.edge && e.origin === 'plan')));
  assert.equal(guidedSteps.at(-1)?.node, 'agent:zimt');
});
test('every practice case rejects partial, extraneous and duplicate selections', () => {
  for (const l of lessons) {
    assert.equal(gradeChallenge(l, l.challenge.correct), true);
    assert.equal(gradeChallenge(l, []), false);
    assert.equal(gradeChallenge(l, l.challenge.correct.slice(1)), false);
    assert.equal(gradeChallenge(l, [...l.challenge.correct, 100]), false);
    assert.equal(gradeChallenge(l, l.challenge.correct.map(() => l.challenge.correct[0])), false);
  }
});
test('lesson examples can always be explored in the real graph', () => {
  const g = buildSpaceGraph(emptyWork(), sources, true);
  assert.ok(lessons.every(l => g.nodes.some(n => n.id === l.node)));
});
test('learning recommendation considers real blocked mission before other topics', () => {
  const s = emptyWork();
  s.command.missions.push({id:crypto.randomUUID(), title:'Own blocked mission', goal:'Determine evidence gaps', scope:'Own app only', project:'cue', owner:'manus', reviewer:'junior', stage:'Blocked', priority:'P1', output:'Own findings', taskIds:[], roomId:null, sourceIds:[], evidence:'', reviewed:false, checkpoint:'', archived:false, createdAt:now.toISOString(), deadlineAt:null, neuro_profile:{acetylcholin:0,dopamine:0,serotonin:0,noradrenaline:85}});
  assert.equal(suggestLesson(s).lesson.id, 'review');
  s.command.missions[0].archived = true; assert.notEqual(suggestLesson(s).lesson.id, 'review');
});
test('learning recommendation never claims a saved topic is unfinished', () => {
  const s = emptyWork(); s.learning.automation = true; s.learning.baseline = true;
  assert.equal(suggestLesson(s).lesson.id, 'evidence');
  for (const l of lessons) s.learning[l.id] = true;
  assert.match(suggestLesson(s).reason, /Wiederhole/);
});
test('all transfer tasks pass the existing strict schema and start unverified', () => {
  for (const l of lessons) {
    const t = taskContract.parse(makeLearningTask(l, crypto.randomUUID()));
    assert.equal(t.status, 'Offen'); assert.equal(t.evidence, ''); assert.equal(t.reviewed, false);
    assert.equal(t.category, 'Lernen'); assert.ok(t.acceptance.length > 100);
  }
});
test('saving quiz and reasoning preserves all existing booleans, notes and profiles', () => {
  const before = emptyWork(); before.learning.review = true; before.notes = [{id:crypto.randomUUID(), text:'Existing own decision', createdAt:now.toISOString()}];
  const lesson = lessons[0], note = {id:crypto.randomUUID(), text:learningResultText(lesson, 'A read call must be evidenced independently of login.'), createdAt:now.toISOString()};
  const after = savedWorkContract.parse({...before, learning:{...before.learning, [lesson.id]:true}, notes:[note, ...before.notes]});
  assert.equal(after.learning.review, true); assert.equal(after.notes[1].text, before.notes[0].text); assert.deepEqual(after.profiles, before.profiles);
  assert.deepEqual(workReferenceErrors(after, sources.map((s: {id:string}) => s.id)), []);
});
test('practice outcome and task events use the existing sequential event mechanism', () => {
  const before = emptyWork(), lesson = lessons[0];
  const after = savedWorkContract.parse({...before, learning:{evidence:true}, notes:[{id:crypto.randomUUID(),text:learningResultText(lesson,'Own read call is still required to verify access.'),createdAt:now.toISOString()}], tasks:[...before.tasks, makeLearningTask(lesson, crypto.randomUUID())]});
  const result = savedWorkContract.parse(withAppEvents(before, after, now));
  assert.ok(result.command.events.some(e => e.kind === 'task-updated'));
  assert.ok(result.command.events.every((e, i, all) => i === 0 || e.sequence === all[i-1].sequence + 1));
  assert.equal(result.command.interactions.length, 0);
});
test('backup merge retains old quiz progress and new learning notes and tasks', () => {
  const incoming = emptyWork(), lesson = lessons[1]; incoming.learning.handoff = true;
  incoming.notes.push({id:crypto.randomUUID(),text:learningResultText(lesson,'A bounded mission needs a clear expected return artifact.'),createdAt:now.toISOString()});
  incoming.tasks.push(makeLearningTask(lesson, crypto.randomUUID()));
  const result = mergeSnapshot(emptyWork(), decodeSnapshot(encodeSnapshot(incoming, {}, now)), sources.map((s: {id:string}) => s.id), now);
  assert.equal(result.learning.handoff, true); assert.equal(result.notes[0].text, incoming.notes[0].text); assert.equal(result.tasks.at(-1)?.title, lesson.taskTitle);
});
test('learning result records the exact reflection and limits its claim to personal practice', () => {
  const text = learningResultText(lessons[0], '  Own source is not yet read.  ');
  assert.ok(text.startsWith('[Mesh Academy · evidence]\n')); assert.ok(text.includes('Eigene Begründung: Own source is not yet read.'));
  assert.ok(text.includes('kein Nachweis einer externen Ausführung')); assert.ok(text.includes('zertifizierten Kompetenz'));
});
const ownMission = () => missionContract.parse({id:crypto.randomUUID(), title:'Own practice mission', goal:'Inspect an actual evidence gap', scope:'Personal app only', project:'cue', owner:'manus', reviewer:'junior', stage:'Created', priority:'P1', output:'A source-bound result', taskIds:[], roomId:null, sourceIds:[], evidence:'', reviewed:false, checkpoint:'', archived:false, createdAt:now.toISOString()});
test('explicit mission transfer creates its task and reference in one valid state', () => {
  const s = emptyWork(); s.command.missions.push(ownMission()); const id = crypto.randomUUID();
  const result = savedWorkContract.parse(createLearningTransfer(s, lessons[0], id, s.command.missions[0].id, 'manus'));
  assert.ok(result.command.missions[0].taskIds.includes(id)); assert.equal(result.tasks.at(-1)?.owner, 'manus');
  assert.deepEqual(workReferenceErrors(result, sources.map((s: {id:string}) => s.id)), []);
  assert.deepEqual(s.command.missions[0].taskIds, []); assert.equal(s.tasks.length, 11);
  const events = withAppEvents(s, result, now).command.events;
  assert.ok(events.some(e => e.kind === 'mission-updated')); assert.ok(events.some(e => e.entityId === id && e.kind === 'task-updated'));
});
test('unlinked learning transfer never changes a mission or marks its status done', () => {
  const s = emptyWork(); s.command.missions.push(ownMission());
  const result = createLearningTransfer(s, lessons[1], crypto.randomUUID(), '', 'zimt');
  assert.deepEqual(result.command, s.command); assert.equal(result.tasks.at(-1)?.status, 'Offen');
});
test('transfer respects review, closure, archive and exact 20-task reference capacity', () => {
  const s = emptyWork(); s.command.missions.push(ownMission()); const m = s.command.missions[0];
  for (const stage of ['Review','Approved','Done'] as const) { m.stage=stage; assert.throws(() => createLearningTransfer(s, lessons[0], crypto.randomUUID(), m.id, 'codex')); }
  m.stage='Created'; m.archived=true; assert.equal(learningMissionCandidates(s).length, 0);
  m.archived=false; m.taskIds=Array.from({length:20},(_,i)=>'task-'+i); assert.equal(learningMissionCandidates(s).length, 0);
  m.taskIds.pop(); assert.equal(learningMissionCandidates(s).length, 1);
});
test('duplicate topic and task capacity reject transfer without mutating prior state', () => {
  const s = emptyWork(); s.tasks.push(makeLearningTask(lessons[0], crypto.randomUUID())); const before=JSON.stringify(s);
  assert.throws(() => createLearningTransfer(s, lessons[0], crypto.randomUUID(), '', 'codex')); assert.equal(JSON.stringify(s), before);
  s.tasks=Array.from({length:60},(_,i)=>({...s.tasks[0],id:'capacity-'+i}));
  assert.throws(() => createLearningTransfer(s, lessons[1], crypto.randomUUID(), '', 'codex'));
});
test('linking a learning prerequisite preserves a blocked mission condition', () => {
  const s = emptyWork(); s.command.missions.push(ownMission()); s.command.missions[0].stage='Blocked';
  const result = createLearningTransfer(s, lessons[0], crypto.randomUUID(), s.command.missions[0].id, 'junior');
  assert.equal(result.command.missions[0].stage, 'Blocked'); assert.equal(result.command.interactions.length, 0);
});
