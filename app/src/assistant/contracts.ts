import {z} from 'zod';
import {roomContract} from '../../upstream/lib/work-contract.ts';
import {projectMemoryContract} from '../project-memory.ts';

export const ASSISTANT_CONTEXT_BYTES=32_768;
export const ASSISTANT_RESULT_BYTES=8_192;
const uuid=z.string().uuid().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
const date=z.string().datetime().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/);
const revision=z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const positiveRevision=revision.min(1);
const identifier=z.string().min(1).max(80).regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/);
const nonempty=(max:number)=>z.string().min(1).max(max).refine(value=>value.trim().length>0,'Leerer Text.');
const role=z.enum(['advisor','specialist','local-helper']);
const feature=z.enum(['continuation','advice','review','suggestions','local-helper']);
const purpose=z.object({goal:nonempty(400),benefit:nonempty(400),successMeasure:nonempty(400)}).strict();
export const contextKeyContract=z.object({contextId:uuid,contextCreatedAt:date}).strict();
export const basisContract=z.object({workUpdatedAt:date.nullable(),memoryRevision:revision,configRevision:revision}).strict();
export const evidenceRefContract=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('room'),id:uuid,createdAt:date}).strict(),
 z.object({kind:z.literal('memory-entry'),id:uuid,revision:positiveRevision}).strict(),
 z.object({kind:z.literal('draft'),id:uuid,revision:positiveRevision}).strict(),
 z.object({kind:z.literal('config'),revision}).strict(),
 z.object({kind:z.literal('host-check'),checkId:identifier,runId:uuid}).strict()
]);
export type ContextKey=z.infer<typeof contextKeyContract>;
export type Basis=z.infer<typeof basisContract>;
export type RoleId=z.infer<typeof role>;
export type FeatureId=z.infer<typeof feature>;
export type EvidenceRef=z.infer<typeof evidenceRefContract>;
export function utf8Bytes(value:unknown):number{return new TextEncoder().encode(canonicalValue(value)).length;}
export function canonicalValue(value:unknown):string {
 if(Array.isArray(value))return '['+value.map(canonicalValue).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonicalValue((value as Record<string,unknown>)[key])).join(',')+'}';
 return JSON.stringify(value)??'undefined';
}
export function evidenceKey(ref:EvidenceRef):string{return canonicalValue(ref);}
const evidenceIdentity=(ref:EvidenceRef)=>ref.kind==='memory-entry'||ref.kind==='draft'?ref.kind+':'+ref.id:ref.kind==='host-check'?ref.kind+':'+ref.runId+':'+ref.checkId:ref.kind==='room'?ref.kind+':'+ref.id:'config';
const refs=z.array(evidenceRefContract).max(16).refine(values=>new Set(values.map(evidenceIdentity)).size===values.length,'Doppelte Belegreferenz.');
const statement=z.object({text:nonempty(2000),evidenceRefs:refs.refine(values=>values.length>0,'Beleg fehlt.')}).strict();
const issue=(ctx:z.RefinementCtx,message:string)=>ctx.addIssue({code:z.ZodIssueCode.custom,message});
export const contextEnvelopeContract=z.object({
 schema:z.literal('lowquantflow.assistant-context/v1'),context:contextKeyContract,basis:basisContract,
 goal:statement.nullable(),confirmed:z.array(statement).max(100),claims:z.array(statement).max(100),
 draft:z.object({id:uuid,revision:positiveRevision,stale:z.boolean()}).strict().nullable(),
 omissions:z.array(z.object({reason:z.enum(['budget','scope','untrusted']),count:positiveRevision}).strict()).max(3)
}).strict().superRefine((value,ctx)=>{
 if(utf8Bytes(value)>ASSISTANT_CONTEXT_BYTES)issue(ctx,'Kontextbudget überschritten.');
 if(new Set(value.omissions.map(item=>item.reason)).size!==value.omissions.length)issue(ctx,'Doppelte Auslassungsart.');
 const all=[...(value.goal?[value.goal]:[]),...value.confirmed,...value.claims];
 const identities=new Set<string>();
 for(const item of all)for(const ref of item.evidenceRefs){
  const key=evidenceIdentity(ref);if(identities.has(key))issue(ctx,'Doppelter semantischer Beleg.');identities.add(key);
  if(ref.kind==='room'&&(ref.id!==value.context.contextId||ref.createdAt!==value.context.contextCreatedAt))issue(ctx,'Fremder Raumbeleg.');
  if(ref.kind==='memory-entry'&&ref.revision>value.basis.memoryRevision)issue(ctx,'Beleg aus späterer Gedächtnisrevision.');
  if(ref.kind==='config'&&ref.revision!==value.basis.configRevision)issue(ctx,'Fremde Konfigurationsrevision.');
  if(ref.kind==='draft'&&(!value.draft||ref.id!==value.draft.id||ref.revision!==value.draft.revision))issue(ctx,'Fremder Entwurf.');
 }
});
export type ContextEnvelope=z.infer<typeof contextEnvelopeContract>;
export const configChangeContract=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('set-purpose'),feature,...purpose.shape}).strict(),
 z.object({kind:z.literal('set-continuation-enabled'),value:z.boolean()}).strict(),
 z.object({kind:z.literal('set-continuation-detail'),value:z.enum(['compact','detailed'])}).strict(),
 z.object({kind:z.literal('set-advice-priority'),value:z.enum(['blockers-first','drafts-first'])}).strict(),
 z.object({kind:z.literal('set-review-depth'),value:z.enum(['standard','thorough'])}).strict(),
 z.object({kind:z.literal('set-suggestion-frequency'),value:z.enum(['on-request','on-reopen','off'])}).strict(),
 z.object({kind:z.literal('set-local-helper-requested'),value:z.boolean()}).strict()
]);
export type ConfigChange=z.infer<typeof configChangeContract>;
export const assistantConfigContract=z.object({
 schema:z.literal('lowquantflow.assistant-config/v1'),context:contextKeyContract,revision,
 purposes:z.object({continuation:purpose,advice:purpose,review:purpose,suggestions:purpose,'local-helper':purpose}).strict(),
 continuation:z.object({enabled:z.boolean(),detail:z.enum(['compact','detailed'])}).strict(),
 advice:z.object({priority:z.enum(['blockers-first','drafts-first'])}).strict(),
 review:z.object({depth:z.enum(['standard','thorough'])}).strict(),
 suggestions:z.object({frequency:z.enum(['on-request','on-reopen','off'])}).strict(),
 localHelper:z.object({requested:z.boolean()}).strict()
}).strict();
export type AssistantConfig=z.infer<typeof assistantConfigContract>;
export const modelCapabilitiesContract=z.object({
 bindingId:identifier,status:z.enum(['unavailable','simulated','verified']),execution:z.enum(['deterministic','local','remote']),
 structuredOutput:z.boolean(),cancellation:z.boolean(),maxInputTokens:positiveRevision.nullable(),maxOutputTokens:positiveRevision.nullable(),verifiedAt:date.nullable()
}).strict().superRefine((value,ctx)=>{
 if((value.status==='verified')!==(value.verifiedAt!==null))issue(ctx,'Verifikation und Status passen nicht zusammen.');
 if(value.status==='simulated'&&value.execution!=='deterministic')issue(ctx,'Simulation muss deterministisch bleiben.');
});
export type ModelCapabilities=z.infer<typeof modelCapabilitiesContract>;
const repairContract=z.object({attempt:z.literal(1),issues:z.array(z.object({field:z.enum(['schema','runId','context','basis','producer','summary','claims','blockers','configProposal','checks','nextAction','result']),code:z.enum(['schema','evidence'])}).strict()).min(1).max(8)}).strict();
export const advisoryRequestContract=z.object({
 runId:uuid,role,context:contextEnvelopeContract,task:z.enum(['explain-continuation','review-proposal','extract-labels']),
 maxOutputBytes:z.number().int().min(1).max(ASSISTANT_RESULT_BYTES),configProposal:configChangeContract.optional(),repair:repairContract.optional()
}).strict().superRefine((value,ctx)=>{
 const expected={'explain-continuation':'advisor','review-proposal':'specialist','extract-labels':'local-helper'};
 if(value.role!==expected[value.task])issue(ctx,'Aufgabe und Rolle passen nicht zusammen.');
 if((value.task==='review-proposal')!==(value.configProposal!==undefined))issue(ctx,'Nur der Prüfauftrag braucht den konkreten Vorschlag.');
});
export type AdvisoryRequest=z.infer<typeof advisoryRequestContract>;
export interface AdvisoryAdapter {readonly capabilities:ModelCapabilities;invoke(request:AdvisoryRequest,signal:AbortSignal):Promise<unknown>;}
export const assistantResultContract=z.object({
 schema:z.literal('lowquantflow.assistant-result/v1'),runId:uuid,context:contextKeyContract,basis:basisContract,
 producer:z.object({role,mode:z.enum(['simulated','model','deterministic']),bindingId:identifier}).strict(),summary:nonempty(8000),
 claims:z.array(z.object({text:nonempty(2000),kind:z.enum(['confirmed','proposal','external-claim']),evidenceRefs:refs}).strict()).max(8),
 blockers:z.array(z.object({code:identifier,evidenceRefs:refs.refine(values=>values.length>0,'Blockerbeleg fehlt.')}).strict()).max(8),
 configProposal:configChangeContract.nullable(),
 checks:z.array(z.object({id:identifier,status:z.enum(['planned','passed','failed','not-run']),evidenceRefs:refs}).strict()).max(8),
 nextAction:z.enum(['review-draft','review-config','ask-user','open-existing-check','none'])
}).strict().superRefine((value,ctx)=>{
 if(utf8Bytes(value)>ASSISTANT_RESULT_BYTES)issue(ctx,'Antwortbudget überschritten.');
 if(new Set(value.claims.map(item=>item.text)).size!==value.claims.length)issue(ctx,'Doppelte Aussage.');
 if(new Set(value.blockers.map(item=>item.code)).size!==value.blockers.length)issue(ctx,'Doppelter Blocker.');
 if(new Set(value.checks.map(item=>item.id)).size!==value.checks.length)issue(ctx,'Doppelte Prüfung.');
 if((value.nextAction==='review-config')!==(value.configProposal!==null))issue(ctx,'Konfigurationsaktion und Vorschlag passen nicht zusammen.');
});
export type AssistantResult=z.infer<typeof assistantResultContract>;
export class AssistantContractError extends Error {
 readonly code:string;
 constructor(code:string){super(code);this.code=code;this.name='AssistantContractError';}
}
/** Detached JSON boundary. Descriptors are inspected without invoking accessors
 * or custom serializers. Prototypes, sparse arrays and non-JSON values fail
 * closed; depth and node caps bound traversal independently of schema shape. */
