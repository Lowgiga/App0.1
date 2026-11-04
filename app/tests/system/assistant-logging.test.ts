import assert from 'node:assert/strict';
import test from 'node:test';
import { projectRunEvent, type RunEvent } from '../../src/assistant/logging.ts';

const SENTINEL = 'SENTINEL_SECRET_must_never_reach_the_log_74df';

function event(): RunEvent {
  return {
    eventId: 'ef4fd843-7991-4ff8-9b0b-434bd3d9aad2',
    runId: '450d7f2c-ff66-45c8-af6a-abaf23b6c533',
    role: 'advisor', phase: 'completed', code: 'OK', durationMs: 125.5,
    counters: { hostSteps: 3, modelCalls: 1, repairAttempts: 0 },
    context: {
      contextId: 'b181f275-2b6a-4bde-a347-35fa2fd86ea1',
      contextCreatedAt: '2026-10-05T08:00:00.000Z',
    },
    basis: { workUpdatedAt: '2026-10-05T08:01:00.000Z', memoryRevision: 4, configRevision: 1 },
    mode: 'simulated',
  };
}

test('projects exactly the supported metadata without copying secrets or source objects', () => {
  const expected = event();
  const raw = {
    ...expected,
    prompt: SENTINEL,
    error: new Error(SENTINEL),
    metadata: { deep: { token: SENTINEL } },
    bindingId: SENTINEL,
    url: `https://example.invalid/${SENTINEL}`,
    headers: { authorization: SENTINEL },
    counters: { ...expected.counters, credential: SENTINEL },
    context: { ...expected.context, name: SENTINEL },
    basis: { ...expected.basis, source: SENTINEL },
  };
  const result = projectRunEvent(raw);
  assert.deepEqual(result, expected);
  assert.ok(result);
  assert.equal(JSON.stringify(result).includes(SENTINEL), false);
  assert.notEqual(result, raw);
  assert.notEqual(result.counters, raw.counters);
  assert.notEqual(result.context, raw.context);
  assert.notEqual(result.basis, raw.basis);
});

test('does not enumerate, stringify, hash, or read unknown fields', () => {
  let reads = 0;
  const raw = event() as RunEvent & Record<string, unknown>;
  Object.defineProperty(raw, 'prompt', { get() { reads += 1; throw new Error(SENTINEL); } });
  raw.toJSON = () => { reads += 1; throw new Error(SENTINEL); };
  raw.metadata = raw;
  assert.deepEqual(projectRunEvent(raw), event());
  assert.equal(reads, 0);
});

test('does not invoke accessors in allowed fields', () => {
  let reads = 0;
  const raw = event();
  Object.defineProperty(raw, 'code', { get() { reads += 1; return 'OK'; } });
  assert.equal(projectRunEvent(raw), null);
  assert.equal(reads, 0);
});

test('rejects accessors in allowed nested fields without invoking them', () => {
  let reads = 0;
  const raw = event();
  Object.defineProperty(raw.context, 'contextId', { get() { reads += 1; return event().context.contextId; } });
  assert.equal(projectRunEvent(raw), null);
  assert.equal(reads, 0);
});

test('rejects inherited metadata, arrays, errors, and unreadable objects', () => {
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  for (const raw of [null, undefined, true, 1, SENTINEL, [], new Error(SENTINEL), Object.create(event()), revoked.proxy]) {
    assert.equal(projectRunEvent(raw), null);
  }
  assert.equal(projectRunEvent({ ...event(), counters: Object.create(event().counters) }), null);
  assert.equal(projectRunEvent({ ...event(), context: [] }), null);
});

test('accepts own data properties on null-prototype objects', () => {
  const raw = Object.assign(Object.create(null), event());
  raw.counters = Object.assign(Object.create(null), raw.counters);
  assert.deepEqual(projectRunEvent(raw), event());
});

for (const key of Object.keys(event()) as (keyof RunEvent)[]) {
  test(`rejects missing required ${key}`, () => {
    const raw: Partial<RunEvent> = event();
    delete raw[key];
    assert.equal(projectRunEvent(raw), null);
  });
  test(`rejects secret text placed in allowed ${key}`, () => {
    assert.equal(projectRunEvent({ ...event(), [key]: SENTINEL }), null);
  });
}

for (const key of ['eventId', 'runId'] as const) {
  test(`requires an actual UUID for ${key}`, () => {
    for (const id of ['', 'run-1', '00000000-0000-0000-0000-000000000000', 'ef4fd843-7991-0ff8-9b0b-434bd3d9aad2', 'ef4fd843-7991-4ff8-0b0b-434bd3d9aad2', `${event()[key]}${SENTINEL}`]) {
      assert.equal(projectRunEvent({ ...event(), [key]: id }), null);
    }
  });
}

