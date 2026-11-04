import {assistantConfigContract,basisContract,canonicalValue,cloneAssistantPlainData,contextKeyContract,type ContextKey} from '../assistant/contracts.ts';
import {assistantReceiptContract} from '../assistant/transaction.ts';

type Identity={eventId:string;requestId:string};
type VerifiedEvent=Identity & {type:'verifiedCommit';receiptId:string;revision:number};
/** Host-owned presentation events. Never construct these from model output text. */
export type CompanionHostEvent=Identity & (
 | {type:'requestStarted';simulation:boolean}
 | {type:'awaitingConfirmation'}
 | {type:'error'}
 | {type:'simulatedResult';summary?:string}
 | {type:'idle'}
) | VerifiedEvent;
export type CompanionPhase='idle'|'working'|'waiting'|'confirmation'|'error'|'simulation'|'verified';
export type CompanionClip='Walk'|'Idle'|'Think'|'Celebrate'|'Idea'|'Caution';
export interface CompanionState {
 phase:CompanionPhase;requestId:string|null;eventId:string|null;startedAt:number|null;
 simulation:boolean;summary:string;receiptId:string|null;revision:number|null;closed:boolean;
}
export const WORK_STATUS_TIMEOUT_MS=30_000;
const verifiedEvents=new WeakSet<object>();
const identity=(value:string)=>typeof value==='string'&&value.length>0&&value.length<=100;
export const initialCompanionState=():CompanionState=>({phase:'idle',requestId:null,eventId:null,startedAt:null,simulation:false,summary:'',receiptId:null,revision:null,closed:false});

/** Call only with the result of the host's read-receipt operation, after await.
 * Validates identity, current revision and the config digest. This is a display
 * guard, NOT an authorization boundary; it never grants or performs a write. */
export async function verifiedCommitEvent(expected:Identity & {context:ContextKey;operationId:string},readback:unknown):Promise<CompanionHostEvent|null>{
 try{
  const snapshot=cloneAssistantPlainData(expected) as typeof expected;
  const {eventId,requestId,operationId}=snapshot;
  if(!identity(eventId)||!identity(requestId))return null;
  const context=contextKeyContract.parse(snapshot.context);
  const value=cloneAssistantPlainData(readback) as Record<string,unknown>;
  if(value.verification!=='verified')return null;
  const receipt=assistantReceiptContract.parse(value.receipt),config=assistantConfigContract.parse(value.config),basis=basisContract.parse(value.basis);
  if(receipt.operationId!==operationId||canonicalValue(receipt.context)!==canonicalValue(context)||canonicalValue(config.context)!==canonicalValue(context)||config.revision!==receipt.afterRevision||basis.configRevision!==config.revision)return null;
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalValue(config)))),b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!==receipt.configHash)return null;
  const event:VerifiedEvent=Object.freeze({type:'verifiedCommit',eventId,requestId,receiptId:receipt.operationId,revision:receipt.afterRevision});
  verifiedEvents.add(event);return event;
 }catch{return null}
}

export function reduceCompanion(state:CompanionState,event:CompanionHostEvent,now:number):CompanionState{
 if(!event||!identity(event.eventId)||!identity(event.requestId)||event.eventId===state.eventId)return state;
 if(event.type==='requestStarted'){
  if(state.requestId===event.requestId)return state;
  return {...initialCompanionState(),phase:'working',requestId:event.requestId,eventId:event.eventId,startedAt:Number.isFinite(now)?now:0,simulation:event.simulation===true};
 }
 if(state.closed||state.requestId!==null&&state.requestId!==event.requestId)return state;
 const base={...state,eventId:event.eventId,requestId:event.requestId,startedAt:null};
 switch(event.type){
  case 'verifiedCommit':return verifiedEvents.has(event)?{...base,phase:'verified',simulation:false,summary:'',receiptId:event.receiptId,revision:event.revision}:state;
  case 'error':return {...base,phase:'error',receiptId:null,revision:null};
  case 'awaitingConfirmation':return state.phase==='error'?state:{...base,phase:'confirmation',receiptId:null,revision:null};
  case 'simulatedResult':return ['error','confirmation','verified'].includes(state.phase)?state:{...base,phase:'simulation',simulation:true,summary:typeof event.summary==='string'?event.summary.slice(0,400):'',receiptId:null,revision:null};
  case 'idle':return {...initialCompanionState(),eventId:event.eventId,requestId:event.requestId,closed:true};
  default:return state;
 }
}
export function expireCompanionWork(state:CompanionState,now:number):CompanionState{
 return state.phase==='working'&&state.startedAt!==null&&now-state.startedAt>=WORK_STATUS_TIMEOUT_MS?{...state,phase:'waiting',startedAt:null}:state;
}
export function companionPresentation(state:CompanionState):{label:string;text:string;clip:CompanionClip;receiptId:string|null}{
 const source=state.simulation?'Offline-Simulation':'App-Ereignis';
 switch(state.phase){
  case 'working':return {label:source,text:'Der gemeldete Auftrag wird bearbeitet. Ein Ergebnis steht noch aus.',clip:'Think',receiptId:null};
  case 'waiting':return {label:source,text:'Status noch offen. Es liegt keine neue Bestätigung vor.',clip:'Caution',receiptId:null};
  case 'confirmation':return {label:source,text:'Deine ausdrückliche Bestätigung ist im Prüfbereich erforderlich. Diese Sprechblase erteilt keine Freigabe.',clip:'Caution',receiptId:null};
  case 'error':return {label:source,text:'Der Vorgang ist nicht bestätigt. Prüfe den Fehler im Auftragsbereich, bevor du fortfährst.',clip:'Caution',receiptId:null};
  case 'simulation':return {label:'Offline-Simulation · kein Ausführungsbeleg',text:state.summary||'Das simulierte Ergebnis steht zur Prüfung bereit. Es bestätigt keine ausgeführte Änderung.',clip:'Idea',receiptId:null};
  case 'verified':return {label:'Host-Readback · lokal bestätigt',text:`Konfiguration nachgelesen und mit dem Speicherbeleg abgeglichen. Revision ${state.revision}.`,clip:'Celebrate',receiptId:state.receiptId};
  default:return {label:'Optionaler Offline-Begleiter',text:'Bereit für das nächste App-Ereignis. Es läuft kein Auftrag.',clip:'Idle',receiptId:null};
 }
}
/** Continuous triangular route. The audited model's forward axis is +Z. */
export function pingPongPose(seconds:number){
 const cycle=((Number.isFinite(seconds)?seconds:0)%24+24)%24;
 const direction=cycle<12?1:-1;
 const progress=cycle<12?cycle/12:(24-cycle)/12;
 return {x:-1.15+2.3*progress,direction,rotationY:direction*Math.PI/2};
}
