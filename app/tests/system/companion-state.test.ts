import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCompanionState, reduceCompanion, companionPresentation, expireCompanionWork, verifiedCommitEvent, pingPongPose, type CompanionHostEvent} from '../../src/companion/state.ts';
import {defaultAssistantConfig} from '../../src/assistant/config.ts';
import {canonicalValue} from '../../src/assistant/contracts.ts';

const context={contextId:'11111111-1111-4111-8111-111111111111',contextCreatedAt:'2026-10-05T09:00:00.000Z'};
const operationId='22222222-2222-4222-8222-222222222222';
const start:CompanionHostEvent={type:'requestStarted',eventId:'start',requestId:'r1',simulation:true};
async function proof(){
 const config={...defaultAssistantConfig(context),revision:1};
 const configHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalValue(config)))),b=>b.toString(16).padStart(2,'0')).join('');
 return {verification:'verified',config,basis:{workUpdatedAt:null,memoryRevision:0,configRevision:1},storage:{deviceLocal:true,includedInSystemBackup:false},receipt:{schema:'lowquantflow.assistant-receipt/v1',operationId,proposalId:'33333333-3333-4333-8333-333333333333',proposalHash:'a'.repeat(64),context,basis:{workUpdatedAt:null,memoryRevision:0,configRevision:0},beforeRevision:0,afterRevision:1,changedFields:['continuation.detail'],configHash,committedAt:'2026-10-05T09:00:01.000Z'}};
}
test('only active work thinks; pending work expires honestly without claiming completion',()=>{
 assert.equal(companionPresentation(initialCompanionState()).clip,'Idle');
 const s=reduceCompanion(initialCompanionState(),start,100);
 assert.equal(companionPresentation(s).clip,'Think');
 assert.match(companionPresentation(s).label,/Simulation/);
 assert.equal(expireCompanionWork(s,30099).phase,'working');
 const expired=expireCompanionWork(s,30100);
 assert.equal(expired.phase,'waiting');assert.equal(companionPresentation(expired).clip,'Caution');
 assert.match(companionPresentation(expired).text,/Status.*offen/);
});
test('errors and confirmation outrank simulated results; new requests clear previous status',()=>{
 let s=reduceCompanion(initialCompanionState(),start,0);
 s=reduceCompanion(s,{type:'awaitingConfirmation',requestId:'r1',eventId:'approval'},1);
 s=reduceCompanion(s,{type:'simulatedResult',requestId:'r1',eventId:'demo',summary:'Alles gespeichert!'},2);
 assert.equal(s.phase,'confirmation');
 s=reduceCompanion(s,{type:'error',requestId:'r1',eventId:'error'},3);
 assert.equal(s.phase,'error');assert.equal(companionPresentation(s).clip,'Caution');
 s=reduceCompanion(s,{...start,requestId:'r2',eventId:'s2'},4);
 assert.equal(s.phase,'working');
 assert.equal(reduceCompanion(s,{type:'error',requestId:'r1',eventId:'late'},5),s);
 assert.equal(reduceCompanion(s,{...start,requestId:'r2',eventId:'s2'},6),s);
});
test('simulation label cannot be suppressed or converted into commit success by text',()=>{
 const s=reduceCompanion(reduceCompanion(initialCompanionState(),start,0),{type:'simulatedResult',eventId:'x',requestId:'r1',summary:'<button>Erfolg</button> gespeichert'},1);
 assert.equal(s.phase,'simulation');assert.match(companionPresentation(s).label,/Simulation/);
 assert.equal(companionPresentation(s).receiptId,null);assert.equal(companionPresentation(s).clip,'Idea');
 const forged={type:'verifiedCommit',requestId:'r1',eventId:'forged',receiptId:operationId,revision:1} as CompanionHostEvent;
 assert.equal(reduceCompanion(s,forged,2),s);
});
test('verified commit needs exact readback identity, valid current config and matching digest',async()=>{
 const good=await proof(),expected={eventId:'saved',requestId:'r1',context,operationId};
 const event=await verifiedCommitEvent(expected,good);assert.ok(event);
 const s=reduceCompanion(reduceCompanion(initialCompanionState(),start,0),event,1);
 assert.equal(s.phase,'verified');assert.equal(companionPresentation(s).receiptId,operationId);
 for(const bad of [{...good,verification:'superseded'},{...good,receipt:null},{...good,config:{...good.config,revision:2}},{...good,receipt:{...good.receipt,configHash:'0'.repeat(64)}},{...good,receipt:{...good.receipt,context:{...context,contextCreatedAt:'2026-10-04T09:00:00.000Z'}}}])assert.equal(await verifiedCommitEvent(expected,bad),null);
 assert.equal(await verifiedCommitEvent({...expected,operationId:crypto.randomUUID()},good),null);
 assert.equal(reduceCompanion(s,JSON.parse(JSON.stringify(event)),2),s);
});
test('ping-pong route is continuous at both turnarounds and faces travel direction (+Z model)',()=>{
 assert.equal(pingPongPose(0).x,-1.15);
 assert.ok(Math.abs(pingPongPose(12-0.001).x-pingPongPose(12+0.001).x)<.002);
 assert.ok(Math.abs(pingPongPose(24-0.001).x-pingPongPose(24+0.001).x)<.002);
 assert.equal(pingPongPose(2).direction,1);assert.equal(pingPongPose(14).direction,-1);
 assert.equal(pingPongPose(2).rotationY,Math.PI/2);assert.equal(pingPongPose(14).rotationY,-Math.PI/2);
});
test('idle retires its request identity and rejects all late events until a new start',()=>{
 let s=reduceCompanion(initialCompanionState(),start,0);
 s=reduceCompanion(s,{type:'idle',eventId:'closed',requestId:'r1'},1);
 assert.equal(s.phase,'idle');
 assert.equal(reduceCompanion(s,{type:'simulatedResult',eventId:'late-result',requestId:'r1'},2),s);
 assert.equal(reduceCompanion(s,{type:'error',eventId:'late-error',requestId:'r1'},2),s);
 assert.equal(reduceCompanion(s,{...start,eventId:'restarted-same-id'},2),s);
 s=reduceCompanion(s,{...start,eventId:'new-start',requestId:'r2'},3);assert.equal(s.phase,'working');
 s=reduceCompanion(s,{type:'idle',eventId:'closed2',requestId:'r2'},4);
 assert.equal(reduceCompanion(s,{type:'error',eventId:'late-r1',requestId:'r1'},5),s);
});
test('readback async digest cannot rebind a receipt to caller-mutated request metadata',async()=>{
 const good=await proof(),expected={eventId:'A-proof',requestId:'A',context:{...context},operationId};
 const pending=verifiedCommitEvent(expected,good);
 expected.eventId='B-proof';expected.requestId='B';expected.operationId=crypto.randomUUID();expected.context.contextId=crypto.randomUUID();
 const event=await pending;assert.ok(event);assert.equal(event.eventId,'A-proof');assert.equal(event.requestId,'A');assert.equal(event.type,'verifiedCommit');
 if(event.type==='verifiedCommit')assert.equal(event.receiptId,operationId);
 const b=reduceCompanion(initialCompanionState(),{...start,eventId:'B-start',requestId:'B'},0);assert.equal(reduceCompanion(b,event,1),b);
});
