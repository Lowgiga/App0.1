import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createBrowserCatalog} from '../src/catalog.mjs';
const root=new URL('../../skill-core/skills/',import.meta.url);
function bundles() {
 return fs.readdirSync(root).sort().map(directory=>{
  const base=new URL(directory+'/',root),manifest=fs.readFileSync(new URL('cue-skill.json',base),'utf8');
  return {directory,manifest,files:Object.fromEntries(JSON.parse(manifest).files.map(f=>[f.path,fs.readFileSync(new URL(f.path,base),'utf8')]))};
 });
}
test('browser catalog verifies all four real packages and separates metadata from content',async()=>{
 const c=await createBrowserCatalog({bundles:bundles()});assert.ok(c,'catalog must be constructed');
 assert.equal(c.list().length,4);for(const m of c.list()) {assert.deepEqual(c.verify(m.id),{status:'passed',versionHash:m.versionHash});assert.equal(typeof c.loadInstructions(m.id),'string');assert.equal(typeof c.loadResource(m.id,'references/semantics.md'),'string');}
 assert.ok(!JSON.stringify(c.list()).includes('---\\n'));assert.equal(c.verify('missing').status,'failed');
});
test('modified resource bytes and manifest hashes fail during initialization',async()=>{
 const b=bundles();b[0].files['SKILL.md']+='x';await assert.rejects(createBrowserCatalog({bundles:b}),/hash/i);
 const d=bundles();d[0].manifest=d[0].manifest.replace('"1.0.0"','"1.0.1"');await assert.rejects(createBrowserCatalog({bundles:d}),/hash/i);
});
test('undeclared or missing resources cannot enter catalog',async()=>{
 const b=bundles();b[0].files['assets/hidden.txt']='x';await assert.rejects(createBrowserCatalog({bundles:b}),/undeclared|inventory/i);
 const d=bundles();delete d[0].files['SKILL.md'];await assert.rejects(createBrowserCatalog({bundles:d}),/missing|inventory/i);
});
test('traversal, duplicate keys, malformed metadata and unknown bundle fields fail closed',async()=>{
 const b=bundles();b[0].files['../escape.txt']='x';await assert.rejects(createBrowserCatalog({bundles:b}),/path/i);
 const d=bundles();d[0].manifest=d[0].manifest.replace('{','{"id":"cue.forged",');await assert.rejects(createBrowserCatalog({bundles:d}),/duplicate/i);
 const e=bundles();e[0].directory='../backup-plan';await assert.rejects(createBrowserCatalog({bundles:e}),/directory|path/i);
 const f=bundles();f[0].execute='https://example.org';await assert.rejects(createBrowserCatalog({bundles:f}),/unknown field/i);
});
test('verified private snapshot cannot be changed through original bundles or metadata copies',async()=>{
 const b=bundles(),c=await createBrowserCatalog({bundles:b}),m=c.list()[0],before=c.loadInstructions(m.id);
 b[0].files['SKILL.md']='broken';m.versionHash='broken';assert.equal(c.loadInstructions(m.id),before);assert.equal(c.verify(m.id).status,'passed');
 assert.throws(()=>c.loadResource(m.id,'../SKILL.md'),/path/i);assert.throws(()=>c.loadResource(m.id,'SKILL.md'),/stage|undeclared/i);
});
test('catalog enforces count and byte budgets before use',async()=>{
 await assert.rejects(createBrowserCatalog({bundles:Array(65).fill(bundles()[0])}),/budget/i);
 const b=bundles();b[0].files['SKILL.md']='x'.repeat(131073);await assert.rejects(createBrowserCatalog({bundles:b}),/budget/i);
});
