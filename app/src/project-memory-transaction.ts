import type {WorkState} from '../upstream/lib/work-contract.ts';
import {LocalStateError,storageError} from './local-errors.ts';
import {MEMORY_KEY,decodeProjectMemory,projectContext,memoryForContext,applyProjectMemory,projectMemoryExport,parseMemoryRequest,memoryBackupRequestContract} from './project-memory.ts';

/** Uses the existing LocalWorkStore database and object store; no shadow WorkState or new database. */
export function projectMemoryTransaction(db:IDBDatabase,decodeWork:(value:unknown)=>WorkState,input:unknown,backup:boolean,now:()=>Date,current:()=>boolean,signal?:AbortSignal|null):Promise<unknown>{
 const request=backup?null:parseMemoryRequest(input),backupRequest=backup?memoryBackupRequestContract.safeParse(input):null;
 if(backupRequest&&!backupRequest.success)throw new LocalStateError('VALIDATION','Ungültige Backuprevision.',400);
 const writing=request&&'expectedRevision' in request;
 const aborted=()=>new DOMException('Lokale Anfrage abgebrochen.','AbortError');
 if(signal?.aborted)throw aborted();
 if(!current())throw storageError(undefined);
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('work',writing?'readwrite':'readonly'),store=tx.objectStore('work');let output:unknown,failure:unknown;
  const abort=()=>{failure=aborted();try{tx.abort()}catch{}};
  signal?.addEventListener('abort',abort,{once:true});const cleanup=()=>signal?.removeEventListener('abort',abort);
  tx.onabort=()=>{cleanup();reject(failure??storageError(tx.error))};tx.onerror=()=>{failure??=storageError(tx.error)};
  tx.oncomplete=()=>{cleanup();if(failure||!current())reject(failure??storageError(undefined));else resolve(output)};
  const workRequest=store.get('local-default');
  workRequest.onsuccess=()=>{try{
   const work=decodeWork(workRequest.result),memoryRequest=store.get(MEMORY_KEY);
   memoryRequest.onsuccess=()=>{try{
    if(!current())throw storageError(undefined);
    const memory=decodeProjectMemory(memoryRequest.result);
    if(backupRequest?.success){if(work.updatedAt!==backupRequest.data.expectedWorkUpdatedAt)throw new LocalStateError('CONFLICT','Arbeitsstand vor Backup geändert. Neu laden und erneut prüfen.',409);output=memory;return}
    if(!request)throw storageError(undefined);
    const room=projectContext(work,request.contextId);
    if(writing){const result=applyProjectMemory(memory,work,request,now());store.put(result,MEMORY_KEY);output=memoryForContext(result,room)}
    else{const record=memoryForContext(memory,room);output=request.operation==='export'?projectMemoryExport(record):request.operation==='search'?{...record,entries:record.entries.filter(e=>!['forgotten','superseded'].includes(e.status)&&e.text.toLocaleLowerCase().includes(request.query.toLocaleLowerCase()))}:record}
   }catch(e){failure=e;tx.abort()}};
  }catch(e){failure=e;tx.abort()}};
  if(signal?.aborted)abort();
 });
}
