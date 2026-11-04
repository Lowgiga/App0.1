import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyWork } from '../lib/work-contract.ts';
import { lessons, makeLearningTask, learningResultText } from '../lib/academy.ts';
import { buildSpaceGraph, visibleSpaceGraph } from '../lib/space-model.ts';
// Catch absent modules in the initial RED run so the failure is an explicit missing-feature assertion.
const levels = await import('../lib/learning-levels.ts').catch(() => null);
const ar = await import('../lib/ar-support.ts').catch(() => null);
const placement = await import('../lib/ar-placement.ts').catch(() => null);

test('learning graph provides five real course levels in 2D and 3D', () => {
  const graph = buildSpaceGraph(emptyWork(), [], true);
  assert.equal(graph.nodes.filter(n => n.kind === 'lesson').length, 5);
  const view = visibleSpaceGraph(graph, 'learning', 'lesson:evidence', false);
  assert.equal(view.nodes.length, 5);
  assert.ok(view.edges.length > 0);
  assert.ok(view.nodes.every(n => n.kind === 'lesson'));
  assert.ok(new Set(view.nodes.map(n => n.position[2])).size > 1);
});
test('lesson dependencies are recommendations and never executed app relationships', () => {
  const graph = buildSpaceGraph(emptyWork(), [], true);
  const edges = graph.edges.filter(e => e.relation === 'recommended-before');
  assert.ok(edges.length > 0); assert.ok(edges.every(e => e.origin === 'plan'));
  assert.ok(edges.every(e => graph.nodes.some(n => n.id === e.from) && graph.nodes.some(n => n.id === e.to)));
});
test('legacy quiz completion is retained without inventing a practice or transfer', () => {
  assert.ok(levels, 'Learning level derivation must exist');
  const work = emptyWork(); work.learning.handoff = true; const before = JSON.stringify(work);
  const level = levels.buildLearningLevels(work, true).find(l => l.id === 'handoff')!;
  assert.equal(level.quizSaved, true); assert.equal(level.practiceSaved, false); assert.equal(level.transferComplete, false);
  assert.equal(level.status, 'quiz-saved'); assert.equal(level.nextAction.kind, 'practice');
  assert.ok(level.missingRecommended.includes('evidence')); assert.equal(JSON.stringify(work), before);
});
test('unknown data never asserts personal achievements', () => {
  assert.ok(levels); const work = emptyWork(); for (const l of lessons) work.learning[l.id] = true;
  assert.ok(levels.buildLearningLevels(work, false).every(l => l.status === 'unknown' && !l.quizSaved && !l.practiceSaved && !l.transferComplete));
});
test('a saved practice note and quiz show the real next case check', () => {
  assert.ok(levels); const work = emptyWork(); work.learning.evidence = true;
  work.notes.push({id:crypto.randomUUID(),text:learningResultText(lessons[0], 'Ein eigener datierter Abruf ist noch offen.'),createdAt:new Date().toISOString()});
  const level = levels.buildLearningLevels(work, true)[0];
  assert.equal(level.status, 'practice-saved'); assert.equal(level.nextAction.kind, 'practice');
});
test('a random note cannot substitute for a saved practice', () => {
  assert.ok(levels); const work = emptyWork(); work.learning.evidence=true;
  work.notes.push({id:crypto.randomUUID(),text:'Beleg oder Behauptung? Ich kenne es.',createdAt:new Date().toISOString()});
  assert.equal(levels.buildLearningLevels(work, true)[0].practiceSaved, false);
});
test('an open transfer remains open and points to its real task', () => {
  assert.ok(levels); const work = emptyWork(); const task = makeLearningTask(lessons[0], 'transfer-own'); work.tasks.push(task);
  const level = levels.buildLearningLevels(work, true)[0];
  assert.equal(level.transferComplete, false); assert.equal(level.transferTaskId, task.id); assert.equal(level.nextAction.kind, 'task');
});
test('done label without evidence and review cannot complete a transfer level', () => {
  assert.ok(levels); const work = emptyWork(); const task = makeLearningTask(lessons[0], 'transfer-own'); task.status='Erledigt'; work.tasks.push(task);
  assert.equal(levels.buildLearningLevels(work, true)[0].transferComplete, false);
  task.evidence='Konkreter datierter Nachweis'; assert.equal(levels.buildLearningLevels(work,true)[0].transferComplete,false);
  task.reviewed=true; assert.equal(levels.buildLearningLevels(work,true)[0].transferComplete,true);
});
test('transitive invalid prerequisites and dependency cycles invalidate transfer completion', () => {
  assert.ok(levels); const work=emptyWork(); const task=makeLearningTask(lessons[0],'transfer-own');
  task.status='Erledigt'; task.reviewed=true; task.evidence='Konkreter datierter Nachweis'; task.dependencies=['dep'];
  const dep={...task,id:'dep',title:'Voraussetzung',dependencies:['missing']}; work.tasks.push(task,dep);
  assert.equal(levels.buildLearningLevels(work,true)[0].transferComplete,false);
  dep.dependencies=[task.id]; assert.equal(levels.buildLearningLevels(work,true)[0].transferComplete,false);
  dep.dependencies=[]; assert.equal(levels.buildLearningLevels(work,true)[0].transferComplete,true);
});
test('archived transfer is not offered as an active task', () => {
  assert.ok(levels); const work=emptyWork(); const task=makeLearningTask(lessons[0],'old'); task.archived=true; work.tasks.push(task);
  assert.equal(levels.buildLearningLevels(work,true)[0].transferTaskId,null);
});
test('AR preflight distinguishes insecure context before any XR probe', async () => {
  assert.ok(ar, 'AR diagnostics must exist'); let calls=0;
  const result=await ar.inspectARSupport({secureContext:false,xr:{isSessionSupported:async()=>{calls++;return true;}}});
  assert.equal(result.code,'insecure'); assert.equal(calls,0); assert.equal(result.supported,false);
});
test('AR preflight explains policy, missing API, unsupported device and probe errors', async () => {
  assert.ok(ar);
  assert.equal((await ar.inspectARSupport({secureContext:true,policyAllowsXR:false})).code,'policy-blocked');
  assert.match((await ar.inspectARSupport({secureContext:true,nativeApp:true})).message,/Chrome|Browser/);
  assert.equal((await ar.inspectARSupport({secureContext:true,xr:{isSessionSupported:async()=>false}})).code,'unsupported');
  assert.equal((await ar.inspectARSupport({secureContext:true,xr:{isSessionSupported:async()=>{throw new Error('probe');}}})).code,'probe-failed');
  assert.equal((await ar.inspectARSupport({secureContext:true,xr:{isSessionSupported:async()=>true}})).supported,true);
});
test('AR start errors distinguish denied permission from unavailable placement', () => {
  assert.ok(ar); assert.match(ar.arStartError({name:'NotAllowedError'}),/Freigabe|abgelehnt/);
  assert.match(ar.arStartError({name:'NotSupportedError'}),/Hit-Test|Flächen/);
  assert.match(ar.arStartError({name:'SecurityError'}),/HTTPS|Richtlinie/);
  assert.match(ar.arStartError({name:'InvalidStateError'}),/Sitzung/);
  assert.match(ar.arStartError({name:'AbortError'}),/abgebrochen/);
});
test('AR placement requires both hit test and usable exit controls', () => {
  assert.ok(ar); const root={} as HTMLElement;
  assert.deepEqual(ar.surfaceSessionInit(root),{requiredFeatures:['hit-test','dom-overlay'],domOverlay:{root}});
});
const pose=(x:number)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,0,-1,1];
test('placement cannot happen before a current hit and remains fixed until explicit reposition', () => {
  assert.ok(placement, 'Surface placement state must exist'); const p=placement.createPlacementState();
  assert.equal(p.place(),null); assert.equal(p.status,'scanning'); p.update(pose(1)); assert.equal(p.status,'surface-found');
  assert.deepEqual(p.place(),pose(1)); assert.equal(p.status,'placed'); p.update(pose(2)); assert.deepEqual(p.placed,pose(1));
  p.reset(); assert.equal(p.placed,null); assert.equal(p.place(),null);
});
test('losing a hit before placement clears stale coordinates', () => {
  assert.ok(placement); const p=placement.createPlacementState(); p.update(pose(1)); p.update(null);
  assert.equal(p.status,'scanning'); assert.equal(p.place(),null);
  p.update([1,2,3]); assert.equal(p.place(),null);
  p.update([...pose(1).slice(0,15),NaN]); assert.equal(p.place(),null);
});
test('placement state copies matrices instead of retaining mutable frame buffers', () => {
  assert.ok(placement); const p=placement.createPlacementState(); const value=pose(1); p.update(value); value[12]=8;
  assert.equal(p.place()?.[12],1);
});
function mockSession(source: {cancel:()=>void}, pending?:Promise<typeof source>) {
  const events=new EventTarget(); let referenceCalls=0,sourceCalls=0;
  return {session:{addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),requestReferenceSpace:async()=>{referenceCalls++;return {};},requestHitTestSource:async()=>{sourceCalls++;return pending??source;}} as unknown as XRSession, end:()=>events.dispatchEvent(new Event('end')), calls:()=>({referenceCalls,sourceCalls})};
}
test('hit source is disposed once on end and explicit cleanup', async () => {
  assert.ok(placement); let cancelled=0; const mock=mockSession({cancel:()=>cancelled++});
  const source=await placement.acquireHitTestSource(mock.session,()=>false); mock.end(); source.dispose();
  assert.equal(cancelled,1); assert.deepEqual(mock.calls(),{referenceCalls:1,sourceCalls:1});
});
test('late hit source is cancelled after unmount during async acquisition', async () => {
  assert.ok(placement); let cancelled=0,stale=false; let resolve!: (s:{cancel:()=>void})=>void;
  const pending=new Promise<{cancel:()=>void}>(r=>resolve=r); const source={cancel:()=>cancelled++}; const mock=mockSession(source,pending);
  const acquiring=placement.acquireHitTestSource(mock.session,()=>stale); await new Promise(r=>setImmediate(r)); assert.equal(mock.calls().sourceCalls,1); stale=true; resolve(source);
  await assert.rejects(acquiring,{name:'AbortError'}); await new Promise(r=>setImmediate(r)); assert.equal(cancelled,1);
});
test('ended session cannot attach a late hit source', async () => {
  assert.ok(placement); let cancelled=0; let resolve!: (s:{cancel:()=>void})=>void;
  const pending=new Promise<{cancel:()=>void}>(r=>resolve=r); const source={cancel:()=>cancelled++}; const mock=mockSession(source,pending);
  const acquiring=placement.acquireHitTestSource(mock.session,()=>false); await new Promise(r=>setImmediate(r)); assert.equal(mock.calls().sourceCalls,1); mock.end(); resolve(source);
  await assert.rejects(acquiring,{name:'AbortError'}); await new Promise(r=>setImmediate(r)); assert.equal(cancelled,1);
});

