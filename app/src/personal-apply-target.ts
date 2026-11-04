import type {PersonalContinuationResponse} from './personal-continuation.ts';

/** Ephemeral navigation evidence from one applied-draft receipt, never a grant. */
export type AppliedMemoryTarget={contextId:string;contextCreatedAt:string;entryId:string;entryRevision:number;memoryRevision:number;draftRevision:number;workUpdatedAt:string|null};
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function appliedMemoryTarget(before:PersonalContinuationResponse,after:PersonalContinuationResponse):AppliedMemoryTarget|null{
 const draft=before.draft,receipt=after.draft,previous=before.memory,memory=after.memory;
 if(!draft||draft.status!=='active'||!previous||!memory||before.contextStatus!=='active'||after.contextStatus!=='active'||receipt?.status!=='applied'||receipt.revision!==draft.revision+1||!equal(receipt.composer,draft.composer)||!equal(receipt.base,draft.base))return null;
 if([receipt,previous,memory].some(value=>value.contextId!==draft.contextId||value.contextCreatedAt!==draft.contextCreatedAt)||previous.revision!==draft.base.memoryRevision||memory.revision!==previous.revision+1||before.workUpdatedAt!==draft.base.workUpdatedAt||after.workUpdatedAt!==before.workUpdatedAt)return null;
 const old=new Map(previous.entries.map(entry=>[entry.id,entry]));
 if(previous.entries.some(entry=>!memory.entries.some(next=>next.id===entry.id)))return null;
 const changed=memory.entries.filter(entry=>!equal(entry,old.get(entry.id)));
 if(changed.length!==1)return null;
 const entry=changed[0],composer=draft.composer,edited=composer.editingEntryId?old.get(composer.editingEntryId):null;
 if(entry.kind!==composer.kind||entry.text!==composer.text.trim()||!['proposed','external-claim'].includes(entry.status))return null;
 if(composer.editingEntryId){
  if(!edited||edited.kind!==composer.kind||edited.revision!==draft.base.entryRevision||!['confirmed','proposed','external-claim'].includes(edited.status))return null;
  if(edited.status!=='confirmed'){
   if(entry.id!==edited.id||entry.revision!==edited.revision+1||entry.status!=='proposed'||entry.replaces!==edited.replaces||!equal(entry.origin,edited.origin)||!equal(entry.history.slice(0,-1),edited.history)||entry.history.at(-1)?.action!=='corrected')return null;
  }else if(old.has(entry.id)||entry.revision!==1||entry.replaces!==edited.id||entry.status!=='proposed'||entry.origin.kind!=='manual'||entry.origin.sourceId!==null||entry.origin.workRevision!==draft.base.workUpdatedAt||entry.history.at(-1)?.action!=='created')return null;
 }else if(old.has(entry.id)||entry.revision!==1||entry.replaces!==null||entry.status!==(composer.origin==='external-claim'?'external-claim':'proposed')||!equal(entry.origin,{kind:composer.origin,sourceId:composer.sourceId,workRevision:draft.base.workUpdatedAt})||entry.history.at(-1)?.action!=='created')return null;
 return {contextId:draft.contextId,contextCreatedAt:draft.contextCreatedAt,entryId:entry.id,entryRevision:entry.revision,memoryRevision:memory.revision,draftRevision:receipt.revision,workUpdatedAt:after.workUpdatedAt};
}
export function appliedMemoryTargetCurrent(target:AppliedMemoryTarget|null,snapshot:PersonalContinuationResponse|null):boolean{
 const memory=snapshot?.memory,entry=memory?.entries.find(value=>value.id===target?.entryId),draft=snapshot?.draft;
 return !!target&&snapshot?.contextStatus==='active'&&snapshot.workUpdatedAt===target.workUpdatedAt&&memory?.contextId===target.contextId&&memory.contextCreatedAt===target.contextCreatedAt&&memory.revision===target.memoryRevision&&draft?.status==='applied'&&draft.contextId===target.contextId&&draft.contextCreatedAt===target.contextCreatedAt&&draft.revision===target.draftRevision&&entry?.revision===target.entryRevision&&['proposed','external-claim'].includes(entry.status);
}
