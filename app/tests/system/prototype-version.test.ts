import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(name:string)=>fs.readFileSync(new URL('../../'+name,import.meta.url),'utf8');
const version='0.5.5-prototype-20261104';
test('prototype update declares Android versionCode13 and keeps package identity and namespace',()=>{
 const gradle=read('android/app/build.gradle');
 assert.match(gradle,/versionCode\s*=\s*13\b/);assert.ok(gradle.includes('versionName = "'+version+'"'));
 assert.match(gradle,/applicationId "de\.lowgiga\.cuecommandmesh\.next"/);
 assert.match(gradle,/namespace = "de\.lowgiga\.cuecommandmesh\.preview"/);
});
test('prototype package, lock metadata, diagnostics and backup producer name the same version',()=>{
 const metadata=JSON.parse(read('package.json')),lock=JSON.parse(read('package-lock.json'));
 assert.equal(metadata.version,version);assert.equal(lock.version,version);assert.equal(lock.packages[''].version,version);
 assert.deepEqual(metadata.dependencies,lock.packages[''].dependencies);assert.deepEqual(metadata.devDependencies,lock.packages[''].devDependencies);
 assert.ok(read('src/diagnostics.ts').includes("const BUILD = '"+version+"'"));
 assert.ok(read('src/backup-adapter.ts').includes("producer:{name:'cue-command-mesh-system',version:'"+version+"'}"));
});
test('current version documentation distinguishes this prototype from historical evidence',()=>{
 for(const name of ['docs/SIGNING-AND-RECOVERY.md','docs/INTEGRATION-RESULTS.md','docs/PARITY.md'])assert.ok(read(name).includes(version),name);
 assert.ok(read('docs/SIGNING-AND-RECOVERY.md').includes('Android-Versionscode: `13`'));
 assert.match(read('docs/INTEGRATION-RESULTS.md'),/historischer Bericht/);assert.match(read('docs/PARITY.md'),/historischer Bericht/);
});