test('renderer uses explicit surface placement and disposes its browser hit source', async () => {
  const fs=await import('node:fs'); const renderer=fs.readFileSync(new URL('../app/space-renderer.tsx',import.meta.url),'utf8');
  assert.match(renderer,/surfaceSessionInit\(overlay\)/); assert.match(renderer,/acquireHitTestSource/);
  assert.match(renderer,/getHitTestResults/); assert.match(renderer,/placeAR:/);
  assert.match(renderer,/hitResource\?\.dispose\(\)/);
  assert.doesNotMatch(renderer,/group\.position\.set\(0, 0, -1\.25\)/);
});
test('UI reports real AR start failures and has explicit placement controls', async () => {
  const fs=await import('node:fs'); const ui=fs.readFileSync(new URL('../app/mesh-space.tsx',import.meta.url),'utf8');
  assert.match(ui,/arStartError\(error\)/); assert.match(ui,/setARStatus\(message\)/);
  assert.match(ui,/Hier platzieren/); assert.match(ui,/placement !== 'surface-found'/);
  assert.match(ui,/Lernlevel & Voraussetzungen/); assert.match(ui,/Nächste Lernaktion öffnen/);
});
test('help matches surface-placement controls and does not promise an unsupported free model', async () => {
  const fs=await import('node:fs'); const help=fs.readFileSync(new URL('../app/help-panel.tsx',import.meta.url),'utf8');
  assert.match(help,/Hier platzieren/); assert.match(help,/Hit-Test/); assert.doesNotMatch(help,/freies Modell ohne Flächenerkennung/);
});

