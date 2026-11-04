import test from 'node:test';
import assert from 'node:assert/strict';
import {runDemo} from '../examples/demo.mjs';
test('demo performs four actual host self-tests and four kernel calls across pause/resume',async()=>{
 const d=await runDemo();assert.equal(d.hostSelfTestRuns,4);assert.equal(d.result.state,'completed');assert.equal(d.pause.completedCount,2);
 assert.equal(d.events.filter(e=>e.type==='step-completed').length,4);assert.equal(d.events.filter(e=>e.type==='step-started').length,4);
 assert.equal(d.result.outputs[2].output.verified,false);assert.equal(d.result.outputs[3].output.installedToolCount,null);
 assert.equal(d.modelCalled,false);assert.equal(d.networkCalled,false);
});
