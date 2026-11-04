/** Portable data contracts. No filesystem, shell, imports from packages, or network. */
const forbidden = new Set(['__proto__','prototype','constructor']);
export const utf8Bytes = value => new TextEncoder().encode(value).byteLength;
export const canonical = value => Array.isArray(value) ? '['+value.map(canonical).join(',')+']' : value !== null && typeof value === 'object' ? '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}' : JSON.stringify(value);
export function assertJson(value, depth=0, counter={n:0}) {
 if(depth>32 || ++counter.n>20000) throw new Error('JSON complexity budget exceeded');
 if(value===null || typeof value==='string' || typeof value==='boolean' || (typeof value==='number' && Number.isFinite(value))) return;
 if(typeof value!=='object' || (!Array.isArray(value) && Object.getPrototypeOf(value)!==Object.prototype && Object.getPrototypeOf(value)!==null)) throw new Error('JSON values only');
 if(Array.isArray(value) && (value.length>20000 || Object.keys(value).length!==value.length || Object.keys(value).some((key,i)=>key!==String(i)))) throw new Error('Sparse or extended JSON array refused');
 for(const [key,descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
  if(Array.isArray(value) && key==='length') continue;
  if(forbidden.has(key) || !('value' in descriptor)) throw new Error('Unsafe JSON field');
  assertJson(descriptor.value,depth+1,counter);
 }
}
export const copy = value => { assertJson(value);return JSON.parse(JSON.stringify(value)); };
export function exactFields(value, allowed, required=allowed, label='contract') {
 if(!value || typeof value!=='object' || Array.isArray(value)) throw new Error(`${label}: object required`);
 for(const key of Object.keys(value)) if(!allowed.includes(key)) throw new Error(`${label}: unknown field ${key}`);
 for(const key of required) if(!Object.hasOwn(value,key)) throw new Error(`${label}: missing field ${key}`);
}
const text = (value,max=1024) => typeof value==='string' && value.trim().length>0 && value.length<=max;
const token = value => text(value,100) && /^[a-z0-9]+(?:[.:-][a-z0-9]+)*$/.test(value);
export function stringList(value,{max=64,tokens=false}={}) {
 if(!Array.isArray(value) || value.length>max || new Set(value).size!==value.length || value.some(v=>tokens ? !token(v) : !text(v))) throw new Error('Invalid unique string list');
}
export function safeRelative(p) {
 if(typeof p!=='string' || p.length>240 || !/^[a-zA-Z0-9_./-]+$/.test(p) || p.startsWith('/') || p.split('/').some(s=>s==='' || s==='.' || s==='..')) throw new Error('Unsafe relative path');
 return p;
}
const schemaKeys={object:['type','properties','required','additionalProperties'],array:['type','items','maxItems','minItems'],string:['type','enum','maxLength','minLength'],number:['type','enum','minimum','maximum'],integer:['type','enum','minimum','maximum'],boolean:['type','enum'],null:['type','enum']};
export function validateSchema(schema,depth=0) {
 if(depth===0) assertJson(schema);
 if(depth>16 || !schema || typeof schema.type!=='string' || !Object.hasOwn(schemaKeys,schema.type)) throw new Error('Unsupported schema type or depth');
 exactFields(schema,schemaKeys[schema.type],['type'],'schema keyword');
 if(schema.type==='object') {
  if(!schema.properties || typeof schema.properties!=='object' || Array.isArray(schema.properties) || schema.additionalProperties!==false || !Array.isArray(schema.required)) throw new Error('Object schema must be closed');
  stringList(schema.required);if(schema.required.some(k=>!Object.hasOwn(schema.properties,k))) throw new Error('Unknown required schema field');
  for(const s of Object.values(schema.properties)) validateSchema(s,depth+1);
 }
 if(schema.type==='array') {if(!schema.items) throw new Error('Array schema needs items');validateSchema(schema.items,depth+1);}
 for(const key of ['maxItems','minItems','maxLength','minLength']) if(key in schema && (!Number.isSafeInteger(schema[key]) || schema[key]<0 || schema[key]>100000)) throw new Error('Invalid schema bound');
 for(const key of ['minimum','maximum']) if(key in schema && (typeof schema[key]!=='number' || !Number.isFinite(schema[key]))) throw new Error('Invalid schema bound');
 if(Object.hasOwn(schema,'enum') && (!Array.isArray(schema.enum) || !schema.enum.length || schema.enum.length>100 || schema.enum.some(v=>v!==null && !['string','number','boolean'].includes(typeof v)))) throw new Error('Invalid schema enum');
 for(const [min,max] of [['minItems','maxItems'],['minLength','maxLength'],['minimum','maximum']]) if(min in schema && max in schema && schema[min]>schema[max]) throw new Error('Contradictory schema bounds');
 if(Object.hasOwn(schema,'enum') && schema.enum.some(v=>schema.type==='integer' ? !Number.isSafeInteger(v) : schema.type==='null' ? v!==null : typeof v!==schema.type)) throw new Error('Enum type differs from schema');
 return true;
}
export function validateData(schema,value) {
 validateSchema(schema);assertJson(value);const errors=[];
 function visit(s,v,p) {
  const actual=v===null?'null':Array.isArray(v)?'array':typeof v;
  if(s.type==='integer' ? !Number.isSafeInteger(v) : actual!==s.type) {errors.push(`${p}: expected ${s.type}`);return;}
  if(s.enum && !s.enum.some(e=>e===v)) errors.push(`${p}: outside enum`);
  if(s.type==='object') {
   for(const k of s.required) if(!Object.hasOwn(v,k)) errors.push(`${p}.${k}: required`);
   for(const k of Object.keys(v)) Object.hasOwn(s.properties,k) ? visit(s.properties[k],v[k],`${p}.${k}`) : errors.push(`${p}.${k}: unknown field`);
  }
  if(s.type==='array') {if(v.length>(s.maxItems??10000) || v.length<(s.minItems??0)) errors.push(`${p}: array bounds`);v.forEach((x,i)=>visit(s.items,x,`${p}[${i}]`));}
  if(s.type==='string' && (v.length>(s.maxLength??100000) || v.length<(s.minLength??0))) errors.push(`${p}: string bounds`);
  if(['number','integer'].includes(s.type) && (v<(s.minimum??-Infinity) || v>(s.maximum??Infinity))) errors.push(`${p}: number bounds`);
 }
 visit(schema,value,'$');return errors;
}
export function validateManifest(m,directoryName) {
 assertJson(m);exactFields(m,['namespace','id','version','versionHash','name','description','triggers','inputSchema','outputSchema','tools','handler','files']);
 if(m.namespace!=='cue.command-mesh.skill/v1') throw new Error('Unsupported contract namespace');
 if(typeof m.id!=='string' || !/^cue\.[a-z0-9]+(?:-[a-z0-9]+)*$/.test(m.id)) throw new Error('Invalid concrete skill id');
 if(typeof m.version!=='string' || m.version.length>64 || typeof m.versionHash!=='string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(m.version) || !/^sha256:[a-f0-9]{64}$/.test(m.versionHash)) throw new Error('Invalid version/hash');
 if(!text(m.name,64) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(m.name) || m.name!==directoryName || !text(m.description,1024)) throw new Error('Invalid standard metadata');
 exactFields(m.triggers,['intents','anyTags','allTags','excludeTags','nodeTypes']);Object.values(m.triggers).forEach(v=>stringList(v,{tokens:true}));
 if(!m.triggers.intents.length && !m.triggers.anyTags.length) throw new Error('Explicit positive trigger required');
 validateSchema(m.inputSchema);validateSchema(m.outputSchema);
 if(!Array.isArray(m.tools) || m.tools.length>32 || new Set(m.tools.map(t=>t.id)).size!==m.tools.length) throw new Error('Invalid tools');
 for(const t of m.tools) {
  exactFields(t,['id','effect','authentication','permissions']);
  if(!token(t.id) || !['local-compute','external-read','external-write'].includes(t.effect) || !['none','required'].includes(t.authentication)) throw new Error('Invalid tool requirement');
  stringList(t.permissions,{tokens:true});
 }
 if(!['mission-check','graph-explain','backup-plan','source-status'].includes(m.handler)) throw new Error('Unsupported static handler');
 if(!Array.isArray(m.files) || !m.files.length || m.files.length>32 || new Set(m.files.map(f=>f.path)).size!==m.files.length) throw new Error('Invalid files');
 let instructions=0;
 for(const f of m.files) {
  exactFields(f,['path','stage','sha256']);safeRelative(f.path);
  if(typeof f.sha256!=='string' || !/^sha256:[a-f0-9]{64}$/.test(f.sha256)) throw new Error('Invalid file hash');
  if(f.stage==='instruction' && f.path==='SKILL.md') instructions++;
  else if(f.stage!=='resource' || !/^(references|assets)\/[a-zA-Z0-9_-]+\.(md|txt|json)$/.test(f.path)) throw new Error('Unsupported resource path/type');
 }
 if(instructions!==1) throw new Error('Exactly one SKILL.md required');
 return true;
}
export function parseSkill(text,m) {
 const match=/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
 if(!match || match[1].length>8192) throw new Error('Invalid SKILL frontmatter');
 const meta={};
 for(const line of match[1].split(/\r?\n/)) {
  const item=/^([a-z-]+): (".*")$/.exec(line);
  if(!item || Object.hasOwn(meta,item[1])) throw new Error('Unsupported frontmatter syntax; use JSON quoted scalar YAML');
  meta[item[1]]=JSON.parse(item[2]);if(typeof meta[item[1]]!=='string') throw new Error('Frontmatter string required');
 }
 exactFields(meta,['name','description','compatibility','license','allowed-tools'],['name','description'],'frontmatter');
 if(meta.name!==m.name || meta.description!==m.description || (meta.compatibility && meta.compatibility.length>500)) throw new Error('Frontmatter differs from metadata');
 // allowed-tools is parsed as descriptive standard metadata only: NEVER a grant.
 return {metadata:meta,body:match[2]};
}
export async function hashManifestWeb(manifest) {
 const {versionHash:ignored,...rest}=manifest;
 const hash=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(rest)));
 return 'sha256:'+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
/** JSON syntax remains native; this extra scan rejects duplicate decoded object keys. */
export function parseJsonStrict(source) {
 const result=JSON.parse(source);let cursor=0;
 const whitespace=()=>{while(/\s/.test(source[cursor]??'') && cursor<source.length) cursor++;};
 function stringToken() {
  const begin=cursor++;
  while(cursor<source.length) {if(source[cursor]==='\\') cursor+=2;else if(source[cursor++]==='"') break;}
  return JSON.parse(source.slice(begin,cursor));
 }
 function scan(depth=0) {
  if(depth>32) throw new Error('JSON depth budget exceeded');whitespace();
  if(source[cursor]==='{') {
   cursor++;whitespace();const keys=new Set();
   if(source[cursor]==='}') {cursor++;return;}
   while(cursor<source.length) {
    whitespace();const key=stringToken();if(keys.has(key)) throw new Error('Duplicate JSON key');keys.add(key);
    whitespace();cursor++;scan(depth+1);whitespace();if(source[cursor++]==='}') return;
   }
  } else if(source[cursor]==='[') {
   cursor++;whitespace();if(source[cursor]===']') {cursor++;return;}
   while(cursor<source.length) {scan(depth+1);whitespace();if(source[cursor++]===']') return;}
  } else if(source[cursor]==='"') stringToken();
  else while(cursor<source.length && !/[\s,}\]]/.test(source[cursor])) cursor++;
 }
 scan();assertJson(result);return result;
}
