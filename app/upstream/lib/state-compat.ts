import type { WorkState } from './work-contract.ts';

const v3Views = ['overview', 'agents', 'missions', 'approvals', 'activity', 'connections', 'pilot', 'make', 'lab', 'addons', 'evidence', 'chats', 'matrix', 'space', 'settings'];
const v2Views = v3Views.filter(v => !['missions', 'approvals', 'activity'].includes(v));

/** Existing strict clients stay usable. Never send a v4-only field to a v3 parser. */
export function projectState(state: WorkState, version: string | null): Record<string, unknown> {
  if (version === '4') return state;
  const { neuro: _neuro, ...settings } = state.settings;
  const legacy = { ...state, settings: { ...settings, startView: (version === '3' ? v3Views : v2Views).includes(settings.startView) ? settings.startView : 'overview' } };
  if (version === '3') return {
    ...legacy, stateVersion: 3,
    command: {
      missions: state.command.missions.map(({ neuro_profile: _p, deadlineAt: _d, ...m }) => m),
      approvals: state.command.approvals,
      events: state.command.events.map(({ neuro_profile: _p, neuro_context: _c, ...e }) => ({ ...e, kind: ['task-updated', 'risk-accepted', 'risk-task-created', 'focus-followed'].includes(e.kind) ? 'workspace-updated' : e.kind })),
    },
  };
  const { stateVersion: _v, command: _c, ...old } = legacy;
  return old;
}

/** Upgrade the projected history only when the old client has not changed it. */
export function preserveLegacyFields(current: WorkState, changes: Partial<WorkState>, version: string | null): Partial<WorkState> {
  if (version === '4') return changes;
  const next = { ...changes };
  if (next.settings) next.settings = { ...next.settings, neuro: current.settings.neuro, startView: next.settings.startView === 'overview' && !(version === '3' ? v3Views : v2Views).includes(current.settings.startView) ? current.settings.startView : next.settings.startView };
  if (next.command && version === '3') {
    const projected = projectState(current, '3').command as { events: unknown[] };
    const clientEvents = next.command.events.map(({ neuro_profile: _p, neuro_context: _c, ...e }) => e);
    next.command = {
      ...next.command, interactions: current.command.interactions,
      missions: next.command.missions.map(m => ({ ...m, deadlineAt: current.command.missions.find(old => old.id === m.id)?.deadlineAt ?? null })),
      events: clientEvents.length === projected.events.length && clientEvents.every((e, i) => {
        const old = projected.events[i] as Record<string, unknown>;
        return ['id', 'sequence', 'at', 'origin', 'entityId', 'kind', 'title'].every(key => (e as Record<string, unknown>)[key] === old[key]);
      }) ? current.command.events : next.command.events,
    };
  }
  return next;
}
