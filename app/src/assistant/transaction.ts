import {z} from 'zod';
import type {WorkState} from '../../upstream/lib/work-contract.ts';
import {LocalStateError} from '../local-errors.ts';
import {MEMORY_KEY,decodeProjectMemory,memoryForContext} from '../project-memory.ts';
import {defaultAssistantConfig,proposeConfig,validateConfigProposal} from './config.ts';
import {AssistantContractError,assistantConfigContract,basisContract,canonicalValue,cloneAssistantPlainData,configChangeContract,contextKeyContract,type AssistantConfig,type AssistantSnapshot,type ConfigProposal,type ContextKey} from './contracts.ts';

const uuid=contextKeyContract.shape.contextId,date=contextKeyContract.shape.contextCreatedAt;
const hash=z.string().regex(/^[a-f0-9]{64}$/),revision=z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const identity={context:contextKeyContract};
const commitFields={...identity,expectedBasis:basisContract,proposalId:uuid,operationId:uuid};
export const assistantRequestContract=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('read-config'),...identity}).strict(),
 z.object({operation:z.literal('preview-config'),...identity,expectedBasis:basisContract,change:configChangeContract}).strict(),
 z.object({operation:z.literal('commit-config'),...commitFields}).strict(),
 z.object({operation:z.literal('read-receipt'),...identity,operationId:uuid}).strict()
]);
const approvalContract=z.object({...commitFields,proposalHash:hash}).strict();
export type AssistantConfigApproval=z.infer<typeof approvalContract>;
type Request=z.infer<typeof assistantRequestContract>;
type Commit=Extract<Request,{operation:'commit-config'}>;
const changedField=z.enum(['purposes.continuation','purposes.advice','purposes.review','purposes.suggestions','purposes.local-helper','continuation.enabled','continuation.detail','advice.priority','review.depth','suggestions.frequency','localHelper.requested']);
export const assistantReceiptContract=z.object({
 schema:z.literal('lowquantflow.assistant-receipt/v1'),operationId:uuid,proposalId:uuid,proposalHash:hash,
 context:contextKeyContract,basis:basisContract,beforeRevision:revision,afterRevision:revision,
 changedFields:z.array(changedField).length(1),configHash:hash,committedAt:date
}).strict().superRefine((r,ctx)=>{
 if(r.beforeRevision===Number.MAX_SAFE_INTEGER||r.afterRevision!==r.beforeRevision+1||r.beforeRevision!==r.basis.configRevision)
  ctx.addIssue({code:'custom',message:'Ungültige Commitrevision.'});
});
export type AssistantReceipt=z.infer<typeof assistantReceiptContract>;
export const ASSISTANT_STORAGE_LIMITS=Object.freeze({configs:100,metadataEvents:200,bytes:512*1024});
export const ASSISTANT_PREVIEW_TTL_MS=5*60*1000;
const storage=Object.freeze({deviceLocal:true,includedInSystemBackup:false});
export const assistantConfigKey=(context:ContextKey)=>'assistant-config-v1:'+context.contextId+'@'+context.contextCreatedAt;
export const assistantReceiptKey=(operationId:string)=>'assistant-receipt-v1:'+operationId;
const invalid=()=>new LocalStateError('VALIDATION','Ungültiger lokaler Assistentenvertrag.',400);
const conflict=()=>new LocalStateError('CONFLICT','Vorschau, Freigabe oder Projektbasis ist nicht mehr aktuell. Neu lesen und ausdrücklich bestätigen.',409);
const unavailable=()=>new LocalStateError('STORAGE_UNAVAILABLE','Speicherergebnis nicht sicher verfügbar. Receipt und aktuellen Stand lesen; nicht blind erneut schreiben.',503);
const corrupt=()=>new LocalStateError('CORRUPT_STORAGE','Assistentendaten beschädigt. Daten bleiben unverändert erhalten.',503);
const unsupported=()=>new LocalStateError('UNSUPPORTED_VERSION','Unbekannte Assistenten-Speicherversion. Daten bleiben unverändert erhalten.',503);
const aborted=()=>new DOMException('Lokale Anfrage abgebrochen.','AbortError');
const equal=(a:unknown,b:unknown)=>canonicalValue(a)===canonicalValue(b);
const bytes=(value:unknown)=>new TextEncoder().encode(canonicalValue(value)).byteLength;
async function digest(value:unknown):Promise<string>{
 const result=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalValue(value)));
 return Array.from(new Uint8Array(result),b=>b.toString(16).padStart(2,'0')).join('');
}
function clock(now:()=>Date):number{const value=now().getTime();if(!Number.isFinite(value))throw unavailable();return value}
function decodeConfig(value:unknown,context:ContextKey):AssistantConfig{
 if(value===undefined)return defaultAssistantConfig(context);
 if(value&&typeof value==='object'&&'schema' in value&&value.schema!=='lowquantflow.assistant-config/v1')throw unsupported();
 const parsed=assistantConfigContract.safeParse(value);if(!parsed.success||!equal(parsed.data.context,context))throw corrupt();return parsed.data;
}
function decodeReceipt(value:unknown,key:string):AssistantReceipt|null{
 if(value===undefined)return null;
 if(value&&typeof value==='object'&&'schema' in value&&value.schema!=='lowquantflow.assistant-receipt/v1')throw unsupported();
 const parsed=assistantReceiptContract.safeParse(value);if(!parsed.success||assistantReceiptKey(parsed.data.operationId)!==key)throw corrupt();return parsed.data;
}
function field(proposal:ConfigProposal):z.infer<typeof changedField>{
 const change=proposal.change;
 switch(change.kind){
  case 'set-purpose':return 'purposes.'+change.feature as z.infer<typeof changedField>;
  case 'set-continuation-enabled':return 'continuation.enabled';
  case 'set-continuation-detail':return 'continuation.detail';
  case 'set-advice-priority':return 'advice.priority';
  case 'set-review-depth':return 'review.depth';
  case 'set-suggestion-frequency':return 'suggestions.frequency';
  case 'set-local-helper-requested':return 'localHelper.requested';
 }
}
interface Pending {proposal:ConfigProposal;proposalHash:string;configHash:string;createdAt:number;expiresAt:number;approval:AssistantConfigApproval|null;}
/** Host/UI-only authority. Never pass this object or LocalWorkStore to a model adapter.
 * No persisted or imported value can restore its single-use approval. */
