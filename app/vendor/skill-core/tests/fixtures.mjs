import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
export const digest = s => 'sha256:' + createHash('sha256').update(s).digest('hex');
export const canonical = v => Array.isArray(v) ? '[' + v.map(canonical).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}' : JSON.stringify(v);
export const versionHash = m => { const {versionHash: ignored, ...rest} = m; return digest(canonical(rest)); };
export const objectSchema = properties => ({type:'object', properties, required:Object.keys(properties), additionalProperties:false});
export function fixture(t, {id='cue.test', name='test-skill', tools=[], handler='mission-check', triggers, instruction, resource}={}) {
 const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cue-skill-')); t.after(() => fs.rmSync(root,{recursive:true,force:true}));
 const dir = path.join(root,name); fs.mkdirSync(path.join(dir,'references'),{recursive:true});
 const body = instruction ?? 'Check only supplied data. Never claim external verification.';
 const skill = `---\nname: "${name}"\ndescription: "Checks a test mission when requested."\n---\n\n${body}\n`;
 const ref = resource ?? 'Reference data only.';
 fs.writeFileSync(path.join(dir,'SKILL.md'),skill); fs.writeFileSync(path.join(dir,'references/help.md'),ref);
 const manifest = {namespace:'cue.command-mesh.skill/v1', id,version:'1.0.0',name,description:'Checks a test mission when requested.',triggers:triggers ?? {intents:['mission-check'],anyTags:['mission'],allTags:[],excludeTags:['delete'],nodeTypes:[]},inputSchema:objectSchema({title:{type:'string',maxLength:200},steps:{type:'array',maxItems:100,items:objectSchema({title:{type:'string'},done:{type:'boolean'}})}}),outputSchema:objectSchema({mode:{type:'string',enum:['offline-deterministic']},title:{type:'string'},stepCount:{type:'integer'},completedCount:{type:'integer'},issues:{type:'array',items:{type:'string'}}}),tools,handler,files:[{path:'SKILL.md',stage:'instruction',sha256:digest(skill)},{path:'references/help.md',stage:'resource',sha256:digest(ref)}]};
 function save() {manifest.versionHash=versionHash(manifest); fs.writeFileSync(path.join(dir,'cue-skill.json'),JSON.stringify(manifest,null,2));}
 save(); return {root,dir,manifest,save,skill,ref};
}
export function evidenceClaims(manifest, overrides={}) {return {skillApprovals:[{id:manifest.id,versionHash:manifest.versionHash,test:{status:'passed',runId:'local-test-1'}}],tools:manifest.tools.map(t=>({id:t.id,catalogued:true,configured:true,authenticated:t.authentication==='none' ? 'not-required' : true,authorized:true,permissions:t.permissions,check:{status:'passed',runId:'local-tool-1'}})),...overrides};}
