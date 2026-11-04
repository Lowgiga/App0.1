import {assertJson,canonical,copy,utf8Bytes} from '../../skill-core/src/contract.mjs';
/** Check option containers without evaluating accessors; option values may be host objects. */
export function plainOptions(value) {
 if(!value || typeof value!=='object' || Array.isArray(value) || ![Object.prototype,null].includes(Object.getPrototypeOf(value))) throw new Error('Plain option object required');
 if(Object.getOwnPropertySymbols(value).length) throw new Error('Symbol option field refused');
 for(const d of Object.values(Object.getOwnPropertyDescriptors(value))) if(!('value' in d)||!d.enumerable) throw new Error('Accessor or hidden option field refused');
 return value;
}
export function snapshot(value,maxBytes=1048576) {
 assertJson(value);
 function check(v) {
  if(!v || typeof v!=='object') return;
  if(Object.getOwnPropertySymbols(v).length) throw new Error('Symbol fields are not JSON');
  for(const [k,d] of Object.entries(Object.getOwnPropertyDescriptors(v))) {
   if(Array.isArray(v) && k==='length') continue;
   if(!d.enumerable) throw new Error('Hidden fields are not JSON');check(d.value);
  }
 }
 check(value);const encoded=JSON.stringify(value);
 if(utf8Bytes(encoded)>maxBytes) throw new Error('JSON byte budget exceeded');return copy(value);
}
export async function hashText(text) {
 const bytes=new TextEncoder().encode(text);
 const result=await globalThis.crypto.subtle.digest('SHA-256',bytes);
 return 'sha256:'+Array.from(new Uint8Array(result),x=>x.toString(16).padStart(2,'0')).join('');
}
export const hashJson=value=>hashText(canonical(value));
export const isHash=value=>typeof value==='string' && /^sha256:[a-f0-9]{64}$/.test(value);
export const isId=value=>typeof value==='string' && /^[a-z0-9][a-z0-9.-]{0,99}$/.test(value);
export function fail(code) {const error=new Error(code);error.code=code;throw error;}
