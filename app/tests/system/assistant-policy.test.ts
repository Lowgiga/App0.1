import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_ASSISTANT_POLICY,createRunBudget,canRetry,AssistantRuntimeError} from '../../src/assistant/policy.ts';

test('a repaired call still leaves only three total role invocations',()=>{
 const budget=createRunBudget();
 budget.call();budget.repair('pure','INVALID_RESULT');budget.call();budget.call();
 assert.throws(()=>budget.call(),{code:'BUDGET'});
 assert.deepEqual(budget.snapshot(),{hostSteps:0,modelCalls:3,repairAttempts:1});
});
test('twelve host steps and one repair are absolute ceilings',()=>{
 const budget=createRunBudget();for(let i=0;i<12;i++)budget.step();
 assert.throws(()=>budget.step(),{code:'BUDGET'});
 budget.repair('read-only','TEMPORARY_READ');
 assert.throws(()=>budget.repair('read-only','TEMPORARY_READ'),{code:'BUDGET'});
});
test('host policy can reduce but never elevate caps or add capabilities',()=>{
 for(const override of [{maxModelCalls:4},{maxHostSteps:13},{maxRepairAttempts:2},{maxInputBytes:32769},{maxOutputBytes:8193},{maxActiveMs:30001},{maxModelCalls:NaN},{maxModelCalls:1.5},{permissions:['network']}]){
  assert.throws(()=>createRunBudget({...DEFAULT_ASSISTANT_POLICY,...override} as any),{code:'POLICY'});
 }
 const budget=createRunBudget({...DEFAULT_ASSISTANT_POLICY,maxModelCalls:1});budget.call();assert.throws(()=>budget.call(),{code:'BUDGET'});
});
test('retry authorization is tied to safe operation and closed failure classes',()=>{
 assert.equal(canRetry('pure','INVALID_RESULT'),true);
 assert.equal(canRetry('read-only','TEMPORARY_READ'),true);
 for(const effect of ['write','unknown'] as const)for(const code of ['INVALID_RESULT','TEMPORARY_READ'] as const)assert.equal(canRetry(effect,code),false);
 for(const code of ['CONTEXT_MISMATCH','STALE_BASIS','POLICY','ABORTED','TIMEOUT','UNKNOWN_SIDE_EFFECT','UNAVAILABLE','BUDGET'] as const)assert.equal(canRetry('read-only',code),false);
 assert.throws(()=>createRunBudget().repair('write','TEMPORARY_READ'),{code:'POLICY'});
});
test('active cycles and repeated operations stop without consuming further work',()=>{
 const budget=createRunBudget(),leave=budget.enter('advisor:explain');
 assert.throws(()=>budget.enter('advisor:explain'),{code:'CYCLE'});leave();
 assert.throws(()=>budget.enter('advisor:explain'),{code:'DUPLICATE'});
 assert.equal(budget.snapshot().modelCalls,0);
});
test('elapsed active time and invalid clocks stop even without timer callback',()=>{
 let now=100;const budget=createRunBudget(DEFAULT_ASSISTANT_POLICY,()=>now);
 now=30100;assert.throws(()=>budget.step(),{code:'TIMEOUT'});
 now=99;assert.throws(()=>budget.remainingMs(),{code:'POLICY'});
 assert.throws(()=>createRunBudget(DEFAULT_ASSISTANT_POLICY,()=>Infinity),{code:'POLICY'});
});
test('errors expose fixed codes without copying provider messages',()=>{
 const error=new AssistantRuntimeError('UNKNOWN_SIDE_EFFECT');
 assert.equal(error.code,'UNKNOWN_SIDE_EFFECT');assert.equal(error.message,'UNKNOWN_SIDE_EFFECT');
});
test('policy validation does not evaluate changing accessors or copy a second unvalidated value',()=>{
 let reads=0;const policy={...DEFAULT_ASSISTANT_POLICY};
 Object.defineProperty(policy,'maxModelCalls',{enumerable:true,get(){return ++reads===1?3:9}});
 assert.throws(()=>createRunBudget(policy),{code:'POLICY'});assert.equal(reads,0);
});
