import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac } from 'node:crypto';
import { pairingCode } from '../runtime/index.mjs';
import { makeNode } from './helpers/fixtures.mjs';

const cli = fileURLToPath(new URL('../cli/omega.mjs', import.meta.url));

test('CLI: init, Kopplung, Tasker-Befehl, Journal, Kill-Switch', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'omega-cli-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const state = join(dir, 'state');
  const omega = (...args) => spawnSync(process.execPath, [cli, ...args, ...(args[0] === 'secret' ? [] : ['--state', state])], { encoding: 'utf8' });
  const json = (result) => {
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };

  const identity = json(omega('init', '--label', 'win-gpu'));
  assert.match(identity.node, /^n[0-9a-f]{16}$/);
  assert.equal(omega('init').status, 2, 'zweites init wird verweigert');
  assert.deepEqual(json(omega('id')).node, identity.node);

  const phone = makeNode();
  assert.equal(json(omega('pair-code', '--peer-key', phone.publicKey)).code, pairingCode(identity.publicKey, phone.publicKey));
  const wrong = omega('peer-add', '--peer-key', phone.publicKey, '--role', 'android', '--label', 'Samsung', '--code', 'abcdef');
  assert.equal(wrong.status, 1);
  assert.match(wrong.stderr, /pairing-code-mismatch/);
  const code = pairingCode(identity.publicKey, phone.publicKey);
  assert.equal(json(omega('peer-add', '--peer-key', phone.publicKey, '--role', 'android', '--label', 'Samsung', '--code', code)).node, phone.node);
  assert.equal(json(omega('peers')).length, 1);

  const secret = omega('secret');
  assert.equal(secret.status, 0);
  const secretFile = join(dir, 'tasker.secret');
  writeFileSync(secretFile, secret.stdout);
  const http = json(omega('tasker-cmd', '--secret-file', secretFile, '--action', 'OMEGA_STATUS'));
  const key = Buffer.from(secret.stdout.trim(), 'base64url');
  assert.equal(createHmac('sha256', key).update(http.body).digest('base64url'), http.headers['x-omega-mac']);
  const needsApproval = omega('tasker-cmd', '--secret-file', secretFile, '--action', 'OMEGA_ADB_ON', '--params', '{"minutes":10}');
  assert.equal(needsApproval.status, 1);
  assert.match(needsApproval.stderr, /approval-required/);
  assert.equal(omega('tasker-cmd', '--secret-file', secretFile, '--action', 'RUN_SHELL').status, 1);

  const journal = json(omega('journal-verify'));
  assert.equal(journal.ok, true);
  assert.ok(journal.count >= 2);

  assert.equal(json(omega('kill')).killed, true);
  assert.equal(json(omega('status')).killed, true);
  assert.equal(omega('kill', '--release').status, 2, 'ohne --confirm-human keine Freigabe');
  assert.equal(json(omega('kill', '--release', '--confirm-human')).level, 'E1');
  assert.equal(spawnSync(process.execPath, [cli, 'gibt-es-nicht'], { encoding: 'utf8' }).status, 1);
  assert.equal(omega('status', '--unbekannt').status, 1);
});

test('CLI: Geheimnis per --out (kein Ueberschreiben) und Windows-Kodierungen', async (t) => {
  const { decodeSecretFile } = await import('../cli/omega.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'omega-secret-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'tasker.secret');
  const first = spawnSync(process.execPath, [cli, 'secret', '--out', file], { encoding: 'utf8' });
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.stdout.includes(readFileSync(file, 'utf8').trim()), false, 'Geheimnis erscheint nicht im Terminal');
  assert.equal(spawnSync(process.execPath, [cli, 'secret', '--out', file], { encoding: 'utf8' }).status, 2, 'kein Ueberschreiben');
  const value = readFileSync(file, 'utf8').trim();
  assert.equal(decodeSecretFile(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(`${value}\r\n`, 'utf16le')])), value);
  assert.equal(decodeSecretFile(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(`${value}\n`)])), value);
});

test('CLI: Schluessel mit fuehrendem Bindestrich (1 von 64) funktionieren', async (t) => {
  const { normalizeArgs } = await import('../cli/omega.mjs');
  const options = { 'peer-key': { type: 'string' }, confirm: { type: 'boolean' } };
  assert.deepEqual(normalizeArgs(['--peer-key', '-AbC', '--confirm'], options), ['--peer-key=-AbC', '--confirm']);
  assert.deepEqual(normalizeArgs(['--peer-key=-AbC'], options), ['--peer-key=-AbC']);
  assert.deepEqual(normalizeArgs(['--constructor', 'x'], options), ['--constructor', 'x']);

  const dir = mkdtempSync(join(tmpdir(), 'omega-dash-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const state = join(dir, 'state');
  const omega = (...args) => spawnSync(process.execPath, [cli, ...args, '--state', state], { encoding: 'utf8' });
  const identity = JSON.parse(omega('init').stdout);
  let phone;
  do phone = makeNode(); while (!phone.publicKey.startsWith('-'));
  const code = omega('pair-code', '--peer-key', phone.publicKey);
  assert.equal(code.status, 0, code.stderr);
  assert.equal(JSON.parse(code.stdout).code, pairingCode(identity.publicKey, phone.publicKey));
  const added = omega('peer-add', '--peer-key', phone.publicKey, '--role', 'android', '--label', 'Samsung', '--code', pairingCode(identity.publicKey, phone.publicKey));
  assert.equal(added.status, 0, added.stderr);
});