export class AssistantConfigHost {
 private pending:Pending|null=null;
 private generation=0;
 private readonly now:()=>Date;
 constructor(now:()=>Date){this.now=now}
 invalidate(){this.pending=null;this.generation++}
 async preview(snapshot:AssistantSnapshot,change:unknown,current:()=>boolean,signal?:AbortSignal|null){
  this.invalidate();const generation=this.generation,createdAt=clock(this.now);
  const proposal=proposeConfig(snapshot,change);
  const [proposalHash,configHash]=await Promise.all([digest(proposal),digest(proposal.after)]);
  if(signal?.aborted)throw aborted();if(!current()||generation!==this.generation)throw unavailable();
  const expiresAt=createdAt+ASSISTANT_PREVIEW_TTL_MS;
  this.pending={proposal,proposalHash,configHash,createdAt,expiresAt,approval:null};
  return {proposal:structuredClone(proposal),proposalHash,expiresAt:new Date(expiresAt).toISOString()};
 }
 private live():Pending{
  const pending=this.pending,time=clock(this.now);
  // A missing grant may mean a replacement preview is hashing. Reject the
  // stale caller without cancelling that newer generation.
  if(!pending)throw conflict();
  if(time<pending.createdAt||time>=pending.expiresAt){this.invalidate();throw conflict()}
  return pending;
 }
 approve(input:unknown):void{
  let clean:unknown;try{clean=cloneAssistantPlainData(input)}catch{throw invalid()}
  const parsed=approvalContract.safeParse(clean);if(!parsed.success)throw invalid();
  const approval=parsed.data,p=this.live();
  if(p.approval||approval.proposalId!==p.proposal.id||approval.proposalHash!==p.proposalHash||!equal(approval.context,p.proposal.context)||!equal(approval.expectedBasis,p.proposal.basis))throw conflict();
  p.approval=approval;
 }
 consume(request:Commit):Pending{
  const p=this.live(),a=p.approval;
  if(!a||a.proposalId!==request.proposalId||a.operationId!==request.operationId||!equal(a.context,request.context)||!equal(a.expectedBasis,request.expectedBasis))throw conflict();
  this.invalidate();return p;
 }
}
interface ReadResult {snapshot:AssistantSnapshot;receipt:AssistantReceipt|null;}
/** All WorkState, memory, config and receipt reads/CAS use one v1 work transaction.
 * Async hashes happen only outside the IndexedDB transaction lifetime. */
