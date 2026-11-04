import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultAssistantConfig,proposeConfig,validateConfigProposal} from '../../src/assistant/config.ts';
import {assistantConfigContract} from '../../src/assistant/contracts.ts';
import {makeSnapshot,IDS} from './assistant-fixtures.ts';

test('defaults expose five purpose-bearing preferences without execution permissions',()=>{
 const config=defaultAssistantConfig(makeSnapshot().context);
 assert.equal(assistantConfigContract.safeParse(config).success,true);
 assert.deepEqual(config.continuation,{enabled:true,detail:'compact'});assert.equal(config.advice.priority,'blockers-first');assert.equal(config.review.depth,'standard');assert.equal(config.suggestions.frequency,'on-request');assert.equal(config.localHelper.requested,false);assert.equal(config.revision,0);
 assert.deepEqual(Object.keys(config.purposes).sort(),['advice','continuation','local-helper','review','suggestions']);
 for(const purpose of Object.values(config.purposes))for(const text of Object.values(purpose))assert.ok(text.length>0&&text.length<=400);
 const second=defaultAssistantConfig(config.context);config.purposes.advice.goal='mutated';assert.notEqual(second.purposes.advice.goal,'mutated');
});
test('compact to detailed proposal changes one preference and revision without mutation',()=>{
 const snapshot=makeSnapshot(),before=JSON.stringify(snapshot),proposal=proposeConfig(snapshot,{kind:'set-continuation-detail',value:'detailed'});
 assert.match(proposal.id,/^[0-9a-f-]{36}$/);assert.deepEqual(proposal.before,snapshot.config);
 assert.deepEqual(proposal.after,{...snapshot.config,revision:1,continuation:{enabled:true,detail:'detailed'}});
 assert.equal(JSON.stringify(snapshot),before);assert.deepEqual(proposal.context,snapshot.context);assert.deepEqual(proposal.basis,snapshot.basis);
 assert.ok(proposal.effect.benefit.length>0);assert.ok(proposal.effect.sideEffect.length>0);assert.deepEqual(validateConfigProposal(proposal,snapshot),{ok:true});
});
test('every allowed variant changes only its designated preference and leaves draft stale basis intact',()=>{
 const changes=[{kind:'set-continuation-enabled',value:false},{kind:'set-advice-priority',value:'drafts-first'},{kind:'set-review-depth',value:'thorough'},{kind:'set-suggestion-frequency',value:'off'},{kind:'set-local-helper-requested',value:true},{kind:'set-purpose',feature:'review',goal:'Prüfen',benefit:'Risiken sehen',successMeasure:'Einwand verstehen'}] as const;
 const expected=[{continuation:{enabled:false,detail:'compact'}},{advice:{priority:'drafts-first'}},{review:{depth:'thorough'}},{suggestions:{frequency:'off'}},{localHelper:{requested:true}},{purposes:{...makeSnapshot().config.purposes,review:{goal:'Prüfen',benefit:'Risiken sehen',successMeasure:'Einwand verstehen'}}}];
 for(const [i,change] of changes.entries()){const snapshot=makeSnapshot(),draft=structuredClone(snapshot.draft),proposal=proposeConfig(snapshot,change);assert.deepEqual(proposal.after,{...snapshot.config,revision:1,...expected[i]});assert.deepEqual(validateConfigProposal(proposal,snapshot),{ok:true});assert.deepEqual(snapshot.draft,draft);assert.equal(snapshot.draft?.basis.memoryRevision,4);assert.equal(proposal.after.revision,1);assert.equal(assistantConfigContract.safeParse(proposal.after).success,true);}
});
test('any changed project, memory or config basis invalidates the same proposal',()=>{
 const snapshot=makeSnapshot(),proposal=proposeConfig(snapshot,{kind:'set-continuation-detail',value:'detailed'});
 for(const change of [{workUpdatedAt:'2026-10-05T08:01:00.000Z'},{memoryRevision:6},{configRevision:1}]){
  const fresh=structuredClone(snapshot);fresh.basis={...fresh.basis,...change};if('memoryRevision'in change)fresh.memory.revision=6;if('configRevision'in change)fresh.config.revision=1;
  assert.deepEqual(validateConfigProposal(proposal,fresh),{ok:false,code:'STALE_BASIS'});
 }
});
test('recreated and archived project invalidate proposal',()=>{
 const snapshot=makeSnapshot(),proposal=proposeConfig(snapshot,{kind:'set-continuation-detail',value:'detailed'});
 const foreign=structuredClone(snapshot);foreign.context.contextCreatedAt='2026-10-04T08:00:00.000Z';assert.deepEqual(validateConfigProposal(proposal,foreign),{ok:false,code:'CONTEXT_MISMATCH'});
 snapshot.room.status='Archiviert';assert.deepEqual(validateConfigProposal(proposal,snapshot),{ok:false,code:'ARCHIVED'});
});
test('tampered before/after, effects, foreign references and unknown keys are rejected',()=>{
 const snapshot=makeSnapshot(),proposal=proposeConfig(snapshot,{kind:'set-continuation-detail',value:'detailed'});
 for(const value of [{...proposal,permissions:true},{...proposal,after:{...proposal.after,review:{depth:'thorough'}}},{...proposal,before:{...proposal.before,continuation:{enabled:false,detail:'compact'}}},{...proposal,effect:{...proposal.effect,benefit:'Erlaubt Netz'}},{...proposal,context:{...proposal.context,contextId:IDS.other}},{...proposal,change:{kind:'set-budget',value:100}}])assert.equal(validateConfigProposal(value,snapshot).ok,false);
});
test('no-op proposals and invalid changes fail closed without writes',()=>{
 const snapshot=makeSnapshot();
 assert.throws(()=>proposeConfig(snapshot,{kind:'set-continuation-detail',value:'compact'}),{code:'NO_CHANGE'});
 assert.throws(()=>proposeConfig(snapshot,{kind:'set-budget',value:100}),{code:'INVALID_CHANGE'});
 assert.throws(()=>proposeConfig(snapshot,{kind:'set-continuation-detail',value:'detailed',permissions:true}),{code:'INVALID_CHANGE'});
});
test('revision overflow cannot create a candidate and no-change forged candidate is rejected',()=>{
 const snapshot=makeSnapshot();snapshot.config.revision=Number.MAX_SAFE_INTEGER;snapshot.basis.configRevision=Number.MAX_SAFE_INTEGER;
 assert.throws(()=>proposeConfig(snapshot,{kind:'set-continuation-detail',value:'detailed'}),{code:'INVALID_CHANGE'});
 const normal=makeSnapshot(),proposal=proposeConfig(normal,{kind:'set-continuation-detail',value:'detailed'});
 assert.deepEqual(validateConfigProposal({...proposal,change:{kind:'set-continuation-detail',value:'compact'}},normal),{ok:false,code:'NO_CHANGE'});
});