test('rejects non-UUID context identity and malformed ISO timestamps', () => {
  assert.equal(projectRunEvent({ ...event(), context: { ...event().context, contextId: SENTINEL } }), null);
  for (const value of [SENTINEL, '2026-02-30T08:00:00.000Z', '2026-13-05T08:00:00.000Z', '2026-10-05', '2026-10-05T24:00:00.000Z', '2026-10-05T08:00:00.000Z trailing']) {
    assert.equal(projectRunEvent({ ...event(), context: { ...event().context, contextCreatedAt: value } }), null);
    assert.equal(projectRunEvent({ ...event(), basis: { ...event().basis, workUpdatedAt: value } }), null);
  }
});

test('accepts valid ISO seconds and milliseconds and a null work timestamp', () => {
  for (const timestamp of ['2024-02-29T23:59:59Z', '2026-10-05T08:00:00.1Z', '2026-10-05T08:00:00.123Z']) {
    const raw = { ...event(), context: { ...event().context, contextCreatedAt: timestamp }, basis: { ...event().basis, workUpdatedAt: null } };
    assert.deepEqual(projectRunEvent(raw), raw);
  }
});

test('requires safe nonnegative integer revisions', () => {
  for (const key of ['memoryRevision', 'configRevision'] as const) {
    for (const revision of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, SENTINEL, null, undefined]) {
      assert.equal(projectRunEvent({ ...event(), basis: { ...event().basis, [key]: revision } }), null);
    }
    for (const revision of [0, Number.MAX_SAFE_INTEGER]) {
      const raw = { ...event(), basis: { ...event().basis, [key]: revision } };
      assert.deepEqual(projectRunEvent(raw), raw);
    }
  }
});

test('requires finite nonnegative duration within the hard cap', () => {
  for (const durationMs of [-1, NaN, Infinity, -Infinity, 30000.01, '12', null]) {
    assert.equal(projectRunEvent({ ...event(), durationMs }), null);
  }
  for (const durationMs of [0, 0.125, 30000]) {
    const raw = { ...event(), durationMs };
    assert.deepEqual(projectRunEvent(raw), raw);
  }
});

test('enforces integer counter bounds without silently clamping invalid values', () => {
  for (const [key, cap] of [['hostSteps', 12], ['modelCalls', 3], ['repairAttempts', 1]] as const) {
    for (const value of [-1, 0.5, cap + 1, NaN, Infinity, SENTINEL, null, undefined]) {
      assert.equal(projectRunEvent({ ...event(), counters: { ...event().counters, [key]: value } }), null);
    }
    for (const value of [0, cap]) {
      const raw = { ...event(), counters: { ...event().counters, [key]: value } };
      assert.deepEqual(projectRunEvent(raw), raw);
    }
  }
});

test('accepts only the documented role, phase, mode, and result-code enums', () => {
  const values = {
    role: ['advisor', 'specialist', 'local-helper', null],
    phase: ['started', 'calling', 'retrying', 'completed', 'stopped'],
    mode: ['simulated', 'model', 'deterministic', 'unavailable'],
    code: ['OK', 'INVALID_REQUEST', 'INVALID_RESULT', 'CONTEXT_MISMATCH', 'STALE_BASIS', 'CONTEXT_BUDGET', 'OUTPUT_BUDGET', 'POLICY', 'BUDGET', 'UNAVAILABLE', 'ABORTED', 'TIMEOUT', 'SUPERSEDED', 'ADAPTER_FAILED', 'DUPLICATE', 'CYCLE', 'TEMPORARY_READ', 'UNKNOWN_SIDE_EFFECT', 'LOGGING_FAILED'],
  };
  for (const [key, choices] of Object.entries(values)) {
    for (const choice of choices) {
      const raw = { ...event(), [key]: choice };
      assert.deepEqual(projectRunEvent(raw), raw);
    }
    for (const value of ['', 'unknown', 'passed', 'verified', 'https://example.invalid/', {}, 1, undefined]) {
      assert.equal(projectRunEvent({ ...event(), [key]: value }), null);
    }
  }
});

test('returns detached nested metadata so later raw mutation cannot contaminate the event', () => {
  const raw = event();
  const projected = projectRunEvent(raw);
  assert.deepEqual(projected, event());
  (raw.context as Record<string, unknown>).contextId = SENTINEL;
  (raw.basis as Record<string, unknown>).memoryRevision = SENTINEL;
  (raw.counters as Record<string, unknown>).hostSteps = SENTINEL;
  assert.deepEqual(projected, event());
});
