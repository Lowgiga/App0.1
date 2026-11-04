import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../../', import.meta.url));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const checkerPath = path.join(project, 'scripts/check-quality.mjs');
const checker = fs.existsSync(checkerPath) ? await import(checkerPath) : {};
const put = (root, name, value) => { fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true }); fs.writeFileSync(path.join(root, name), value); };
const encode = data => JSON.stringify(data, null, 2) + '\n';
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lowquantflow-quality-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const files = {
    'package.json': encode({ type: 'module', scripts: { 'verify:serial': 'npm run check:portability && npm run test:serial && npm run build' } }),
    'package-lock.json': '{}\n',
    'index.html': '<meta http-equiv="Content-Security-Policy" content="default-src self">',
    'capacitor.config.json': '{}\n',
    'scripts/check-quality.mjs': '// reviewed checker fixture\n',
    'scripts/verify-quality.mjs': '// reviewed wrapper fixture\n',
    'tests/quality/pass.test.mjs': "import test from 'node:test'; test('fixture host pass',()=>{});\n",
    'tests/data.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; test('preserves data',()=>{assert.equal(1,1)});\n",
    'android/app/src/test/java/ExampleTest.java': 'class ExampleTest { @Test void original() {} }\n',
    'android/app/src/androidTest/java/DeviceTest.java': 'class DeviceTest { @Test void onDevice() {} }\n',
    'extensions/addon/source/tests/renderer.mjs': "import test from 'node:test'; test('renderer',()=>{});\n",
    'src/platform/permissions.ts': 'export const allowed = false;\n',
    'src/feature.ts': 'export const value = 1;\n',
    'overlay/generated.ts': 'export const generated = 1;\n',
  };
  for (const [name, value] of Object.entries(files)) put(root, name, value);
  const baseline = { schema: 'lowquantflow.quality-baseline/v1', sourceScope: 'quality-source-v1', files: Object.fromEntries(Object.entries(files).map(([name, value]) => [name, sha(value)])) };
  const contract = { schema: 'lowquantflow.quality-contract/v1', baseline: { path: 'quality/baselines/accepted.json', sha256: sha(encode(baseline)) }, protectedBehaviors: [{ id: 'fixture.preserves-data', cases: [{ path: 'tests/data.test.mjs', name: 'preserves data' }] }], exceptions: [] };
  const save = () => { put(root, contract.baseline.path, encode(baseline)); contract.baseline.sha256 = sha(encode(baseline)); put(root, 'quality/contract.json', encode(contract)); return sha(encode(contract)); };
  let pin = save();
  return { root, baseline, contract, get pin() { return pin; }, save() { pin = save(); }, put: (name, value) => put(root, name, value), check: () => checker.checkQuality({ root, contractSha256: pin }) };
}
function blocked(result, code) { assert.equal(result.status, 'blocked', JSON.stringify(result)); assert.ok(result.issues.some(issue => issue.code === code), JSON.stringify(result.issues)); }

