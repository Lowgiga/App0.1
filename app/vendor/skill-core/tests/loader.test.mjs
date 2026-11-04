import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createCatalog,validateSchema,validateData,hashManifest} from '../src/index.mjs';
import {fixture,digest,versionHash,objectSchema} from './fixtures.mjs';

test('catalog metadata is separate from instruction and resource reads',t=>{
 const f=fixture(t); const c=createCatalog({root:f.root});
 assert.equal(c.list()[0].id,'cue.test'); assert.equal(c.list()[0].versionHash,f.manifest.versionHash);
 assert.deepEqual(c.events().map(e=>e.stage),['metadata']);
 assert.equal(c.list()[0].instructions,undefined);
 assert.match(c.loadInstructions('cue.test'),/Check only supplied data/);
 assert.deepEqual(c.events().map(e=>e.stage),['metadata','instruction']);
 assert.equal(c.loadResource('cue.test','references/help.md'),f.ref);
 assert.equal(c.verify('cue.test').status,'passed');
});
test('versions hash all manifest semantics and declared content hashes',t=>{
 const f=fixture(t);assert.equal(hashManifest(f.manifest),versionHash(f.manifest));
 const before=f.manifest.versionHash;f.manifest.triggers.anyTags.push('new');f.save();assert.notEqual(before,f.manifest.versionHash);
 const c=createCatalog({root:f.root}); assert.equal(c.list()[0].versionHash,f.manifest.versionHash);
 fs.appendFileSync(path.join(f.dir,'SKILL.md'),'modified');assert.throws(()=>c.loadInstructions('cue.test'),/hash/i);
});
test('metadata corruption and unversioned changed manifests fail closed',t=>{
 const f=fixture(t);f.manifest.id='cue.changed';fs.writeFileSync(path.join(f.dir,'cue-skill.json'),JSON.stringify(f.manifest));
 assert.throws(()=>createCatalog({root:f.root}),/hash/i);
});
test('traversal absolute paths backslashes encoded paths and undeclared resources are refused',t=>{
 const f=fixture(t);const c=createCatalog({root:f.root});
 for(const p of ['../secret','/etc/passwd','references/../SKILL.md','references\\help.md','references/%2e%2e/help','references/absent.md']) assert.throws(()=>c.loadResource('cue.test',p));
});
test('symlinks in package contents and root ancestors are refused',t=>{
 const f=fixture(t);fs.symlinkSync('/etc/passwd',path.join(f.dir,'references/link.md'));
 assert.throws(()=>createCatalog({root:f.root}),/symlink/i);
 fs.unlinkSync(path.join(f.dir,'references/link.md'));const link=f.root+'-link';fs.symlinkSync(f.root,link);t.after(()=>fs.unlinkSync(link));
 assert.throws(()=>createCatalog({root:link}),/symlink/i);
});
test('resources are lazy and changed content never passes verification',t=>{
 const f=fixture(t);const c=createCatalog({root:f.root});fs.writeFileSync(path.join(f.dir,'references/help.md'),'tampered');
 assert.match(c.loadInstructions('cue.test'),/Check only/);assert.throws(()=>c.loadResource('cue.test','references/help.md'),/hash/i);
 assert.equal(c.verify('cue.test').status,'failed');
});
test('script resources and unknown contract fields rejected without execution',t=>{
 const f=fixture(t);f.manifest.command='touch /tmp/forbidden';f.save();assert.throws(()=>createCatalog({root:f.root}),/field/i);
 delete f.manifest.command;f.manifest.files.push({path:'references/run.js',stage:'resource',sha256:digest('throw Error()')});fs.writeFileSync(path.join(f.dir,'references/run.js'),'throw Error()');f.save();assert.throws(()=>createCatalog({root:f.root}),/resource/i);
});
test('metadata and file size caps fail closed',t=>{
 const f=fixture(t);assert.throws(()=>createCatalog({root:f.root,limits:{metadataBytes:30}}),/size|budget/i);
 const c=createCatalog({root:f.root,limits:{fileBytes:20}});assert.throws(()=>c.loadInstructions('cue.test'),/size|budget/i);
});
test('SKILL frontmatter standard name and description must agree and allowed-tools grants nothing',t=>{
 const f=fixture(t);const s=f.skill.replace('name: "test-skill"','name: "wrong-name"');fs.writeFileSync(path.join(f.dir,'SKILL.md'),s);f.manifest.files[0].sha256=digest(s);f.save();
 assert.equal(createCatalog({root:f.root}).verify('cue.test').status,'failed');
});
test('strict schemas validate real data and reject unknown keys and unsupported keywords',()=>{
 const schema=objectSchema({x:{type:'integer',minimum:0},name:{type:'string',maxLength:3}});
 assert.equal(validateSchema(schema),true);assert.deepEqual(validateData(schema,{x:1,name:'abc'}),[]);
 assert.ok(validateData(schema,{x:-1,name:'abcd',granted:true}).length>=3);
 assert.throws(()=>validateSchema({type:'string',$ref:'https://evil.example/schema'}),/schema|keyword/i);
 assert.throws(()=>validateSchema({type:'object',properties:{},additionalProperties:true}),/schema/i);
});
test('duplicate ids never override another skill silently',t=>{
 const f=fixture(t);const second=path.join(f.root,'another-skill');fs.cpSync(f.dir,second,{recursive:true});
 const m=JSON.parse(fs.readFileSync(path.join(second,'cue-skill.json')));m.name='another-skill';m.versionHash=versionHash(m);fs.writeFileSync(path.join(second,'cue-skill.json'),JSON.stringify(m));
 assert.throws(()=>createCatalog({root:f.root}),/duplicate/i);
});
test('hard-linked files are refused',t=>{
 const f=fixture(t);const extra=f.root+'-outside.txt';t.after(()=>fs.unlinkSync(extra));fs.linkSync(path.join(f.dir,'references/help.md'),extra);
 assert.throws(()=>createCatalog({root:f.root}),/link/i);
});
test('malformed sparse JSON arrays are refused',()=>{
 assert.throws(()=>validateData({type:'array',items:{type:'string'}},new Array(2)),/sparse|JSON/i);
});
test('duplicate JSON keys cannot hide conflicting manifest values',t=>{
 const f=fixture(t);const p=path.join(f.dir,'cue-skill.json');const json=fs.readFileSync(p,'utf8');fs.writeFileSync(p,json.replace('{','{"id":"cue.hidden",'));
 assert.throws(()=>createCatalog({root:f.root}),/duplicate/i);
});
test('semantic versions reject leading zeros',t=>{
 const f=fixture(t);f.manifest.version='01.2.3';f.save();assert.throws(()=>createCatalog({root:f.root}),/version/i);
});
test('UTF-8 BOM resource content preserves exact bytes for hashing',t=>{
 const f=fixture(t,{resource:'\uFEFFReference with byte order mark.'});const c=createCatalog({root:f.root});assert.equal(c.loadResource('cue.test','references/help.md'),f.ref);assert.equal(c.verify('cue.test').status,'passed');
});
test('manifest scalar identifiers versions and hashes never accept coerced arrays',t=>{
 for(const field of ['id','version','versionHash']) {
  const f=fixture(t);f.manifest[field]=[f.manifest[field]];
  if(field!=='versionHash') f.save();else fs.writeFileSync(path.join(f.dir,'cue-skill.json'),JSON.stringify(f.manifest));
  assert.throws(()=>createCatalog({root:f.root}),/invalid/i);
 }
 const f=fixture(t);f.manifest.files[0].sha256=[f.manifest.files[0].sha256];f.save();assert.throws(()=>createCatalog({root:f.root}),/invalid/i);
});
test('schema scalar types and enum constraints cannot be silently coerced or ignored',()=>{
 assert.throws(()=>validateSchema({type:['string']}),/schema/i);
 for(const value of [null,false,0,'']) assert.throws(()=>validateSchema({type:'string',enum:value}),/enum/i);
 assert.throws(()=>validateSchema({type:'boolean',enum:[1]}),/enum/i);
 assert.throws(()=>validateSchema({type:'string',minLength:2,maxLength:1}),/bound/i);
});
test('loader event history survives repeated progressive reads with bounded retention',t=>{
 const f=fixture(t),c=createCatalog({root:f.root});for(let i=0;i<7000;i++) c.loadResource('cue.test','references/help.md');
 assert.equal(c.events().length,256);assert.equal(c.historyInfo().retainedCount,4096);
});
