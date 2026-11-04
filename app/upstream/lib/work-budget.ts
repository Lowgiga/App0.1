import type { WorkState } from './work-contract.ts';
export const WORK_WRITE_BUDGET = 1750000;
export function workBytes(state: WorkState) { return new TextEncoder().encode(JSON.stringify(state)).byteLength; }
/** A write limit must not make a previously valid record unreadable or unexportable. */
export function workSizeError(state: WorkState): string | null {
  return workBytes(state) > WORK_WRITE_BUDGET ? 'Der gesamte Arbeitsstand darf bei neuen Schreibvorgängen höchstens 1.750.000 UTF-8-Bytes belegen. Den geladenen Stand zuerst exportieren und große Texte kürzen.' : null;
}
