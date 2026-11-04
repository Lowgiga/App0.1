// Interop: Node erzeugt, Java (Vorlage fuer OmegaBridge/Tasker) prueft - byte-genau dieselbe MAC.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac, randomBytes } from 'node:crypto';
import { LeaseManager, HybridLogicalClock, buildTaskerCommand, toTaskerHttp, canonicalize } from '../runtime/index.mjs';

const javaFile = fileURLToPath(new URL('../java/OmegaTaskerGate.java', import.meta.url));
const hasJava = spawnSync('java', ['-version'], { encoding: 'utf8' }).status === 0;

test('Java-Gate akzeptiert Node-Befehle und weist Manipulation ab', { skip: !hasJava && 'kein JDK', timeout: 120_000 }, (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'omega-java-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const secret = randomBytes(32);
  const lease = new LeaseManager().acquire('t', 'win-1', 60_000).lease;
  const cmd = buildTaskerCommand({ action: 'OMEGA_ADB_ON', params: { minutes: 15 }, lease, hlc: new HybridLogicalClock({ node: 'win-1' }).tick() }, secret);
  const { body, headers } = toTaskerHttp(cmd);
  const run = (bodyText, mac) => {
    const file = join(dir, `body-${randomBytes(4).toString('hex')}.json`);
    writeFileSync(file, bodyText);
    return spawnSync('java', [javaFile, secret.toString('base64url'), file, mac], { encoding: 'utf8' });
  };
  const ok = run(body, headers['x-omega-mac']);
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(ok.stdout.trim(), 'OMEGA_ADB_ON');
  const tampered = run(body.replace('"minutes":15', '"minutes":30'), headers['x-omega-mac']);
  assert.equal(tampered.status, 1);
  assert.equal(tampered.stdout.trim(), 'bad-mac');
  const forged = { ...JSON.parse(body), action: 'RUN_SHELL' };
  const forgedBody = canonicalize(forged);
  const forgedRun = run(forgedBody, createHmac('sha256', secret).update(forgedBody).digest('base64url'));
  assert.equal(forgedRun.status, 2, 'gueltige MAC, aber nicht erlaubte Aktion');
});
