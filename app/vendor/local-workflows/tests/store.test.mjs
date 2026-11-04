import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrustedMemoryStore} from '../src/store.mjs';
test('trusted memory store has atomic exact-revision compare-and-swap',()=>{
 const s=createTrustedMemoryStore();assert.ok(s,'store must be constructed');assert.equal(s.read('p'),null);
 assert.equal(s.compareAndSwap('p',null,{state:'running'}),1);
 assert.throws(()=>s.compareAndSwap('p',null,{state:'forged'}),/STORE_CONFLICT/);
 assert.equal(s.compareAndSwap('p',1,{state:'paused'}),2);
 assert.throws(()=>s.compareAndSwap('p',1,{state:'stale'}),/STORE_CONFLICT/);
 assert.deepEqual(s.read('p'),{revision:2,record:{state:'paused'}});
});
test('memory store never aliases caller records or read snapshots',()=>{
 const s=createTrustedMemoryStore(),v={outputs:[{n:1}]};s.compareAndSwap('p',null,v);v.outputs[0].n=20;
 const a=s.read('p');a.record.outputs[0].n=99;assert.equal(s.read('p').record.outputs[0].n,1);
});
test('memory store validates IDs, revisions, JSON, capacity and byte budgets',()=>{
 const s=createTrustedMemoryStore({maxEntries:1});assert.throws(()=>s.read('../p'),/STORE_ID/);
 assert.throws(()=>s.compareAndSwap('p',-1,{}),/STORE_REVISION/);
 assert.throws(()=>s.compareAndSwap('p',null,{grant:()=>true}),/JSON/);
 assert.throws(()=>s.compareAndSwap('p',null,{data:'x'.repeat(1048577)}),/budget/);
 s.compareAndSwap('p',null,{});assert.throws(()=>s.compareAndSwap('q',null,{}),/STORE_CAPACITY/);
});
