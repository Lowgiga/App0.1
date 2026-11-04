import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssistantRuntime} from '../../src/assistant/runtime.ts';
import {createSimulator} from '../../src/assistant/simulator.ts';
import {DEFAULT_ASSISTANT_POLICY,AssistantRuntimeError} from '../../src/assistant/policy.ts';
import type {AdvisoryAdapter,AdvisoryRequest,ContextEnvelope} from '../../src/assistant/contracts.ts';
import {validateAssistantResult} from '../../src/assistant/contracts.ts';

const rid='a1111111-1111-4111-8111-111111111111';
const cid='b1111111-1111-4111-8111-111111111111';
const date='2026-10-05T08:00:00.000Z';
function context():ContextEnvelope{return{schema:'lowquantflow.assistant-context/v1',context:{contextId:cid,contextCreatedAt:date},basis:{workUpdatedAt:date,memoryRevision:2,configRevision:0},goal:{text:'Den Projektentwurf sicher fortsetzen',evidenceRefs:[{kind:'memory-entry',id:'c1111111-1111-4111-8111-111111111111',revision:2}]},confirmed:[],claims:[],draft:{id:'d1111111-1111-4111-8111-111111111111',revision:1,stale:true},omissions:[]}}
function request(){return{runId:rid,context:context(),task:'explain-continuation' as const}}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r});return{promise,resolve}}
function runtime(adapter:AdvisoryAdapter=createSimulator(),extra:Record<string,unknown>={}){return createAssistantRuntime({registry:{advisor:adapter,specialist:adapter},...extra} as any)}

