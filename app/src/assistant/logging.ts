export type RunEvent = {
  eventId: string;
  runId: string;
  role: 'advisor' | 'specialist' | 'local-helper' | null;
  phase: 'started' | 'calling' | 'retrying' | 'completed' | 'stopped';
  code: 'OK' | 'INVALID_REQUEST' | 'INVALID_RESULT' | 'CONTEXT_MISMATCH' |
    'STALE_BASIS' | 'CONTEXT_BUDGET' | 'OUTPUT_BUDGET' | 'POLICY' | 'BUDGET' |
    'UNAVAILABLE' | 'ABORTED' | 'TIMEOUT' | 'SUPERSEDED' | 'ADAPTER_FAILED' |
    'DUPLICATE' | 'CYCLE' | 'TEMPORARY_READ' | 'UNKNOWN_SIDE_EFFECT' | 'LOGGING_FAILED';
  durationMs: number;
  counters: { hostSteps: number; modelCalls: number; repairAttempts: number };
  context: { contextId: string; contextCreatedAt: string };
  basis: { workUpdatedAt: string | null; memoryRevision: number; configRevision: number };
  mode: 'simulated' | 'model' | 'deterministic' | 'unavailable';
};

const ROLES = ['advisor', 'specialist', 'local-helper'] as const;
const PHASES = ['started', 'calling', 'retrying', 'completed', 'stopped'] as const;
const MODES = ['simulated', 'model', 'deterministic', 'unavailable'] as const;
const CODES = [
  'OK', 'INVALID_REQUEST', 'INVALID_RESULT', 'CONTEXT_MISMATCH', 'STALE_BASIS',
  'CONTEXT_BUDGET', 'OUTPUT_BUDGET', 'POLICY', 'BUDGET', 'UNAVAILABLE', 'ABORTED',
  'TIMEOUT', 'SUPERSEDED', 'ADAPTER_FAILED', 'DUPLICATE', 'CYCLE', 'TEMPORARY_READ',
  'UNKNOWN_SIDE_EFFECT', 'LOGGING_FAILED',
] as const;

function record(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object') return null;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null ? value as Record<string, unknown> : null;
}

// Read only named own data properties. Do not invoke getters or inspect extras.
function own(value: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
}

function member<T extends string>(value: unknown, choices: readonly T[]): value is T {
  return typeof value === 'string' && choices.some(choice => choice === value);
}

function uuid(value: unknown): value is string {
  return typeof value === 'string' && value.length === 36 &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// The host contract uses UTC ISO timestamps, with up to millisecond precision.
// Component comparisons reject Date.parse's normalization of impossible dates.
function iso(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 24) return false;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/.exec(value);
  if (!parts) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) &&
    date.getUTCFullYear() === Number(parts[1]) &&
    date.getUTCMonth() + 1 === Number(parts[2]) &&
    date.getUTCDate() === Number(parts[3]) &&
    date.getUTCHours() === Number(parts[4]) &&
    date.getUTCMinutes() === Number(parts[5]) &&
    date.getUTCSeconds() === Number(parts[6]);
}

function integer(value: unknown, cap: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= cap;
}

/**
 * Pure metadata projection. Invalid allowed fields reject the event as a whole;
 * unknown fields are never copied, serialized, hashed, or traversed.
 * The caller must separately enforce current project and generation ownership.
 */
export function projectRunEvent(raw: unknown): RunEvent | null {
  try {
    const source = record(raw);
    if (!source) return null;
    const eventId = own(source, 'eventId');
    const runId = own(source, 'runId');
    const role = own(source, 'role');
    const phase = own(source, 'phase');
    const code = own(source, 'code');
    const durationMs = own(source, 'durationMs');
    const mode = own(source, 'mode');
    if (!uuid(eventId) || !uuid(runId) || (role !== null && !member(role, ROLES)) ||
        !member(phase, PHASES) || !member(code, CODES) || !member(mode, MODES) ||
        typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0 || durationMs > 30000) {
      return null;
    }
    const counters = record(own(source, 'counters'));
    const context = record(own(source, 'context'));
    const basis = record(own(source, 'basis'));
    if (!counters || !context || !basis) return null;
    const hostSteps = own(counters, 'hostSteps');
    const modelCalls = own(counters, 'modelCalls');
    const repairAttempts = own(counters, 'repairAttempts');
    const contextId = own(context, 'contextId');
    const contextCreatedAt = own(context, 'contextCreatedAt');
    const workUpdatedAt = own(basis, 'workUpdatedAt');
    const memoryRevision = own(basis, 'memoryRevision');
    const configRevision = own(basis, 'configRevision');
    if (!integer(hostSteps, 12) || !integer(modelCalls, 3) || !integer(repairAttempts, 1) ||
        !uuid(contextId) || !iso(contextCreatedAt) || (workUpdatedAt !== null && !iso(workUpdatedAt)) ||
        !integer(memoryRevision, Number.MAX_SAFE_INTEGER) || !integer(configRevision, Number.MAX_SAFE_INTEGER)) {
      return null;
    }
    return {
      eventId, runId, role, phase, code, durationMs, mode,
      counters: { hostSteps, modelCalls, repairAttempts },
      context: { contextId, contextCreatedAt },
      basis: { workUpdatedAt, memoryRevision, configRevision },
    };
  } catch {
    // Unreadable or revoked objects are not diagnostic content either.
    return null;
  }
}
