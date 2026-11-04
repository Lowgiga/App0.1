// Drift-Schutz: OMEGA spiegelt Typen der App. Aendert sich die App, schlaegt dieser Test fehl,
// statt dass Vertraege still auseinanderlaufen (Verknuepfung Plan <-> Code <-> App).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  MISSION_STAGES, STAGE_TRANSITIONS, AGENT_PROFILES, OPERATION_EFFECTS, GRANT_EXECUTIONS,
} from '../runtime/index.mjs';

const appRoot = fileURLToPath(new URL('../../app/', import.meta.url));
const read = (rel) => readFileSync(`${appRoot}${rel}`, 'utf8');
const hasApp = existsSync(`${appRoot}upstream/lib/command-contract.ts`);
const strings = (text) => [...text.matchAll(/'([^']+)'/g)].map((m) => m[1]);

test('Missionsstufen und Uebergaenge = app/upstream/lib/command-contract.ts', { skip: !hasApp && 'app/ fehlt' }, () => {
  const src = read('upstream/lib/command-contract.ts');
  const stages = /export const missionStages = \[([^\]]+)\]/.exec(src);
  assert.ok(stages, 'missionStages nicht gefunden');
  assert.deepEqual(strings(stages[1]), [...MISSION_STAGES]);
  const block = /export const stageTransitions[^=]*=\s*\{([\s\S]*?)\n\};/.exec(src);
  assert.ok(block, 'stageTransitions nicht gefunden');
  const parsed = Object.fromEntries([...block[1].matchAll(/(\w+):\s*\[([^\]]*)\]/g)].map((m) => [m[1], strings(m[2])]));
  assert.deepEqual(parsed, Object.fromEntries(Object.entries(STAGE_TRANSITIONS).map(([k, v]) => [k, [...v]])));
});

test('Agentenprofile = app/upstream/lib/work-constants.ts', { skip: !hasApp && 'app/ fehlt' }, () => {
  const ids = /export const agentIds = \[([^\]]+)\]/.exec(read('upstream/lib/work-constants.ts'));
  assert.ok(ids, 'agentIds nicht gefunden');
  assert.deepEqual(strings(ids[1]), [...AGENT_PROFILES]);
});

test('OperationEffect = app/src/assistant/policy.ts', { skip: !hasApp && 'app/ fehlt' }, () => {
  const type = /export type OperationEffect\s*=\s*([^;]+);/.exec(read('src/assistant/policy.ts'));
  assert.ok(type, 'OperationEffect nicht gefunden');
  assert.deepEqual(strings(type[1]), [...OPERATION_EFFECTS]);
});

test('Modell-Ausfuehrung und bindingId = app/src/assistant/contracts.ts', { skip: !hasApp && 'app/ fehlt' }, () => {
  const src = read('src/assistant/contracts.ts');
  const execution = /execution:z\.enum\(\[([^\]]+)\]\)/.exec(src);
  assert.ok(execution, 'execution-Enum nicht gefunden');
  assert.deepEqual(strings(execution[1]).filter((e) => e !== 'deterministic'), [...GRANT_EXECUTIONS]);
  const identifier = /const identifier=z\.string\(\)\.min\(1\)\.max\((\d+)\)\.regex\(\/(.+?)\/\);/.exec(src);
  assert.ok(identifier, 'identifier nicht gefunden');
  assert.equal(identifier[1], '80');
  assert.equal(identifier[2], '^[a-zA-Z0-9][a-zA-Z0-9._-]*$');
});
