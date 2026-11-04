import test from 'node:test';
import assert from 'node:assert/strict';
import {assistantConfigContract,assistantResultContract,contextEnvelopeContract,configChangeContract,advisoryRequestContract,modelCapabilitiesContract,validateAssistantResult} from '../../src/assistant/contracts.ts';
import {makeSnapshot,makeRequest,makeResult,SIMULATOR_CAPABILITIES,IDS,AT} from './assistant-fixtures.ts';

test('config changes reject budget escalation and unknown permissions fields',()=>{
 assert.equal(configChangeContract.safeParse({kind:'set-budget',value:99}).success,false);
 assert.equal(configChangeContract.safeParse({kind:'set-continuation-detail',value:'detailed',permissions:['network']}).success,false);
 assert.equal(configChangeContract.safeParse({kind:'set-continuation-detail',value:'detailed'}).success,true);
});
test('config schema requires every purpose and rejects unknown feature and configuration fields',()=>{
 const config=makeSnapshot().config;
 assert.equal(assistantConfigContract.safeParse(config).success,true);
 for(const value of [{...config,budget:99},{...config,purposes:{...config.purposes,network:config.purposes.advice}},{...config,purposes:{...config.purposes,review:undefined}},{...config,localHelper:{requested:true,connected:true}}])assert.equal(assistantConfigContract.safeParse(value).success,false);
 assert.equal(configChangeContract.safeParse({kind:'set-purpose',feature:'advice',goal:'x'.repeat(401),benefit:'ok',successMeasure:'ok'}).success,false);
});
test('envelopes validate supported schema, UUID, timestamps and safe revisions',()=>{
 const context=makeRequest().context;
 for(const value of [{...context,schema:'lowquantflow.assistant-context/v2'},{...context,context:{...context.context,contextId:'same-title'}},{...context,context:{...context.context,contextCreatedAt:'2026-99-99'}},{...context,basis:{...context.basis,memoryRevision:-1}},{...context,basis:{...context.basis,configRevision:Number.MAX_SAFE_INTEGER+1}},{...context,basis:{...context.basis,memoryRevision:0.5}},{...context,permissions:{write:true}}])assert.equal(contextEnvelopeContract.safeParse(value).success,false);
});
test('UUIDs require RFC version and variant and times use valid UTC millisecond precision',()=>{
 const context=makeRequest().context;
 for(const contextId of ['11111111-1111-1111-1111-111111111111','11111111-1111-f111-8111-111111111111'])assert.equal(contextEnvelopeContract.safeParse({...context,context:{...context.context,contextId}}).success,false);
 for(const contextCreatedAt of ['2026-02-30T08:00:00.000Z','2026-02-29T08:00:00.000Z','2026-10-05T08:00:00.0000Z','2026-10-05T08:00:00+00:00'])assert.equal(contextEnvelopeContract.safeParse({...context,context:{...context.context,contextCreatedAt}}).success,false);
});
test('duplicate semantic keys and future entry references are rejected',()=>{
 const context=makeRequest().context;
 assert.equal(contextEnvelopeContract.safeParse({...context,omissions:[{reason:'budget',count:1},{reason:'budget',count:2}]}).success,false);
 assert.equal(contextEnvelopeContract.safeParse({...context,confirmed:[...context.confirmed,...context.confirmed]}).success,false);
 assert.equal(contextEnvelopeContract.safeParse({...context,confirmed:[{...context.confirmed[0],evidenceRefs:[{kind:'memory-entry',id:IDS.decision,revision:99}]}]}).success,false);
 assert.equal(assistantResultContract.safeParse({...makeResult(),blockers:[...makeResult().blockers,...makeResult().blockers]}).success,false);
 assert.equal(assistantResultContract.safeParse({...makeResult(),checks:[{id:'memory-check',status:'planned',evidenceRefs:[]},{id:'memory-check',status:'not-run',evidenceRefs:[]}]}).success,false);
});
test('role and task are paired and review includes exactly one actual proposal',()=>{
 const request=makeRequest();
 assert.equal(advisoryRequestContract.safeParse({...request,role:'specialist'}).success,false);
 assert.equal(advisoryRequestContract.safeParse({...request,role:'specialist',task:'review-proposal'}).success,false);
 assert.equal(advisoryRequestContract.safeParse({...request,configProposal:{kind:'set-review-depth',value:'thorough'}}).success,false);
 assert.equal(advisoryRequestContract.safeParse({...request,role:'specialist',task:'review-proposal',configProposal:{kind:'set-review-depth',value:'thorough'}}).success,true);
});
test('repair metadata accepts bounded field codes and never arbitrary raw errors',()=>{
 const request=makeRequest(),repair={attempt:1,issues:[{field:'claims',code:'evidence'}]};
 assert.equal(advisoryRequestContract.safeParse({...request,repair}).success,true);
 for(const invalid of [{...repair,attempt:2},{...repair,issues:[]},{...repair,issues:Array.from({length:9},()=>({field:'result',code:'schema'}))},{...repair,issues:[{field:'SENTINEL_SECRET',code:'schema'}]},{...repair,issues:[{field:'claims',code:'evidence',message:'RAW_ERROR'}]},{...repair,stack:'SECRET'}])assert.equal(advisoryRequestContract.safeParse({...request,repair:invalid}).success,false);
});
test('result validators accept a bounded authentic simulation',()=>{
 const request=makeRequest(),result=makeResult(request);
 const accepted=validateAssistantResult(result,request,SIMULATOR_CAPABILITIES);
 assert.deepEqual({...accepted,summary:result.summary},result);
 assert.match(accepted.summary,/Simulation/);
});
test('result producer, run, context incarnation and basis must match host expectations',()=>{
 const request=makeRequest(),result=makeResult(request);
 for(const value of [{...result,runId:IDS.other},{...result,producer:{...result.producer,mode:'model'}},{...result,producer:{...result.producer,bindingId:'other-binding'}},{...result,producer:{...result.producer,role:'specialist'}},{...result,context:{...result.context,contextCreatedAt:'2026-10-04T08:00:00.000Z'}},{...result,basis:{...result.basis,memoryRevision:6}}])assert.throws(()=>validateAssistantResult(value,request,SIMULATOR_CAPABILITIES));
});
test('foreign references and external claims relabeled confirmed are rejected',()=>{
 const request=makeRequest(),result=makeResult(request);
 for(const ref of [{kind:'memory-entry',id:IDS.other,revision:1},{kind:'memory-entry',id:IDS.decision,revision:1},{kind:'memory-entry',id:IDS.claim,revision:1},{kind:'draft',id:IDS.draft,revision:1}])assert.throws(()=>validateAssistantResult({...result,claims:[{text:'Nicht belegt',kind:'confirmed',evidenceRefs:[ref]}]},request,SIMULATOR_CAPABILITIES));
 assert.throws(()=>validateAssistantResult({...result,blockers:[{code:'FAKE',evidenceRefs:[{kind:'config',revision:99}]}]},request,SIMULATOR_CAPABILITIES));
 assert.throws(()=>validateAssistantResult({...result,claims:[{text:'Unbelegt',kind:'confirmed',evidenceRefs:[]}]},request,SIMULATOR_CAPABILITIES));
});
test('a genuine goal reference cannot launder an invented confirmed fact',()=>{
 const request=makeRequest(),result=makeResult(request),evidenceRefs=request.context.goal!.evidenceRefs;
 assert.throws(()=>validateAssistantResult({...result,claims:[{text:'Build erfolgreich und Provider freigegeben',kind:'confirmed',evidenceRefs}]},request,SIMULATOR_CAPABILITIES));
 assert.equal(validateAssistantResult({...result,claims:[{text:'Den lokalen Stand verständlicher erklären',kind:'proposal',evidenceRefs}]},request,SIMULATOR_CAPABILITIES).claims[0].kind,'proposal');
 assert.equal(validateAssistantResult({...result,claims:[{...request.context.goal!,kind:'confirmed'}]},request,SIMULATOR_CAPABILITIES).claims[0].kind,'confirmed');
});
test('local extraction cannot return configuration, workflow actions, blockers or checks',()=>{
 const request={...makeRequest(),role:'local-helper' as const,task:'extract-labels' as const};
 const caps={...SIMULATOR_CAPABILITIES,status:'verified' as const,verifiedAt:AT};
 const result={...makeResult(request,caps),blockers:[],configProposal:null,checks:[],nextAction:'none' as const};
 assert.equal(validateAssistantResult(result,request,caps).nextAction,'none');
 for(const invalid of [{...result,blockers:makeResult().blockers},{...result,checks:[{id:'memory-check',status:'planned',evidenceRefs:[]}]},{...result,nextAction:'review-draft'}])assert.throws(()=>validateAssistantResult(invalid,request,caps));
});
test('next actions require the actual draft or a current executed host check',()=>{
 const request=makeRequest();request.context.draft=null;
 const result={...makeResult(request),blockers:[],configProposal:null,nextAction:'none' as const};
 assert.throws(()=>validateAssistantResult({...result,nextAction:'review-draft'},request,SIMULATOR_CAPABILITIES));
 assert.throws(()=>validateAssistantResult({...result,nextAction:'open-existing-check'},request,SIMULATOR_CAPABILITIES));
 const ref={kind:'host-check' as const,checkId:'memory-check',runId:request.runId};request.context.confirmed.push({text:'Lokale Prüfung',evidenceRefs:[ref]});
 const checked={...result,nextAction:'open-existing-check' as const,checks:[{id:'memory-check',status:'passed' as const,evidenceRefs:[ref]}]};
 const host={checkId:'memory-check',runId:request.runId,context:request.context.context,basis:request.context.basis,status:'passed' as const};
 assert.equal(validateAssistantResult(checked,request,SIMULATOR_CAPABILITIES,[host]).nextAction,'open-existing-check');
});
test('stale-draft blocker requires a stale draft and its own reference',()=>{
 const request=makeRequest(),result=makeResult(request);request.context.draft!.stale=false;
 assert.throws(()=>validateAssistantResult(result,request,SIMULATOR_CAPABILITIES));
 request.context.draft!.stale=true;
 assert.throws(()=>validateAssistantResult({...result,blockers:[{code:'STALE_DRAFT',evidenceRefs:request.context.goal!.evidenceRefs}]},request,SIMULATOR_CAPABILITIES));
});
test('passed check requires current matching host execution evidence, not a model-created reference',()=>{
 const request=makeRequest(),ref={kind:'host-check' as const,checkId:'memory-check',runId:IDS.run};
 request.context.confirmed.push({text:'Hostprüfung',evidenceRefs:[ref]});
 const result={...makeResult(request),checks:[{id:'memory-check',status:'passed' as const,evidenceRefs:[ref]}]};
 assert.throws(()=>validateAssistantResult(result,request,SIMULATOR_CAPABILITIES));
 const host={checkId:'memory-check',runId:IDS.run,context:request.context.context,basis:request.context.basis,status:'passed' as const};
 assert.equal(validateAssistantResult(result,request,SIMULATOR_CAPABILITIES,[host]).checks[0].status,'passed');
 for(const bad of [{...host,runId:IDS.other},{...host,status:'failed'},{...host,basis:{...host.basis,memoryRevision:4}},{...host,context:{...host.context,contextCreatedAt:'2026-10-04T08:00:00.000Z'}}])assert.throws(()=>validateAssistantResult(result,request,SIMULATOR_CAPABILITIES,[bad as typeof host]));
});
test('count and UTF-8 byte limits apply to the entire response and caller cap',()=>{
 const request=makeRequest(),result=makeResult(request);
 assert.equal(assistantResultContract.safeParse({...result,claims:Array.from({length:9},(_,i)=>({text:'Claim '+i,kind:'proposal',evidenceRefs:[]}))}).success,false);
 assert.equal(assistantResultContract.safeParse({...result,blockers:Array.from({length:9},(_,i)=>({code:'BLOCK_'+i,evidenceRefs:[]}))}).success,false);
 assert.equal(assistantResultContract.safeParse({...result,checks:Array.from({length:9},(_,i)=>({id:'check-'+i,status:'planned',evidenceRefs:[]}))}).success,false);
 const unicode={...result,summary:'🧪'.repeat(1900)};
 assert.ok(new TextEncoder().encode(JSON.stringify(unicode)).length>8192);
 assert.equal(assistantResultContract.safeParse(unicode).success,false);
 assert.throws(()=>validateAssistantResult(result,{...request,maxOutputBytes:100},SIMULATOR_CAPABILITIES));
 assert.equal(advisoryRequestContract.safeParse({...request,maxOutputBytes:8193}).success,false);
});
test('a hidden serializer cannot bypass the byte cap of the validated result',()=>{
 const request={...makeRequest(),maxOutputBytes:500},result=makeResult(request);
 assert.ok(new TextEncoder().encode(JSON.stringify(result)).length>request.maxOutputBytes);
 Object.defineProperty(result,'toJSON',{value:()=>0,enumerable:false});
 assert.throws(()=>validateAssistantResult(result,request,SIMULATOR_CAPABILITIES),{code:'INVALID_RESULT'});
});
test('a foreign evidence reference is a context failure rather than repairable model structure',()=>{
 const request=makeRequest(),result=makeResult(request);
 result.claims=[{text:'Fremde Behauptung',kind:'proposal',evidenceRefs:[{kind:'memory-entry',id:IDS.other,revision:1}]}];
 assert.throws(()=>validateAssistantResult(result,request,SIMULATOR_CAPABILITIES),{code:'CONTEXT_MISMATCH'});
});
test('a goal reference cannot establish an arbitrary model-invented blocker',()=>{
 const request=makeRequest(),result=makeResult(request);
 result.blockers=[{code:'BUILD_FAILED',evidenceRefs:request.context.goal!.evidenceRefs}];
 assert.throws(()=>validateAssistantResult(result,request,SIMULATOR_CAPABILITIES),{code:'INVALID_RESULT'});
});
test('missing-goal blocker requires an actually missing goal and the current room reference',()=>{
 const request=makeRequest(),ref={kind:'room' as const,id:request.context.context.contextId,createdAt:request.context.context.contextCreatedAt};
 const result={...makeResult(request),blockers:[{code:'MISSING_GOAL',evidenceRefs:[ref]}]};
 assert.throws(()=>validateAssistantResult(result,request,SIMULATOR_CAPABILITIES),{code:'INVALID_RESULT'});
 request.context.goal=null;
 assert.equal(validateAssistantResult(result,request,SIMULATOR_CAPABILITIES).blockers[0].code,'MISSING_GOAL');
});
test('model result accessors are rejected without invoking a getter',()=>{
 const request=makeRequest(),result=makeResult(request);let calls=0,error:unknown;
 Object.defineProperty(result,'summary',{enumerable:true,get:()=>{calls++;return 'Simulation';}});
 try{validateAssistantResult(result,request,SIMULATOR_CAPABILITIES);}catch(caught){error=caught;}
 assert.equal(calls,0);assert.equal((error as {code?:string})?.code,'INVALID_RESULT');
});
test('model output must be finite plain JSON data without custom prototypes, symbols or cycles',()=>{
 const request=makeRequest(),inherited=Object.create(makeResult(request)),symbolic=makeResult(request),cyclic=makeResult(request) as unknown as Record<string,unknown>;
 Object.defineProperty(symbolic,Symbol('hidden'),{value:1,enumerable:true});cyclic.extra=cyclic;
 for(const value of [inherited,symbolic,cyclic,{...makeResult(request),summary:new String('Simulation')},{...makeResult(request),summary:()=>''},{...makeResult(request),extra:Number.NaN}])assert.throws(()=>validateAssistantResult(value,request,SIMULATOR_CAPABILITIES),{code:'INVALID_RESULT'});
});
test('free model summary cannot assert success beyond canonical host evidence',()=>{
 const request=makeRequest(),result=makeResult(request);
 result.summary='Build erfolgreich geprüft. Providerzugang freigegeben. Alle Tests bestanden.';
 const accepted=validateAssistantResult(result,request,SIMULATOR_CAPABILITIES);
 assert.equal(accepted.summary,'Simulation: Bestätigtes Ziel: „Ohne Kontextverlust weiterarbeiten“. Der Entwurf bezieht sich auf einen älteren Stand; seine veraltete Basis bleibt gesperrt. Es wurde keine ausgeführte Prüfung nachgewiesen. Nutzen des Vorschlags: Unterschiede vor der Übernahme leichter erkennen. Prüfe die vorgeschlagene Konfigurationsänderung.');
 assert.equal(result.summary,'Build erfolgreich geprüft. Providerzugang freigegeben. Alle Tests bestanden.');
});
test('the canonical host summary also counts toward the caller output byte cap',()=>{
 const request=makeRequest(),result=makeResult(request);result.summary='Kurz';
 request.maxOutputBytes=new TextEncoder().encode(JSON.stringify(result)).length;
 assert.throws(()=>validateAssistantResult(result,request,SIMULATOR_CAPABILITIES),{code:'OUTPUT_BUDGET'});
});
test('oversized raw UTF-8 output stops as a budget failure before schema repair',()=>{
 const request=makeRequest(),result=makeResult(request);result.summary='外'.repeat(3000);
 assert.throws(()=>validateAssistantResult(result,request,SIMULATOR_CAPABILITIES),{code:'OUTPUT_BUDGET'});
});
test('configuration advice explains its bounded benefit without changing stale draft basis',()=>{
 const request=makeRequest(),before=structuredClone(request),result=makeResult(request);
 result.summary='UNTRUSTED_RAW_PROSE';
 const accepted=validateAssistantResult(result,request,SIMULATOR_CAPABILITIES);
 assert.match(accepted.summary,/Unterschiede vor der Übernahme leichter erkennen/);
 assert.match(accepted.summary,/veraltete Basis bleibt gesperrt/);
 assert.equal(accepted.summary.includes('UNTRUSTED_RAW_PROSE'),false);assert.deepEqual(request,before);
});
test('every allowed proposal kind has a host-defined benefit and purpose text stays untrusted',()=>{
 const request=makeRequest(),result=makeResult(request);
 const proposals=[
  {kind:'set-purpose',feature:'advice',goal:'Unverändert',benefit:'NETWORK_ACCESS_GRANTED',successMeasure:'ROOT_GRANTED'},
  {kind:'set-continuation-enabled',value:false},
  {kind:'set-continuation-detail',value:'compact'},
  {kind:'set-advice-priority',value:'drafts-first'},
  {kind:'set-review-depth',value:'thorough'},
  {kind:'set-suggestion-frequency',value:'off'},
  {kind:'set-local-helper-requested',value:true}
 ] as const;
 for(const configProposal of proposals){
  const accepted=validateAssistantResult({...result,configProposal},request,SIMULATOR_CAPABILITIES);
  assert.match(accepted.summary,/Nutzen des Vorschlags: .{10,}\./);
  assert.equal(accepted.summary.includes('NETWORK_ACCESS_GRANTED'),false);assert.equal(accepted.summary.includes('ROOT_GRANTED'),false);
 }
});
test('nested unknown fields, URLs as binding ids and invalid capability metadata are rejected',()=>{
 const result=makeResult();
 assert.equal(assistantResultContract.safeParse({...result,producer:{...result.producer,permissions:['write']}}).success,false);
 assert.equal(assistantResultContract.safeParse({...result,claims:[{...result.claims[0],evidenceRefs:[{kind:'memory-entry',id:IDS.decision,revision:2,secret:'x'}]}]}).success,false);
 assert.equal(modelCapabilitiesContract.safeParse({...SIMULATOR_CAPABILITIES,bindingId:'https://provider.invalid'}).success,false);
 assert.equal(modelCapabilitiesContract.safeParse({...SIMULATOR_CAPABILITIES,status:'verified',verifiedAt:null}).success,false);
 assert.equal(modelCapabilitiesContract.safeParse({...SIMULATOR_CAPABILITIES,maxInputTokens:-1}).success,false);
 assert.equal(modelCapabilitiesContract.safeParse({...SIMULATOR_CAPABILITIES,status:'verified',verifiedAt:AT}).success,true);
});