export function cloneAssistantPlainData(input:unknown):unknown {
 const ancestors=new WeakSet<object>();let nodes=0;
 function visit(value:unknown,depth:number):unknown {
  if(++nodes>4096||depth>16)throw new AssistantContractError('INVALID_RESULT');
  if(value===null||typeof value==='string'||typeof value==='boolean')return value;
  if(typeof value==='number'&&Number.isFinite(value))return value;
  if(typeof value!=='object'||value===null||ancestors.has(value))throw new AssistantContractError('INVALID_RESULT');
  const array=Array.isArray(value),prototype=Object.getPrototypeOf(value);
  if(array?prototype!==Array.prototype&&prototype!==null:prototype!==Object.prototype&&prototype!==null)throw new AssistantContractError('INVALID_RESULT');
  const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);
  if(keys.length>4096||keys.some(key=>typeof key!=='string'||key==='toJSON'))throw new AssistantContractError('INVALID_RESULT');
  for(const key of keys){
   const descriptor=descriptors[key as string];
   if(!Object.hasOwn(descriptor,'value')||key!=='length'&&!descriptor.enumerable||!array&&key==='length'&&!descriptor.enumerable)throw new AssistantContractError('INVALID_RESULT');
  }
  ancestors.add(value);
  try{
   if(array){
    const length=descriptors.length?.value;
    if(!Number.isSafeInteger(length)||length<0||length>4095||keys.length!==length+1)throw new AssistantContractError('INVALID_RESULT');
    const copied:unknown[]=[];
    for(let index=0;index<length;index++){
     const descriptor=descriptors[String(index)];
     if(!descriptor||!descriptor.enumerable)throw new AssistantContractError('INVALID_RESULT');
     copied.push(visit(descriptor.value,depth+1));
    }
    return copied;
   }
   const copied:Record<string,unknown>=Object.create(null);
   for(const key of keys as string[])copied[key]=visit(descriptors[key].value,depth+1);
   return copied;
  }finally{ancestors.delete(value);}
 }
 try{return visit(input,0);}catch{throw new AssistantContractError('INVALID_RESULT');}
}
const hostCheckContract=z.object({checkId:identifier,runId:uuid,context:contextKeyContract,basis:basisContract,status:z.enum(['passed','failed'])}).strict();
export type HostCheckEvidence=z.infer<typeof hostCheckContract>;
function proposalBenefit(change:ConfigChange):string {
 switch(change.kind){
  case 'set-purpose':return 'Zweck und erwarteten Nutzen der Funktion verständlicher beschreiben';
  case 'set-continuation-enabled':return change.value?'Den bestätigten Projektstand beim Fortsetzen leichter finden':'Die Fortsetzungsansicht bei Bedarf ausblenden';
  case 'set-continuation-detail':return change.value==='detailed'?'Unterschiede vor der Übernahme leichter erkennen':'Die Fortsetzungskarte kompakter überblicken';
  case 'set-advice-priority':return change.value==='blockers-first'?'Belegte Blocker zuerst überblicken':'Entwürfe leichter finden; technische Blocker behalten Vorrang';
  case 'set-review-depth':return change.value==='thorough'?'Prüfhinweise ausführlicher nachvollziehen; harte Prüfungen bleiben erforderlich':'Prüfhinweise kompakt nachvollziehen; harte Prüfungen bleiben erforderlich';
  case 'set-suggestion-frequency':return change.value==='off'?'Unaufgeforderte Vorschläge ausblenden':change.value==='on-request'?'Vorschläge gezielt auf Nachfrage prüfen':'Beim Wiederöffnen passende Vorschläge prüfen';
  case 'set-local-helper-requested':return change.value?'Den Wunsch nach geprüfter lokaler Unterstützung sichtbar machen; keine Verbindung aktivieren':'Auf optionale lokale Unterstützung verzichten';
 }
}
/** Format only validated fields; free adapter prose never becomes host fact. */
export function formatAssistantSummary(result:AssistantResult,request:AdvisoryRequest):string {
 const mode=result.producer.mode==='simulated'?'Simulation':result.producer.mode==='deterministic'?'Lokale Beratung':'Modellberatung';
 const goal=request.context.goal?`Bestätigtes Ziel: „${request.context.goal.text}“.`:'Ein bestätigtes Ziel fehlt.';
 const draft=request.context.draft?.stale?'Der Entwurf bezieht sich auf einen älteren Stand; seine veraltete Basis bleibt gesperrt.':request.context.draft?'Ein Entwurf liegt vor.':'In dieser Beratungsgrundlage sind keine Entwurfsdaten enthalten.';
 const checks=result.checks.filter(check=>check.status==='passed'||check.status==='failed');
 const proof=checks.length?`Aktuelle Hostprüfungen: ${checks.map(check=>`${check.id}: ${check.status==='passed'?'bestanden':'fehlgeschlagen'}`).join('; ')}.`:'Es wurde keine ausgeführte Prüfung nachgewiesen.';
 const unconfirmed=result.claims.some(claim=>claim.kind!=='confirmed')?' Unbestätigte Aussagen bleiben als Behauptungen getrennt.':'';
 const benefit=result.configProposal?` Nutzen des Vorschlags: ${proposalBenefit(result.configProposal)}.`:'';
 const action={'review-draft':'Prüfe den vorhandenen Entwurf gegen den aktuellen Stand.','review-config':'Prüfe die vorgeschlagene Konfigurationsänderung.','ask-user':'Kläre den nächsten Schritt mit dem Nutzer.','open-existing-check':'Öffne die belegte lokale Prüfung.','none':'Es wird keine weitere Aktion vorgeschlagen.'}[result.nextAction];
 return `${mode}: ${goal} ${draft} ${proof}${unconfirmed}${benefit} ${action}`;
}
export function validateAssistantResult(input:unknown,request:AdvisoryRequest,capabilities:ModelCapabilities,hostChecks:readonly HostCheckEvidence[]=[]):AssistantResult {
 const requestParsed=advisoryRequestContract.safeParse(request),capParsed=modelCapabilitiesContract.safeParse(capabilities);
 if(!requestParsed.success||!capParsed.success||capParsed.data.status==='unavailable'||!capParsed.data.structuredOutput)throw new AssistantContractError('INVALID_REQUEST');
 const clean=cloneAssistantPlainData(input),maxBytes=Math.min(ASSISTANT_RESULT_BYTES,requestParsed.data.maxOutputBytes);
 if(utf8Bytes(clean)>maxBytes)throw new AssistantContractError('OUTPUT_BUDGET');
 const parsed=assistantResultContract.safeParse(clean),checksParsed=z.array(hostCheckContract).max(8).safeParse(hostChecks);
 if(!parsed.success||!checksParsed.success)throw new AssistantContractError('INVALID_RESULT');
 const result=parsed.data,expected=requestParsed.data,cap=capParsed.data;
 if(canonicalValue(result.context)!==canonicalValue(expected.context.context))throw new AssistantContractError('CONTEXT_MISMATCH');
 if(canonicalValue(result.basis)!==canonicalValue(expected.context.basis))throw new AssistantContractError('STALE_BASIS');
 const mode=cap.status==='simulated'?'simulated':cap.execution==='deterministic'?'deterministic':'model';
 if(result.runId!==expected.runId||result.producer.role!==expected.role||result.producer.bindingId!==cap.bindingId||result.producer.mode!==mode)throw new AssistantContractError('INVALID_RESULT');
 if(result.configProposal&&expected.task!=='explain-continuation')throw new AssistantContractError('INVALID_RESULT');
 const envelope=expected.context;
 if(expected.role==='local-helper'&&(result.configProposal!==null||result.blockers.length>0||result.checks.length>0||!['none','ask-user'].includes(result.nextAction)))throw new AssistantContractError('INVALID_RESULT');
 if(result.nextAction==='review-draft'&&!envelope.draft)throw new AssistantContractError('INVALID_RESULT');
 const confirmedStatements=[...(envelope.goal?[envelope.goal]:[]),...envelope.confirmed];
 const confirmed=confirmedStatements.flatMap(item=>item.evidenceRefs);
 const all:EvidenceRef[]=[...confirmed,...envelope.claims.flatMap(item=>item.evidenceRefs),{kind:'room',id:envelope.context.contextId,createdAt:envelope.context.contextCreatedAt},{kind:'config',revision:envelope.basis.configRevision},...(envelope.draft?[{kind:'draft' as const,id:envelope.draft.id,revision:envelope.draft.revision}]:[])];
 const allowed=new Set(all.map(evidenceKey));
 for(const item of [...result.claims,...result.blockers,...result.checks])if(item.evidenceRefs.some(ref=>!allowed.has(evidenceKey(ref))))throw new AssistantContractError('CONTEXT_MISMATCH');
 // A real citation does not establish a different fact. Stage 0 only repeats
 // exact confirmed statements; paraphrases stay proposals/external claims.
 const refSet=(values:EvidenceRef[])=>canonicalValue(values.map(evidenceKey).sort());
 for(const claim of result.claims)if(claim.kind==='confirmed'&&!confirmedStatements.some(item=>item.text===claim.text&&refSet(item.evidenceRefs)===refSet(claim.evidenceRefs)))throw new AssistantContractError('INVALID_RESULT');
 for(const blocker of result.blockers){
  const valid=blocker.code==='STALE_DRAFT'?envelope.draft?.stale===true&&blocker.evidenceRefs.length===1&&blocker.evidenceRefs[0].kind==='draft'&&blocker.evidenceRefs[0].id===envelope.draft.id&&blocker.evidenceRefs[0].revision===envelope.draft.revision:
   blocker.code==='MISSING_GOAL'?envelope.goal===null&&blocker.evidenceRefs.length===1&&blocker.evidenceRefs[0].kind==='room'&&blocker.evidenceRefs[0].id===envelope.context.contextId&&blocker.evidenceRefs[0].createdAt===envelope.context.contextCreatedAt:false;
  if(!valid)throw new AssistantContractError('INVALID_RESULT');
 }
 let executedCheck=false;
 for(const check of result.checks)if(check.status==='passed'||check.status==='failed'){
  if(expected.role==='local-helper'||!check.evidenceRefs.some(ref=>ref.kind==='host-check'&&ref.checkId===check.id&&ref.runId===expected.runId&&checksParsed.data.some(host=>host.checkId===check.id&&host.runId===expected.runId&&host.status===check.status&&canonicalValue(host.context)===canonicalValue(envelope.context)&&canonicalValue(host.basis)===canonicalValue(envelope.basis))))throw new AssistantContractError('INVALID_RESULT');
  executedCheck=true;
 }
 if(result.nextAction==='open-existing-check'&&!executedCheck)throw new AssistantContractError('INVALID_RESULT');
 const safeResult={...result,summary:formatAssistantSummary(result,expected)};
 if(utf8Bytes(safeResult)>maxBytes)throw new AssistantContractError('OUTPUT_BUDGET');
 return safeResult;
}

