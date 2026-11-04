import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createBrowserCatalog} from '../src/catalog.mjs';
import {bundledSkills} from '../src/bundled-skills.mjs';
import {createLocalPipelineRunner} from '../src/runner.mjs';
import {fixture,issue,specFor} from './fixtures.mjs';
import {hashJson,hashText} from '../src/data.mjs';
import {hashManifestWeb} from '../../skill-core/src/contract.mjs';

test('catalog and run option getters are refused without invocation',async()=>{
 let accesses=0;const opts={};Object.defineProperty(opts,'bundles',{enumerable:true,get(){accesses++;return bundledSkills;}});
 await assert.rejects(createBrowserCatalog(opts),/accessor|field|JSON/i);assert.equal(accesses,0);
 const f=await fixture(),runOpts={};Object.defineProperty(runOpts,'resume',{enumerable:true,get(){accesses++;return undefined;}});
 await assert.rejects(f.runner.run(f.spec,runOpts),/accessor|field|JSON/i);assert.equal(accesses,0);
});
test('abort and budget after the synchronous handler suppress its result and success event',async()=>{
 for(const mode of ['abort','budget']) {
  let armed=false,samples=0;const controller=new AbortController();
  const f=await fixture({runner:{now(){if(armed&&++samples===2) {if(mode==='abort') controller.abort();else return 1100;}return 100;}}});
  f.runner.subscribe(e=>{if(e.type==='step-started') armed=true;});
  const r=await f.runner.run(f.spec,{signal:controller.signal});assert.equal(r.state,mode==='abort'?'aborted':'budget-exhausted');assert.equal(r.completedCount,0);assert.equal(f.calls.length,1);
  assert.equal(f.runner.events().filter(e=>e.type==='step-started').length,1);assert.equal(f.runner.events().some(e=>e.type==='step-completed'),false);
 }
});
test('budget exhaustion is resumable with new evidence, paused wall time is excluded',async()=>{
 let slow=true;const f=await fixture({evidence(ctx,{clock,catalog,authority}) {const h=issue(authority,catalog,ctx.skillId);if(slow)clock.value+=1000;return h;}});
 const a=await f.runner.run(f.spec);assert.equal(a.state,'budget-exhausted');slow=false;f.clock.value+=3600000;
 const b=await f.runner.run(f.spec,{resume:a.checkpoint,pauseAfterSteps:1});assert.equal(b.state,'paused');f.clock.value+=86400000;
 const r=await f.runner.run(f.spec,{resume:b.checkpoint});assert.equal(r.state,'completed');assert.equal(r.completedCount,4);
});
test('resume can use a fresh runner with same trusted store but never a foreign store',async()=>{
 const f=await fixture(),a=await f.runner.run(f.spec,{pauseAfterSteps:2}),g=await fixture({catalog:f.catalog,authority:f.authority,store:f.store});
 const r=await g.runner.run(f.spec,{resume:a.checkpoint});assert.equal(r.state,'completed');assert.deepEqual(g.calls,['step-3','step-4']);
 const foreign=await fixture();await assert.rejects(foreign.runner.run(f.spec,{resume:a.checkpoint}),/CHECKPOINT_MISSING/);assert.equal(foreign.calls.length,0);
});
test('two runners racing to resume cannot both execute the remaining prefix',async()=>{
 const f=await fixture(),a=await f.runner.run(f.spec,{pauseAfterSteps:1});
 const g=await fixture({catalog:f.catalog,authority:f.authority,store:f.store}),h=await fixture({catalog:f.catalog,authority:f.authority,store:f.store});
 const results=await Promise.allSettled([g.runner.run(f.spec,{resume:a.checkpoint}),h.runner.run(f.spec,{resume:a.checkpoint})]);
 assert.equal(results.filter(r=>r.status==='fulfilled'&&r.value.state==='completed').length,1);assert.equal(g.calls.length+h.calls.length,3);
});
test('checkpoint output hash tampering, unknown authorization and nonprefix completion are refused',async()=>{
 for(const mutate of [r=>r.completed[0].outputHash='sha256:'+'a'.repeat(64),r=>r.completed[0].evidence={},r=>r.completed.push(r.completed[0])]) {
  const f=await fixture(),a=await f.runner.run(f.spec,{pauseAfterSteps:1});
  // Simulated accidental trusted-host corruption, not an untrusted checkpoint import API.
  const env=f.store.read(a.checkpoint.pipelineId);mutate(env.record);const revision=f.store.compareAndSwap(a.checkpoint.pipelineId,env.revision,env.record);
  await assert.rejects(f.runner.run(f.spec,{resume:{pipelineId:a.checkpoint.pipelineId,revision}}),/CHECKPOINT_CORRUPT/);assert.equal(f.calls.length,1);
 }
});
test('external requirements are rejected despite a newly recomputed matching manifest hash',async()=>{
 const bundles=structuredClone(bundledSkills),b=bundles.find(b=>b.directory==='mission-check'),m=JSON.parse(b.manifest);m.tools[0].effect='external-read';m.versionHash=await hashManifestWeb(m);b.manifest=JSON.stringify(m);
 const catalog=await createBrowserCatalog({bundles}),f=await fixture({catalog});await assert.rejects(f.runner.run(specFor(catalog,['mission-check'])),/EXTERNAL_EFFECT_DISABLED/);assert.equal(f.calls.length,0);
});
test('frontmatter mismatch fails even when attacker recomputes every content checksum',async()=>{
 const bundles=structuredClone(bundledSkills),b=bundles[0],m=JSON.parse(b.manifest);b.files['SKILL.md']=b.files['SKILL.md'].replace('name: "backup-plan"','name: "forged"');m.files[0].sha256=await hashText(b.files['SKILL.md']);m.versionHash=await hashManifestWeb(m);b.manifest=JSON.stringify(m);
 await assert.rejects(createBrowserCatalog({bundles}),/Frontmatter/i);
});
test('static bundled package data exactly matches the reviewed skill-core inventory',()=>{
 for(const b of bundledSkills) {
  const root=new URL('../../skill-core/skills/'+b.directory+'/',import.meta.url);assert.equal(b.manifest,fs.readFileSync(new URL('cue-skill.json',root),'utf8'));
  for(const [name,text] of Object.entries(b.files)) assert.equal(text,fs.readFileSync(new URL(name,root),'utf8'));
 }
});
test('public runtime import graph has no Node, network, shell, dynamic import or dependency package',()=>{
 const pending=[new URL('../src/index.mjs',import.meta.url)],seen=new Set();
 while(pending.length) {
  const url=pending.pop();if(seen.has(url.href))continue;seen.add(url.href);const text=fs.readFileSync(url,'utf8');
  if(url.pathname.endsWith('/bundled-skills.mjs')) continue;
  assert.doesNotMatch(text,/\b(?:fetch|XMLHttpRequest|WebSocket|eval)\s*\(|\bimport\s*\(/);
  const imports=[...text.matchAll(/(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]/g)].map(m=>m[1]);
  for(const path of imports) {assert.ok(path.startsWith('.'),`Runtime import must be relative: ${path}`);pending.push(new URL(path,url));}
 }
 assert.ok(seen.size>=10);
});
test('events are copied, paged and listener exceptions cannot synthesize or prevent completion',async()=>{
 const f=await fixture();f.runner.subscribe(()=>{throw new Error('UI observer error');});await f.runner.run(f.spec);
 const events=f.runner.events({limit:2});assert.equal(events.length,2);events[0].type='fake';assert.notEqual(f.runner.events()[0].type,'fake');
 assert.ok(f.runner.events({afterSequence:events[1].sequence}).every(e=>e.sequence>events[1].sequence));assert.equal(f.runner.pause(),false);assert.equal(f.runner.abort(),false);
});
test('a bare SHA checksum of caller data is never an accepted resume proof',async()=>{
 const f=await fixture(),forged={pipelineId:f.spec.pipelineId,revisionHash:await hashJson(f.spec),state:'completed',nextStepIndex:4,completed:[]};
 await assert.rejects(f.runner.run(f.spec,{resume:forged}),/unknown field|CHECKPOINT/);assert.equal(f.calls.length,0);
});
