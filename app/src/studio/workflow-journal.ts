/** Local, host-only journal. This store validates structure; the host verifies catalog and output hashes. */
export type WorkflowJournal={
 schema:'cue.workflow-journal/v1';
 createdAt:string;
 updatedAt:string;
 sourceUpdatedAt:string|null;
 sourceHash:string;
 spec:any;
 checkpoint:any;
 pendingStepId:string|null;
};
export type JournalRecord={revision:number;value:WorkflowJournal};
type Options={indexedDB?:IDBFactory;name?:string};
const OBJECT_STORE='journal',CURRENT_KEY='current';
const MAX_BYTES=2*1024*1024,MAX_PAYLOAD_BYTES=131072,MAX_STRING=131072,MAX_DEPTH=24,MAX_NODES=20000;
const forbidden=new Set(['__proto__','prototype','constructor']);
const states=new Set(['running','paused','completed','aborted','failed','budget-exhausted']);
const kinds=new Set(['inspect-mission','validate-local-result','run-offline-skill']);
const encoder=new TextEncoder();

export class WorkflowJournalError extends Error {
 readonly code:string;
 constructor(suffix:string){const code='WORKFLOW_JOURNAL_'+suffix;super(code);this.name='WorkflowJournalError';this.code=code;}
}
function fail(suffix:string):never {throw new WorkflowJournalError(suffix)}
function failure(error:unknown,fallback:string):WorkflowJournalError {
 if(error instanceof WorkflowJournalError)return error;
 const name=error&&typeof error==='object'&&'name' in error?error.name:null;
 return new WorkflowJournalError(name==='QuotaExceededError'?'QUOTA':name==='VersionError'?'VERSION':fallback);
}
function id(value:unknown):boolean{return typeof value==='string'&&/^[a-z0-9][a-z0-9.-]{0,99}$/.test(value)}
function hash(value:unknown):boolean{return typeof value==='string'&&/^sha256:[a-f0-9]{64}$/.test(value)}
function version(value:unknown):boolean{return typeof value==='string'&&value.length<=64&&/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)}
function exact(value:any,required:string[],optional:string[]=[]):void {
 if(!value||typeof value!=='object'||Array.isArray(value)||required.some(key=>!Object.hasOwn(value,key))||Object.keys(value).some(key=>!required.includes(key)&&!optional.includes(key)))fail('CORRUPT');
}
function iso(value:unknown,arbitraryFraction=false):boolean {
 if(typeof value!=='string')return false;
 const match=/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?Z$/.exec(value);
 if(!match||!arbitraryFraction&&(match[2]?.length??0)>3)return false;
 // Check the UTC calendar independently; source revision precision is kept verbatim.
 const calendar=match[1]+'.000Z',time=Date.parse(calendar);
 return Number.isFinite(time)&&new Date(time).toISOString()===calendar;
}
function bytes(value:unknown,maximum:number):string {
 const encoded=JSON.stringify(value);if(encoder.encode(encoded).byteLength>maximum)fail('LIMIT');return encoded;
}
/** Descriptor-first traversal never invokes accessors or toJSON, and rejects lossy JSON. */
function snapshot(value:unknown):any {
 let nodes=0;
 const ancestors=new Set<object>();
 function check(current:any,depth:number):void {
  if(depth>MAX_DEPTH||++nodes>MAX_NODES)fail('LIMIT');
  if(current===null||typeof current==='boolean'||typeof current==='number'&&Number.isFinite(current))return;
  if(typeof current==='string'){if(current.length>MAX_STRING)fail('LIMIT');return;}
  if(typeof current!=='object')fail('CORRUPT');
  const array=Array.isArray(current),prototype=Object.getPrototypeOf(current);
  if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)fail('CORRUPT');
  if(ancestors.has(current))fail('CORRUPT');
  if(Object.getOwnPropertySymbols(current).length)fail('CORRUPT');
  if(array&&current.length>MAX_NODES)fail('LIMIT');
  const descriptors=Object.getOwnPropertyDescriptors(current);
  if(array){const keys=Object.keys(descriptors).filter(key=>key!=='length');if(keys.length!==current.length||keys.some((key,index)=>key!==String(index)))fail('CORRUPT');}
  ancestors.add(current);
  for(const [key,descriptor] of Object.entries(descriptors)){
   if(array&&key==='length')continue;
   if(key.length>MAX_STRING)fail('LIMIT');
   if(forbidden.has(key)||!descriptor.enumerable||!('value' in descriptor))fail('CORRUPT');
   check(descriptor.value,depth+1);
  }
  ancestors.delete(current);
 }
 try{check(value,0);return JSON.parse(bytes(value,MAX_BYTES));}catch(error){throw failure(error,'CORRUPT')}
}

