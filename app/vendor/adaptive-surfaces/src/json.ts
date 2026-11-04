export class SurfaceError extends Error { constructor(public code:string) {super(code)} }
const forbidden = new Set(['__proto__','constructor','prototype']);
export const safeRef = (s:unknown):s is string => typeof s==='string' && /^[a-z][a-z0-9_-]{0,63}$/.test(s) && !forbidden.has(s);
export const byteLength = (s:string) => new TextEncoder().encode(s).length;
// Strict JSON, including duplicate decoded keys. No reviver, expression or path evaluation.
export function parseBoundedJSON(raw:string,maxBytes:number,maxDepth:number,maxTextBytes:number):unknown {
 if(typeof raw!=='string')throw new SurfaceError('json-input');
 if(raw.length>maxBytes || byteLength(raw)>maxBytes)throw new SurfaceError('size');
 let i=0;const ws=()=>{while(/[\t\n\r ]/.test(raw[i]??'x'))i++};
 function str():string {const start=i++;while(i<raw.length){if(raw[i]==='"'){i++;let value:string;try{value=JSON.parse(raw.slice(start,i))}catch{throw new SurfaceError('json-syntax')}
   if(byteLength(value)>maxTextBytes)throw new SurfaceError('text-size');
   for(let j=0;j<value.length;j++){const c=value.charCodeAt(j);if(c>=0xd800&&c<=0xdbff){const next=value.charCodeAt(++j);if(!(next>=0xdc00&&next<=0xdfff))throw new SurfaceError('unicode')}else if(c>=0xdc00&&c<=0xdfff)throw new SurfaceError('unicode')}
   return value;}if(raw[i]==='\\')i++;i++}throw new SurfaceError('json-syntax')}
 function value(depth:number):unknown {if(depth>maxDepth)throw new SurfaceError('json-depth');ws();const ch=raw[i];if(ch==='"')return str();
  if(ch==='{'){i++;const out:Record<string,unknown>=Object.create(null),keys=new Set<string>();ws();if(raw[i]==='}'){i++;return out}while(i<raw.length){ws();if(raw[i]!=='"')throw new SurfaceError('json-syntax');const key=str();if(forbidden.has(key))throw new SurfaceError('prototype-key');if(keys.has(key))throw new SurfaceError('duplicate-key');keys.add(key);ws();if(raw[i++]!==':')throw new SurfaceError('json-syntax');out[key]=value(depth+1);ws();const end=raw[i++];if(end==='}')return out;if(end!==',')throw new SurfaceError('json-syntax')}throw new SurfaceError('json-syntax')}
  if(ch==='['){i++;const out:unknown[]=[];ws();if(raw[i]===']'){i++;return out}while(i<raw.length){out.push(value(depth+1));ws();const end=raw[i++];if(end===']')return out;if(end!==',')throw new SurfaceError('json-syntax')}throw new SurfaceError('json-syntax')}
  for(const [token,v] of [['true',true],['false',false],['null',null]] as const)if(raw.startsWith(token,i)){i+=token.length;return v}
  const match=/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(raw.slice(i));if(match){i+=match[0].length;const n=Number(match[0]);if(!Number.isFinite(n))throw new SurfaceError('json-number');return n}throw new SurfaceError('json-syntax')
 }
 const parsed=value(0);ws();if(i!==raw.length)throw new SurfaceError('json-syntax');return parsed;
}
export function deepFreeze<T>(value:T):T {if(value && typeof value==='object'){Object.freeze(value);for(const v of Object.values(value))deepFreeze(v)}return value}
