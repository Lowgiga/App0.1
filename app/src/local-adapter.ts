import { emptyWork, savedWorkContract, type WorkState } from '../upstream/lib/work-contract.ts';
import { projectState } from '../upstream/lib/state-compat.ts';
import { applyLocalWrite, applyLocalAction } from './local-domain.ts';
import { LocalStateError, storageError } from './local-errors.ts';
import {planLegacyImport,acceptLegacyImport,type LegacyImportPlan} from './legacy-import.ts';
import {createId} from '../upstream/lib/ids.ts';
import { workSizeError } from '../upstream/lib/work-budget.ts';
import {projectMemoryTransaction} from './project-memory-transaction.ts';
import {personalContinuationTransaction} from './personal-continuation-transaction.ts';
import {AssistantConfigHost,assistantConfigRequest,type AssistantConfigApproval} from './assistant/transaction.ts';

export const DATABASE_NAME='cue-command-mesh-local';
export const DATABASE_VERSION=1;
export const STORAGE_FORMAT_VERSION=1;
export interface WorkTransport { request(path:string,init?:RequestInit):Promise<Response>; }
export interface LocalStoreOptions { indexedDB?:IDBFactory|null; name?:string; now?:()=>Date; sources?:readonly string[]; }
interface Envelope { formatVersion:1; stateVersion:4; state:WorkState; }
const abortError=()=>new DOMException('Lokale Anfrage abgebrochen.','AbortError');
function decode(value:unknown):WorkState {
  if(value===undefined)return emptyWork();
  if(!value||typeof value!=='object')throw new LocalStateError('CORRUPT_STORAGE','Lokaler Arbeitsstand beschädigt. Daten bleiben unverändert erhalten.');
  const envelope=value as Record<string,unknown>;
  if(envelope.formatVersion!==STORAGE_FORMAT_VERSION||(typeof envelope.stateVersion!=='number'||![3,4].includes(envelope.stateVersion)))throw new LocalStateError('UNSUPPORTED_VERSION','Diese lokale Speicherversion wird von diesem App-Build nicht unterstützt. Daten bleiben erhalten.');
  const parsed=savedWorkContract.safeParse(envelope.state);
  if(!parsed.success)throw new LocalStateError('CORRUPT_STORAGE','Lokaler Arbeitsstand beschädigt. Speichern ist gesperrt; Daten wurden nicht zurückgesetzt.',503,{cause:parsed.error});
  return parsed.data;
}
/** Explicit local protocol, not a fetch shim: no network or identity handling. */
export class LocalWorkStore implements WorkTransport {
  private factory:IDBFactory|null;
  private name:string;
  private now:()=>Date;
  private sources:readonly string[];
  private opened:Promise<IDBDatabase>|null=null;
  private connectionGeneration=0;
  private importGeneration=0;
  private importPlan:LegacyImportPlan|null=null;
  private assistant:AssistantConfigHost;
  private assistantGeneration=0;
  constructor(options:LocalStoreOptions={}) {this.factory=options.indexedDB===undefined?(globalThis.indexedDB??null):options.indexedDB;this.name=options.name??DATABASE_NAME;this.now=options.now??(()=>new Date());this.sources=options.sources??[];this.assistant=new AssistantConfigHost(this.now);}
  private open():Promise<IDBDatabase> {
    if(this.opened)return this.opened;
    if(!this.factory)return Promise.reject(new LocalStateError('STORAGE_UNAVAILABLE','IndexedDB ist nicht verfügbar. Lokales Speichern ist gesperrt.'));
    const generation=++this.connectionGeneration;
    const invalidate=()=>{if(this.connectionGeneration===generation){this.opened=null;this.discardAssistantConfigPreview();}};
    this.opened=new Promise((resolve,reject)=>{
      const request=this.factory!.open(this.name,DATABASE_VERSION);let rejected=false;
      request.onupgradeneeded=(event)=>{if(event.oldVersion===0)request.result.createObjectStore('work');};
      request.onblocked=()=>{rejected=true;reject(new LocalStateError('STORAGE_UNAVAILABLE','Speicheraktualisierung blockiert. Schließe andere offene App-Tabs und lade neu.'));};
      request.onerror=()=>reject(request.error?.name==='VersionError'?new LocalStateError('UNSUPPORTED_VERSION','Ein neuerer App-Build hat den Gerätespeicher aktualisiert. Dieser Build schreibt keine älteren Daten darüber.'):storageError(request.error));
      request.onsuccess=()=>{const db=request.result;if(rejected){db.close();return;}db.onversionchange=()=>{db.close();invalidate();};db.onclose=invalidate;resolve(db);};
    });this.opened.catch(invalidate);return this.opened;
  }
  /** Host/UI only: call after displaying the exact preview and an explicit user decision. */
  approveAssistantConfig(approval:AssistantConfigApproval){this.assistant.approve(approval)}
  /** Call on stop, preview dismissal or project/context change. Does not close the database. */
  discardAssistantConfigPreview(){this.assistantGeneration++;this.assistant.invalidate()}
  close(){this.discardAssistantConfigPreview();this.importGeneration++;this.importPlan=null;const opened=this.opened;this.opened=null;this.connectionGeneration++;if(opened)void opened.then(db=>db.close(),()=>{});}
  private async transaction(update:((current:WorkState,now:Date)=>WorkState)|null,signal?:AbortSignal|null,preservePlannedRevision=false):Promise<WorkState> {
    if(signal?.aborted)throw abortError();const db=await this.open();if(signal?.aborted)throw abortError();
    return new Promise((resolve,reject)=>{
      let result:WorkState|undefined;let failure:unknown;
      const tx=db.transaction('work',update?'readwrite':'readonly');
      const abort=()=>{failure=abortError();try{tx.abort()}catch{/* Already committed: caller can reload and reconcile. */}};
      signal?.addEventListener('abort',abort,{once:true});
      const cleanup=()=>signal?.removeEventListener('abort',abort);
      tx.onabort=()=>{cleanup();reject(failure??storageError(tx.error));};
      tx.onerror=()=>{failure??=storageError(tx.error);};
      tx.oncomplete=()=>{cleanup();if(failure)reject(failure);else if(result)resolve(result);else reject(storageError(undefined));};
      const store=tx.objectStore('work');const request=store.get('local-default');
      request.onsuccess=()=>{try{
        const current=decode(request.result);
        if(!update){result=current;return;}
        const wallTime=this.now().getTime();if(!Number.isFinite(wallTime))throw new LocalStateError('STORAGE_UNAVAILABLE','Ungültige Gerätezeit. Es wurde nichts gespeichert.');
        const domainNow=new Date(wallTime);
        const revisionTime=new Date(Math.max(wallTime,current.updatedAt?Date.parse(current.updatedAt)+1:0));
        const candidate=update(current,domainNow);
        result=savedWorkContract.parse({...candidate,updatedAt:preservePlannedRevision?candidate.updatedAt:revisionTime.toISOString()});
        const sizeError=workSizeError(result);if(sizeError)throw new LocalStateError('VALIDATION',sizeError,400);
        const envelope:Envelope={formatVersion:1,stateVersion:4,state:result};
        store.put(envelope,'local-default');
      }catch(error){failure=error instanceof LocalStateError?error:storageError(error);tx.abort();}};
      request.onerror=()=>{failure=storageError(request.error);};
      if(signal?.aborted)abort();
    });
  }
  async request(path:string,init:RequestInit={}):Promise<Response> {
    if(init.signal?.aborted){if(path==='/api/assistant')this.discardAssistantConfigPreview();throw abortError();}
    const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Cue-Storage':'device-local'}});
    try {
      if(!['/api/state','/api/actions','/api/imports/preview','/api/imports/commit','/api/project-memory','/api/project-memory/backup','/api/personal-continuation','/api/assistant'].includes(path))return json({error:'In der lokalen App nicht verfügbar. Keine Remote-Verbindung.',code:'UNSUPPORTED'},404);
      const headers=new Headers(init.headers);for(const [key] of headers)if(!['content-type','x-mesh-state-version'].includes(key))throw new LocalStateError('UNSUPPORTED','Identitäts- oder andere Netzwerkheader gehören nicht zum lokalen Speicher.',400);
      const version=headers.get('X-Mesh-State-Version')??'4';if(!['3','4'].includes(version))throw new LocalStateError('UNSUPPORTED_VERSION','Nicht unterstützte Datenversion.',400);
      const method=(init.method??'GET').toUpperCase();
      if(path==='/api/personal-continuation'){
        if(method!=='POST')return json({error:'Persönliche Fortsetzung benötigt POST.',code:'UNSUPPORTED'},405);
        if(typeof init.body!=='string')throw new LocalStateError('VALIDATION','Eine JSON-Zeichenfolge ist erforderlich.',400);
        if(new TextEncoder().encode(init.body).byteLength>32768)throw new LocalStateError('TOO_LARGE','Entwurfsanfrage zu groß.',413);
        let input:unknown;try{input=JSON.parse(init.body)}catch{throw new LocalStateError('VALIDATION','Ungültiges JSON.',400)}
        const opened=this.open(),generation=this.connectionGeneration,db=await opened;
        return json(await personalContinuationTransaction(db,decode,input,this.now,()=>this.connectionGeneration===generation,init.signal));
      }
      if(path==='/api/assistant'){
        if(method!=='POST')return json({error:'Assistentenspeicher benötigt POST.',code:'UNSUPPORTED'},405);
        if(typeof init.body!=='string'||new TextEncoder().encode(init.body).byteLength>32768)throw new LocalStateError('VALIDATION','Assistentenanfrage benötigt höchstens 32 KiB JSON.',400);
        let input:unknown;try{input=JSON.parse(init.body)}catch{throw new LocalStateError('VALIDATION','Ungültiges JSON.',400)}
        if(input&&typeof input==='object'&&'operation' in input&&input.operation==='preview-config')this.discardAssistantConfigPreview();
        const assistantGeneration=this.assistantGeneration;
        const db=await this.open(),generation=this.connectionGeneration;
        const current=()=>this.connectionGeneration===generation&&this.assistantGeneration===assistantGeneration;
        return json(await assistantConfigRequest(db,decode,input,this.assistant,this.now,current,init.signal));
      }
      if(path.startsWith('/api/project-memory')){
        if(method!=='POST')return json({error:'Projektgedächtnis benötigt POST.',code:'UNSUPPORTED'},405);
        if(typeof init.body!=='string')throw new LocalStateError('VALIDATION','Eine JSON-Zeichenfolge ist erforderlich.',400);
        if(new TextEncoder().encode(init.body).byteLength>32768)throw new LocalStateError('TOO_LARGE','Gedächtnisanfrage zu groß.',413);
        let input:unknown;try{input=JSON.parse(init.body)}catch{throw new LocalStateError('VALIDATION','Ungültiges JSON.',400)}
        const db=await this.open(),generation=this.connectionGeneration;
        return json(await projectMemoryTransaction(db,decode,input,path.endsWith('/backup'),this.now,()=>this.connectionGeneration===generation,init.signal));
      }
      if(path.startsWith('/api/imports/')){
        if(method!=='POST')return json({error:'Import benötigt POST.',code:'UNSUPPORTED'},405);
        if(typeof init.body!=='string')throw new LocalStateError('VALIDATION','Eine JSON-Zeichenfolge ist erforderlich.',400);
        if(path==='/api/imports/preview'){
          const generation=++this.importGeneration;this.importPlan=null;
          const current=await this.transaction(null,init.signal);
          const plan=planLegacyImport(current,init.body,this.sources,this.now(),createId(),Array.from({length:200},()=>createId()));
          if(init.signal?.aborted||generation!==this.importGeneration)throw abortError();
          this.importPlan=plan;return json(plan.preview);
        }
        let input:unknown;try{input=JSON.parse(init.body)}catch{throw new LocalStateError('VALIDATION','Ungültige Bestätigung.',400)}
        if(!input||typeof input!=='object'||Object.keys(input).length!==1||!('planId'in input)||typeof input.planId!=='string')throw new LocalStateError('VALIDATION','Ungültige Bestätigung.',400);
        const plan=this.importPlan;
        if(!plan||plan.preview.planId!==input.planId)throw new LocalStateError('CONFLICT','Vorschau fehlt, wurde ersetzt oder bereits bestätigt. Datei erneut prüfen.',409);
        this.importPlan=null;this.importGeneration++;
        const state=await this.transaction((current,now)=>acceptLegacyImport(current,plan,now),init.signal,true);
        return json({state,receipt:plan.preview});
      }
      if(path==='/api/state'&&method==='GET')return json(projectState(await this.transaction(null,init.signal),version));
      if(!(path==='/api/state'&&method==='PUT'||path==='/api/actions'&&method==='POST'))return json({error:'Methode lokal nicht unterstützt.',code:'UNSUPPORTED'},405);
      if(typeof init.body!=='string')throw new LocalStateError('VALIDATION','Eine JSON-Zeichenfolge ist erforderlich.',400);
      if(new TextEncoder().encode(init.body).byteLength>(path==='/api/actions'?32768:2000000))throw new LocalStateError('TOO_LARGE','Anfrage zu groß. Exportiere den vorhandenen Stand und kürze große Texte.',413);
      let input:unknown;try{input=JSON.parse(init.body);}catch{throw new LocalStateError('VALIDATION','Ungültiges JSON.',400);}
      const state=await this.transaction((current,now)=>path==='/api/state'?applyLocalWrite(current,input,now,this.sources,version):applyLocalAction(current,input,now,this.sources),init.signal);
      return json(projectState(state,version));
    }catch(error){if(error instanceof DOMException&&error.name==='AbortError'){if(path==='/api/assistant')this.discardAssistantConfigPreview();throw error}const known=storageError(error);return json({error:known.message,code:known.code},known.status);}
  }
}