export function validateJournal(value:unknown):WorkflowJournal {
 const result=snapshot(value);
 exact(result,['schema','createdAt','updatedAt','sourceUpdatedAt','sourceHash','spec','checkpoint','pendingStepId']);
 if(result.schema!=='cue.workflow-journal/v1')fail('SCHEMA');
 if(!iso(result.createdAt)||!iso(result.updatedAt)||Date.parse(result.updatedAt)<Date.parse(result.createdAt)||result.sourceUpdatedAt!==null&&!iso(result.sourceUpdatedAt,true)||!hash(result.sourceHash))fail('CORRUPT');
 const {spec,checkpoint}=result;
 exact(spec,['namespace','pipelineId','limits','steps']);
 if(spec.namespace!=='cue.local-pipeline/v1'||!id(spec.pipelineId))fail('CORRUPT');
 exact(spec.limits,['maxSteps','maxElapsedMs']);
 const {maxSteps,maxElapsedMs}=spec.limits;
 if(!Number.isSafeInteger(maxSteps)||maxSteps<1||maxSteps>8||!Number.isSafeInteger(maxElapsedMs)||maxElapsedMs<1||maxElapsedMs>1000)fail('CORRUPT');
 if(!Array.isArray(spec.steps)||spec.steps.length<1||spec.steps.length>maxSteps)fail('CORRUPT');
 const ids=new Set<string>();
 for(const step of spec.steps){
  exact(step,['stepId','kind','skillId','version','versionHash','input']);
  if(!id(step.stepId)||ids.has(step.stepId)||!kinds.has(step.kind)||!id(step.skillId)||!version(step.version)||!hash(step.versionHash))fail('CORRUPT');
  ids.add(step.stepId);bytes(step.input,MAX_PAYLOAD_BYTES);
 }
 exact(checkpoint,['namespace','pipelineId','revisionHash','nextStepIndex','completed','state'],['code']);
 if(checkpoint.namespace!=='cue.local-checkpoint/v1'||checkpoint.pipelineId!==spec.pipelineId||!hash(checkpoint.revisionHash)||!states.has(checkpoint.state))fail('CORRUPT');
 if(!Number.isSafeInteger(checkpoint.nextStepIndex)||checkpoint.nextStepIndex<0||checkpoint.nextStepIndex>spec.steps.length||!Array.isArray(checkpoint.completed)||checkpoint.completed.length!==checkpoint.nextStepIndex)fail('CORRUPT');
 if(checkpoint.state==='completed'&&checkpoint.nextStepIndex!==spec.steps.length)fail('CORRUPT');
 if(Object.hasOwn(checkpoint,'code')&&(typeof checkpoint.code!=='string'||!/^[A-Z_]{1,60}$/.test(checkpoint.code)))fail('CORRUPT');
 for(let index=0;index<checkpoint.completed.length;index++){
  const completed=checkpoint.completed[index],step=spec.steps[index];
  exact(completed,['stepId','skillId','version','versionHash','inputHash','outputHash','output']);
  if(['stepId','skillId','version','versionHash'].some(key=>completed[key]!==step[key])||!hash(completed.inputHash)||!hash(completed.outputHash))fail('CORRUPT');
  bytes(completed.output,MAX_PAYLOAD_BYTES);
 }
 if(result.pendingStepId!==null&&(!id(result.pendingStepId)||checkpoint.state!=='running'||result.pendingStepId!==spec.steps[checkpoint.nextStepIndex]?.stepId))fail('CORRUPT');
 return result as WorkflowJournal;
}
function checkedRecord(raw:unknown):JournalRecord {
 // Check the envelope without imposing an extra JSON-depth level on its value.
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||![Object.prototype,null].includes(Object.getPrototypeOf(raw))||Object.getOwnPropertySymbols(raw).length)fail('CORRUPT');
 const descriptors=Object.getOwnPropertyDescriptors(raw);
 if(Object.keys(descriptors).sort().join(',')!=='revision,value'||Object.values(descriptors).some(descriptor=>!descriptor.enumerable||!('value' in descriptor)))fail('CORRUPT');
 const revision=descriptors.revision.value;
 if(!Number.isSafeInteger(revision)||revision<1)fail('CORRUPT');
 const value=validateJournal(descriptors.value.value),record={revision,value};
 bytes(record,MAX_BYTES);return record;
}

