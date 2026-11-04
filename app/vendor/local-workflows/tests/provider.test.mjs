import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixtures.mjs';
test('rejected async evidence is refused without an unhandled rejection escaping the runner',async()=>{
 const f=await fixture({evidence:()=>Promise.reject(new Error('provider failure'))});
 const r=await f.runner.run(f.spec);assert.equal(r.state,'failed');assert.equal(r.code,'EVIDENCE_INVALID');
 await new Promise(resolve=>setTimeout(resolve,10));assert.equal(r.completedCount,0);
});