function transaction(db:IDBDatabase,decodeWork:(value:unknown)=>WorkState,request:Request,host:AssistantConfigHost,now:()=>Date,current:()=>boolean,signal?:AbortSignal|null):Promise<ReadResult>{
 if(signal?.aborted)throw aborted();if(!current())throw unavailable();
 return new Promise((resolve,reject)=>{
  let output:ReadResult|undefined,failure:unknown;
  const tx=db.transaction('work',request.operation==='commit-config'?'readwrite':'readonly'),store=tx.objectStore('work');
  const fail=(e:unknown)=>{failure??=e;try{tx.abort()}catch{/* Reconcile the receipt if outcome is unknown. */}};
  const abort=()=>fail(aborted());signal?.addEventListener('abort',abort,{once:true});
  const cleanup=()=>signal?.removeEventListener('abort',abort);
  tx.onabort=()=>{cleanup();reject(failure??unavailable())};
  tx.onerror=()=>{failure??=unavailable()};
  tx.oncomplete=()=>{cleanup();if(failure||!current()||!output)reject(failure??unavailable());else resolve(output)};
  const guard=()=>{if(signal?.aborted)throw aborted();if(!current())throw unavailable()};
  const workRead=store.get('local-default');
  workRead.onsuccess=()=>{try{
   guard();const work=decodeWork(workRead.result),room=work.rooms.find(r=>r.id===request.context.contextId);
   if(!room||room.createdAt!==request.context.contextCreatedAt)throw conflict();
   const memoryPresence=store.getKey(MEMORY_KEY),memoryRead=store.get(MEMORY_KEY);
   memoryRead.onsuccess=()=>{try{
    guard();if(memoryPresence.result!==undefined&&memoryRead.result===undefined)throw corrupt();
    const memory=memoryForContext(decodeProjectMemory(memoryRead.result),room);
    const configPresence=store.getKey(assistantConfigKey(request.context)),configRead=store.get(assistantConfigKey(request.context));
    configRead.onsuccess=()=>{try{
     guard();if(configPresence.result!==undefined&&configRead.result===undefined)throw corrupt();
     const config=decodeConfig(configRead.result,request.context);
     const snapshot:AssistantSnapshot={context:request.context,basis:{workUpdatedAt:work.updatedAt,memoryRevision:memory.revision,configRevision:config.revision},room,memory,config,draft:null};
     if(request.operation==='read-config'){output={snapshot,receipt:null};return}
     if(request.operation==='preview-config'){
      if(room.status==='Archiviert'||!equal(request.expectedBasis,snapshot.basis))throw conflict();output={snapshot,receipt:null};return;
     }
     const receiptPresence=store.getKey(assistantReceiptKey(request.operationId)),receiptRead=store.get(assistantReceiptKey(request.operationId));
     receiptRead.onsuccess=()=>{try{
      guard();if(receiptPresence.result!==undefined&&receiptRead.result===undefined)throw corrupt();
      const receipt=decodeReceipt(receiptRead.result,assistantReceiptKey(request.operationId));
      if(receipt&&!equal(receipt.context,request.context))throw conflict();
      if(request.operation==='read-receipt'){output={snapshot,receipt};return}
      if(receipt){
       if(receipt.proposalId!==request.proposalId||!equal(receipt.basis,request.expectedBasis))throw conflict();
       output={snapshot,receipt};return; // Reconciliation is never a new grant.
      }
      const pending=host.consume(request),proposal=pending.proposal;
      if(room.status==='Archiviert'||!equal(request.expectedBasis,snapshot.basis)||!validateConfigProposal(proposal,snapshot).ok)throw conflict();
      const next=assistantReceiptContract.parse({schema:'lowquantflow.assistant-receipt/v1',operationId:request.operationId,proposalId:proposal.id,proposalHash:pending.proposalHash,context:request.context,basis:snapshot.basis,beforeRevision:config.revision,afterRevision:proposal.after.revision,changedFields:[field(proposal)],configHash:pending.configHash,committedAt:new Date(clock(now)).toISOString()});
      let configCount=0,events=0,total=0;
      const cursor=store.openCursor();
      cursor.onsuccess=()=>{try{
       guard();const entry=cursor.result;
       if(entry){
        if(typeof entry.key==='string'&&entry.key.startsWith('assistant-')){
         if(entry.key.startsWith('assistant-config-v1:')){
          const item=assistantConfigContract.safeParse(entry.value);if(!item.success)throw corrupt();if(assistantConfigKey(item.data.context)!==entry.key)throw corrupt();configCount++;
         }else if(entry.key.startsWith('assistant-receipt-v1:')){if(!decodeReceipt(entry.value,entry.key))throw corrupt();events++}
         else throw unsupported();
         total+=bytes(entry.value);if(entry.key===assistantConfigKey(request.context))total-=bytes(entry.value);
        }
        entry.continue();return;
       }
       if(configRead.result===undefined)configCount++;
       events++;total+=bytes(proposal.after)+bytes(next);
       if(configCount>ASSISTANT_STORAGE_LIMITS.configs||events>ASSISTANT_STORAGE_LIMITS.metadataEvents||total>ASSISTANT_STORAGE_LIMITS.bytes)
        throw new LocalStateError('STORAGE_UNAVAILABLE','Lokaler Assistentenspeicher ist voll. Lesen bleibt möglich; gezieltes Aufräumen ist nötig. Keine Daten wurden gelöscht.',503);
       const commitTime=clock(now);if(commitTime<pending.createdAt||commitTime>=pending.expiresAt)throw conflict();
       next.committedAt=new Date(commitTime).toISOString();
       guard();store.put(proposal.after,assistantConfigKey(request.context));guard();store.put(next,assistantReceiptKey(request.operationId));guard();
       output={snapshot:{...snapshot,config:proposal.after,basis:{...snapshot.basis,configRevision:proposal.after.revision}},receipt:next};
      }catch(e){fail(e)}};
     }catch(e){fail(e)}};
    }catch(e){fail(e)}};
   }catch(e){fail(e)}};
  }catch(e){fail(e)}};
  if(signal?.aborted)abort();
 });
}
export async function assistantConfigRequest(db:IDBDatabase,decodeWork:(value:unknown)=>WorkState,input:unknown,host:AssistantConfigHost,now:()=>Date,current:()=>boolean,signal?:AbortSignal|null):Promise<unknown>{
 try{
  const clean=cloneAssistantPlainData(input);if(bytes(clean)>32768)throw invalid();
  const parsed=assistantRequestContract.safeParse(clean);if(!parsed.success)throw invalid();const request=parsed.data;
  const result=await transaction(db,decodeWork,request,host,now,current,signal);
  if(request.operation==='preview-config')return await host.preview(result.snapshot,request.change,current,signal);
  const {snapshot,receipt}=result;
  if(request.operation==='read-config')return {context:snapshot.context,basis:snapshot.basis,config:snapshot.config,storage};
  let verification:'missing'|'verified'|'superseded'='missing';
  if(receipt){
   if(snapshot.config.revision<receipt.afterRevision)throw corrupt();
   if(snapshot.config.revision===receipt.afterRevision){if(await digest(snapshot.config)!==receipt.configHash)throw corrupt();verification='verified'}
   else verification='superseded';
  }
  if(signal?.aborted)throw aborted();if(!current())throw unavailable();
  return {receipt,config:snapshot.config,basis:snapshot.basis,verification,storage};
 }catch(error){
  if(error instanceof DOMException&&error.name==='AbortError')throw error;
  if(error instanceof LocalStateError)throw error;
  if(error instanceof AssistantContractError||error instanceof z.ZodError)throw invalid();
  throw unavailable();
 }
}
