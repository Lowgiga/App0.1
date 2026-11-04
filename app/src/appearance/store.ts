import {defaultAppearanceState,parseAppearanceState,type AppearanceState} from './contracts.ts';
export const APPEARANCE_KEY='appearance-v1';
export type AppearanceRecord={revision:number;value:AppearanceState};
type Options={indexedDB?:IDBFactory|null;name?:string};
function checked(raw:unknown):AppearanceRecord{
 if(!raw||typeof raw!=='object'||Object.keys(raw).sort().join(',')!=='revision,value')throw new Error('APPEARANCE_CORRUPT: Darstellungsspeicher beschädigt.');
 const record=raw as AppearanceRecord;
 if(!Number.isSafeInteger(record.revision)||record.revision<1)throw new Error('APPEARANCE_CORRUPT: Ungültige Speicherrevision.');
 return{revision:record.revision,value:parseAppearanceState(record.value)};
}
/** Device-local CAS store. No WorkState, journal, backup or other preference keys are written. */
export class AppearanceStore{
 private database:Promise<IDBDatabase>|null=null;
 private generation=0;
 private transactions=new Set<IDBTransaction>();
 private readonly factory:IDBFactory|null|undefined;
 private readonly name:string;
 constructor(options:Options={}){this.factory=options.indexedDB===undefined?globalThis.indexedDB:options.indexedDB;this.name=options.name??'cue-system-preferences-v2'}
 private open():Promise<IDBDatabase>{
  if(this.database)return this.database;
  if(!this.factory)return Promise.reject(new Error('APPEARANCE_UNAVAILABLE: Lokaler Speicher ist nicht verfügbar.'));
  const generation=this.generation;
  this.database=new Promise((resolve,reject)=>{
   const request=this.factory!.open(this.name,1);let rejected=false;
   const invalidate=()=>{if(this.generation===generation){this.database=null;this.generation++}};
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('preferences'))request.result.createObjectStore('preferences')};
   request.onerror=()=>{invalidate();reject(new Error('APPEARANCE_OPEN_FAILED: Darstellungsspeicher konnte nicht geöffnet werden.'))};
   request.onblocked=()=>{rejected=true;invalidate();reject(new Error('APPEARANCE_BLOCKED: Darstellungsspeicher ist blockiert.'))};
   request.onsuccess=()=>{const db=request.result;if(rejected||generation!==this.generation){db.close();reject(new Error('APPEARANCE_CLOSED: Speicherverbindung geändert.'));return}db.onversionchange=()=>{db.close();invalidate()};db.onclose=invalidate;resolve(db)};
  });
  return this.database;
 }
 private async begin(mode:IDBTransactionMode):Promise<{tx:IDBTransaction;generation:number}>{
  const generation=this.generation,opened=this.open(),db=await opened;
  if(generation!==this.generation)throw new Error('APPEARANCE_CLOSED: Speicherverbindung geändert.');
  let tx:IDBTransaction;
  try{tx=db.transaction('preferences',mode)}catch(error){if(this.database===opened){this.database=null;this.generation++}throw error}
  this.transactions.add(tx);const remove=()=>this.transactions.delete(tx);tx.addEventListener('complete',remove);tx.addEventListener('abort',remove);
  return{tx,generation};
 }
 private async transact(mode:IDBTransactionMode,change?:(current:AppearanceRecord)=>AppearanceRecord,signal?:AbortSignal):Promise<AppearanceRecord>{
  if(signal?.aborted)throw new DOMException('Darstellungsspeicherung abgebrochen.','AbortError');
  const {tx,generation}=await this.begin(mode);
  return new Promise((resolve,reject)=>{
   let result:AppearanceRecord|undefined,failure:unknown;
   const abort=()=>{failure=new DOMException('Darstellungsspeicherung abgebrochen.','AbortError');try{tx.abort()}catch{/* Already terminal. */}};
   const cleanup=()=>signal?.removeEventListener('abort',abort);
   tx.oncomplete=()=>{cleanup();if(generation!==this.generation||!result){reject(new Error('APPEARANCE_UNCERTAIN: Speicherergebnis unklar. App neu laden.'));return}resolve(result)};
   tx.onabort=()=>{cleanup();reject(failure??new Error(mode==='readonly'?'APPEARANCE_READ_FAILED: Darstellung konnte nicht geladen werden.':'APPEARANCE_WRITE_FAILED: Darstellung wurde nicht gespeichert.'))};
   tx.onerror=()=>{};
   signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return}
   const store=tx.objectStore('preferences');
   // get() alone cannot distinguish an absent key from a corrupt stored undefined.
   const key=store.getKey(APPEARANCE_KEY),read=store.get(APPEARANCE_KEY);
   read.onsuccess=()=>{
    try{
     const current=key.result===undefined?{revision:0,value:defaultAppearanceState()}:checked(read.result);
     result=change?change(current):current;
     if(change){if(generation!==this.generation)throw new Error('APPEARANCE_CLOSED');store.put(result,APPEARANCE_KEY)}
    }catch(error){failure=error;try{tx.abort()}catch{reject(error)}}
   };
  });
 }
 load():Promise<AppearanceRecord>{return this.transact('readonly')}
 async save(expectedRevision:number,next:AppearanceState|((current:AppearanceState)=>AppearanceState),beforeWrite?:()=>void,signal?:AbortSignal):Promise<AppearanceRecord>{
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw new Error('APPEARANCE_REVISION: Ungültige Speicherrevision.');
  const candidate=typeof next==='function'?next:parseAppearanceState(next);
  return this.transact('readwrite',current=>{
   if(current.revision!==expectedRevision)throw new Error('APPEARANCE_CONFLICT: Eine andere Sitzung hat die Darstellung geändert. Entwurf bleibt erhalten. App neu laden.');
   if(current.revision===Number.MAX_SAFE_INTEGER)throw new Error('APPEARANCE_REVISION_LIMIT: Revisionsgrenze erreicht.');
   const value=parseAppearanceState(typeof candidate==='function'?candidate(current.value):candidate);
   beforeWrite?.();
   return{revision:current.revision+1,value};
  },signal);
 }
 close(){const pending=this.database;this.database=null;this.generation++;for(const tx of this.transactions){try{tx.abort()}catch{/* Transaction already terminal. */}}this.transactions.clear();void pending?.then(db=>db.close()).catch(()=>{})}
}
