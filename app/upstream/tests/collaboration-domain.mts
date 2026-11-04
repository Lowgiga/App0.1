import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { buildCollaborationBrief, collaborationMarkdown, collaborationRegistry as registry, lowReportContract, lowReportNote, parseLowReport, reportMatchesBrief } from '../lib/collaboration-model.ts';
import { checkOwnedPaths } from '../lib/collaboration-scope.mjs';
import { emptyWork } from '../lib/work-contract.ts';
const state = emptyWork();
function report() {
  const brief = buildCollaborationBrief(state);
  return { schemaVersion: 1, revision: brief.revision, missionId: brief.missionId, briefHash: brief.briefHash, from: 'low', acknowledged: true, referenceCommit: brief.referenceCommit, baseCommit: registry.referenceCommit, status: 'blocked', summary: 'Agent meldet einen konkret beschriebenen Zugriffsblocker.', changedFiles: [], tests: [], blockers: ['Eigenes Gerät ist aktuell nicht erreichbar.'] };
}
test('brief has a real read-only route but keeps identity delivery and acknowledgement unverified', () => {
  const brief = buildCollaborationBrief(state);
  assert.equal(brief.transport.tool, 'mesh_get_collaboration_brief'); assert.equal(brief.state, 'prepared-not-delivered');
  assert.equal(brief.identity.directChannel, 'not-verified'); assert.equal(brief.identity.acknowledgement, 'not-received');
  assert.equal(brief.limits.externalWrite, false); assert.equal(brief.limits.scheduler, false); assert.equal(brief.limits.install, false);
});
test('brief exposes only bounded context and no identity email private notes or permission tokens', () => {
  const own = emptyWork(); own.notes.push({ id: crypto.randomUUID(), text: 'private-note-do-not-share', createdAt: new Date().toISOString() });
  const text = JSON.stringify(buildCollaborationBrief(own));
  assert.ok(!text.includes('private-note-do-not-share')); assert.ok(!text.includes('oai-authenticated-user'));
  assert.equal(buildCollaborationBrief().context.kind, 'unknown');
});
test('brief binding is actual SHA-256 semantic content and ignores generated time', () => {
  const b = buildCollaborationBrief(state, '2026-10-01T00:00:00Z');
  const { briefHash, generatedAt, ...content } = b;
  assert.equal(briefHash, crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex'));
  assert.equal(briefHash, buildCollaborationBrief(state, '2026-10-02T00:00:00Z').briefHash); assert.ok(generatedAt);
});
test('scope changes alter the brief binding and reports stay unverified claims', () => {
  const valid = parseLowReport(JSON.stringify(report())); assert.equal(reportMatchesBrief(valid, state), true);
  const next = { ...state, updatedAt: '2026-10-01T00:03:00.000Z' };
  assert.equal(reportMatchesBrief(valid, next), false);
  assert.ok(lowReportNote(valid).includes('NICHT unabhängig verifiziert')); assert.equal(valid.status, 'blocked');
});
test('old revision remains readable as a claim but never matches the current brief', () => {
  const old = parseLowReport(JSON.stringify({ ...report(), revision: 'older-brief', briefHash: '0'.repeat(64) }));
  assert.equal(reportMatchesBrief(old, state), false);
  assert.ok(lowReportNote(old, 'historical').includes('HISTORISCH: abweichender Arbeitsbrief'));
});
test('unknown report fields claimed verified flags and invalid sender are rejected', () => {
  assert.equal(lowReportContract.safeParse({ ...report(), verified: true }).success, false);
  assert.equal(lowReportContract.safeParse({ ...report(), from: 'codex' }).success, false);
  assert.equal(lowReportContract.safeParse({ ...report(), acknowledged: false }).success, false);
});
test('invalid JSON unicode byte overflow and incomplete commits are rejected', () => {
  assert.throws(() => parseLowReport('null')); assert.throws(() => parseLowReport('not json'));
  assert.throws(() => parseLowReport('ä'.repeat(13000)), /UTF-8/);
  assert.equal(lowReportContract.safeParse({ ...report(), baseCommit: '2b838b4' }).success, false);
});
test('completed claims require documented successful tests and no blocker', () => {
  const done = { ...report(), status: 'completed', blockers: [], changedFiles: ['docs/low/access.md'] };
  assert.equal(lowReportContract.safeParse(done).success, false);
  const checked = { ...done, tests: [{ command: 'manual Android test', exitCode: 0, evidence: 'Actual viewport and result documented.' }] };
  assert.equal(lowReportContract.safeParse(checked).success, true);
  assert.equal(lowReportContract.safeParse({ ...checked, tests: [{ ...checked.tests[0], exitCode: null }] }).success, false);
});
test('duplicates forbidden paths and unsupported schema version do not pass result intake', () => {
  assert.equal(lowReportContract.safeParse({ ...report(), changedFiles: ['docs/low/a.md', 'docs/low/a.md'] }).success, false);
  assert.equal(lowReportContract.safeParse({ ...report(), changedFiles: ['lib/work-contract.ts'] }).success, false);
  assert.equal(lowReportContract.safeParse({ ...report(), schemaVersion: 2 }).success, false);
});
test('oversized valid evidence cannot exceed personal note limit', () => {
  const large = parseLowReport(JSON.stringify({ ...report(), tests: Array.from({ length: 6 }, () => ({ command: 'manual probe', exitCode: null, evidence: 'E'.repeat(900) })) }));
  assert.throws(() => lowReportNote(large), /Notiz/);
});
test('code-like report commands are only preserved as text and are never executed', () => {
  const r = parseLowReport(JSON.stringify({ ...report(), tests: [{ command: 'rm -rf / ; <script>alert(1)</script>', exitCode: null, evidence: 'Received command text, not executed.' }] }));
  assert.ok(lowReportNote(r).includes('<script>')); assert.ok(collaborationMarkdown(state).includes('niemals automatisch ausgeführt'));
});
test('ownership has disjoint niches protects common contracts and rejects prototype agent names', () => {
  assert.equal(checkOwnedPaths(registry, 'low', ['integrations/low/read.ts', 'tests/low/qa.md', 'docs/low/result.md']).ok, true);
  assert.equal(checkOwnedPaths(registry, 'low', ['app/mesh-app.tsx']).ok, false);
  assert.equal(checkOwnedPaths(registry, 'codex', ['package.json']).ok, false);
  assert.equal(checkOwnedPaths(registry, 'constructor', []).ok, false);
});
test('invalid paths traversal similar prefixes secrets and generated output are rejected', () => {
  for (const file of ['integrations/low/../a', '/integrations/low/a', 'integrations/lowish/a', 'integrations/low/.env', 'integrations/low/.ENV.local', 'integrations/low/.env.local', 'integrations/low/Node_Modules/a', 'integrations/low/node_modules/a', 'docs/low/./a', 'docs/low/a\nother', 'docs/low/a\tother', 'docs/low/a\x7fother', 'docs\\low\\a']) assert.equal(checkOwnedPaths(registry, 'low', [file]).ok, false, file);
});

function fixture(action: (dir: string, base: string, check: () => { status: number | null; stdout: string }) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesh-scope-'));
  const git = (args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    fs.mkdirSync(path.join(dir, 'scripts')); fs.mkdirSync(path.join(dir, 'lib')); fs.mkdirSync(path.join(dir, 'docs/low'), { recursive: true });
    for (const file of ['scripts/check-agent-scope.mjs', 'lib/collaboration-scope.mjs', 'lib/collaboration-registry.json']) fs.copyFileSync(new URL('../' + file, import.meta.url), path.join(dir, file));
    fs.writeFileSync(path.join(dir, 'package.json'), '{}'); fs.writeFileSync(path.join(dir, 'docs/low/baseline.md'), 'initial\n');
    git(['init', '-q', '-b', 'feat/low-fixture']); git(['add', '.']); git(['-c', 'user.name=Local Scope Fixture', '-c', 'user.email=qa@example.invalid', 'commit', '-q', '-m', 'Scope baseline']);
    const base = git(['rev-parse', 'HEAD']).trim();
    const check = () => spawnSync(process.execPath, ['scripts/check-agent-scope.mjs', '--agent', 'low', '--base', base], { cwd: dir, encoding: 'utf8' });
    action(dir, base, check);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
test('actual git guard includes owned untracked files and owned deleted files', () => fixture((dir, _base, check) => {
  fs.writeFileSync(path.join(dir, 'docs/low/new.md'), 'new\n'); fs.unlinkSync(path.join(dir, 'docs/low/baseline.md'));
  const result = check(); assert.equal(result.status, 0); const body = JSON.parse(result.stdout); assert.ok(body.files.includes('docs/low/new.md')); assert.ok(body.files.includes('docs/low/baseline.md'));
}));
test('moving a protected source to an owned destination still fails the actual git guard', () => fixture((dir, _base, check) => {
  fs.renameSync(path.join(dir, 'package.json'), path.join(dir, 'docs/low/package.json')); const result = check(); assert.equal(result.status, 1);
  assert.ok(JSON.parse(result.stdout).violations.some((v: { path: string }) => v.path === 'package.json'));
}));
test('owned symlinks fail the actual git guard instead of following their target', () => fixture((dir, _base, check) => {
  fs.symlinkSync('../../package.json', path.join(dir, 'docs/low/shortcut')); assert.equal(check().status, 1);
}));
test('a staged symlink with a tabbed name still fails after worktree deletion', () => fixture((dir, _base, check) => {
  const file = 'docs/low/tab\tshortcut'; fs.symlinkSync('../../package.json', path.join(dir, file));
  execFileSync('git', ['add', '--', file], { cwd: dir }); fs.unlinkSync(path.join(dir, file));
  const result = check(); assert.equal(result.status, 1);
  assert.ok(JSON.parse(result.stdout).violations.some((v: { path: string; reason: string }) => v.path === file && v.reason.includes('Index')));
}));
test('file-mode changes on protected files fail the actual git guard', () => fixture((dir, _base, check) => {
  fs.chmodSync(path.join(dir, 'package.json'), 0o755); assert.equal(check().status, 1);
}));
test('submodule gitlinks in owned paths fail the actual git guard', () => fixture((dir, base, check) => {
  execFileSync('git', ['update-index', '--add', '--cacheinfo', `160000,${base},docs/low/submodule`], { cwd: dir }); assert.equal(check().status, 1);
}));
test('wrong branch fails closed', () => fixture((dir, _base, check) => {
  execFileSync('git', ['switch', '-q', '-c', 'other-agent'], { cwd: dir }); assert.equal(check().status, 2);
}));
test('abbreviated or unavailable source base fails closed', () => fixture((dir, _base, _check) => {
  for (const base of ['2b838b4', 'f'.repeat(40)]) assert.equal(spawnSync(process.execPath, ['scripts/check-agent-scope.mjs', '--agent', 'low', '--base', base], { cwd: dir, encoding: 'utf8' }).status, 2);
}));
test('another current directory cannot accidentally check a different project', () => fixture((dir, base, _check) => {
  assert.equal(spawnSync(process.execPath, [path.join(dir, 'scripts/check-agent-scope.mjs'), '--agent', 'low', '--base', base], { cwd: os.tmpdir(), encoding: 'utf8' }).status, 2);
}));
