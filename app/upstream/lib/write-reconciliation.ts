import type { WorkState } from './work-contract.ts';
import type { IntelligenceAction } from './interaction-contract.ts';

const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  const obj = value as Record<string, unknown>;
  return Object.fromEntries(Object.keys(obj).filter(k => k !== 'neuro_profile' && k !== 'decidedAt').sort().map(k => [k, stable(obj[k])]));
};
const same = (a: unknown, b: unknown) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
function observed(old: unknown, next: unknown, saved: unknown): boolean {
  if (same(old, next)) return true;
  if ((old === undefined || Array.isArray(old)) && Array.isArray(next) && Array.isArray(saved) && [...(old || []), ...next, ...saved].every(v => v && typeof v === 'object' && 'id' in v)) {
    for (const item of next) if (!observed((old || []).find((x: {id:string}) => x.id === item.id), item, saved.find(x => x.id === item.id))) return false;
    return (old || []).every((item: {id:string}) => next.some(x => x.id === item.id) || !saved.some(x => x.id === item.id));
  }
  if ((old === undefined || (old && typeof old === 'object')) && next && saved && typeof next === 'object' && typeof saved === 'object' && !Array.isArray(next)) {
    const a = (stable(old) || {}) as Record<string, unknown>, b = stable(next) as Record<string, unknown>, c = stable(saved) as Record<string, unknown>;
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].every(key => observed(a[key], b[key], c[key]));
  }
  return same(next, saved);
}

/** Confirm changed IDs and fields after a lost response, before allowing a retry. */
export function writeIntentObserved(before: WorkState, proposed: WorkState, latest: WorkState): boolean {
  if (latest.updatedAt === before.updatedAt) return false;
  const listObserved = (old: { id: string }[], next: { id: string }[], saved: { id: string }[]) => {
    for (const item of next) if (!observed(old.find(x => x.id === item.id), item, saved.find(x => x.id === item.id))) return false;
    for (const item of old) if (!next.some(x => x.id === item.id) && saved.some(x => x.id === item.id)) return false;
    return true;
  };
  for (const key of ['notes', 'profiles', 'rooms', 'tasks'] as const) if (!listObserved(before[key], proposed[key], latest[key])) return false;
  for (const key of ['missions', 'approvals'] as const) if (!listObserved(before.command[key], proposed.command[key], latest.command[key])) return false;
  for (const key of ['checks', 'learning', 'settings'] as const) {
    const old = before[key] as Record<string, unknown>, next = proposed[key] as Record<string, unknown>, saved = latest[key] as Record<string, unknown>;
    for (const field of new Set([...Object.keys(old), ...Object.keys(next)])) if (!same(old[field], next[field]) && !same(next[field], saved[field])) return false;
  }
  return true;
}
export function actionIntentObserved(before: WorkState, action: IntelligenceAction, latest: WorkState): boolean {
  return latest.command.interactions.some(r => r.requestId === action.requestId && !before.command.interactions.some(old => old.id === r.id) && (action.action === 'focus-follow'
    ? r.kind === 'focus-followed' && r.missionId === action.missionId && r.sourceId === action.suggestionId
    : r.kind === (action.action === 'risk-accept' ? 'risk-accepted' : 'risk-task-created') && r.sourceId === action.sourceId && r.requestFingerprint === action.fingerprint && r.reason === action.reason));
}
