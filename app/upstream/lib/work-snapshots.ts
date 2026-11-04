import { savedWorkContract, type WorkState } from './work-contract.ts';
import { workReferenceErrors } from './work-updates.ts';

export function decodeSnapshot(raw: unknown): WorkState {
  if (!raw || typeof raw !== 'object' || !('schemaVersion' in raw) || !('work' in raw) || ![1, 2, 3, 4].includes(Number(raw.schemaVersion))) {
    throw new Error('Bitte einen Command-Mesh-Export der Version 1, 2, 3 oder 4 auswählen.');
  }
  if (typeof raw.schemaVersion !== 'number') throw new Error('Die Exportversion muss eine Zahl sein.');
  const result = savedWorkContract.safeParse(raw.work);
  if (!result.success) throw new Error(result.error.issues[0]?.message || 'Der Arbeitsstand ist ungültig.');
  return result.data;
}

export function encodeSnapshot(work: WorkState, data: unknown, now = new Date()) {
  return { schemaVersion: 4, exportedAt: now.toISOString(), data, work };
}

const mergeById = <T extends { id: string }>(incoming: T[], current: T[]) => [...new Map([...incoming, ...current].map(x => [x.id, x])).values()];

/** Current IDs win. Imported decisions are re-proposed and never replayed. */
export function mergeSnapshot(current: WorkState, incoming: WorkState, sources: readonly string[], now = new Date()): WorkState {
  const existingMissions = new Set(current.command.missions.map(m => m.id));
  const existingApprovals = new Set(current.command.approvals.map(a => a.id));
  const time = now.toISOString();
  const freshMissions = incoming.command.missions.filter(m => !existingMissions.has(m.id)).map(m => ({
    ...m, stage: 'Created' as const, reviewed: false, createdAt: time,
    checkpoint: (`Importiert aus Phase ${m.stage}; Abnahme neu prüfen.\n${m.checkpoint}`).slice(0, 3000),
  }));
  const freshApprovals = incoming.command.approvals.filter(a => !existingApprovals.has(a.id)).map(a => ({
    ...a, status: 'pending' as const, decidedAt: null, decisionNote: '', createdAt: time,
    expiresAt: new Date(now.getTime() + 86400000).toISOString(), executed: false as const,
  }));
  const next = savedWorkContract.parse({
    ...current,
    learning: { ...incoming.learning, ...current.learning }, checks: { ...incoming.checks, ...current.checks },
    notes: mergeById(incoming.notes, current.notes).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    rooms: mergeById(incoming.rooms, current.rooms), tasks: mergeById(incoming.tasks, current.updatedAt === null ? [] : current.tasks),
    command: { missions: [...current.command.missions, ...freshMissions], approvals: [...current.command.approvals, ...freshApprovals], events: current.command.events, interactions: current.command.interactions },
  });
  const errors = workReferenceErrors(next, sources);
  if (errors.length) throw new Error(errors[0]);
  return next;
}