/** A single current journal, with IndexedDB-transaction CAS and no reset or migration path. */
export class WorkflowJournalStore {
 private db:Promise<IDBDatabase>|null=null;
 private readonly factory:IDBFactory|undefined;
 private readonly name:string;
 private closed=false;
 constructor(options:Options={}){this.factory=options.indexedDB??globalThis.indexedDB;this.name=options.name??'cue-system-workflow-journal-v1';}
 private open():Promise<IDBDatabase>{
  if(this.closed)return Promise.reject(new WorkflowJournalError('CLOSED'));
  if(this.db)return this.db;
  if(!this.factory)return Promise.reject(new WorkflowJournalError('UNAVAILABLE'));
  const opening=new Promise<IDBDatabase>((resolve,reject)=>{
   let abandoned=false;
   const refuse=(error:WorkflowJournalError)=>{abandoned=true;reject(error)};
   let request:IDBOpenDBRequest;
   try{request=this.factory!.open(this.name,1)}catch(error){refuse(failure(error,'OPEN_FAILED'));return}
   request.onupgradeneeded=event=>{
    if(abandoned||this.closed){request.transaction?.abort();return}
    // Only a brand-new database is initialized. Existing unknown layouts are never repaired.
    if(event.oldVersion!==0){refuse(new WorkflowJournalError('SCHEMA'));request.transaction?.abort();return}
    try{request.result.createObjectStore(OBJECT_STORE)}catch(error){refuse(failure(error,'OPEN_FAILED'));request.transaction?.abort()}
   };
   request.onerror=()=>refuse(this.closed?new WorkflowJournalError('CLOSED'):failure(request.error,'OPEN_FAILED'));
   request.onblocked=()=>refuse(new WorkflowJournalError('BLOCKED'));
   request.onsuccess=()=>{
    const db=request.result;
    if(abandoned||this.closed){db.close();if(this.closed)refuse(new WorkflowJournalError('CLOSED'));return}
    if(db.objectStoreNames.length!==1||!db.objectStoreNames.contains(OBJECT_STORE)){db.close();refuse(new WorkflowJournalError('SCHEMA'));return}
    try{const store=db.transaction(OBJECT_STORE,'readonly').objectStore(OBJECT_STORE);if(store.keyPath!==null||store.autoIncrement||store.indexNames.length)fail('SCHEMA')}catch(error){db.close();refuse(failure(error,'SCHEMA'));return}
    db.onversionchange=()=>{db.close();if(this.db===opening)this.db=null};
    resolve(db);
   };
  });
  this.db=opening;
  void opening.catch(()=>{if(this.db===opening)this.db=null});
  return opening;
 }
 private async transact(mode:IDBTransactionMode,change?:(current:JournalRecord|null)=>JournalRecord):Promise<JournalRecord|null>{
  const db=await this.open();
  if(this.closed)fail('CLOSED');
  return new Promise((resolve,reject)=>{
   const fallback=mode==='readonly'?'READ_FAILED':'WRITE_FAILED';
   let tx:IDBTransaction;
   try{tx=db.transaction(OBJECT_STORE,mode)}catch(error){reject(failure(error,fallback));return}
   let result:JournalRecord|null=null,ready=false,error:WorkflowJournalError|undefined;
   tx.oncomplete=()=>{if(ready)resolve(result);else reject(new WorkflowJournalError(fallback))};
   tx.onabort=()=>reject(error??failure(tx.error,fallback));
   tx.onerror=()=>{};
   const abort=(cause:unknown)=>{error=failure(cause,fallback);try{tx.abort()}catch{reject(error)}};
   const finish=(raw:unknown,present:boolean)=>{
    try{
     // Validate the previous value before either checking CAS or replacing it.
     const current=present?checkedRecord(raw):null;
     result=change?change(current):current;
     if(change)tx.objectStore(OBJECT_STORE).put(result,CURRENT_KEY);
     ready=true;
    }catch(cause){abort(cause)}
   };
   try{
    const store=tx.objectStore(OBJECT_STORE),count=store.count();
    count.onsuccess=()=>{
     if(count.result===0){finish(undefined,false);return}
     if(count.result!==1){abort(new WorkflowJournalError('SCHEMA'));return}
     try{
      const key=store.getKey(CURRENT_KEY);
      key.onsuccess=()=>{
       if(key.result===undefined){abort(new WorkflowJournalError('SCHEMA'));return}
       try{const read=store.get(CURRENT_KEY);read.onsuccess=()=>finish(read.result,true)}catch(cause){abort(cause)}
      };
     }catch(cause){abort(cause)}
    };
   }catch(cause){abort(cause)}
  });
 }
 async load():Promise<JournalRecord|null>{return this.transact('readonly')}
 async save(expectedRevision:number|null,value:WorkflowJournal):Promise<JournalRecord>{
  if(this.closed)fail('CLOSED');
  if(expectedRevision!==null&&(!Number.isSafeInteger(expectedRevision)||expectedRevision<1))fail('REVISION');
  // No caller-owned data crosses the first asynchronous boundary.
  const safe=validateJournal(value);
  return await this.transact('readwrite',current=>{
   if((current?.revision??null)!==expectedRevision)fail('CONFLICT');
   if(current?.revision===Number.MAX_SAFE_INTEGER)fail('REVISION_LIMIT');
   const record={revision:(current?.revision??0)+1,value:safe};
   bytes(record,MAX_BYTES);return record;
  }) as JournalRecord;
 }
 close():void{this.closed=true;const current=this.db;this.db=null;void current?.then(db=>db.close()).catch(()=>{})}
}
