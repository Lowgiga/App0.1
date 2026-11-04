import {useEffect,useMemo,useRef,useSyncExternalStore} from 'react';
import {z} from 'zod';
import type {WorkState} from '../../upstream/lib/work-contract.ts';
import {LocalWorkStore,type WorkTransport} from '../local-adapter.ts';
import {useWorkState} from '../shared-work-state.tsx';
import {useWorkTransport} from '../work-transport.tsx';
import {projectMemoryContract} from '../project-memory.ts';
import {assistantReceiptContract} from './transaction.ts';
import {assistantConfigContract,basisContract,canonicalValue,configProposalContract,contextKeyContract,parseAssistantSnapshot,type AssistantSnapshot,type ContextEnvelope,type ContextKey} from './contracts.ts';
import {buildAssistantContext} from './context.ts';
import {validateConfigProposal} from './config.ts';
import {createAssistantRuntime,type AssistantRuntimeResult} from './runtime.ts';
import {createSimulator} from './simulator.ts';
import type {RunEvent} from './logging.ts';

const storageContract=z.object({deviceLocal:z.literal(true),includedInSystemBackup:z.literal(false)}).strict();
const configReadContract=z.object({context:contextKeyContract,basis:basisContract,config:assistantConfigContract,storage:storageContract}).strict();
const previewContract=z.object({proposal:configProposalContract,proposalHash:z.string().regex(/^[a-f0-9]{64}$/),expiresAt:z.string().datetime()}).strict();
const proofContract=z.object({receipt:assistantReceiptContract.nullable(),config:assistantConfigContract,basis:basisContract,verification:z.enum(['missing','verified','superseded']),storage:storageContract}).strict();
export type AssistantPreview=z.infer<typeof previewContract>;
export type AssistantProof=z.infer<typeof proofContract>;
export type AssistantPhase='idle'|'loading'|'ready'|'advising'|'previewing'|'preview'|'reviewing'|'checked'|'committing'|'reconciling'|'saved'|'uncertain'|'error';
export type AssistantSessionState={phase:AssistantPhase;snapshot:AssistantSnapshot|null;context:ContextEnvelope|null;preview:AssistantPreview|null;result:AssistantRuntimeResult|null;review:AssistantRuntimeResult|null;proof:AssistantProof|null;error:string;notice:string;events:readonly RunEvent[];operationId:string|null};
const initial=():AssistantSessionState=>({phase:'idle',snapshot:null,context:null,preview:null,result:null,review:null,proof:null,error:'',notice:'',events:[],operationId:null});
const same=(a:unknown,b:unknown)=>canonicalValue(a)===canonicalValue(b);
// C invalidates its host generation when an aborted request settles. Drain the
// previous local call before a new UI incarnation enters that same transport.
// This is ordering, not retry: each supplied request is executed at most once.
const transportTails=new WeakMap<WorkTransport,Promise<void>>();
async function proposalDigest(value:unknown){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalValue(value)));return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')}
const activePhases:readonly AssistantPhase[]=['loading','advising','previewing','reviewing','committing','reconciling'];
export const assistantIsBusy=(phase:AssistantPhase)=>activePhases.includes(phase);
class SessionError extends Error {constructor(readonly code:string){super(code)}}
function explain(error:unknown):string {
 const code=error instanceof SessionError?error.code:'INVALID_RESPONSE';
 return ({STALE:'Projektbasis hat sich geändert. Stand neu laden und die Änderung erneut prüfen.',CONFLICT:'Vorschau oder Projektbasis ist nicht mehr gültig. Stand neu laden und erneut bestätigen.',UNAVAILABLE:'Lokaler Konfigurationshost ist nicht verfügbar. Es wird keine Änderung ausgeführt.',EXPIRED:'Die Vorschau ist abgelaufen. Eine neue Vorschau und Bestätigung sind erforderlich.',BLOCKED:'Projektstand ist gesperrt oder archiviert. Keine Änderung ausgeführt.',INVALID_RESPONSE:'Der lokale Nachweis konnte nicht sicher gelesen werden. Keine Speicherung bestätigt.',STORAGE:'Lokaler Speicher ist nicht verlässlich verfügbar. Bestehende Daten bleiben erhalten.'} as Record<string,string>)[code]??'Die lokale Beratung wurde angehalten. Es wurde keine Änderung freigegeben.';
}
type Options={transport:WorkTransport;context:ContextKey;getWork:()=>{work:WorkState;available:boolean};now?:()=>number};
/** UI host only. This instance and its transport never cross the AdvisoryAdapter boundary. */
export function createAssistantSession(options:Options){
 const context=contextKeyContract.parse(options.context),now=options.now??Date.now;
 const store=options.transport instanceof LocalWorkStore?options.transport:null;
 let state=initial(),active=false,generation=0,gate=false,controller:AbortController|null=null;
 let ownedRunId:string|null=null;
 const listeners=new Set<()=>void>();
 const runtime=createAssistantRuntime({registry:{advisor:createSimulator(),specialist:createSimulator()},emit:event=>{
  if(active&&event.runId===ownedRunId&&same(event.context,context)&&state.context&&same(event.basis,state.context.basis))set({events:[...state.events,event].slice(-24)});
 }});
 function set(patch:Partial<AssistantSessionState>){state={...state,...patch};for(const listener of listeners)listener()}
 function guard(id:number,signal:AbortSignal){if(!active||id!==generation||signal.aborted)throw new DOMException('Abgebrochen','AbortError')}
 function localWork(){const value=options.getWork();const room=value.work.rooms.find(r=>r.id===context.contextId&&r.createdAt===context.contextCreatedAt);if(!value.available||!room||room.status==='Archiviert')throw new SessionError('BLOCKED');return {room,workUpdatedAt:value.work.updatedAt}}
 async function request(body:unknown,signal:AbortSignal,path='/api/assistant'){
  const previous=transportTails.get(options.transport)??Promise.resolve();
  let release!:()=>void;const tail=new Promise<void>(resolve=>{release=resolve});transportTails.set(options.transport,tail);
  await previous;
  try{
   if(signal.aborted)throw new DOMException('Abgebrochen','AbortError');
   const response=await options.transport.request(path,{method:'POST',body:JSON.stringify(body),signal});
   if(!response.ok)throw new SessionError(response.status===409?'CONFLICT':response.status>=500?'STORAGE':'INVALID_RESPONSE');
   return await response.json();
  }finally{release();if(transportTails.get(options.transport)===tail)transportTails.delete(options.transport)}
 }
 async function snapshot(id:number,signal:AbortSignal):Promise<AssistantSnapshot>{
  if(!store)throw new SessionError('UNAVAILABLE');
  const before=localWork();
  const first=configReadContract.parse(await request({operation:'read-config',context},signal));guard(id,signal);
  const memory=projectMemoryContract.parse(await request({operation:'read',contextId:context.contextId},signal,'/api/project-memory'));guard(id,signal);
  const second=configReadContract.parse(await request({operation:'read-config',context},signal));guard(id,signal);
  const after=localWork();
  // Separate reads form a revision-checked collection, never a claimed atomic read.
  if(!same(first,second)||!same(first.context,context)||!same(before,after)||before.workUpdatedAt!==second.basis.workUpdatedAt||memory.revision!==second.basis.memoryRevision)throw new SessionError('STALE');
  return parseAssistantSnapshot({context,basis:second.basis,room:before.room,memory,config:second.config,draft:null});
 }
 function begin(phase:AssistantPhase){if(!active||gate)return null;ownedRunId=null;gate=true;const id=++generation;controller?.abort();controller=new AbortController();set({phase,error:'',notice:''});return {id,signal:controller.signal}}
 function finish(id:number){if(id===generation){ownedRunId=null;gate=false;controller=null}}
 function fail(error:unknown,id:number,signal:AbortSignal){if(active&&id===generation&&!signal.aborted){store?.discardAssistantConfigPreview();set({phase:'error',preview:null,review:null,error:explain(error)})}}
 function livePreview(){if(!state.preview)throw new SessionError('CONFLICT');const t=now();if(!Number.isFinite(t)||t>=Date.parse(state.preview.expiresAt))throw new SessionError('EXPIRED');return state.preview}
 async function unchanged(id:number,signal:AbortSignal){const fresh=await snapshot(id,signal);if(!state.snapshot||!same(fresh,state.snapshot))throw new SessionError('STALE');return fresh}
 async function verifyProof(id:number,signal:AbortSignal,operationId:string,proposal:AssistantPreview){
  const proof=proofContract.parse(await request({operation:'read-receipt',context,operationId},signal));guard(id,signal);
  if(!same(proof.config.context,context)||proof.basis.configRevision!==proof.config.revision)throw new SessionError('INVALID_RESPONSE');
  const receipt=proof.receipt;
  if(receipt&&(receipt.operationId!==operationId||receipt.proposalId!==proposal.proposal.id||receipt.proposalHash!==proposal.proposalHash||!same(receipt.context,context)||!same(receipt.basis,proposal.proposal.basis)))throw new SessionError('INVALID_RESPONSE');
  if(proof.verification==='missing'?receipt!==null:!receipt)throw new SessionError('INVALID_RESPONSE');
  if(proof.verification==='verified'&&(!same(proof.config,proposal.proposal.after)||!receipt||receipt.afterRevision!==proof.config.revision))throw new SessionError('INVALID_RESPONSE');
  if(proof.verification==='superseded'&&(!receipt||proof.config.revision<=receipt.afterRevision))throw new SessionError('INVALID_RESPONSE');
  const previous=state.snapshot;
  const stillSameWork=previous&&previous.basis.workUpdatedAt===proof.basis.workUpdatedAt&&previous.basis.memoryRevision===proof.basis.memoryRevision;
  const next=stillSameWork?{...previous,config:proof.config,basis:proof.basis}:null;
  set({proof,preview:null,review:null,result:null,snapshot:next,context:next?buildAssistantContext(next):null,
   phase:proof.verification==='missing'?'uncertain':'saved',
   notice:proof.verification==='verified'?'Änderung lokal gespeichert und durch erneutes Lesen bestätigt.':proof.verification==='superseded'?'Die Änderung wurde gespeichert; inzwischen liegt eine neuere Konfiguration vor. Stand vor weiteren Änderungen neu laden.':'Kein Commitbeleg gefunden. Ausgang nicht bestätigt; keine Schreibwiederholung.',
   error:''});
 }
 let attempted:{operationId:string;preview:AssistantPreview}|null=null;
 const api={
  getSnapshot:()=>state,
  subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener)}},
  activate(){active=true},
  deactivate(){active=false;ownedRunId=null;++generation;controller?.abort();controller=null;runtime.stop();store?.discardAssistantConfigPreview();gate=false;state=initial();attempted=null},
  cancel(){if(!active||state.phase==='committing'||state.phase==='reconciling'||state.phase==='uncertain')return;ownedRunId=null;++generation;controller?.abort();controller=null;runtime.stop();store?.discardAssistantConfigPreview();gate=false;set({phase:state.snapshot?'ready':'idle',preview:null,review:null,result:null,error:'',notice:'Vorgang abgebrochen. Keine neue Änderung freigegeben.'})},
  async load(){if(state.phase==='uncertain')return;const run=begin('loading');if(!run)return;const {id,signal}=run;store?.discardAssistantConfigPreview();set({preview:null,review:null,result:null,proof:null,operationId:null,snapshot:null,context:null,events:[]});attempted=null;
   try{const value=await snapshot(id,signal);guard(id,signal);set({phase:'ready',snapshot:value,context:buildAssistantContext(value),notice:'Lokalen Projektstand mit übereinstimmenden Revisionen geladen.'})}catch(error){fail(error,id,signal)}finally{finish(id)}},
  async advise(){if(!state.snapshot||!['ready','saved'].includes(state.phase))return;const run=begin('advising');if(!run)return;const {id,signal}=run;
   try{const value=await unchanged(id,signal),envelope=buildAssistantContext(value);set({events:[]});const runId=crypto.randomUUID();ownedRunId=runId;const result=await runtime.advise({runId,context:envelope,task:'explain-continuation'},signal);guard(id,signal);await unchanged(id,signal);guard(id,signal);set({phase:'ready',result,notice:'Offline-Simulation abgeschlossen. Keine Änderung ausgeführt.'})}catch(error){fail(error,id,signal)}finally{finish(id)}},
  async preview(detail:'compact'|'detailed'){if(!state.snapshot||!['ready','saved'].includes(state.phase)||state.snapshot.config.continuation.detail===detail)return;const run=begin('previewing');if(!run)return;const {id,signal}=run;
   try{const value=await unchanged(id,signal);const proposal=previewContract.parse(await request({operation:'preview-config',context,expectedBasis:value.basis,change:{kind:'set-continuation-detail',value:detail}},signal));guard(id,signal);
    if(!validateConfigProposal(proposal.proposal,value).ok||proposal.proposal.change.kind!=='set-continuation-detail'||proposal.proposal.change.value!==detail)throw new SessionError('INVALID_RESPONSE');
    const hash=await proposalDigest(proposal.proposal);guard(id,signal);
    if(hash!==proposal.proposalHash)throw new SessionError('INVALID_RESPONSE');
    set({phase:'preview',preview:proposal,review:null,proof:null,operationId:null,notice:'Vom lokalen Host berechnete Vorschau. Noch nichts gespeichert.'});
   }catch(error){fail(error,id,signal)}finally{finish(id)}},
  async review(){if(state.phase!=='preview')return;const run=begin('reviewing');if(!run)return;const {id,signal}=run;
   try{const p=livePreview(),fresh=await unchanged(id,signal);if(!validateConfigProposal(p.proposal,fresh).ok)throw new SessionError('STALE');
    const runId=crypto.randomUUID();ownedRunId=runId;const review=await runtime.advise({runId,context:buildAssistantContext(fresh),task:'review-proposal',configProposal:p.proposal.change},signal);guard(id,signal);await unchanged(id,signal);guard(id,signal);livePreview();
    set({phase:'checked',review,notice:'Kontext, Revisionen und erlaubte Änderung geprüft. Die zusätzliche Beratung ist eine Simulation.'});
   }catch(error){fail(error,id,signal)}finally{finish(id)}},
  async commit(){if(state.phase!=='checked'||!store)return;const run=begin('committing');if(!run)return;const {id,signal}=run;
   let submitted=false;
   try{const p=structuredClone(livePreview()),fresh=await unchanged(id,signal);guard(id,signal);livePreview();if(!validateConfigProposal(p.proposal,fresh).ok)throw new SessionError('STALE');
    const hash=await proposalDigest(p.proposal);guard(id,signal);livePreview();
    if(hash!==p.proposalHash||!same(state.preview,p))throw new SessionError('INVALID_RESPONSE');
    const operationId=crypto.randomUUID();attempted={operationId,preview:p};set({operationId});
    const command={operation:'commit-config' as const,context,expectedBasis:p.proposal.basis,proposalId:p.proposal.id,operationId};
    // Only this concrete click path grants the exact displayed proposal hash.
    if(!same(state.preview,p))throw new SessionError('INVALID_RESPONSE');
    store.approveAssistantConfig({context,expectedBasis:command.expectedBasis,proposalId:command.proposalId,operationId,proposalHash:p.proposalHash});
    submitted=true;
    try{await request(command,signal)}catch{/* Unknown responses are reconciled by a read, never by replay. */}
    guard(id,signal);set({phase:'reconciling'});await verifyProof(id,signal,operationId,p);
   }catch(error){if(!submitted){attempted=null;fail(error,id,signal)}else{if(active&&id===generation&&!signal.aborted)set({phase:'uncertain',preview:null,review:null,error:'Speicherantwort unklar. Nur den Commitbeleg erneut lesen; nicht erneut schreiben.'})}}finally{finish(id)}},
  async reconcile(){if(state.phase!=='uncertain'||!attempted)return;const attempt=attempted,run=begin('reconciling');if(!run)return;const {id,signal}=run;try{await verifyProof(id,signal,attempt.operationId,attempt.preview)}catch{if(active&&id===generation&&!signal.aborted)set({phase:'uncertain',error:'Commitbeleg weiterhin nicht sicher lesbar. Es wurde kein Schreibversuch wiederholt.'})}finally{finish(id)}}
 };
 return api;
}
export function useAssistantSession(context:ContextKey){
 const shared=useWorkState(),transport=useWorkTransport(),latest=useRef(shared);latest.current=shared;
 const session=useMemo(()=>createAssistantSession({transport,context,getWork:()=>({work:latest.current.work,available:latest.current.hasLoaded&&!latest.current.loadingWork&&!latest.current.storageError&&!latest.current.busy})}),[transport,context.contextId,context.contextCreatedAt]);
 const state=useSyncExternalStore(session.subscribe,session.getSnapshot,session.getSnapshot);
 useEffect(()=>{session.activate();void session.load();return()=>session.deactivate()},[session]);
 const stale=!!state.snapshot&&state.snapshot.basis.workUpdatedAt!==shared.work.updatedAt;
 const blocked=stale||!shared.hasLoaded||shared.loadingWork||shared.storageError||shared.busy||!shared.work.rooms.some(r=>r.id===context.contextId&&r.createdAt===context.contextCreatedAt&&r.status!=='Archiviert');
 return {session,state,blocked};
}
