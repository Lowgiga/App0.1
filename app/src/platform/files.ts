export const MAX_EXPORT_BYTES=8*1024*1024;
export type SaveRequest={name:string;text:string;mime:'application/json'|'text/markdown'|'text/plain'};
export type SaveResult={status:'saved'|'cancelled'|'dispatched'};
type Writable={write:(text:string)=>Promise<void>;close:()=>Promise<void>;abort:()=>Promise<void>};
export type FileDrivers={native:boolean;saveNative?:(request:SaveRequest)=>Promise<unknown>;pickSave?:(request:SaveRequest)=>Promise<{createWritable:()=>Promise<Writable>}>;download?:(request:SaveRequest)=>void};
export function createFileService(drivers:FileDrivers):{save:(request:SaveRequest)=>Promise<SaveResult>}{
 let pending=false;
 return {async save(input){
  if(pending)throw new Error('EXPORT_BUSY');
  if(!input||typeof input.text!=='string'||typeof input.name!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(input.name)||!['application/json','text/markdown','text/plain'].includes(input.mime))throw new Error('INVALID_EXPORT');
  if(new TextEncoder().encode(input.text).length>MAX_EXPORT_BYTES)throw new Error('EXPORT_SIZE_LIMIT');
  const request={...input};pending=true;
  try {
   if(drivers.native){if(!drivers.saveNative)throw new Error('NATIVE_EXPORT_UNAVAILABLE');const result=await drivers.saveNative(request);if(!result||typeof result!=='object'||Object.keys(result).length!==1||!('status' in result)||!['saved','cancelled'].includes(String(result.status)))throw new Error('INVALID_RESULT');return result as SaveResult}
   if(drivers.pickSave){let writable:Writable|undefined;try{const handle=await drivers.pickSave(request);writable=await handle.createWritable();await writable.write(request.text);await writable.close();return{status:'saved'}}catch(error){if(writable)await writable.abort().catch(()=>{});if(!writable&&error instanceof Error&&error.name==='AbortError')return{status:'cancelled'};throw error}}
   if(!drivers.download)throw new Error('EXPORT_UNAVAILABLE');drivers.download(request);return{status:'dispatched'};
  }finally{pending=false}
 }};
}
