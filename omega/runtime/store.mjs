// Atomarer Zustandsspeicher: schreiben in Temp-Datei, fsync, umbenennen, Verzeichnis-fsync.
// Ein Absturz hinterlaesst entweder den alten oder den neuen Zustand, nie einen halben.
import {
  closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

export function writeJsonAtomic(path, value, { mode = 0o600 } = {}) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  const fd = openSync(tmp, 'wx', mode);
  try {
    writeSync(fd, `${JSON.stringify(value, null, 2)}\n`);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  try {
    renameSync(tmp, path);
  } catch (error) {
    try {
      unlinkSync(tmp);
    } catch {
      // Temp-Datei bereits weg
    }
    throw error;
  }
  if (process.platform !== 'win32') {
    const dir = openSync(dirname(path), 'r');
    try {
      fsyncSync(dir);
    } finally {
      closeSync(dir);
    }
  }
}

/** { ok: true, value } - value ist undefined, wenn die Datei fehlt; { ok: false, error } bei Defekt. */
export function readJson(path) {
  try {
    return { ok: true, value: JSON.parse(readFileSync(path, 'utf8')) };
  } catch (error) {
    if (error?.code === 'ENOENT') return { ok: true, value: undefined };
    return { ok: false, error: String(error?.message ?? error) };
  }
}
