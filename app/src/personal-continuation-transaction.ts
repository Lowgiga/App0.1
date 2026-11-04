import type {WorkState} from '../upstream/lib/work-contract.ts';
import {LocalStateError,storageError} from './local-errors.ts';
import {MEMORY_KEY,decodeProjectMemory} from './project-memory.ts';
import {PERSONAL_CONTINUATION_KEY,PERSONAL_VIEW_KEY,parsePersonalContinuationRequest,decodePersonalContinuation,decodePersonalView,personalContinuationSnapshot,rememberPersonalView,applyPersonalContinuation} from './personal-continuation.ts';

/** One transaction on the existing work store. Never writes local-default or backups. */
export function personalContinuationTransaction(db:IDBDatabase,decodeWork:(value:unknown)=>WorkState,input:unknown,now:()=>Date,current:()=>boolean,signal?:AbortSignal|null):Promise<unknown>{
 const request=parsePersonalContinuationRequest(input),writing=request.operation!=='read'&&request.operation!=='read-view';
 const aborted=()=>new DOMException('Lokale Anfrage abgebrochen.','AbortError');
 if(signal?.aborted)throw aborted();if(!current())throw storageError(undefined);
 return new Promise((resolve,reject)=>{
  let tx:IDBTransaction;try{tx=db.transaction('work',writing?'readwrite':'readonly')}catch(error){reject(storageError(error));return}
  const store=tx.objectStore('work');let output:unknown,failure:unknown;
  const abort=()=>{failure=aborted();try{tx.abort()}catch{}};
  signal?.addEventListener('abort',abort,{once:true});const cleanup=()=>signal?.removeEventListener('abort',abort);
  tx.onabort=()=>{cleanup();reject(failure??storageError(tx.error))};tx.onerror=()=>{failure??=storageError(tx.error)};
  tx.oncomplete=()=>{cleanup();if(failure||!current())reject(failure??storageError(undefined));else resolve(output)};
  const put=(value:unknown,key:string)=>{
   const request=store.put(value,key);request.onerror=()=>{failure??=storageError(request.error)};
   request.onsuccess=()=>{if(signal?.aborted||!current()){failure=signal?.aborted?aborted():storageError(undefined);try{tx.abort()}catch{}}};
  };
  const values:unknown[]=[],keys=['local-default',MEMORY_KEY,PERSONAL_CONTINUATION_KEY,PERSONAL_VIEW_KEY];let received=0;
  keys.forEach((key,index)=>{
   const presence=store.getKey(key),read=store.get(key);read.onerror=()=>{failure??=storageError(read.error)};
   read.onsuccess=()=>{
    try{
     if(presence.result!==undefined&&read.result===undefined)throw new LocalStateError('CORRUPT_STORAGE','Persönliche Fortsetzung enthält einen beschädigten Speicherwert. Nichts wird überschrieben.');
     values[index]=read.result;if(++received!==keys.length)return;
     if(signal?.aborted)throw aborted();if(!current())throw storageError(undefined);
     const work=decodeWork(values[0]),memory=decodeProjectMemory(values[1]),records=decodePersonalContinuation(values[2]),view=decodePersonalView(values[3]);
     if(request.operation==='read-view')output=view;
     else if(request.operation==='remember'){output=rememberPersonalView(view,work,request,now());if(signal?.aborted)throw aborted();if(!current())throw storageError(undefined);put(output,PERSONAL_VIEW_KEY)}
     else if(request.operation==='read')output=personalContinuationSnapshot(records,memory,work,request);
     else{
      const result=applyPersonalContinuation(records,memory,work,request,now());
      if(signal?.aborted)throw aborted();if(!current())throw storageError(undefined);
      if(result.memoryChanged)put(result.memory,MEMORY_KEY);
      if(result.records!==records)put(result.records,PERSONAL_CONTINUATION_KEY);
      output=personalContinuationSnapshot(result.records,result.memory,work,request);
     }
    }catch(error){failure=error instanceof DOMException&&error.name==='AbortError'?error:storageError(error);try{tx.abort()}catch{}}
   };
  });
  if(signal?.aborted)abort();
 });
}
