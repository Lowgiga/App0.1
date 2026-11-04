import {copy,exactFields,hashManifestWeb,parseJsonStrict,parseSkill,safeRelative,utf8Bytes,validateManifest} from '../../skill-core/src/contract.mjs';
import {createEventStore} from '../../skill-core/src/events.mjs';
import {bundledSkills} from './bundled-skills.mjs';
import {hashText,plainOptions,snapshot} from './data.mjs';
/** Async verification followed by a private immutable synchronous inventory. */
export async function createBrowserCatalog(options={}) {
 plainOptions(options);exactFields(options,['bundles'],[],'catalog options');
 const source=options.bundles??bundledSkills;
 if(!Array.isArray(source) || source.length<1 || source.length>64) throw new Error('Skill count budget exceeded');
 const bundles=snapshot(source,8388608),entries=new Map(),log=createEventStore();
 for(const bundle of bundles) {
  exactFields(bundle,['directory','manifest','files']);
  if(typeof bundle.directory!=='string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(bundle.directory)) throw new Error('Invalid bundle directory path');
  if(typeof bundle.manifest!=='string' || utf8Bytes(bundle.manifest)>65536) throw new Error('Manifest byte budget exceeded');
  const m=parseJsonStrict(bundle.manifest);validateManifest(m,bundle.directory);
  if(await hashManifestWeb(m)!==m.versionHash) throw new Error('Manifest version hash mismatch');
  if(entries.has(m.id)) throw new Error('Duplicate skill id');
  if(!bundle.files || Array.isArray(bundle.files) || typeof bundle.files!=='object') throw new Error('Invalid resource inventory');
  const paths=Object.keys(bundle.files);paths.forEach(safeRelative);
  if(paths.length!==m.files.length || paths.some(p=>!m.files.some(f=>f.path===p))) throw new Error('Undeclared or missing resource inventory');
  for(const f of m.files) {
   const raw=bundle.files[f.path];
   if(typeof raw!=='string' || utf8Bytes(raw)>131072) throw new Error('Resource byte budget exceeded');
   if(await hashText(raw)!==f.sha256) throw new Error('Resource content hash mismatch');
  }
  const body=parseSkill(bundle.files['SKILL.md'],m).body;
  entries.set(m.id,{m,files:bundle.files,body});log.append({type:'catalog-verified',id:m.id,versionHash:m.versionHash,status:'passed'});
 }
 const entry=id=>{const value=entries.get(id);if(!value) throw new Error('Unknown skill');return value;};
 return Object.freeze({
  list:()=>[...entries.values()].map(e=>copy(e.m)),
  loadInstructions(id) {const e=entry(id);log.append({id,stage:'instruction',versionHash:e.m.versionHash});return e.body;},
  loadResource(id,path) {
   safeRelative(path);const e=entry(id);
   if(!e.m.files.some(f=>f.path===path && f.stage==='resource')) throw new Error('Undeclared resource or stage mismatch');
   log.append({id,stage:'resource',path,versionHash:e.m.versionHash});return e.files[path];
  },
  // No mutable source remains: the complete inventory was hashed before publication.
  verify(id) {const e=entries.get(id);return e?{status:'passed',versionHash:e.m.versionHash}:{status:'failed',reason:'Unknown skill'};},
  events:options=>log.read(options),historyInfo:()=>log.info()
 });
}
