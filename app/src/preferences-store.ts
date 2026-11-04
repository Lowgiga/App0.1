import {parseSystemState,readSystemState,defaultSystemState,type SystemState} from './system-state.ts';
export type PreferencesRecord={revision:number;value:SystemState};
type Options={indexedDB?:IDBFactory;name?:string;legacy?:Pick<Storage,'getItem'>};
function checked(raw:unknown):PreferencesRecord {if(!raw||typeof raw!=='object')throw new Error('PREFERENCES_CORRUPT');const r=raw as PreferencesRecord;if(Object.keys(r).sort().join(',')!=='revision,value'||!Number.isSafeInteger(r.revision)||r.revision<1)throw new Error('PREFERENCES_CORRUPT');return{revision:r.revision,value:parseSystemState(r.value)}}
export class PreferencesStore {
 private generation=0;private db:Promise<IDBDatabase>|null=null;private factory:IDBFactory|undefined;private name:string;private legacy:Options['legacy'];
 constructor(options:Options={}){this.factory=options.indexedDB??globalThis.indexedDB;this.name=options.name??'cue-system-preferences-v2';this.legacy=options.legacy;}
 private open():Promise<IDBDatabase>{
  if(this.db)return this.db;
  if(!this.factory)return Promise.reject(new Error('INDEXEDDB_UNAVAILABLE'));
  const generation=++this.generation;
  const invalidate=()=>{if(this.generation===generation)this.db=null};
  this.db=new Promise((resolve,reject)=>{
   let rejected=false;const req=this.factory!.open(this.name,1);
   req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('preferences'))req.result.createObjectStore('preferences')};
   req.onerror=()=>{invalidate();reject(new Error('PREFERENCES_OPEN_FAILED'))};
   req.onblocked=()=>{rejected=true;invalidate();reject(new Error('PREFERENCES_BLOCKED'))};
   req.onsuccess=()=>{const db=req.result;if(rejected){db.close();return}db.onversionchange=()=>{db.close();invalidate()};db.onclose=invalidate;resolve(db)};
  });return this.db;
 }
 private async beginTransaction(retryBeforeRead=false):Promise<IDBTransaction>{
  const invalid=(error:unknown)=>error!==null&&typeof error==='object'&&'name' in error&&error.name==='InvalidStateError';
  const acquire=async()=>{const opened=this.open(),db=await opened;try{return db.transaction('preferences','readwrite')}catch(error){if(invalid(error)&&this.db===opened){this.db=null;this.generation++}throw error}};
  // Only retry acquisition before any transaction/request exists. Never retry
  // a write callback, an aborted transaction or a possibly committed save.
  try{return await acquire()}catch(error){if(retryBeforeRead&&invalid(error))return acquire();throw error}
 }
 async load():Promise<PreferencesRecord>{const tx=await this.beginTransaction(true);return new Promise((resolve,reject)=>{let value:PreferencesRecord;let failure:unknown;tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(failure??new Error('PREFERENCES_READ_FAILED'));tx.onerror=()=>{};const store=tx.objectStore('preferences'),req=store.get('default');req.onsuccess=()=>{try{if(req.result===undefined){value={revision:1,value:this.legacy?readSystemState(this.legacy):defaultSystemState()};store.put(value,'default')}else value=checked(req.result)}catch(error){failure=error;tx.abort()}}})}
 async save(expectedRevision:number,change:(current:SystemState)=>SystemState):Promise<PreferencesRecord>{if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1)throw new Error('PREFERENCES_REVISION');const tx=await this.beginTransaction();return new Promise((resolve,reject)=>{let value:PreferencesRecord;let failure:unknown;tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(failure??new Error('PREFERENCES_WRITE_FAILED'));tx.onerror=()=>{};const store=tx.objectStore('preferences'),req=store.get('default');req.onsuccess=()=>{try{const current=checked(req.result);if(current.revision!==expectedRevision)throw new Error('PREFERENCES_CONFLICT: Eine andere Sitzung hat Studio-Daten gespeichert. Vor weiteren Änderungen App neu laden.');if(current.revision===Number.MAX_SAFE_INTEGER)throw new Error('PREFERENCES_REVISION_LIMIT');value={revision:current.revision+1,value:parseSystemState(change(current.value))};store.put(value,'default')}catch(error){failure=error;tx.abort()}}})}
 close(){const current=this.db;this.db=null;this.generation++;void current?.then(db=>db.close()).catch(()=>{})}
}
