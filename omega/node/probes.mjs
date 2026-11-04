// Nachweis-Proben fuer den Windows-Knoten (P3): pruefen echte Werkzeuge und erzeugen
// omega.capability/v1 mit kurzer Gueltigkeit. Keine Shell, feste Argumente, Zeitlimit.
import { execFile } from 'node:child_process';

export const PROBE_TTL_MS = 5 * 60_000;

/** Fuehrt ein Programm ohne Shell aus; Ergebnis statt Ausnahme. */
export function runTool(file, args, { timeoutMs = 5_000 } = {}) {
  return new Promise((resolve) => {
    execFile(file, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 256 * 1024 }, (error, stdout, stderr) => {
      resolve({ ok: !error, code: error ? (error.code ?? 1) : 0, stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

const iso = (ms) => new Date(ms).toISOString();

function capability({ id, provider, node, effect = 'read-only', requires = [], fallbacks = [], passed, checkId, now }) {
  return {
    schema: 'omega.capability/v1',
    id,
    provider,
    node,
    effect,
    requires,
    state: passed ? 'available' : 'unavailable',
    evidence: { checkId, status: passed ? 'passed' : 'failed', verifiedAt: iso(now), expiresAt: iso(now + PROBE_TTL_MS) },
    fallbacks,
  };
}

/** Zaehlt autorisierte Geraete aus "adb devices" (Zeilen "<serial>\tdevice"). */
export function parseAdbDevices(stdout) {
  return stdout.split(/\r?\n/).map((line) => line.trim()).filter((line) => /^\S+\s+device$/.test(line)).map((line) => line.split(/\s+/)[0]);
}

/** Proben fuer adb, scrcpy und ein autorisiertes Geraet; abgeleitete Faehigkeiten fuer Spiegeln/Screenshot. */
export async function probeHost({ node, run = runTool, now = Date.now(), adb = 'adb', scrcpy = 'scrcpy' }) {
  const [adbVersion, scrcpyVersion] = await Promise.all([run(adb, ['version']), run(scrcpy, ['--version'])]);
  const devices = adbVersion.ok ? parseAdbDevices((await run(adb, ['devices'])).stdout) : [];
  return [
    capability({ id: 'host.adb.present', provider: { kind: 'binary', name: 'adb' }, node, passed: adbVersion.ok, checkId: 'probe.adb.version', now }),
    capability({ id: 'host.scrcpy.present', provider: { kind: 'binary', name: 'scrcpy' }, node, passed: scrcpyVersion.ok, checkId: 'probe.scrcpy.version', now }),
    capability({
      id: 'android.adb.authorized', provider: { kind: 'binary', name: 'adb' }, node, requires: ['host.adb.present'],
      passed: devices.length > 0, checkId: 'probe.adb.devices', now,
    }),
    capability({
      id: 'android.screen.mirror', provider: { kind: 'binary', name: 'scrcpy' }, node,
      requires: ['android.adb.authorized', 'host.scrcpy.present'], fallbacks: ['android.screen.screenshot'],
      passed: true, checkId: 'derive.android.screen.mirror', now,
    }),
    capability({
      id: 'android.screen.screenshot', provider: { kind: 'binary', name: 'adb' }, node, requires: ['android.adb.authorized'],
      passed: true, checkId: 'derive.android.screen.screenshot', now,
    }),
  ];
}
