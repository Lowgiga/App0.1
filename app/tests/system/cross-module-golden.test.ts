import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,sources} from '../../vendor/mesh-extensions/tests/fixture.ts';
import {adaptWorkState} from '../../vendor/mesh-extensions/src/model.ts';
import {createBackupAdapter} from '../../src/backup-adapter.ts';
import {defaultSystemState} from '../../src/system-state.ts';
import {workflowInputs} from '../../src/studio/workflow-host.ts';
import {surfaceProjections} from '../../src/studio/surface-contract.ts';
test('golden mission/task/source/event fixture stays identical through backup across graph workflow and adaptive projections',async()=>{const work=fixture(),system=defaultSystemState();system.graph.layout='evidence';system.graph.transitions='brief';system.surfaceLayout='focus';const adapter=createBackupAdapter({sources}),text=await adapter.export(work,system,'2026-09-30T23:00:00Z'),result=await adapter.preview(text,work,system);const restored=result.inspection.snapshot.work as typeof work;
assert.deepEqual(adaptWorkState(restored,sources),adaptWorkState(work,sources));assert.deepEqual(workflowInputs(restored,sources),workflowInputs(work,sources));assert.deepEqual(surfaceProjections(restored,sources,system),surfaceProjections(work,sources,system));assert.equal(result.inspection.snapshot.data.system.graph.transitions,'brief');assert.deepEqual(result.plan.writes,[])});