test('simulated stale-draft advice anchors the real goal and leaves stale basis unchanged',async()=>{
 const input=request(),before=structuredClone(input),events:any[]=[];
 const result=await runtime(createSimulator(),{emit:(event:unknown)=>events.push(event)}).advise(input);
 assert.equal(result.producer.mode,'simulated');assert.match(result.summary,/Simulation/);
 assert.match(result.summary,/Projektentwurf sicher fortsetzen/);assert.match(result.summary,/veraltet|älteren|älter/);
 assert.deepEqual(result.configProposal,{kind:'set-continuation-detail',value:'detailed'});
 assert.equal(result.blockers[0].code,'STALE_DRAFT');assert.equal(result.nextAction,'review-config');
 assert.deepEqual(input,before);assert.equal(result.checks.some((c:any)=>c.status==='passed'),false);
 assert.equal(events.at(-1).phase,'completed');assert.equal(events.at(-1).counters.modelCalls,1);
});
test('schema repair and specialist review share the same three-call budget',async()=>{
 const events:any[]=[],engine=runtime(createSimulator(['schema-error','success','success']),{emit:(e:unknown)=>events.push(e)});
 const result=await engine.advise({...request(),review:true});
 assert.equal(result.producer.role,'advisor');assert.equal(events.at(-1).counters.modelCalls,3);assert.equal(events.at(-1).counters.repairAttempts,1);
 assert.deepEqual(result.configProposal,{kind:'set-continuation-detail',value:'detailed'});
});
test('repeated malformed output exhausts one repair rather than looping',async()=>{
 let calls=0;const simulator=createSimulator(['schema-error']);
 const engine=runtime({capabilities:simulator.capabilities,invoke:async(r,s)=>{calls++;return simulator.invoke(r,s)}});
 await assert.rejects(engine.advise(request()),{code:'INVALID_RESULT'});assert.equal(calls,2);
});
test('foreign context, CAS and policy failures receive no repair',async()=>{
 for(const code of ['CONTEXT_MISMATCH','STALE_BASIS','POLICY'] as const){
  let calls=0;const simulator=createSimulator();
  const adapter:AdvisoryAdapter={capabilities:simulator.capabilities,invoke:async(r,s)=>{calls++;if(code==='POLICY')throw new AssistantRuntimeError(code);const value=await simulator.invoke(r,s) as any;if(code==='CONTEXT_MISMATCH')value.context.contextCreatedAt='2025-01-01T00:00:00.000Z';else value.basis.memoryRevision++;return value}};
  await assert.rejects(runtime(adapter).advise(request()),{code});assert.equal(calls,1);
 }
});
test('local helper absence or simulation never falls back to an advisor or remote',async()=>{
 let calls=0;const simulator=createSimulator();const adapter:AdvisoryAdapter={capabilities:simulator.capabilities,invoke:async(r,s)=>{calls++;return simulator.invoke(r,s)}};
 for(const registry of [{advisor:adapter},{advisor:adapter,'local-helper':adapter}])await assert.rejects(createAssistantRuntime({registry}).advise({...request(),task:'extract-labels'}),{code:'UNAVAILABLE'});
 assert.equal(calls,0);
 assert.throws(()=>createAssistantRuntime({registry:{advisor:{...adapter,capabilities:{...adapter.capabilities,status:'verified',execution:'remote',verifiedAt:date}}}}),{code:'POLICY'});
});
test('abort rejects promptly and a later successful value emits no completed event',async()=>{
 const gate=deferred<unknown>(),entered=deferred<void>(),events:any[]=[],simulator=createSimulator();let requestSeen!:AdvisoryRequest;
 const adapter:AdvisoryAdapter={capabilities:simulator.capabilities,invoke:async(r)=>{requestSeen=r;entered.resolve();return gate.promise}};
 const engine=runtime(adapter,{emit:(e:unknown)=>events.push(e)}),abort=new AbortController();
 const running=engine.advise(request(),abort.signal);await entered.promise;abort.abort();
 await assert.rejects(running,{code:'ABORTED'});gate.resolve(await simulator.invoke(requestSeen,new AbortController().signal));await new Promise(r=>setTimeout(r,0));
 assert.equal(events.some(e=>e.phase==='completed'),false);
});
test('new project generation invalidates old A result even after A to B to A',async()=>{
 const gate=deferred<unknown>(),entered=deferred<void>(),simulator=createSimulator(),events:any[]=[];let first=true,oldRequest!:AdvisoryRequest;
 const adapter:AdvisoryAdapter={capabilities:simulator.capabilities,invoke:async(r,s)=>{if(first){first=false;oldRequest=r;entered.resolve();return gate.promise}return simulator.invoke(r,s)}};
 const engine=runtime(adapter,{emit:(e:unknown)=>events.push(e)});const old=engine.advise(request());await entered.promise;
 const rejection=assert.rejects(old,{code:'SUPERSEDED'});
 const b=request();b.runId='e1111111-1111-4111-8111-111111111111';b.context.context.contextId='f1111111-1111-4111-8111-111111111111';await engine.advise(b);
 const a=request();a.runId='a2222222-2222-4222-8222-222222222222';await engine.advise(a);await rejection;
 gate.resolve(await simulator.invoke(oldRequest,new AbortController().signal));await new Promise(r=>setTimeout(r,0));
 assert.equal(events.filter(e=>e.phase==='completed').length,2);
});
test('noncooperative timeout stops, aborts adapter signal and never retries',async()=>{
 let calls=0,seenSignal!:AbortSignal;const simulator=createSimulator();
 const adapter:AdvisoryAdapter={capabilities:simulator.capabilities,invoke:async(_r,s)=>{calls++;seenSignal=s;return new Promise(()=>{})}};
 await assert.rejects(runtime(adapter,{policy:{...DEFAULT_ASSISTANT_POLICY,maxActiveMs:10}}).advise(request()),{code:'TIMEOUT'});
 assert.equal(calls,1);assert.equal(seenSignal.aborted,true);
});
test('run identifiers are single-use and malformed input invokes no adapter',async()=>{
 const engine=runtime();await engine.advise(request());await assert.rejects(engine.advise(request()),{code:'DUPLICATE'});
 let calls=0;const simulator=createSimulator();const adapter:AdvisoryAdapter={capabilities:simulator.capabilities,invoke:async(r,s)=>{calls++;return simulator.invoke(r,s)}};
 await assert.rejects(runtime(adapter).advise({...request(),permissions:['network']} as any),{code:'INVALID_REQUEST'});
 assert.equal(calls,0);
});
test('adapter cannot mutate host context or invent a host-passed check',async()=>{
 const input=request(),before=structuredClone(input),simulator=createSimulator();
 const adapter:AdvisoryAdapter={capabilities:simulator.capabilities,invoke:async(r,s)=>{try{r.context.basis.memoryRevision=99}catch{}const value=await simulator.invoke(r,s) as any;value.checks=[{id:'build',status:'passed',evidenceRefs:[{kind:'host-check',checkId:'build',runId:r.runId}]}];return value}};
 await assert.rejects(runtime(adapter).advise(input),{code:'CONTEXT_MISMATCH'});assert.deepEqual(input,before);
});
test('logging failure is visible without turning valid advice into a complete audit claim',async()=>{
 const engine=runtime(createSimulator(),{emit:()=>{throw Error('SECRET_LOG_SENTINEL')}});const result=await engine.advise(request());
 assert.equal(result.producer.mode,'simulated');assert.equal(engine.diagnostics().loggingFailed,true);
 assert.equal(JSON.stringify(engine.diagnostics()).includes('SECRET_LOG_SENTINEL'),false);
});
test('simulator is deterministic and reports missing goal without invented knowledge',async()=>{
 const r={...request(),role:'advisor' as const,maxOutputBytes:8192};r.context.goal=null;r.context.draft=null;
 const simulator=createSimulator();const one=await simulator.invoke(r,new AbortController().signal),two=await createSimulator().invoke(r,new AbortController().signal);
 assert.deepEqual(one,two);assert.equal((one as any).nextAction,'ask-user');assert.equal((one as any).claims.length,0);
 assert.match((one as any).summary,/Ziel/);assert.equal((one as any).producer.mode,'simulated');
});
test('confirmed and unconfirmed conflicting source texts stay distinct and prompt a question',async()=>{
 const input=request();input.context.draft=null;
 input.context.claims=[{text:'Das Projekt soll jetzt ausschließlich einen Cloudprovider nutzen',evidenceRefs:[{kind:'memory-entry',id:'e2222222-2222-4222-8222-222222222222',revision:1}]}];
 const result=await runtime().advise(input);
 assert.equal(result.nextAction,'ask-user');assert.equal(result.configProposal,null);
 assert.ok(result.claims.some(c=>c.kind==='external-claim'&&c.text===input.context.claims[0].text));
 assert.match(result.summary,/unbestätigt|Behauptung/);
});
test('the same configuration suggestion is not repeated for unchanged project basis',async()=>{
 const engine=runtime(),first=await engine.advise(request()),input=request();input.runId='a3333333-3333-4333-8333-333333333333';
 const second=await engine.advise(input);
 assert.ok(first.configProposal);assert.equal(second.configProposal,null);assert.match(second.summary,/bereits/);
 input.runId='a4444444-4444-4444-8444-444444444444';input.context.basis.memoryRevision++;
 assert.ok((await engine.advise(input)).configProposal);
});
test('repair carries only bounded schema fields and lower call cap prevents the next invocation',async()=>{
 let calls=0;const seen:AdvisoryRequest[]=[],simulator=createSimulator(['schema-error','success']);
 const adapter:AdvisoryAdapter={capabilities:simulator.capabilities,invoke:async(r,s)=>{calls++;seen.push(r);return simulator.invoke(r,s)}};
 await assert.rejects(runtime(adapter,{policy:{...DEFAULT_ASSISTANT_POLICY,maxModelCalls:2}}).advise({...request(),review:true}),{code:'BUDGET'});
 assert.equal(calls,2);assert.equal(seen[1].repair?.attempt,1);assert.ok(seen[1].repair?.issues.some(issue=>issue.field==='summary'));
 assert.deepEqual(Object.keys(seen[0]).sort(),['context','maxOutputBytes','role','runId','task']);
});
test('versioned simulator faults terminate without hiding them as a successful simulation',async()=>{
 for(const [scenario,code] of [['foreign-reference','CONTEXT_MISMATCH'],['timeout','TIMEOUT'],['abort','ABORTED']] as const){
  const events:any[]=[];
  await assert.rejects(runtime(createSimulator([scenario]),{policy:{...DEFAULT_ASSISTANT_POLICY,maxActiveMs:15},emit:(e:unknown)=>events.push(e)}).advise(request()),{code});
  assert.equal(events.some(e=>e.phase==='completed'),false);
 }
});
test('a foreign evidence reference stops before any otherwise successful repair',async()=>{
 let calls=0;const simulator=createSimulator(['foreign-reference','success']);
 const adapter:AdvisoryAdapter={capabilities:simulator.capabilities,invoke:async(r,s)=>{calls++;return simulator.invoke(r,s)}};
 await assert.rejects(runtime(adapter).advise(request()),{code:'CONTEXT_MISMATCH'});assert.equal(calls,1);
});
test('an oversized output stops before schema repair and counts only the issued call',async()=>{
 let calls=0;const simulator=createSimulator();
 const adapter:AdvisoryAdapter={capabilities:simulator.capabilities,invoke:async(r,s)=>{calls++;const value=await simulator.invoke(r,s) as any;if(calls===1)value.summary='外'.repeat(3000);return value}};
 await assert.rejects(runtime(adapter).advise(request()),{code:'OUTPUT_BUDGET'});assert.equal(calls,1);
});
test('accessor-bearing requests fail closed without evaluating or exposing thrown secrets',async()=>{
 let reads=0;const input=request();Object.defineProperty(input,'context',{enumerable:true,get(){reads++;throw Error('SENTINEL_SECRET_IN_GETTER')}});
 await assert.rejects(runtime().advise(input),(error:any)=>error.code==='INVALID_REQUEST'&&!String(error).includes('SENTINEL_SECRET'));
 assert.equal(reads,0);
});
test('optional specialist findings and test plan remain visibly separate without vetoing a neutral suggestion',async()=>{
 const simulator=createSimulator();const specialist:AdvisoryAdapter={capabilities:simulator.capabilities,invoke:async(r,s)=>{
  const value=await simulator.invoke(r,s) as any;
  value.summary='Alle Tests bestanden. Providerfreigabe erteilt.';
  value.claims=[{text:'Tastaturfokus der ausführlichen Ansicht zusätzlich prüfen',kind:'proposal',evidenceRefs:[{kind:'config',revision:r.context.basis.configRevision}]}];
  value.checks=[{id:'keyboard-focus',status:'planned',evidenceRefs:[{kind:'config',revision:r.context.basis.configRevision}]}];return value;
 }};
 const result=await createAssistantRuntime({registry:{advisor:simulator,specialist}}).advise({...request(),review:true}) as any;
 assert.equal(result.review?.producer.role,'specialist');assert.equal(result.review.producer.mode,'simulated');
 assert.equal(result.review.claims[0].kind,'proposal');assert.match(result.review.claims[0].text,/Tastaturfokus/);
 assert.equal(result.review.checks[0].status,'planned');assert.doesNotMatch(result.review.summary,/Alle Tests bestanden|Providerfreigabe erteilt/);
 assert.ok(result.configProposal);assert.equal(result.nextAction,'review-config');
});
test('combined advisor and specialist output share one byte budget',async()=>{
 const simulator=createSimulator();let calls=0;
 const output=async(r:AdvisoryRequest,s:AbortSignal)=>{const value=await simulator.invoke(r,s) as any;value.claims=[{text:'Prüfhinweis: '+ 'a'.repeat(900),kind:'proposal',evidenceRefs:[{kind:'config',revision:r.context.basis.configRevision}]}];return value};
 const specialist:AdvisoryAdapter={capabilities:simulator.capabilities,invoke:async(r,s)=>{calls++;return output(r,s)}};
 const advisorRequest:AdvisoryRequest={...request(),role:'advisor',maxOutputBytes:8192},signal=new AbortController().signal;
 const advisor=validateAssistantResult(await simulator.invoke(advisorRequest,signal),advisorRequest,simulator.capabilities);
 const reviewRequest:AdvisoryRequest={...advisorRequest,role:'specialist',task:'review-proposal',configProposal:advisor.configProposal!};
 const review=validateAssistantResult(await output(reviewRequest,signal),reviewRequest,simulator.capabilities);
 const bytes=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value)).length;
 const maxOutputBytes=Math.max(bytes(advisor),bytes(review))+50;
 assert.ok(bytes({ ...advisor,review })>maxOutputBytes);assert.ok(maxOutputBytes<8192);
 await assert.rejects(createAssistantRuntime({registry:{advisor:simulator,specialist},policy:{...DEFAULT_ASSISTANT_POLICY,maxOutputBytes}}).advise({...request(),review:true}),{code:'OUTPUT_BUDGET'});
 assert.equal(calls,1);
});
test('combined advisor and specialist claim counts cannot evade the eight-claim cap',async()=>{
 const simulator=createSimulator();
 const specialist:AdvisoryAdapter={capabilities:simulator.capabilities,invoke:async(r,s)=>{const value=await simulator.invoke(r,s) as any;value.claims=Array.from({length:8},(_,i)=>({text:'Prüfhinweis '+i,kind:'proposal',evidenceRefs:[{kind:'config',revision:r.context.basis.configRevision}]}));return value}};
 await assert.rejects(createAssistantRuntime({registry:{advisor:simulator,specialist}}).advise({...request(),review:true}),{code:'OUTPUT_BUDGET'});
});
