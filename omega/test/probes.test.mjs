import { test } from 'node:test';
import assert from 'node:assert/strict';
import { probeHost, parseAdbDevices, runTool } from '../node/probes.mjs';
import { CapabilityRegistry } from '../runtime/index.mjs';

const node = 'n0123456789abcdef';
const fakeRun = (table) => async (file, args) => table[`${file} ${args.join(' ')}`] ?? { ok: false, code: 'ENOENT', stdout: '', stderr: '' };

test('adb devices: nur autorisierte Geraete zaehlen', () => {
  const out = 'List of devices attached\nR5CX123\tdevice\n192.168.1.5:37123\tdevice\nABC\tunauthorized\n\n';
  assert.deepEqual(parseAdbDevices(out), ['R5CX123', '192.168.1.5:37123']);
  assert.deepEqual(parseAdbDevices('List of devices attached\n'), []);
});

test('Proben: alles vorhanden -> Spiegeln verfuegbar', async () => {
  const now = Date.now();
  const caps = await probeHost({
    node, now,
    run: fakeRun({
      'adb version': { ok: true, stdout: 'Android Debug Bridge version 1.0.41' },
      'scrcpy --version': { ok: true, stdout: 'scrcpy 3.3' },
      'adb devices': { ok: true, stdout: 'List of devices attached\nR5CX123\tdevice\n' },
    }),
  });
  const registry = new CapabilityRegistry({ now: () => now });
  for (const cap of caps) registry.upsert(cap);
  assert.deepEqual(registry.resolve('android.screen.mirror'), { id: 'android.screen.mirror', via: 'primary', state: 'available' });
});

test('Proben: kein scrcpy -> Fallback Screenshot; kein Geraet -> nichts verfuegbar', async () => {
  const now = Date.now();
  const base = { 'adb version': { ok: true, stdout: '' }, 'adb devices': { ok: true, stdout: 'List of devices attached\nR5CX123\tdevice\n' } };
  const registry = new CapabilityRegistry({ now: () => now });
  for (const cap of await probeHost({ node, now, run: fakeRun(base) })) registry.upsert(cap);
  assert.equal(registry.resolve('android.screen.mirror').id, 'android.screen.screenshot');
  const empty = new CapabilityRegistry({ now: () => now });
  for (const cap of await probeHost({ node, now, run: fakeRun({ 'adb version': { ok: true, stdout: '' }, 'adb devices': { ok: true, stdout: 'List of devices attached\n' } }) })) empty.upsert(cap);
  assert.deepEqual(empty.resolve('android.screen.mirror'), { id: null, via: 'none', state: 'unavailable', primaryReason: 'requires:android.adb.authorized' });
});

test('runTool: fehlendes Programm liefert Ergebnis statt Ausnahme', async () => {
  const result = await runTool('omega-gibt-es-nicht', ['--version']);
  assert.equal(result.ok, false);
});
