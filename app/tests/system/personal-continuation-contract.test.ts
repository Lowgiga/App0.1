import test from 'node:test';
import assert from 'node:assert/strict';
import {personalComposerContract,personalDraftContract,personalContinuationContract,personalContinuationResponseContract,personalViewContract,personalContextContract,personalContinuationRequestContract,decodePersonalContinuation,decodePersonalView,applyPersonalContinuation,rememberPersonalView,PERSONAL_CONTINUATION_BYTES,type PersonalDraft,type PersonalContinuation} from '../../src/personal-continuation.ts';
import {emptyWork} from '../../upstream/lib/work-contract.ts';

const at='2026-10-05T12:00:00.000Z',id=crypto.randomUUID();
const composer={kind:'decision' as const,text:'  Unfinished\n',origin:'manual' as const,sourceId:null,editingEntryId:null};
const base={workUpdatedAt:at,memoryRevision:0,entryRevision:null};
const draft:PersonalDraft={schema:'lowquantflow.personal-draft/v1',contextId:id,contextCreatedAt:at,revision:1,updatedAt:at,status:'active',base,composer};
const records=(entries:PersonalDraft[]=[draft]):PersonalContinuation=>({schema:'lowquantflow.personal-continuation/v1',records:entries});
const memory={schema:'lowquantflow.project-memory-backup/v1' as const,records:[]};
const work=emptyWork();work.updatedAt=at;work.rooms=[{id,title:'Project',createdAt:at,agent:'codex',project:'custom',mode:'DEEP',goal:'Local',output:'Local',sources:[],messages:[],status:'Aktiv'}];
const identity={contextId:id,contextCreatedAt:at};

test('composer preserves whitespace and empty recovery text while rejecting overflow and credential patterns',()=>{
 assert.equal(personalComposerContract.parse(composer).text,composer.text);
 assert.equal(personalComposerContract.safeParse({...composer,text:''}).success,true);
 assert.equal(personalComposerContract.safeParse({...composer,text:'x'.repeat(2001)}).success,false);
 assert.equal(personalComposerContract.safeParse({...composer,text:'api_key = SYNTHETIC_ONLY'}).success,false);
 assert.equal(personalComposerContract.safeParse({...composer,origin:'external-claim',sourceId:null}).success,true);
 assert.equal(personalComposerContract.safeParse({...composer,sourceId:'unexpected'}).success,false);
 assert.equal(personalComposerContract.safeParse({...composer,origin:'external-claim',sourceId:'selected'}).success,true);
});

test('closed contracts reject metadata, partial identities, invalid timestamps and unsafe revisions',()=>{
 assert.equal(personalContextContract.safeParse(identity).success,true);
 for(const value of [{...identity,contextCreatedAt:'2026-02-30T00:00:00.000Z'},{...identity,contextId:'project-name'},{...identity,contextCreatedAt:null}])assert.equal(personalContextContract.safeParse(value).success,false);
 for(const extra of [{revision:0},{revision:Number.MAX_SAFE_INTEGER+1},{revision:1.5},{status:'confirmed'},{token:'SYNTHETIC_ONLY'},{base:{...base,entryRevision:1}}])assert.equal(personalDraftContract.safeParse({...draft,...extra}).success,false);
 assert.equal(personalDraftContract.safeParse({...draft,status:'applied'}).success,false);
 assert.equal(personalDraftContract.safeParse({...draft,composer:{...composer,editingEntryId:crypto.randomUUID()}}).success,false);
 assert.equal(personalContinuationRequestContract.safeParse({operation:'save-draft',...identity,expectedRevision:0,base,composer,autorun:true}).success,false);
 assert.equal(personalContinuationRequestContract.safeParse({operation:'read',contextId:id}).success,false);
});

test('view never accepts partial or implicit first-run selection',()=>{
 const empty=decodePersonalView(undefined);assert.deepEqual(empty,{schema:'lowquantflow.personal-view/v1',revision:0,updatedAt:null,contextId:null,contextCreatedAt:null});
 for(const extra of [{contextId:id},{contextCreatedAt:at},{revision:1},{updatedAt:at}])assert.equal(personalViewContract.safeParse({...empty,...extra}).success,false);
 assert.equal(personalViewContract.safeParse({...empty,revision:1,updatedAt:at,...identity}).success,true);
});