// Removing validation, AST parsing, or exit preservation must make these real fixtures fail.
test('quality checker exports its read-only check and snapshot API', () => {
  assert.equal(typeof checker.checkQuality, 'function');
  assert.equal(typeof checker.snapshotSources, 'function');
});
test('unchanged accepted fixture inventories Android, extensions and all test sources', t => {
  const f = fixture(t); const result = f.check();
  assert.equal(result.status, 'pass', JSON.stringify(result));
  for (const name of ['tests/data.test.mjs', 'android/app/src/test/java/ExampleTest.java', 'android/app/src/androidTest/java/DeviceTest.java', 'extensions/addon/source/tests/renderer.mjs']) assert.ok(result.testInventory.some(item => item.path === name), name);
  assert.equal(result.manualEvidence.nativePermissionFlows, 'not-run');
  assert.equal(result.releaseClaim, null);
});
test('missing or incorrect external contract pin cannot authorize a candidate', t => {
  const f = fixture(t);
  blocked(checker.checkQuality({ root: f.root }), 'contract-pin');
  blocked(checker.checkQuality({ root: f.root, contractSha256: '0'.repeat(64) }), 'contract-pin');
});
test('missing baseline is a real blocking error', t => { const f = fixture(t); fs.unlinkSync(path.join(f.root, f.contract.baseline.path)); blocked(f.check(), 'baseline-read'); });
test('changed baseline bytes fail the pinned manifest hash', t => { const f = fixture(t); f.put(f.contract.baseline.path, encode({ ...f.baseline, injected: true })); blocked(f.check(), 'baseline-hash'); });
test('baseline entry with a missing or malformed hash fails closed', t => { const f = fixture(t); f.baseline.files['tests/data.test.mjs'] = ''; f.save(); blocked(f.check(), 'baseline-entry'); });
test('baseline path traversal cannot read outside the source root', t => { const f = fixture(t); f.contract.baseline.path = '../accepted.json'; f.put('quality/contract.json', encode(f.contract)); blocked(checker.checkQuality({ root: f.root, contractSha256: sha(encode(f.contract)) }), 'unsafe-path'); });
test('manifest entry traversal fails even with a valid manifest hash', t => { const f = fixture(t); f.baseline.files['../outside.test.mjs'] = '1'.repeat(64); f.save(); blocked(f.check(), 'unsafe-path'); });
test('symlinked source fails even when the destination stays inside root', t => { const f = fixture(t); fs.symlinkSync('feature.ts', path.join(f.root, 'src/link.ts')); blocked(f.check(), 'symlink'); });
test('symlinked baseline cannot be read as an accepted manifest', t => { const f = fixture(t); const file = path.join(f.root, f.contract.baseline.path); fs.renameSync(file, file + '.real'); fs.symlinkSync('accepted.json.real', file); blocked(f.check(), 'symlink'); });
test('deleting one protected test cannot be hidden by adding more tests', t => { const f = fixture(t); fs.unlinkSync(path.join(f.root, 'tests/data.test.mjs')); f.put('tests/many.test.mjs', "test('extra 1',()=>{}); test('extra 2',()=>{});"); blocked(f.check(), 'protected-removed'); });
test('changing an assertion requires independent review', t => { const f = fixture(t); f.put('tests/data.test.mjs', "test('preserves data',()=>{});"); blocked(f.check(), 'protected-changed'); });
test('removing any accepted source requires review even outside security and test scopes', t => { const f = fixture(t); fs.unlinkSync(path.join(f.root, 'src/feature.ts')); blocked(f.check(), 'source-removed'); });
for (const [name, source] of [
  ['dot skip', "test.skip('new case',()=>{});"],
  ['computed only', "test['only']('new case',()=>{});"],
  ['todo', "test.todo('new case');"],
  ['implicit todo', "test('new case');"],
  ['implicit options todo', "test('new case',{timeout:20});"],
  ['options', "test('new case',{skip:true},()=>{});"],
  ['computed skip option', "test('new case',{['skip']:true},()=>{});"],
  ['computed todo option', "test('new case',{['todo']:true},()=>{});"],
  ['computed only option', "test('new case',{['only']:true},()=>{});"],
  ['import alias', "import { test as verify } from 'node:test'; verify.only('new case',()=>{});"],
  ['context skip', "test('new case',t=>{t.skip('reason')});"],
]) test('new ' + name + ' marker blocks', t => { const f = fixture(t); f.put('tests/new.test.mjs', source); blocked(f.check(), 'test-marker'); });
test('fixture strings, regex and comments are not executed test markers', t => {
  const f = fixture(t);
  f.put('tests/fixtures.test.mjs', "const fixture = \"test.skip('bad',()=>{})\"; const other = `it.only('bad')`; const pattern = /test\\.skip/; // test.todo('comment')\n/* it.only('comment') */ test('safe',{skip:false},()=>{});");
  assert.equal(f.check().status, 'pass');
});
test('new disabled Android test is blocked without pretending to run Android', t => { const f = fixture(t); f.put('android/app/src/androidTest/java/NewTest.java', '@org.junit.Ignore("later") class NewTest {}'); blocked(f.check(), 'test-marker'); });
test('real node:test hooks and callback-only tests are not implicit TODO declarations', t => {
  const f = fixture(t); f.put('tests/hooks.test.mjs', "import test,{afterEach as cleanup} from 'node:test'; const release=()=>{}; cleanup(release); test(()=>{}); test(async function(){});");
  assert.equal(f.check().status, 'pass');
});
for (const name of ['package-lock.json', 'index.html', 'src/platform/permissions.ts', 'scripts/check-quality.mjs', 'scripts/verify-quality.mjs']) test('protected file change blocks: ' + name, t => { const f = fixture(t); fs.appendFileSync(path.join(f.root, name), '\n// changed\n'); blocked(f.check(), 'protected-changed'); });
test('a new Android permission manifest also requires review', t => { const f = fixture(t); f.put('android/new/AndroidManifest.xml', '<manifest/>'); blocked(f.check(), 'protected-added'); });
test('ordinary source changes are inventoried rather than silently declared equivalent', t => { const f = fixture(t); f.put('src/feature.ts', 'export const value = 2;\n'); const result = f.check(); assert.equal(result.status, 'pass'); assert.deepEqual(result.sourceDiff.changed, ['src/feature.ts']); });
test('behavior ID cannot bind to a mere string/comment rather than a test case', t => { const f = fixture(t); f.contract.protectedBehaviors[0].cases[0].name = 'nonexistent case'; f.save(); blocked(f.check(), 'behavior-missing'); });
test('approvalRef has no exception semantics in version one', t => { const f = fixture(t); f.contract.exceptions = [{ approvalRef: 'self-approved' }]; f.save(); blocked(f.check(), 'exceptions-unsupported'); });
test('contract cannot provide arbitrary shell commands', t => { const f = fixture(t); f.contract.command = ['sh', '-c', 'touch forbidden']; f.save(); blocked(f.check(), 'contract-schema'); });
test('upstream/build and unknown Android source build directories are never excluded', t => {
  const f = fixture(t); f.put('upstream/build/source.mjs', 'export const value=1;'); f.put('android/app/src/test/build/new.test.mjs', "test.only('hidden',()=>{})");
  assert.ok(checker.snapshotSources(f.root).files['upstream/build/source.mjs']); blocked(f.check(), 'test-marker');
});
test('only exact known generated outputs are excluded from the source snapshot', t => {
  const f = fixture(t); const before = checker.snapshotSources(f.root).sha256;
  for (const name of ['android/.gradle/cache', 'android/app/build/output', 'android/cue-native-ar/build/output', 'docs/build-manifest.json', 'dist/index.html']) f.put(name, 'generated');
  assert.equal(checker.snapshotSources(f.root).sha256, before);
});
test('literal marker text in a native fixture is not a disabled test', t => { const f = fixture(t); f.put('android/app/src/test/java/StringTest.java', 'class StringTest { String text="@Ignore(\\\"later\\\")"; /* @Disabled */ }'); assert.equal(f.check().status, 'pass'); });
test('root __proto__ source is inventoried and changes the source hash', t => {
  const f = fixture(t); const before = checker.snapshotSources(f.root); f.put('__proto__', 'tracked source A'); const after = checker.snapshotSources(f.root);
  assert.ok(Object.hasOwn(after.files, '__proto__')); assert.equal(after.files['__proto__'], sha('tracked source A')); assert.notEqual(before.sha256, after.sha256);
  assert.ok(f.check().sourceDiff.added.includes('__proto__'));
});

