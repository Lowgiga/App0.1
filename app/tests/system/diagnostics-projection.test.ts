import test from 'node:test';
import assert from 'node:assert/strict';
import {projectDiagnostics, projectConnection, projectCatalogConnections, diagnosticsFromLoadedState, MAX_DIAGNOSTIC_COUNT} from '../../src/diagnostics.ts';

const now = Date.parse('2026-10-04T10:00:00.000Z');
const policy = {now, maxAgeMs: 60_000, offline: false};
const check = (result = 'confirmed', at = now - 1_000, origin = 'session-check') => ({result, at, origin});
const dimensions = ['saved', 'reachable', 'authenticated', 'actionTested'] as const;

test('diagnostics emits only a fixed local metadata schema and unknown checks', () => {
 const value = projectDiagnostics({});
 assert.equal(value.schema, 'local-diagnostics/v1');
 assert.equal(value.mode, 'local-only');
 assert.equal(value.lastConfirmedCheckAt, null);
 assert.equal(value.workflow.currentRun, 'unknown');
 assert.equal(value.export, 'not-implemented');
 assert.equal(value.capabilities.networkProbes, false);
 assert.equal(value.capabilities.telemetry, false);
 assert.equal(value.capabilities.fullRestore, false);
});

test('bounded counts do not scan contents or accept absurd numeric values', () => {
 for (const count of [-1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER, '44', {token:'never'}]) {
  assert.equal(projectDiagnostics({counts:{tasks:count}}).counts.tasks, null);
 }
 assert.equal(projectDiagnostics({counts:{tasks:MAX_DIAGNOSTIC_COUNT}}).counts.tasks, MAX_DIAGNOSTIC_COUNT);
 assert.equal(projectDiagnostics({counts:{tasks:0}}).counts.tasks, 0);
});

test('all arbitrary text, nested secrets, unknown enums and raw errors are omitted', () => {
 const secret = 'sk-SENTINEL_very_private https://user:pass@private.local /home/user/key';
 const value = projectDiagnostics({buildVersion:secret,mode:secret,workSchema:secret,error:{code:secret,message:secret,stack:secret,cause:{token:secret}},counts:{tasks:secret,notes:[secret]},preferencesError:secret,capabilities:{token:secret},prompt:secret,headers:{Authorization:secret},userId:secret});
 const text = JSON.stringify(value);
 assert.ok(!text.includes('SENTINEL'));
 assert.ok(!text.includes('https:'));
 assert.ok(!text.includes('/home/'));
 assert.equal(value.errorClass, 'UNKNOWN');
 assert.equal(value.workSchema, 'unknown');
});

test('fixed local error code is retained without error message or stack', () => {
 for (const code of ['VALIDATION','CONFLICT','CORRUPT_STORAGE','UNSUPPORTED_VERSION','STORAGE_UNAVAILABLE','QUOTA_EXCEEDED','UNSUPPORTED','TOO_LARGE']) {
  const result=projectDiagnostics({error:{code,message:'secret',stack:'secret'}});
  assert.equal(result.errorClass,code); assert.ok(!JSON.stringify(result).includes('secret'));
 }
 assert.equal(projectDiagnostics({error:null}).errorClass,'none');
});

test('work and preferences failures are explicit without interpreting raw strings', () => {
 const failed=projectDiagnostics({hasLoaded:true,loadingWork:false,storageError:true,preferencesReady:false,preferencesFailed:true,historyCount:3});
 assert.equal(failed.workState,'blocked');assert.equal(failed.preferencesState,'blocked');
 assert.equal(failed.errorClass,'UNKNOWN','A known failure without a structured code is not no error');
 assert.equal(failed.workflow.currentRun,'unknown');assert.equal(failed.workflow.historyCount,3);
 assert.equal(projectDiagnostics({hasLoaded:true,loadingWork:false,storageError:false,preferencesReady:true,preferencesFailed:false,workSchema:4}).workSchema,4);
});

test('projection ignores accessors and inherited properties without invoking code', () => {
 const value=Object.create({hasLoaded:true,error:{code:'CONFLICT'}});
 Object.defineProperty(value,'counts',{get(){throw Error('must not run')}});
 assert.equal(projectDiagnostics(value).workState,'unknown');
 assert.equal(projectDiagnostics(value).counts.tasks,null);
 assert.equal(projectDiagnostics(value).errorClass,'none');
});

test('saved and authenticated do not imply reachability, action testing or authority', () => {
 const value=projectConnection({saved:check(),authenticated:check()},policy);
 assert.equal(value.saved.current,'confirmed');assert.equal(value.authenticated.current,'confirmed');
 assert.equal(value.reachable.current,'unknown');assert.equal(value.actionTested.current,'unknown');
 assert.equal(value.authority,'not-evaluated');
});

test('explicit boundary-age policy determines freshness; no policy never means current', () => {
 assert.equal(projectConnection({reachable:check('confirmed',now-60_000)},policy).reachable.freshness,'current');
 assert.equal(projectConnection({reachable:check('confirmed',now-60_001)},policy).reachable.freshness,'stale');
 for(const maxAgeMs of [undefined,null,-1,Infinity,NaN,1.5]) {
  const value=projectConnection({reachable:check()},{...policy,maxAgeMs});
  assert.equal(value.reachable.current,'unknown');assert.equal(value.reachable.freshness,'unknown');
 }
});

test('historical snapshots remain historical even when timestamp and auth look current', () => {
 const value=projectConnection(Object.fromEntries(dimensions.map(key=>[key,check('confirmed',now,'historical-snapshot')])),policy);
 for(const key of dimensions){assert.equal(value[key].freshness,'historical');assert.equal(value[key].current,'unknown')}
 assert.equal(value.lastConfirmedCheckAt,null);
});