test('snapshot validates matching draft and memory incarnation and missing context shape',()=>{
 const response={schema:'lowquantflow.personal-continuation-response/v1',draft,memory:{schema:'lowquantflow.project-memory/v1',...identity,revision:0,updatedAt:null,entries:[]},workUpdatedAt:at,contextStatus:'active'};
 assert.equal(personalContinuationResponseContract.safeParse(response).success,true);
 assert.equal(personalContinuationResponseContract.safeParse({...response,memory:{...response.memory,contextCreatedAt:'2026-10-04T00:00:00.000Z'}}).success,false);
 assert.equal(personalContinuationResponseContract.safeParse({...response,memory:null}).success,false);
 assert.equal(personalContinuationResponseContract.safeParse({...response,memory:null,contextStatus:'missing'}).success,true);
});

test('storage rejects duplicate context, 101 records and excess UTF-8 without truncation',()=>{
 assert.equal(personalContinuationContract.safeParse(records([draft,draft])).success,false);
 const many=Array.from({length:101},()=>({...draft,contextId:crypto.randomUUID()}));assert.equal(personalContinuationContract.safeParse(records(many)).success,false);
 const unicode=records(many.slice(0,100).map(d=>({...d,composer:{...composer,text:'界'.repeat(2000)}})));
 assert.ok(JSON.stringify(unicode).length<PERSONAL_CONTINUATION_BYTES);assert.ok(new TextEncoder().encode(JSON.stringify(unicode)).length>PERSONAL_CONTINUATION_BYTES);assert.equal(personalContinuationContract.safeParse(unicode).success,false);
});

test('corrupt and future schemas cannot turn into default records',()=>{
 assert.deepEqual(decodePersonalContinuation(undefined),records([]));
 for(const value of [null,{},records([draft,draft]),{schema:'lowquantflow.personal-continuation/v1',records:undefined}])assert.throws(()=>decodePersonalContinuation(value),(e:any)=>e.code==='CORRUPT_STORAGE');
 assert.throws(()=>decodePersonalContinuation({schema:'lowquantflow.personal-continuation/v2',records:[]}),(e:any)=>e.code==='UNSUPPORTED_VERSION');
 assert.throws(()=>decodePersonalView({schema:'lowquantflow.personal-view/v9'}),(e:any)=>e.code==='UNSUPPORTED_VERSION');
});

test('revision overflow and invalid device clock reject without mutating source values',()=>{
 const full=records([{...draft,revision:Number.MAX_SAFE_INTEGER}]),before=structuredClone(full);
 assert.throws(()=>applyPersonalContinuation(full,memory,work,{operation:'save-draft',...identity,expectedRevision:Number.MAX_SAFE_INTEGER,base,composer},new Date(at)),(e:any)=>e.code==='VALIDATION');assert.deepEqual(full,before);
 const view={schema:'lowquantflow.personal-view/v1' as const,revision:Number.MAX_SAFE_INTEGER,updatedAt:at,...identity};
 assert.throws(()=>rememberPersonalView(view,work,{operation:'remember',...identity,expectedRevision:Number.MAX_SAFE_INTEGER},new Date(at)),(e:any)=>e.code==='VALIDATION');
 assert.throws(()=>applyPersonalContinuation(records(),memory,work,{operation:'save-draft',...identity,expectedRevision:1,base,composer},new Date(NaN)),(e:any)=>e.code==='STORAGE_UNAVAILABLE');
});

test('terminal status preserves exact draft and requires a new explicit save to reactivate',()=>{
 const result=applyPersonalContinuation(records(),memory,work,{operation:'discard-draft',...identity,expectedRevision:1},new Date(at));
 assert.deepEqual(result.records.records[0].composer,composer);assert.equal(result.records.records[0].status,'discarded');assert.equal(result.memoryChanged,false);assert.equal(result.memory,memory);
 assert.throws(()=>applyPersonalContinuation(result.records,memory,work,{operation:'apply-draft',...identity,expectedRevision:2},new Date(at)),(e:any)=>e.code==='CONFLICT');
});
