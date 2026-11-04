import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  TASKER_ACTIONS, EVENT_SCHEMA, TASKER_SCHEMA, DATA_CLASSES, CLASSES, CHANGE_KINDS, MISSION_STAGES, AGENT_PROFILES,
  OPERATION_EFFECTS, EventEmitterNode, LeaseManager, buildTaskerCommand, createPeerEntry, createModelGrant,
  createOwnerApproval, changeDigest, HybridLogicalClock, validateCapability, validateTask,
} from '../runtime/index.mjs';
import { loadSchema, validate } from './helpers/mini-schema.mjs';
import { makeNode } from './helpers/fixtures.mjs';

const dir = fileURLToPath(new URL('../contracts/', import.meta.url));

test('Vertraege: gueltiges JSON, $id passt zum Dateinamen, geschlossene Objekte', () => {
  const files = readdirSync(dir).filter((f) => f.endsWith('.schema.json'));
  assert.equal(files.length, 7);
  for (const file of files) {
    const schema = loadSchema(file);
    assert.ok(schema.$id.endsWith(`/${file}`), `${file}: $id ${schema.$id}`);
    assert.equal(schema.additionalProperties, false, `${file}: additionalProperties`);
    assert.equal(schema.properties.schema.const, schema.title, `${file}: schema-const`);
    assert.ok(schema.required.includes('schema'), `${file}: schema ist Pflicht`);
  }
});

test('Vertraege und Laufzeit nutzen dieselben Aufzaehlungen', () => {
  assert.equal(loadSchema('omega.event.v1.schema.json').title, EVENT_SCHEMA);
  assert.deepEqual(loadSchema('omega.event.v1.schema.json').properties.dataClass.enum, [...DATA_CLASSES]);
  const tasker = loadSchema('omega.tasker.v1.schema.json');
  assert.equal(tasker.title, TASKER_SCHEMA);
  assert.deepEqual([...tasker.properties.action.enum].sort(), Object.keys(TASKER_ACTIONS).sort());
  const task = loadSchema('omega.task.v1.schema.json');
  assert.deepEqual(task.properties.cls.enum, [...CLASSES]);
  assert.deepEqual(task.properties.change.enum, Object.keys(CHANGE_KINDS));
  assert.deepEqual(task.properties.stage.enum, [...MISSION_STAGES]);
  assert.deepEqual(task.properties.profile.enum, [...AGENT_PROFILES]);
  assert.deepEqual(loadSchema('omega.capability.v1.schema.json').properties.effect.enum, [...OPERATION_EFFECTS]);
  assert.deepEqual(loadSchema('omega.owner-approval.v1.schema.json').properties.change.enum,
    Object.keys(CHANGE_KINDS).filter((k) => CHANGE_KINDS[k] === 'E4'));
});

test('Laufzeit-Objekte erfuellen die Vertraege', () => {
  const win = makeNode();
  const phone = makeNode();
  const ev = new EventEmitterNode({ clock: phone.clock, privateKey: phone.privateKey }).emit('device.usb.connected', { a: 1 });
  assert.deepEqual(validate(loadSchema('omega.event.v1.schema.json'), ev), []);
  const lease = new LeaseManager().acquire('t', win.node, 60_000).lease;
  const cmd = buildTaskerCommand({ action: 'OMEGA_ADB_ON', params: { minutes: 5 }, lease, hlc: win.clock.tick() }, randomBytes(32));
  assert.deepEqual(validate(loadSchema('omega.tasker.v1.schema.json'), cmd), []);
  const peer = createPeerEntry({ publicKey: phone.publicKey, role: 'android', label: 'Samsung', addedHlc: win.clock.tick() }, win);
  assert.deepEqual(validate(loadSchema('omega.peer.v1.schema.json'), peer), []);
  const now = Date.now();
  const grant = createModelGrant({
    bindingId: 'ollama.qwen3', execution: 'local', model: 'qwen3:8b', dataClasses: ['internal', 'financial'],
    maxInputTokens: 8_000, maxOutputTokens: 1_000, maxCallsPerDay: 200, maxCostPerDayCents: 0, issuedAt: now, expiresAt: now + 86_400_000,
  }, win);
  assert.deepEqual(validate(loadSchema('omega.model-grant.v1.schema.json'), grant), []);
  const owner = createOwnerApproval({ change: 'policy', digest: changeDigest('x'), expiresAt: now + 1 }, win.privateKey);
  assert.deepEqual(validate(loadSchema('omega.owner-approval.v1.schema.json'), owner), []);
});

test('Beispiele aus docs/31 erfuellen Vertrag und Laufzeitpruefung', () => {
  const capability = {
    schema: 'omega.capability/v1',
    id: 'android.screen.mirror',
    provider: { kind: 'binary', name: 'scrcpy' },
    node: 'n7f3a9c0d1e2b4a56',
    effect: 'read-only',
    requires: ['android.adb.authorized'],
    state: 'available',
    evidence: { checkId: 'probe.scrcpy.version', status: 'passed', verifiedAt: '2026-11-03T18:40:00Z', expiresAt: '2026-11-03T18:45:00Z' },
    fallbacks: ['android.screen.screenshot'],
  };
  assert.deepEqual(validate(loadSchema('omega.capability.v1.schema.json'), capability), []);
  assert.equal(validateCapability(capability), null);
  const task = {
    schema: 'omega.task/v1', taskId: randomUUID(), kind: 'device.mirror', cls: 'observe', risk: 2, stage: 'Planned',
    profile: 'zimt', createdHlc: new HybridLogicalClock({ node: 'n7f3a9c0d1e2b4a56' }).tick(), origin: 'n7f3a9c0d1e2b4a56',
  };
  assert.deepEqual(validate(loadSchema('omega.task.v1.schema.json'), task), []);
  assert.equal(validateTask(task), null);
});
