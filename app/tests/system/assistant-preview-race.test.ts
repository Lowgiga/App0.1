import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {LocalWorkStore} from '../../src/local-adapter.ts';
import {emptyWork} from '../../upstream/lib/work-contract.ts';

const AT='2026-10-05T09:00:00.000Z';
test('rejected stale approval cannot invalidate a replacement preview while its hashes are pending',{timeout:10000},async()=>{
 const store=new LocalWorkStore({indexedDB:new IDBFactory(),name:'preview-race-'+crypto.randomUUID(),now:()=>new Date(AT)});
 const context={contextId:crypto.randomUUID(),contextCreatedAt:AT},work=emptyWork();
 work.rooms=[{id:context.contextId,title:'Race fixture',agent:'codex',project:'custom',mode:'DEEP',goal:'Local test',output:'Local result',sources:[],status:'Aktiv',messages:[],createdAt:AT}];
 const {updatedAt,...rest}=work;
 const request=(body:unknown)=>store.request('/api/assistant',{method:'POST',body:JSON.stringify(body)});
 const originalDigest=crypto.subtle.digest,digest=originalDigest.bind(crypto.subtle),fetch=globalThis.fetch;let networkCalls=0,release!:()=>void,entered!:()=>void;
 const gate=new Promise<void>(resolve=>{release=resolve}),started=new Promise<void>(resolve=>{entered=resolve});
 let pending:Promise<Response>|undefined;
 try{
  globalThis.fetch=async()=>{networkCalls++;throw Error('Unexpected network access in local fixture')};
  assert.equal((await store.request('/api/state',{method:'PUT',body:JSON.stringify({...rest,expectedUpdatedAt:null})})).status,200);
  const read=await (await request({operation:'read-config',context})).json();
  const old=await (await request({operation:'preview-config',context,expectedBasis:read.basis,change:{kind:'set-continuation-detail',value:'detailed'}})).json();
  const command={operation:'commit-config',context,expectedBasis:read.basis,proposalId:old.proposal.id,operationId:crypto.randomUUID()};
  store.approveAssistantConfig({context,expectedBasis:read.basis,proposalId:old.proposal.id,proposalHash:old.proposalHash,operationId:command.operationId});
  crypto.subtle.digest=async(...args:Parameters<SubtleCrypto['digest']>)=>{entered();await gate;return digest(...args)};
  pending=request({operation:'preview-config',context,expectedBasis:read.basis,change:{kind:'set-review-depth',value:'thorough'}});
  await started; // Deliberately interleave the stale commit with both pending hashes.
  assert.equal((await request(command)).status,409,'old approval must remain rejected');
  release();const response=await pending;assert.equal(response.status,200,await response.clone().text());
  const replacement=await response.json();assert.notEqual(replacement.proposal.id,old.proposal.id);
  assert.equal((await request(command)).status,409,'stale commit must not consume the new proposal');
  const after=await (await request({operation:'read-config',context})).json();assert.equal(after.config.revision,0,'preview and rejected commit must never write');
  const next={...command,proposalId:replacement.proposal.id,operationId:crypto.randomUUID()};
  store.approveAssistantConfig({context,expectedBasis:read.basis,proposalId:next.proposalId,proposalHash:replacement.proposalHash,operationId:next.operationId});
  assert.equal((await request(next)).status,200,'new explicit approval remains usable exactly once');
  const saved=await (await request({operation:'read-config',context})).json();assert.equal(saved.config.revision,1);assert.equal(saved.config.review.depth,'thorough');assert.equal(networkCalls,0);
 }finally{release();if(pending)await pending.catch(()=>{});crypto.subtle.digest=originalDigest;globalThis.fetch=fetch;store.close()}
});
