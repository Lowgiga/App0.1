import {ASSISTANT_CONTEXT_BYTES,AssistantContractError,contextEnvelopeContract,parseAssistantSnapshot,utf8Bytes,type AssistantSnapshot,type ContextEnvelope} from './contracts.ts';

export function buildAssistantContext(input:AssistantSnapshot,limits:{maxInputBytes?:number}={}):ContextEnvelope {
 const maxBytes=limits.maxInputBytes??ASSISTANT_CONTEXT_BYTES;
 if(Object.keys(limits).some(key=>key!=='maxInputBytes')||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>ASSISTANT_CONTEXT_BYTES)throw new AssistantContractError('INVALID_CONTEXT');
 const snapshot=parseAssistantSnapshot(input),entries=snapshot.memory.entries;
 const active=entries.filter(entry=>entry.status!=='forgotten'&&entry.status!=='superseded');
 const statement=(entry:typeof entries[number])=>({text:entry.text,evidenceRefs:[{kind:'memory-entry' as const,id:entry.id,revision:entry.revision}]});
 const goal=active.find(entry=>entry.kind==='goal'&&entry.status==='confirmed');
 const optional=active.filter(entry=>entry.status!=='confirmed'&&entry.kind!=='openQuestion');
 const questions=active.filter(entry=>entry.status!=='confirmed'&&entry.kind==='openQuestion');
 const context:ContextEnvelope={schema:'lowquantflow.assistant-context/v1',context:{...snapshot.context},basis:{...snapshot.basis},goal:goal?statement(goal):null,confirmed:active.filter(entry=>entry.status==='confirmed'&&entry!==goal).map(statement),claims:questions.map(statement),draft:snapshot.draft?{id:snapshot.draft.id,revision:snapshot.draft.revision,stale:snapshot.draft.basis.memoryRevision!==snapshot.basis.memoryRevision||snapshot.draft.basis.workUpdatedAt!==snapshot.basis.workUpdatedAt}:null,omissions:[]};
 const scope=entries.length-active.length,untrusted=snapshot.room.messages.length;
 function omissions(budget:number):ContextEnvelope['omissions'] {
  return [...(scope?[{reason:'scope' as const,count:scope}]:[]),...(untrusted?[{reason:'untrusted' as const,count:untrusted}]:[]),...(budget?[{reason:'budget' as const,count:budget}]:[])];
 }
 // Reserve exact omission metadata before filling optional material. Mandatory
 // identity, basis, confirmed decisions and draft metadata are never truncated.
 let omitted=optional.length;context.omissions=omissions(omitted);
 if(utf8Bytes(context)>maxBytes)throw new AssistantContractError('CONTEXT_BUDGET');
 for(const entry of optional){
  context.claims.push(statement(entry));context.omissions=omissions(omitted-1);
  if(utf8Bytes(context)>maxBytes){context.claims.pop();context.omissions=omissions(omitted);}else omitted--;
 }
 const parsed=contextEnvelopeContract.safeParse(context);
 if(!parsed.success)throw new AssistantContractError('INVALID_CONTEXT');
 return parsed.data;
}
