import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// No shell or candidate-defined command is accepted. The trusted host supplies the pin.
const report = { schema: 'lowquantflow.quality-verification/v1', status: 'blocked', releaseClaim: null, stages: Object.fromEntries(['preflight', 'qualityTests', 'verifySerial', 'postflight', 'sourceStability'].map(name => [name, { status: 'not-run' }])), issues: [] };
let root = fileURLToPath(new URL('../', import.meta.url));
let exitCode = 1;
let checker;
const encode = value => JSON.stringify(value, null, 2) + '\n';
function execute(command, args) {
  const env = { ...process.env };
  // Node suppresses nested --test runs when this runner-private flag leaks from a parent.
  // Every verification child must really run, including our subprocess regression fixtures.
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false, env });
  const code = Number.isInteger(result.status) ? result.status : result.signal ? 128 + (os.constants.signals[result.signal] ?? 1) : 1;
  return { status: code === 0 ? 'pass' : 'blocked', command: [command, ...args], exitCode: code, signal: result.signal ?? null, error: result.error?.message ?? null };
}
try {
  checker = await import('./check-quality.mjs');
  const options = checker.cliOptions(process.argv.slice(2));
  root = options.root;
  report.manualEvidence = { ...checker.MANUAL_EVIDENCE };
  report.contractSha256 = options.contractSha256 ?? null;
  report.stages.preflight = checker.checkQuality(options);
  if (report.stages.preflight.status === 'pass') {
    const before = checker.snapshotSources(root);
    report.sourceBefore = { sha256: before.sha256, sourceScope: before.sourceScope };
    const testFiles = fs.readdirSync(checker.safePath(root, 'tests/quality')).filter(name => name.endsWith('.test.mjs')).sort().map(name => 'tests/quality/' + name);
    if (!testFiles.length) throw Error('No focused quality tests found.');
    report.stages.qualityTests = execute(process.execPath, ['--test', '--test-concurrency=1', ...testFiles]);
    exitCode = report.stages.qualityTests.exitCode;
    if (exitCode === 0) {
      report.stages.verifySerial = execute('npm', ['run', 'verify:serial']);
      exitCode = report.stages.verifySerial.exitCode;
    }
    report.stages.postflight = checker.checkQuality(options);
    const after = checker.snapshotSources(root);
    report.sourceAfter = { sha256: after.sha256, sourceScope: after.sourceScope };
    report.stages.sourceStability = { status: before.sha256 === after.sha256 ? 'pass' : 'blocked', diff: checker.diffFiles(before.files, after.files) };
    if (report.stages.postflight.status !== 'pass' || report.stages.sourceStability.status !== 'pass') exitCode ||= 1;
    if (exitCode === 0) {
      report.status = 'pass';
      report.releaseClaim = 'source-tested';
      // Build output is recorded separately; never promote it to native/device verification.
      if (fs.existsSync(path.join(root, 'dist'))) {
        const files = Object.create(null);
        function artifacts(directory, prefix = '') {
          for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const relative = prefix + entry.name;
            const file = checker.safePath(root, 'dist/' + relative);
            if (entry.isDirectory()) artifacts(file, relative + '/');
            else if (entry.isFile()) files[relative] = { bytes: fs.statSync(file).size, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') };
            else throw Error('Unsupported build artifact: ' + relative);
          }
        }
        artifacts(checker.safePath(root, 'dist'));
        report.buildArtifacts = files;
        if (files['index.html']) report.releaseClaim = 'web-built';
      }
    }
  }
} catch (error) {
  report.status = 'blocked'; report.releaseClaim = null; exitCode ||= 1;
  report.issues.push({ code: error.qualityCode ?? 'verify-error', detail: error.message });
} finally {
  report.exitCode = exitCode;
  try {
    if (!checker) throw Error('Checker unavailable; report is available on stderr only.');
    const directory = checker.safePath(root, 'artifacts', true);
    fs.mkdirSync(directory, { recursive: true });
    const target = checker.safePath(root, 'artifacts/quality-report.json', true);
    const fd = fs.openSync(target, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_NOFOLLOW, 0o600);
    try { fs.writeFileSync(fd, encode(report)); } finally { fs.closeSync(fd); }
    console.log('Quality report: ' + target + ' (' + report.status + ')');
  } catch (error) {
    report.status = 'blocked'; report.releaseClaim = null; exitCode ||= 1; report.exitCode = exitCode;
    report.issues.push({ code: 'report-write', detail: error.message });
    console.error(encode(report));
  }
  process.exitCode = exitCode;
}
