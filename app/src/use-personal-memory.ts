import {useEffect,useReducer,useRef} from 'react';
import {useWorkTransport} from './work-transport.tsx';
import {personalContinuationResponseContract,type PersonalContinuationResponse,type PersonalComposer,type PersonalDraftBase} from './personal-continuation.ts';
import {appliedMemoryTarget,appliedMemoryTargetCurrent,type AppliedMemoryTarget} from './personal-apply-target.ts';
import type {MeshRoom} from '../upstream/lib/work-contract.ts';

export const emptyPersonalComposer=():PersonalComposer=>({kind:'decision',text:'',origin:'manual',sourceId:null,editingEntryId:null});
export type DraftApplyPreview={version:number;draft:NonNullable<PersonalContinuationResponse['draft']>};
export type DraftOpenOptions={signal?:AbortSignal;isCurrent?:()=>boolean;confirmReplace?:()=>boolean};
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
/** A keyed editor session. Confirmed draft writes survive UI unmount; no write is retried on uncertainty. */
export function usePersonalMemory(room:Pick<MeshRoom,'id'|'createdAt'>){
 const transport=useWorkTransport(),[,render]=useReducer(n=>n+1,0);
 const state=useRef({snapshot:null as PersonalContinuationResponse|null,composer:emptyPersonalComposer(),base:null as PersonalDraftBase|null,dirty:false,opened:false,busy:false,opening:false,locked:false,error:'',notice:'',version:0,appliedTarget:null as AppliedMemoryTarget|null});
 const alive=useRef(false),generation=useRef(0),readAbort=useRef<AbortController|null>(null),running=useRef<Promise<boolean>|null>(null);
 const applyPreview=useRef<DraftApplyPreview|null>(null),applyPreviewCurrent=useRef<(()=>boolean)|null>(null);
 const pendingApply=useRef<{revision:number;composer:PersonalComposer;version:number;snapshot:PersonalContinuationResponse}|null>(null);
 const m=state.current;
 function notify(){if(alive.current)render()}
 function baseFor(snapshot:PersonalContinuationResponse,composer=m.composer):PersonalDraftBase{return {workUpdatedAt:snapshot.workUpdatedAt,memoryRevision:snapshot.memory?.revision??0,entryRevision:composer.editingEntryId?snapshot.memory?.entries.find(e=>e.id===composer.editingEntryId)?.revision??null:null}}
 async function request(operation:string,extra:Record<string,unknown>={},signal?:AbortSignal){
  const response=await transport.request('/api/personal-continuation',{method:'POST',body:JSON.stringify({operation,contextId:room.id,contextCreatedAt:room.createdAt,...extra}),signal});
  if(!response.ok)throw Error(response.status===409?'CONFLICT':response.status>=500?'UNCERTAIN':'INVALID');
  const next=personalContinuationResponseContract.parse(await response.json());
  if(next.draft&&(next.draft.contextId!==room.id||next.draft.contextCreatedAt!==room.createdAt)||next.memory&&(next.memory.contextId!==room.id||next.memory.contextCreatedAt!==room.createdAt))throw Error('UNCERTAIN');
  return next;
 }
 async function load(){
  applyPreview.current=null;
  if(running.current)await running.current;
  const id=++generation.current,abort=new AbortController();readAbort.current?.abort();readAbort.current=abort;m.opening=false;m.busy=true;m.error='';notify();
  try{
   const next=await request('read',{},abort.signal);if(!alive.current||abort.signal.aborted||generation.current!==id)return false;
   const previous=m.snapshot,draft=next.draft,applied=pendingApply.current;
   m.snapshot=next;m.locked=false;if(!appliedMemoryTargetCurrent(m.appliedTarget,next))m.appliedTarget=null;
   if(applied&&draft?.status==='applied'&&draft.revision===applied.revision+1&&equal(draft.composer,applied.composer)){
    m.appliedTarget=appliedMemoryTarget(applied.snapshot,next);
    if(m.version===applied.version){m.composer=emptyPersonalComposer();m.base=null;m.dirty=false;m.opened=false}pendingApply.current=null;m.notice='Übernahme durch Wiederlesen bestätigt. Kein zweiter Vorschlag erzeugt.';
   }else if((m.dirty||m.opened)&&draft?.status==='active'&&equal(draft.composer,m.composer)&&equal(draft.base,m.base)){
    m.dirty=false;m.opened=true;m.notice='Entwurf lokal gesichert; durch Wiederlesen bestätigt.';
   }else if((m.dirty||m.opened)&&previous&&previous.draft?.revision!==draft?.revision){
    m.locked=true;m.error='Speicherkonflikt: Lokaler Text bleibt sichtbar. Die andere gesicherte Fassung wird nicht überschrieben. Text sichern und gesicherte Fassung bewusst öffnen.';
   }else{m.notice=previous?'Stand neu geladen. Entwurfbasis bleibt unverändert.':'Stand geladen. Ein gesicherter Entwurf wird nur ausdrücklich geöffnet.'}
   return true;
  }catch{if(alive.current&&!abort.signal.aborted){m.locked=true;m.error='Gedächtnis konnte nicht geladen werden. Persönlicher Speicher nicht verlässlich gelesen; sichtbaren Text sichern. Es wurde nichts zurückgesetzt.'}return false}
  finally{if(generation.current===id){m.busy=false;notify()}}
 }
 useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;generation.current++;readAbort.current?.abort()}},[]);
 function change(change:Partial<PersonalComposer>){
  if(!m.snapshot)return;
  applyPreview.current=null;
  m.appliedTarget=null;m.composer={...m.composer,...change};m.base??=baseFor(m.snapshot,m.composer);m.dirty=true;m.opened=true;m.version++;m.notice='Ungesicherte Änderungen';notify();
 }
 function operation(run:()=>Promise<boolean>):Promise<boolean>{
  if(running.current)return running.current;
  // A write owns the next authoritative snapshot. An older read must never
  // replace its receipt or clear its busy flag, even if transport ignores abort.
  generation.current++;readAbort.current?.abort();m.opening=false;
  m.busy=true;notify();
  const promise=run().finally(()=>{if(running.current===promise){running.current=null;m.busy=false;notify()}});running.current=promise;return promise;
 }
 function failure(error:unknown){m.locked=true;m.error=error instanceof Error&&error.message==='CONFLICT'?'Speicherkonflikt. Lokaler Text bleibt sichtbar; die andere Fassung wird nicht überschrieben. Stand neu laden und vergleichen.':'Schreibausgang nicht bestätigt. Sichtbaren Text sichern und Stand neu laden. Keine automatische Wiederholung.';notify()}
 async function flush():Promise<boolean>{
  if(running.current){await running.current;if(m.locked)return false}
  if(!m.dirty)return !m.locked;
  if(m.locked||!m.snapshot||!m.base)return false;
  if(m.snapshot.draft?.status!=='active'&&!equal(m.base,baseFor(m.snapshot))){m.notice='Neuere Eingabe noch ungesichert. Aktuellen Stand vor neuer Entwurfsicherung ausdrücklich vergleichen.';notify();return false}
  return operation(async()=>{
   const version=m.version,composer=structuredClone(m.composer),base=structuredClone(m.base!),revision=m.snapshot?.draft?.revision??0;
   try{const next=await request('save-draft',{expectedRevision:revision,composer,base});if(!next.draft||next.draft.revision!==revision+1||next.draft.status!=='active'||!equal(next.draft.composer,composer)||!equal(next.draft.base,base))throw Error('UNCERTAIN');m.snapshot=next;if(m.version===version)m.dirty=false;m.error='';m.notice=m.dirty?'Neuere Eingabe noch ungesichert':'Entwurf lokal gesichert';notify();return !m.dirty}
   catch(error){failure(error);return false}
  });
 }
 useEffect(()=>{if(!m.dirty||m.locked)return;const timer=setTimeout(()=>{void flush()},400);return()=>clearTimeout(timer)},[m.version]);
 useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(m.dirty||running.current){event.preventDefault();event.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[]);
 function cancelPreview(){applyPreview.current=null;applyPreviewCurrent.current=null}
 async function previewApply(isCurrent:()=>boolean):Promise<DraftApplyPreview|null>{
  applyPreview.current=null;const version=m.version;
  if(!isCurrent()||running.current||m.busy||!m.opened||!await flush()||!isCurrent()||m.version!==version||!await load())return null;
  const draft=m.snapshot?.draft;
  if(!isCurrent()||!alive.current||m.version!==version||m.locked||m.dirty||m.snapshot?.contextStatus!=='active'||draft?.status!=='active'||!equal(draft.composer,m.composer)||!equal(draft.base,m.base)||!equal(m.base,baseFor(m.snapshot)))return null;
  const preview={version,draft:structuredClone(draft)};applyPreview.current=preview;applyPreviewCurrent.current=isCurrent;return preview;
 }
 function canApply(preview:DraftApplyPreview){return applyPreviewCurrent.current?.()===true&&!running.current&&!m.busy&&applyPreview.current===preview&&m.version===preview.version&&!m.locked&&!m.dirty&&equal(m.snapshot?.draft,preview.draft)&&equal(m.composer,preview.draft.composer)&&equal(m.base,preview.draft.base)}
 async function apply(preview:DraftApplyPreview){
  if(!canApply(preview))return false;
  applyPreview.current=null;
  return operation(async()=>{const draft=m.snapshot!.draft!;pendingApply.current={revision:draft.revision,composer:structuredClone(draft.composer),version:m.version,snapshot:structuredClone(m.snapshot!)};
   try{const next=await request('apply-draft',{expectedRevision:draft.revision});if(next.draft?.status!=='applied'||next.draft.revision!==draft.revision+1)throw Error('UNCERTAIN');m.appliedTarget=appliedMemoryTarget(pendingApply.current!.snapshot,next);m.snapshot=next;if(m.version===pendingApply.current!.version){m.composer=emptyPersonalComposer();m.base=null;m.opened=false;m.dirty=false;m.notice='Änderung lokal bestätigt gespeichert. Entwurf als Vorschlag übernommen.'}else{m.notice='Änderung übernommen. Neuere Eingabe noch ungesichert; Basis vor neuer Sicherung vergleichen.'}m.error='';pendingApply.current=null;notify();return true}catch(error){failure(error);return false}});
 }
 async function discard(){
  applyPreview.current=null;
  if(running.current||m.locked)return false;
  if(m.snapshot?.draft?.status!=='active'){m.composer=emptyPersonalComposer();m.base=null;m.opened=false;m.dirty=false;m.version++;notify();return true}
  return operation(async()=>{const revision=m.snapshot!.draft!.revision,version=m.version;try{const next=await request('discard-draft',{expectedRevision:revision});if(next.draft?.status!=='discarded'||next.draft.revision!==revision+1)throw Error('UNCERTAIN');m.snapshot=next;if(m.version===version){m.composer=emptyPersonalComposer();m.base=null;m.opened=false;m.dirty=false;m.notice='Entwurf ausdrücklich verworfen';m.version++}else{m.notice='Vorherigen Entwurf verworfen. Neuere Eingabe noch ungesichert.'}m.error='';notify();return true}catch(error){failure(error);return false}});
 }
 async function open(expectedRevision=m.snapshot?.draft?.revision,options:DraftOpenOptions={}):Promise<boolean>{
  if(running.current||m.busy||!Number.isSafeInteger(expectedRevision)||!expectedRevision||expectedRevision<1||options.signal?.aborted||options.isCurrent?.()===false)return false;
  applyPreview.current=null;
  const id=++generation.current,version=m.version,abort=new AbortController();readAbort.current?.abort();readAbort.current=abort;
  const cancel=()=>abort.abort();options.signal?.addEventListener('abort',cancel,{once:true});m.opening=true;m.busy=true;notify();
  const current=()=>alive.current&&!abort.signal.aborted&&id===generation.current&&version===m.version&&options.isCurrent?.()!==false;
  const checked=(next:PersonalContinuationResponse)=>{if(next.contextStatus!=='active'||next.draft?.status!=='active'||next.draft.revision!==expectedRevision)throw Error('OPEN_CHANGED');return next.draft};
  try{
   const first=await request('read',{},abort.signal);if(!current())return false;const draft=checked(first);
   if((m.dirty||m.locked)&&options.confirmReplace?.()!==true){m.notice='Öffnen abgebrochen. Lokaler Text bleibt erhalten.';return false}
   if(!current())return false;
   // A confirmation is permission to replace this editor, not permission to
   // silently open a later revision saved while the decision was being made.
   const next=await request('read',{},abort.signal);if(!current())return false;const latest=checked(next);
   if(!equal(draft,latest))throw Error('OPEN_CHANGED');
   m.snapshot=next;m.composer=structuredClone(latest.composer);m.base=structuredClone(latest.base);m.opened=true;m.dirty=false;m.locked=false;m.error='';pendingApply.current=null;m.notice='Gesicherten Entwurf geöffnet. Noch keine Änderung am Projektgedächtnis.';m.version++;notify();return true;
  }catch(error){if(current()){m.locked=true;m.error=error instanceof Error&&error.message==='OPEN_CHANGED'?'Entwurf oder Projekt geändert. Die angeforderte Revision wurde nicht geöffnet. Stand neu laden und bewusst erneut wählen.':'Entwurf konnte nicht verlässlich geprüft werden. Lokaler Text bleibt erhalten; Stand neu laden.';notify()}return false}
  finally{options.signal?.removeEventListener('abort',cancel);if(id===generation.current){m.opening=false;m.busy=false;notify()}}
 }
 function cancelOpen(){if(!m.opening)return;generation.current++;readAbort.current?.abort();m.opening=false;m.busy=false;m.notice='Öffnen abgebrochen. Lokaler Text bleibt erhalten.';notify()}
 async function rebase(){
  applyPreview.current=null;
  if(running.current||m.locked||!m.snapshot)return false;
  const newDraft=m.snapshot.draft?.status!=='active';
  if(!newDraft&&!await flush())return false;
  return operation(async()=>{const revision=m.snapshot!.draft?.revision??0,base=baseFor(m.snapshot!),version=m.version;try{const next=await request(newDraft?'save-draft':'rebase-draft',{expectedRevision:revision,base,...(newDraft?{composer:structuredClone(m.composer)}:{})});if(next.draft?.revision!==revision+1||!equal(next.draft.base,base))throw Error('UNCERTAIN');m.snapshot=next;m.base=next.draft.base;if(m.version===version)m.dirty=false;m.error='';m.notice='Neue Basis nach ausdrücklichem Vergleich gewählt. Entwurf bleibt unbestätigt.';notify();return true}catch(error){failure(error);return false}});
 }
 async function mutate(operationName:string,extra:Record<string,unknown>={}){
  if(running.current||m.locked||m.dirty||m.snapshot?.draft?.status==='active'||!m.snapshot?.memory)return false;
  return operation(async()=>{try{const response=await transport.request('/api/project-memory',{method:'POST',body:JSON.stringify({operation:operationName,contextId:room.id,expectedRevision:m.snapshot!.memory!.revision,expectedWorkUpdatedAt:m.snapshot!.workUpdatedAt,...extra})});if(!response.ok)throw Error(response.status===409?'CONFLICT':'UNCERTAIN');const next=await request('read');m.snapshot=next;if(!appliedMemoryTargetCurrent(m.appliedTarget,next))m.appliedTarget=null;m.notice='Änderung lokal bestätigt gespeichert.';m.error='';notify();return true}catch(error){failure(error);return false}});
 }
 const pendingRestore=m.snapshot?.draft?.status==='active'&&!m.opened&&!m.dirty;
 const stale=!!m.base&&!!m.snapshot&&!equal(m.base,baseFor(m.snapshot));
 return {state:m,pendingRestore,stale,load,change,flush,previewApply,cancelPreview,canApply,apply,discard,open,cancelOpen,rebase,mutate,baseFor};
}