test('offline hint prevents live network assurances without disproving saved configuration', () => {
 const value=projectConnection(Object.fromEntries(dimensions.map(key=>[key,check()])),{...policy,offline:true});
 assert.equal(value.saved.current,'confirmed');
 for(const key of ['reachable','authenticated','actionTested'] as const){assert.equal(value[key].current,'unknown');assert.equal(value[key].freshness,'offline')}
});

test('failed and revoked observations replace earlier confirmations and stay distinct', () => {
 for(const result of ['failed','revoked']) {
  const value=projectConnection({authenticated:check(result)},policy);
  assert.equal(value.authenticated.current,result);
  assert.equal(value.actionTested.current,'unknown');
 }
 const stale=projectConnection({authenticated:check('revoked',now-60_001)},policy);
 assert.equal(stale.authenticated.current,'unknown');assert.equal(stale.authenticated.recorded,'revoked');
});

test('invalid, future, missing and absurd timestamps never become confirmed checks', () => {
 for(const at of [undefined,null,now+1,-1,NaN,Infinity,1e99,'2026-10-04T09:00:00Z']) {
  const value=projectConnection({reachable:{result:'confirmed',at,origin:'session-check'}},policy);
  assert.equal(value.reachable.current,'unknown');assert.equal(value.lastConfirmedCheckAt,null);
 }
 assert.equal(projectConnection({reachable:{result:'confirmed',origin:'session-check'}},policy).lastConfirmedCheckAt,null);
});

test('unknown policy signals, zero-duration policy and enormous catalogs stay bounded and explicit', () => {
 for(const offline of [undefined,null,'false',0,{},[]])assert.equal(projectConnection({reachable:check()},{...policy,offline}).reachable.current,'unknown');
 assert.equal(projectConnection({reachable:check('confirmed',now)},{...policy,maxAgeMs:0}).reachable.current,'confirmed');
 assert.equal(projectConnection({reachable:check('confirmed',now-1)},{...policy,maxAgeMs:0}).reachable.current,'unknown');
 const rows=new Array(4_294_967_295);rows[0]={id:'slack',password:'SECRET'};rows[1000]={id:'github'};
 const result=projectCatalogConnections(rows);
 assert.equal(result.find(row=>row.provider==='slack')!.provenance,'historical-snapshot');
 assert.equal(result.find(row=>row.provider==='github')!.provenance,'missing');
});

test('connection projection emits no free text, secrets, identities or URLs', () => {
 const secret='SENTINEL-CREDENTIAL';
 const input={saved:{...check(),token:secret},reachable:{result:secret,at:now,origin:'session-check'},authenticated:{...check(),headers:{Authorization:secret}},actionTested:{...check(),action:secret},account:secret,url:secret};
 const result=projectConnection(input,policy);
 assert.ok(!JSON.stringify(result).includes(secret));assert.equal(result.reachable.current,'unknown');
 assert.equal(result.lastConfirmedCheckAt,new Date(now-1000).toISOString());
});

test('catalog rows are allowlisted providers with historical-only provenance', () => {
 const value=projectCatalogConnections([{id:'make',name:'SECRET',auth:true,tool:true,state:'verified',at:now},{id:'unknown-secret',token:'SECRET'},{id:'make',auth:false}]);
 assert.equal(value.length,6);assert.ok(!JSON.stringify(value).includes('SECRET'));
 const make=value.find(row=>row.provider==='make')!;
 assert.equal(make.provenance,'historical-snapshot');
 for(const key of dimensions)assert.equal(make.evidence[key].current,'unknown');
 assert.equal(make.evidence.lastConfirmedCheckAt,null);
 assert.equal(value.find(row=>row.provider==='github')!.provenance,'missing');
});

test('diagnostics are deterministic, synchronous, non-mutating and do not use network, storage or clock', () => {
 const input=Object.freeze({hasLoaded:true,loadingWork:false,storageError:false,counts:Object.freeze({tasks:5}),historyCount:2});
 const oldFetch=globalThis.fetch,oldNow=Date.now;
 globalThis.fetch=()=>{throw Error('NETWORK_FORBIDDEN')};Date.now=()=>{throw Error('CLOCK_FORBIDDEN')};
 try {assert.deepEqual(projectDiagnostics(input),projectDiagnostics(input));assert.equal(input.counts.tasks,5)}
 finally {globalThis.fetch=oldFetch;Date.now=oldNow}
});

test('loaded-state adapter counts arrays without leaking content or treating timestamps/history as current', () => {
 const input={hasLoaded:true,loadingWork:false,storageError:false,preferencesReady:true,preferencesFailed:false,work:{stateVersion:4,tasks:[{title:'SECRET'}],notes:['SECRET','SECRET'],rooms:[],updatedAt:'2026-10-04T10:00:00Z'},system:{schema:'cue.system-state/v1',history:[{at:'2026-10-04T10:00:00Z',state:'running',outputs:'SECRET'}]},data:{sources:[{url:'SECRET'}]}};
 const value=diagnosticsFromLoadedState(input);
 assert.deepEqual(value.counts,{tasks:1,notes:2,rooms:0,sources:1});
 assert.equal(value.workState,'ready');assert.equal(value.workSchema,4);assert.equal(value.systemSchema,'cue.system-state/v1');
 assert.equal(value.workflow.historyCount,1);assert.equal(value.workflow.currentRun,'unknown');assert.equal(value.lastConfirmedCheckAt,null);
 assert.ok(!JSON.stringify(value).includes('SECRET'));assert.ok(!JSON.stringify(value).includes('2026-10'));
 const loading=diagnosticsFromLoadedState({...input,hasLoaded:false,preferencesReady:false});
 assert.equal(loading.counts.tasks,null);assert.equal(loading.workflow.historyCount,null);
});
