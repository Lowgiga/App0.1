import type {PersonalContinuationResponse,PersonalDraft} from '../personal-continuation.ts';
import type {ContextKey} from './contracts.ts';

/** Host-only projection. Composer text is deliberately never retained here. */
export type AssistantContinuation={
 context:ContextKey;
 status:'none'|PersonalDraft['status'];
 revision:number|null;
 updatedAt:string|null;
 kind:PersonalDraft['composer']['kind']|null;
 origin:PersonalDraft['composer']['origin']|null;
 stale:boolean;
};
export function projectAssistantContinuation(value:PersonalContinuationResponse,context:ContextKey):AssistantContinuation{
 const draft=value.draft;
 return {context:{...context},status:draft?.status??'none',revision:draft?.revision??null,updatedAt:draft?.updatedAt??null,kind:draft?.composer.kind??null,origin:draft?.composer.origin??null,
  stale:!!draft&&(draft.base.workUpdatedAt!==value.workUpdatedAt||draft.base.memoryRevision!==value.memory?.revision)};
}