function runWrapper(f, command = 'process.exit(0)') {
  // This local executable is a child-process fixture, never a replacement in production.
  f.put('artifacts/fixture-bin/npm', '#!' + process.execPath + '\n' + command + '\n');
  fs.chmodSync(path.join(f.root, 'artifacts/fixture-bin/npm'), 0o755);
  return spawnSync(process.execPath, [path.join(project, 'scripts/verify-quality.mjs'), '--root', f.root, '--contract-sha256', f.pin], { encoding: 'utf8', env: { ...process.env, PATH: path.join(f.root, 'artifacts/fixture-bin') + path.delimiter + process.env.PATH } });
}
const report = f => JSON.parse(fs.readFileSync(path.join(f.root, 'artifacts/quality-report.json'), 'utf8'));
test('wrapper preserves a real failed verification exit and still writes its report', t => {
  const f = fixture(t); const child = runWrapper(f, "if(JSON.stringify(process.argv.slice(2))!==JSON.stringify(['run','verify:serial']))process.exit(99); process.exit(17)");
  assert.equal(child.status, 17, child.stderr); const r = report(f); assert.equal(r.status, 'blocked'); assert.equal(r.stages.verifySerial.exitCode, 17); assert.equal(r.stages.postflight.status, 'pass'); assert.equal(r.releaseClaim, null);
});
test('wrapper blocks source mutation by a successful generator/verify process', t => {
  const f = fixture(t); const child = runWrapper(f, "(await import('node:fs')).appendFileSync('overlay/generated.ts','// unexpected drift');");
  assert.equal(child.status, 1, child.stderr); const r = report(f); assert.equal(r.stages.verifySerial.status, 'pass'); assert.equal(r.stages.sourceStability.status, 'blocked'); assert.equal(r.releaseClaim, null);
});
test('missing baseline prevents verify, report says not-run rather than pass', t => {
  const f = fixture(t); fs.unlinkSync(path.join(f.root, f.contract.baseline.path)); const child = runWrapper(f, 'process.exit(99)'); assert.equal(child.status, 1, child.stderr); const r = report(f); assert.equal(r.stages.verifySerial.status, 'not-run'); assert.equal(r.status, 'blocked');
});
test('report-write failure never masks the original verify exit', t => {
  const f = fixture(t); fs.mkdirSync(path.join(f.root, 'artifacts/quality-report.json'), { recursive: true }); const child = runWrapper(f, 'process.exit(17)'); assert.equal(child.status, 17, child.stderr); assert.match(child.stderr, /report-write/);
});
test('successful host fixture still cannot claim native, visual or device verification', t => {
  const f = fixture(t); const child = runWrapper(f); assert.equal(child.status, 0, child.stderr); const r = report(f); assert.equal(r.status, 'pass'); assert.equal(r.releaseClaim, 'source-tested'); for (const status of Object.values(r.manualEvidence)) assert.equal(status, 'not-run');
});
test('failed focused quality tests prevent the existing verification command', t => {
  const f = fixture(t); f.put('tests/quality/fail.test.mjs', "import test from 'node:test'; test('intentional failure',()=>{throw Error('fixture failure')})");
  const child = runWrapper(f, 'process.exit(99)'); assert.equal(child.status, 1, child.stdout + child.stderr); const r = report(f); assert.equal(r.stages.qualityTests.status, 'blocked'); assert.equal(r.stages.verifySerial.status, 'not-run'); assert.equal(r.releaseClaim, null);
});
test('report destination symlink is rejected without writing through it', t => {
  const f = fixture(t); f.put('artifacts/protected.txt', 'unchanged'); fs.symlinkSync('protected.txt', path.join(f.root, 'artifacts/quality-report.json'));
  const child = runWrapper(f); assert.equal(child.status, 1); assert.equal(fs.readFileSync(path.join(f.root, 'artifacts/protected.txt'), 'utf8'), 'unchanged'); assert.match(child.stderr, /report-write/);
});
test('postflight failure never replaces an earlier verify exit', t => {
  const f = fixture(t); const child = runWrapper(f, "(await import('node:fs')).appendFileSync('index.html','changed'); process.exit(17)");
  assert.equal(child.status, 17); const r = report(f); assert.equal(r.stages.postflight.status, 'blocked'); assert.equal(r.stages.sourceStability.status, 'blocked');
});
test('wrapper includes __proto__ build artifact as an own hashed report entry', t => {
  const f = fixture(t); f.put('dist/__proto__', 'built artifact A'); const child = runWrapper(f); assert.equal(child.status, 0, child.stdout + child.stderr);
  const files = report(f).buildArtifacts; assert.ok(Object.hasOwn(files, '__proto__')); assert.deepEqual(files['__proto__'], { bytes: Buffer.byteLength('built artifact A'), sha256: sha('built artifact A') });
});