const draftMetadataContract=z.object({id:uuid,revision:positiveRevision,context:contextKeyContract,basis:z.object({workUpdatedAt:date.nullable(),memoryRevision:revision}).strict()}).strict();
export const assistantSnapshotContract=z.object({context:contextKeyContract,basis:basisContract,room:roomContract,memory:projectMemoryContract,draft:draftMetadataContract.nullable(),config:assistantConfigContract}).strict();
export type AssistantSnapshot=z.infer<typeof assistantSnapshotContract>;
export function parseAssistantSnapshot(input:unknown):AssistantSnapshot {
 const parsed=assistantSnapshotContract.safeParse(input);if(!parsed.success)throw new AssistantContractError('INVALID_CONTEXT');
 const snapshot=parsed.data,{context,room,memory,config,draft}=snapshot;
 if(room.id!==context.contextId||room.createdAt!==context.contextCreatedAt||memory.contextId!==context.contextId||memory.contextCreatedAt!==context.contextCreatedAt||canonicalValue(config.context)!==canonicalValue(context)||draft&&canonicalValue(draft.context)!==canonicalValue(context))throw new AssistantContractError('CONTEXT_MISMATCH');
 if(room.status==='Archiviert')throw new AssistantContractError('ARCHIVED');
 if(memory.revision!==snapshot.basis.memoryRevision||config.revision!==snapshot.basis.configRevision)throw new AssistantContractError('STALE_BASIS');
 if(memory.entries.some(entry=>entry.status!=='forgotten'&&entry.status!=='superseded'&&entry.origin.sourceId!==null&&!room.sources.includes(entry.origin.sourceId)))throw new AssistantContractError('INVALID_CONTEXT');
 return snapshot;
}
export const configProposalContract=z.object({schema:z.literal('lowquantflow.assistant-config-proposal/v1'),id:uuid,context:contextKeyContract,basis:basisContract,change:configChangeContract,before:assistantConfigContract,after:assistantConfigContract,effect:z.object({benefit:nonempty(400),sideEffect:nonempty(400)}).strict()}).strict();
export type ConfigProposal=z.infer<typeof configProposalContract>;
export type ConfigValidation={ok:true}|{ok:false;code:'CONTEXT_MISMATCH'|'ARCHIVED'|'STALE_BASIS'|'INVALID_CHANGE'|'NO_CHANGE'};
