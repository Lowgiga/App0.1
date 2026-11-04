import {z} from 'zod';
import type {WorkState} from '../upstream/lib/work-contract.ts';
import {LocalStateError} from './local-errors.ts';
import {memoryKinds,projectMemoryContract,memoryForContext,applyProjectMemory,parseMemoryRequest,type ProjectMemoryBackup} from './project-memory.ts';

/** Device-only records: deliberately excluded from all WorkState and backup contracts. */
export const PERSONAL_CONTINUATION_KEY='personal-continuation-v1';
export const PERSONAL_VIEW_KEY='personal-view-v1';
export const PERSONAL_CONTINUATION_BYTES=512*1024;
export const PERSONAL_CONTINUATION_RECORDS=100;
const uuid=z.string().uuid(),date=z.string().datetime(),revision=z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const credentialPattern=/(?:authorization\s*:\s*bearer|\b(?:password|passwd|api[_ -]?key|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|cookie)\s*[:=]|-----BEGIN (?:[A-Z ]*PRIVATE KEY)|\b(?:sk-|ghp_|github_pat_)[a-zA-Z0-9_-]{12,})/i;
export const personalContextContract=z.object({contextId:uuid,contextCreatedAt:date}).strict();
export const personalComposerContract=z.object({
 kind:z.enum(memoryKinds),text:z.string().max(2000).refine(text=>!credentialPattern.test(text),'Keine Zugangsdaten im Entwurf speichern.'),
 origin:z.enum(['manual','proposal','external-claim']),sourceId:z.string().min(1).max(80).nullable(),editingEntryId:uuid.nullable(),
}).strict().superRefine((value,ctx)=>{
 // The origin dropdown can be changed before its source is selected. Preserve
 // that incomplete editor state; application still requires a selected source.
 if(value.origin!=='external-claim'&&value.sourceId!==null)ctx.addIssue({code:'custom',message:'Ungültige Herkunft.'});
});
export const personalDraftBaseContract=z.object({workUpdatedAt:date.nullable(),memoryRevision:revision,entryRevision:revision.refine(n=>n>0).nullable()}).strict();
export const personalDraftContract=z.object({
 schema:z.literal('lowquantflow.personal-draft/v1'),...personalContextContract.shape,
 revision:revision.refine(n=>n>0),updatedAt:date,status:z.enum(['active','applied','discarded']),
 base:personalDraftBaseContract,composer:personalComposerContract,
}).strict().superRefine((value,ctx)=>{
 if((value.composer.editingEntryId===null)!==(value.base.entryRevision===null)||value.base.entryRevision!==null&&value.base.entryRevision>value.base.memoryRevision)ctx.addIssue({code:'custom',message:'Ungültige Eintragsbasis.'});
 if(value.status!=='active'&&value.revision<2)ctx.addIssue({code:'custom',message:'Abschluss benötigt eine eigene Revision.'});
});
const bytes=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value)).length;
export const personalContinuationContract=z.object({schema:z.literal('lowquantflow.personal-continuation/v1'),records:z.array(personalDraftContract).max(PERSONAL_CONTINUATION_RECORDS)}).strict().superRefine((value,ctx)=>{
 if(new Set(value.records.map(r=>r.contextId+'@'+r.contextCreatedAt)).size!==value.records.length)ctx.addIssue({code:'custom',message:'Doppelte Projektinkarnation.'});
 if(bytes(value)>PERSONAL_CONTINUATION_BYTES)ctx.addIssue({code:'custom',message:'Entwurfsgrenze von 512 KiB erreicht.'});
});
export const personalViewContract=z.object({
 schema:z.literal('lowquantflow.personal-view/v1'),revision,updatedAt:date.nullable(),contextId:uuid.nullable(),contextCreatedAt:date.nullable(),
}).strict().superRefine((value,ctx)=>{
 const empty=value.revision===0;
 if((value.updatedAt===null)!==empty||(value.contextId===null)!==empty||(value.contextCreatedAt===null)!==empty)ctx.addIssue({code:'custom',message:'Ungültiger persönlicher Arbeitspunkt.'});
});
export const personalContinuationResponseContract=z.object({
 schema:z.literal('lowquantflow.personal-continuation-response/v1'),draft:personalDraftContract.nullable(),memory:projectMemoryContract.nullable(),workUpdatedAt:date.nullable(),contextStatus:z.enum(['active','archived','missing']),
}).strict().superRefine((value,ctx)=>{
 if((value.contextStatus==='missing')!==(value.memory===null))ctx.addIssue({code:'custom',message:'Ungültiger Projektstatus.'});
 if(value.draft&&value.memory&&(value.draft.contextId!==value.memory.contextId||value.draft.contextCreatedAt!==value.memory.contextCreatedAt))ctx.addIssue({code:'custom',message:'Abweichende Projektinkarnationen.'});
});
const context=personalContextContract.shape,expected={...context,expectedRevision:revision};
export const personalContinuationRequestContract=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('read-view')}).strict(),
 z.object({operation:z.literal('remember'),...expected}).strict(),
 z.object({operation:z.literal('read'),...context}).strict(),
 z.object({operation:z.literal('save-draft'),...expected,base:personalDraftBaseContract,composer:personalComposerContract}).strict(),
 z.object({operation:z.literal('rebase-draft'),...expected,base:personalDraftBaseContract}).strict(),
 z.object({operation:z.literal('apply-draft'),...expected}).strict(),
 z.object({operation:z.literal('discard-draft'),...expected}).strict(),
]);
export type PersonalDraft=z.infer<typeof personalDraftContract>;
export type PersonalComposer=z.infer<typeof personalComposerContract>;
export type PersonalDraftBase=z.infer<typeof personalDraftBaseContract>;
export type PersonalView=z.infer<typeof personalViewContract>;
export type PersonalContinuation=z.infer<typeof personalContinuationContract>;
export type PersonalContinuationResponse=z.infer<typeof personalContinuationResponseContract>;
export type PersonalContinuationRequest=z.infer<typeof personalContinuationRequestContract>;
type Context=z.infer<typeof personalContextContract>;
const invalid=(message='Ungültiger persönlicher Entwurf. Grenzen, Herkunft und Projekt prüfen.')=>new LocalStateError('VALIDATION',message,400);
const conflict=(message:string)=>new LocalStateError('CONFLICT',message,409);
export function parsePersonalContinuationRequest(input:unknown):PersonalContinuationRequest{
 const parsed=personalContinuationRequestContract.safeParse(input);if(!parsed.success)throw invalid();return parsed.data;
}
function decode<T>(value:unknown,schema:string,contract:z.ZodType<T>,empty:T):T{
 if(value===undefined)return empty;
 if(value&&typeof value==='object'&&'schema' in value&&value.schema!==schema)throw new LocalStateError('UNSUPPORTED_VERSION','Neuere persönliche Speicherversion. Daten bleiben erhalten.');
 const parsed=contract.safeParse(value);if(!parsed.success)throw new LocalStateError('CORRUPT_STORAGE','Persönlicher Speicher beschädigt. Kein Zurücksetzen oder Überschreiben.');return parsed.data;
}
export function decodePersonalContinuation(value:unknown):PersonalContinuation{return decode(value,'lowquantflow.personal-continuation/v1',personalContinuationContract,{schema:'lowquantflow.personal-continuation/v1',records:[]})}
export function decodePersonalView(value:unknown):PersonalView{return decode(value,'lowquantflow.personal-view/v1',personalViewContract,{schema:'lowquantflow.personal-view/v1',revision:0,updatedAt:null,contextId:null,contextCreatedAt:null})}
const sameContext=(a:Context,b:Context)=>a.contextId===b.contextId&&a.contextCreatedAt===b.contextCreatedAt;
const sameBase=(a:PersonalDraftBase,b:PersonalDraftBase)=>a.workUpdatedAt===b.workUpdatedAt&&a.memoryRevision===b.memoryRevision&&a.entryRevision===b.entryRevision;
function roomFor(work:WorkState,input:Context){return work.rooms.find(room=>room.id===input.contextId&&room.createdAt===input.contextCreatedAt)}
function activeRoom(work:WorkState,input:Context){const room=roomFor(work,input);if(!room||room.status==='Archiviert')throw conflict('Projekt fehlt, wurde ersetzt oder ist archiviert. Entwurf bleibt erhalten.');return room}
function nextStamp(previous:string|null,now:Date){const wall=now.getTime(),next=Math.max(wall,previous?Date.parse(previous)+1:0);if(!Number.isFinite(next)||!Number.isFinite(new Date(next).getTime()))throw new LocalStateError('STORAGE_UNAVAILABLE','Ungültige Gerätezeit. Nichts gespeichert.');return new Date(next).toISOString()}
function nextRevision(previous:number){if(previous===Number.MAX_SAFE_INTEGER)throw invalid('Revisionsgrenze erreicht. Nichts gespeichert.');return previous+1}
export function personalContinuationSnapshot(records:PersonalContinuation,memory:ProjectMemoryBackup,work:WorkState,input:Context):PersonalContinuationResponse{
 const room=roomFor(work,input);
 return {schema:'lowquantflow.personal-continuation-response/v1',draft:records.records.find(r=>sameContext(r,input))??null,memory:room?memoryForContext(memory,room):null,workUpdatedAt:work.updatedAt,contextStatus:room?(room.status==='Archiviert'?'archived':'active'):'missing'};
}
export function rememberPersonalView(view:PersonalView,work:WorkState,input:Extract<PersonalContinuationRequest,{operation:'remember'}>,now:Date):PersonalView{
 if(view.revision!==input.expectedRevision)throw conflict('Ein anderer Tab hat den Arbeitspunkt geändert. Neu laden.');activeRoom(work,input);
 return {schema:'lowquantflow.personal-view/v1',revision:nextRevision(view.revision),updatedAt:nextStamp(view.updatedAt,now),contextId:input.contextId,contextCreatedAt:input.contextCreatedAt};
}
function checkBase(work:WorkState,memory:ProjectMemoryBackup,input:Context,base:PersonalDraftBase,composer:PersonalComposer){
 const room=activeRoom(work,input),record=memoryForContext(memory,room);
 if(base.workUpdatedAt!==work.updatedAt||base.memoryRevision!==record.revision)throw conflict('Arbeitsstand oder Projektgedächtnis hat sich geändert. Entwurf vergleichen und ausdrücklich auf den aktuellen Stand beziehen.');
 const entry=composer.editingEntryId?record.entries.find(e=>e.id===composer.editingEntryId):null;
 if(composer.editingEntryId&&(!entry||entry.revision!==base.entryRevision||entry.kind!==composer.kind||['forgotten','superseded'].includes(entry.status))||!composer.editingEntryId&&base.entryRevision!==null)throw conflict('Der zu korrigierende Eintrag hat sich geändert oder fehlt. Entwurf bleibt erhalten.');
 if(composer.origin==='external-claim'&&composer.sourceId!==null&&!room.sources.includes(composer.sourceId))throw invalid('Diese externe Herkunft ist im Projekt nicht ausgewählt.');
}
/** Pure transition; the transaction commits returned draft receipt and memory together. */
export function applyPersonalContinuation(records:PersonalContinuation,memory:ProjectMemoryBackup,work:WorkState,input:Exclude<PersonalContinuationRequest,{operation:'read'|'read-view'|'remember'}>,now:Date):{records:PersonalContinuation;memory:ProjectMemoryBackup;memoryChanged:boolean}{
 const old=records.records.find(r=>sameContext(r,input));
 // An applied record is a durable receipt for precisely the previous revision.
 // Retrying an older apply after editing/restarting cannot apply the newer draft.
 if(input.operation==='apply-draft'&&old?.status==='applied'&&old.revision-1===input.expectedRevision)return {records,memory,memoryChanged:false};
 if((old?.revision??0)!==input.expectedRevision)throw conflict('Ein anderer Tab hat den Entwurf geändert. Gespeicherten Entwurf laden oder Text sichern.');
 const revision=nextRevision(old?.revision??0),updatedAt=nextStamp(old?.updatedAt??null,now);
 let draft:PersonalDraft,nextMemory=memory,memoryChanged=false;
 if(input.operation==='save-draft'){
  if(old?.status==='active'){
   if(!sameBase(old.base,input.base))throw conflict('Die Entwurfsbasis darf nur nach ausdrücklichem Vergleich geändert werden.');
   // A detached active draft may still save exact text; it never adopts a new identity/base.
   if(old.composer.editingEntryId!==input.composer.editingEntryId)throw conflict('Korrekturziel geändert. Vor einem anderen Entwurf den bisherigen Entwurf abschließen.');
  }else checkBase(work,memory,input,input.base,input.composer);
  draft={schema:'lowquantflow.personal-draft/v1',contextId:input.contextId,contextCreatedAt:input.contextCreatedAt,revision,updatedAt,status:'active',base:input.base,composer:input.composer};
 }else{
  if(!old||old.status!=='active')throw conflict('Kein aktiver Entwurf für diese Revision vorhanden.');
  draft={...old,revision,updatedAt};
  if(input.operation==='discard-draft')draft.status='discarded';
  else if(input.operation==='rebase-draft'){checkBase(work,memory,input,input.base,old.composer);draft.base=input.base}
  else{
   checkBase(work,memory,input,old.base,old.composer);
   const {composer,base}=old;
   const request=parseMemoryRequest(composer.editingEntryId?{operation:'correct',contextId:input.contextId,expectedRevision:base.memoryRevision,expectedWorkUpdatedAt:base.workUpdatedAt,entryId:composer.editingEntryId,text:composer.text}:{operation:'propose',contextId:input.contextId,expectedRevision:base.memoryRevision,expectedWorkUpdatedAt:base.workUpdatedAt,kind:composer.kind,text:composer.text,origin:composer.origin,sourceId:composer.sourceId});
   nextMemory=applyProjectMemory(memory,work,request,now);memoryChanged=true;draft.status='applied';
  }
 }
 const result={...records,records:[...records.records.filter(r=>!sameContext(r,input)),draft]};
 const parsed=personalContinuationContract.safeParse(result);if(!parsed.success)throw invalid('Entwurfsgrenze oder Revisionsvertrag erreicht. Vorhandene Daten bleiben erhalten.');
 // Reserve a few bytes for terminal status/revision growth; never evict another project.
 const reserve=parsed.data.records.filter(r=>r.status==='active').reduce((n,r)=>n+32+String(Number.MAX_SAFE_INTEGER).length-String(r.revision).length,0);
 if(input.operation!=='discard-draft'&&bytes(parsed.data)+reserve>PERSONAL_CONTINUATION_BYTES)throw invalid('Entwurfsspeicher voll. Vorhandene Entwürfe bleiben erhalten.');
 return {records:parsed.data,memory:nextMemory,memoryChanged};
}
