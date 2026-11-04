/** Node filesystem adapter only. The portable core never imports this file. */
import {createEventStore} from './events.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {canonical,copy,safeRelative,validateManifest,parseSkill,parseJsonStrict} from './contract.mjs';
const digest=s=>'sha256:'+createHash('sha256').update(s).digest('hex');
export function hashManifest(manifest) {const {versionHash:ignored,...rest}=manifest;return digest(canonical(rest));}
function assertPath(target,finalType='file') {
 const absolute=path.resolve(target);let cursor=path.parse(absolute).root;
 for(const segment of absolute.slice(cursor.length).split(path.sep).filter(Boolean)) {
  cursor=path.join(cursor,segment);const stat=fs.lstatSync(cursor);
  if(stat.isSymbolicLink()) throw new Error('Symlink refused');
  if(cursor!==absolute && !stat.isDirectory()) throw new Error('Non-directory ancestor');
 }
 const st=fs.lstatSync(absolute);
 if(st.isFile() && st.nlink!==1) throw new Error('Hard link refused');
 if(finalType==='file' ? !st.isFile() : !st.isDirectory()) throw new Error('Special file or wrong type refused');
 return absolute;
}
function readBounded(filename,budget) {
 assertPath(filename);const fd=fs.openSync(filename,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
 try {
  const before=fs.fstatSync(fd);if(!before.isFile() || before.size>budget) throw new Error('File size budget exceeded');
  const buffer=Buffer.alloc(budget+1);let n=0,read;
  while(n<buffer.length && (read=fs.readSync(fd,buffer,n,buffer.length-n,null))>0) n+=read;
  const after=fs.fstatSync(fd);if(n>budget) throw new Error('File size budget exceeded');
  if(before.ino!==after.ino || before.size!==after.size || before.mtimeMs!==after.mtimeMs) throw new Error('File changed during read');
  return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(buffer.subarray(0,n));
 } finally {fs.closeSync(fd);}
}
function inventory(dir,prefix='',counter={n:0}) {
 const result=[];
 for(const name of fs.readdirSync(dir).sort()) {
  if(++counter.n>128) throw new Error('Directory entry budget exceeded');
  const absolute=path.join(dir,name),relative=prefix+name,st=fs.lstatSync(absolute);
  if(st.isSymbolicLink()) throw new Error('Symlink refused');
  if(st.isDirectory()) {if(prefix || !['assets','references'].includes(name)) throw new Error('Unsupported resource directory');result.push(...inventory(absolute,relative+'/',counter));}
  else if(st.isFile()) {if(st.nlink!==1) throw new Error('Hard link refused');result.push(relative);}
  else throw new Error('Special file refused');
 }
 return result;
}
export function createCatalog({root,limits={}}) {
 const budgets={metadataBytes:65536,fileBytes:131072,...limits};
 for(const v of Object.values(budgets)) if(!Number.isSafeInteger(v) || v<1 || v>1048576) throw new Error('Invalid size budget');
 root=assertPath(root,'directory');const entries=new Map(),log=createEventStore();
 const folders=fs.readdirSync(root).sort();if(folders.length>64) throw new Error('Skill count budget exceeded');
 for(const folder of folders) {
  safeRelative(folder);const dir=assertPath(path.join(root,folder),'directory');
  const files=inventory(dir);const raw=readBounded(path.join(dir,'cue-skill.json'),budgets.metadataBytes);const m=parseJsonStrict(raw);
  validateManifest(m,folder);if(hashManifest(m)!==m.versionHash) throw new Error('Manifest version hash mismatch');
  if(entries.has(m.id)) throw new Error('Duplicate skill id');
  const declared=new Set(['cue-skill.json',...m.files.map(f=>f.path)]);
  if(files.length!==declared.size || files.some(f=>!declared.has(f))) throw new Error('Undeclared or missing resource');
  entries.set(m.id,{dir,m});log.append({id:m.id,stage:'metadata',versionHash:m.versionHash});
 }
 function entry(id) {const e=entries.get(id);if(!e) throw new Error('Unknown skill');return e;}
 function load(id,p,stage) {
  safeRelative(p);const {dir,m}=entry(id);const declared=m.files.find(f=>f.path===p && f.stage===stage);if(!declared) throw new Error('Undeclared resource or stage mismatch');
  const raw=readBounded(path.join(dir,p),budgets.fileBytes);if(digest(raw)!==declared.sha256) throw new Error('Content hash mismatch');
  log.append({id,stage,path:p,versionHash:m.versionHash});return raw;
 }
 const api={
  list:()=>Array.from(entries.values(),({m})=>copy(m)),
  loadInstructions(id) {const m=entry(id).m;return parseSkill(load(id,'SKILL.md','instruction'),m).body;},
  loadResource:(id,p)=>load(id,p,'resource'),
  verify(id) {
   try {const {m,dir}=entry(id);const disk=parseJsonStrict(readBounded(path.join(dir,'cue-skill.json'),budgets.metadataBytes));if(hashManifest(disk)!==m.versionHash || disk.versionHash!==m.versionHash) throw new Error('Manifest changed; rebuild catalog');
    const files=inventory(dir);const allowed=new Set(['cue-skill.json',...m.files.map(f=>f.path)]);if(files.length!==allowed.size || files.some(f=>!allowed.has(f))) throw new Error('Package inventory changed');
    api.loadInstructions(id);for(const f of m.files) if(f.stage==='resource') api.loadResource(id,f.path);
    return {status:'passed',versionHash:m.versionHash};
   } catch(error) {return {status:'failed',reason:error.message};}
  },
  events:options=>log.read(options),
  historyInfo:()=>log.info()
 };
 return Object.freeze(api);
}
