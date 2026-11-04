import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import registry from '../lib/collaboration-registry.json' with { type: 'json' };
import { checkOwnedPaths } from '../lib/collaboration-scope.mjs';

const args = process.argv.slice(2);
let agent, base;
try {
  for (let i = 0; i < args.length; i += 2) {
    if (args[i] === '--agent' && !agent) agent = args[i + 1];
    else if (args[i] === '--base' && !base) base = args[i + 1];
    else throw new Error('Usage: node scripts/check-agent-scope.mjs --agent codex|low --base FULL_SHA');
  }
  if (!Object.hasOwn(registry.roles, agent) || !/^[a-f0-9]{40}$/.test(base)) throw new Error('Agent und vollständiger Basiscommit erforderlich.');
  const git = a => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const projectRoot = fileURLToPath(new URL('../', import.meta.url));
  if (path.resolve(git(['rev-parse', '--show-toplevel']).trim()) !== path.resolve(projectRoot)) throw new Error('Im zugehörigen App-Projekt ausführen; kein anderes Repository prüfen.');
  const branch = git(['branch', '--show-current']).trim();
  if (!branch.startsWith(registry.roles[agent].branchPrefix)) throw new Error(`Eigener Branch mit Präfix ${registry.roles[agent].branchPrefix} erforderlich.`);
  git(['rev-parse', '--verify', `${base}^{commit}`]);
  git(['merge-base', '--is-ancestor', base, 'HEAD']);
  const paths = [...new Set((git(['diff', '--no-renames', '--name-only', '-z', base, '--']) + git(['diff', '--cached', '--no-renames', '--name-only', '-z', base, '--']) + git(['ls-files', '--others', '--exclude-standard', '-z'])).split('\0').filter(Boolean))];
  const check = checkOwnedPaths(registry, agent, paths);
  for (const file of paths) {
    try {
      const stat = fs.lstatSync(file);
      if (!stat.isFile()) check.violations.push({ path: file, reason: 'Symlink, Submodule oder andere Nicht-Datei ist kein erlaubter Entwurf.' });
    } catch (e) { if (e.code !== 'ENOENT') throw e; } // Deletions still pass ownership checks.
  }
  // Check index/HEAD file modes as well, including deleted gitlinks and symlinks.
  for (const ref of [base, 'HEAD']) {
    for (const entry of git(['ls-tree', '-r', '-z', ref]).split('\0').filter(Boolean)) {
      const separator = entry.indexOf('\t'); const meta = entry.slice(0, separator), file = entry.slice(separator + 1);
      if (paths.includes(file) && ['120000', '160000'].includes(meta.split(' ')[0])) check.violations.push({ path: file, reason: 'Symlink/Submodule im verglichenen Stand benötigt explizites Review.' });
    }
  }
  for (const entry of git(['ls-files', '--stage', '-z']).split('\0').filter(Boolean)) {
    const separator = entry.indexOf('\t'); const meta = entry.slice(0, separator), file = entry.slice(separator + 1);
    if (paths.includes(file) && ['120000', '160000'].includes(meta.split(' ')[0])) check.violations.push({ path: file, reason: 'Symlink/Submodule im Index ist nicht erlaubt.' });
  }
  const report = { status: check.violations.length ? 'FAIL' : 'PASS', agent, baseCommit: base, headCommit: git(['rev-parse', 'HEAD']).trim(), files: paths, violations: check.violations, qualification: 'Lokale advisory Dateiprüfung, kein Berechtigungsmechanismus und keine Bestätigung von Tests oder Integration.' };
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = check.violations.length ? 1 : 0;
} catch (e) { console.error(e instanceof Error ? e.message : 'Scope-Prüfung fehlgeschlagen.'); process.exitCode = 2; }