test('dense shared-prerequisite DAG is evaluated once per task, within the 60-task contract', async () => {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', `
    import { emptyWork } from './lib/work-contract.ts';
    import { lessons, makeLearningTask } from './lib/academy.ts';
    import { buildLearningLevels } from './lib/learning-levels.ts';
    const work=emptyWork(); let evidenceReads=0;
    work.tasks=Array.from({length:60},(_,i)=>({
      ...makeLearningTask(lessons[0],'dag-'+i), title:i===59?lessons[0].taskTitle:'Voraussetzung '+i,
      status:'Erledigt', reviewed:true, dependencies:i===0?[]:i===1?['dag-0']:['dag-'+(i-1),'dag-'+(i-2)],
      get evidence(){ evidenceReads++; return 'Konkreter geprüfter Abschlussbeleg'; }
    }));
    const first=buildLearningLevels(work,true)[0];
    console.log(JSON.stringify({complete:first.transferComplete,evidenceReads}));
  `], { cwd: new URL('../', import.meta.url), encoding: 'utf8', timeout: 2000 });
  assert.equal(result.status, 0, 'A valid dense DAG must finish without the subprocess timeout: ' + result.error);
  const actual=JSON.parse(result.stdout.trim()); assert.equal(actual.complete,true); assert.ok(actual.evidenceReads<=60, 'Each shared prerequisite should be evaluated only once');
});
test('completion cache is rebuilt for each state and cannot retain an old success', () => {
  assert.ok(levels); const work=emptyWork(); const task=makeLearningTask(lessons[0],'memo');
  task.status='Erledigt';task.reviewed=true;task.evidence='Konkreter geprüfter Abschlussbeleg';work.tasks=[task];
  assert.equal(levels.buildLearningLevels(work,true)[0].transferComplete,true);
  task.reviewed=false;assert.equal(levels.buildLearningLevels(work,true)[0].transferComplete,false);
});
test('completion rejects work outside contract bounds without traversing an unbounded graph', () => {
  assert.ok(levels); const work=emptyWork(); const task=makeLearningTask(lessons[0],'bounded');
  task.status='Erledigt';task.reviewed=true;task.evidence='Konkreter geprüfter Abschlussbeleg';
  work.tasks=Array.from({length:61},(_,i)=>({...task,id:'too-many-'+i,title:i===0?task.title:'Anderer Eintrag '+i}));
  assert.equal(levels.buildLearningLevels(work,true)[0].transferComplete,false);
  work.tasks=[{...task,dependencies:Array.from({length:13},(_,i)=>'dependency-'+i)},...Array.from({length:13},(_,i)=>({...task,id:'dependency-'+i,title:'Voraussetzung '+i}))];
  assert.equal(levels.buildLearningLevels(work,true)[0].transferComplete,false);
});

test('ending a session aborts a never-settling hit-source request immediately', async () => {
  assert.ok(placement); let resolve!: (s:{cancel:()=>void})=>void;let cancelled=0;
  const pending=new Promise<{cancel:()=>void}>(r=>resolve=r);const mock=mockSession({cancel(){}},pending);
  const acquiring=placement.acquireHitTestSource(mock.session,()=>false);const outcome=acquiring.then(()=>false,error=>error.name==='AbortError');
  await new Promise(r=>setImmediate(r));assert.equal(mock.calls().sourceCalls,1);mock.end();
  assert.equal(await Promise.race([outcome,new Promise<boolean>(r=>setTimeout(()=>r(false),100))]),true);
  resolve({cancel(){cancelled++;}});await new Promise(r=>setImmediate(r));assert.equal(cancelled,1);
});
test('saved practice recommends the real required case recheck instead of a disabled transfer screen', () => {
  assert.ok(levels);const work=emptyWork();work.learning.evidence=true;
  work.notes.push({id:crypto.randomUUID(),text:learningResultText(lessons[0],'Ein eigener datierter Abruf ist noch offen.'),createdAt:new Date().toISOString()});
  const next=levels.buildLearningLevels(work,true)[0].nextAction;assert.equal(next.kind,'practice');assert.match(next.label,/Fall.*erneut|erneut.*Fall/);
});
test('AR startup cancellation is reachable inside the immersive overlay hit region', async () => {
  const fs=await import('node:fs');const ui=fs.readFileSync(new URL('../app/mesh-space.tsx',import.meta.url),'utf8');
  assert.match(ui,/className="space-ar-overlay" hidden=\{!arActive && !arBusy\}/);
  assert.match(ui,/<div className="actions-row"><Button onClick=\{\(\) => controls\.current\?\.cancelAR\(\)\}>Start abbrechen/);
});
test('missing hit-test source result rejects clearly without retaining session listeners', async () => {
  assert.ok(placement);const events=new EventTarget();
  const session={addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),requestReferenceSpace:async()=>({}),requestHitTestSource:()=>undefined} as unknown as XRSession;
  await assert.rejects(placement.acquireHitTestSource(session,()=>false),{name:'NotSupportedError'});
  events.dispatchEvent(new Event('end'));
});
