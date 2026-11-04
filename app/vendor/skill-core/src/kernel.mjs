import {createEventStore} from './events.mjs';
import {assertJson,copy,exactFields,stringList,validateData,validateManifest} from './contract.mjs';
import {builtinTools,executeBuiltin} from './handlers.mjs';
import {composePrompt} from './prompt.mjs';
const combine=values=>values.includes('no')?'no':values.includes('unknown')?'unknown':values.every(v=>v==='not-required')?'not-required':'yes';
const status=v=>v===true?'yes':v===false?'no':v==='not-required'?'not-required':'unknown';
export function createKernel({catalog,authority}) {
 if(!catalog || typeof catalog.list!=='function' || !authority || typeof authority.resolve!=='function') throw new Error('Trusted catalog adapter and host authority required');
 const entries=new Map(),verified=new Map(),log=createEventStore();
 for(const original of catalog.list()) {const m=copy(original);validateManifest(m,m.name);if(entries.has(m.id)) throw new Error('Duplicate skill id');entries.set(m.id,m);}
 const event=(type,id,detail={})=>log.append({type,...(id?{id}:{}),...detail});
 const skill=id=>{const m=entries.get(id);if(!m) throw new Error('Unknown skill');return m;};
 function effectiveTools(m) {
  const base=builtinTools[m.handler];const tools=copy(m.tools);const declared=tools.find(t=>t.id===base.id);
  if(declared) declared.permissions=[...new Set([...declared.permissions,...base.permissions])];else tools.unshift(copy(base));return tools;
 }
 function readiness(id,handle) {
  const m=skill(id),claims=authority.resolve(handle),approval=claims?.skillApprovals.find(s=>s.id===id&&s.versionHash===m.versionHash);
  const test=approval?copy(approval.test):{status:'unknown'},integrity=verified.get(id)??{status:'unknown'};
  const tools=effectiveTools(m).map(required=>{
   const evidence=claims?.tools.find(t=>t.id===required.id),known=Object.values(builtinTools).some(t=>t.id===required.id),blockers=[];
   const dimensions={catalogued:status(evidence?.catalogued),configured:status(evidence?.configured),authenticated:status(evidence?.authenticated),authorized:status(evidence?.authorized),checked:evidence?.check.status==='passed'?'yes':evidence?.check.status==='failed'?'no':'unknown'};
   if(required.authentication==='required' && dimensions.authenticated==='not-required') dimensions.authenticated='no';
   const missingPermissions=required.permissions.filter(p=>!evidence?.permissions.includes(p));
   if(required.effect==='external-write') blockers.push('external-write-disabled');
   if(required.effect!=='local-compute'||!known) blockers.push('no-offline-executor');
   for(const [key,value] of Object.entries(dimensions)) if(value!=='yes' && !(key==='authenticated' && required.authentication==='none' && value==='not-required')) blockers.push(`${key}:${value}`);
   if(missingPermissions.length) blockers.push('missing-permission');
   const ready=blockers.length===0;
   return {id:required.id,...dimensions,ready:ready?'yes':'no',state:ready?'ready':!evidence?'unknown':'blocked',missingPermissions,blockers};
  });
  const blockers=[];if(!approval) blockers.push('version-not-approved');if(test.status!=='passed') blockers.push('skill-test-not-passed');if(integrity.status!=='passed') blockers.push('package-not-verified');
  if(tools.some(t=>t.ready!=='yes')) blockers.push('tools-not-ready');
  return {id,versionHash:m.versionHash,catalogued:'yes',configured:combine([approval?'yes':'unknown',...tools.map(t=>t.configured)]),authenticated:combine(tools.map(t=>t.authenticated)),authorized:combine([approval?'yes':'unknown',...tools.map(t=>t.authorized)]),checked:combine([integrity.status==='passed'?'yes':integrity.status==='failed'?'no':'unknown',test.status==='passed'?'yes':test.status==='failed'?'no':'unknown',...tools.map(t=>t.checked)]),ready:blockers.length===0,tools,missingTools:tools.filter(t=>t.catalogued!=='yes'||t.configured!=='yes'||t.blockers.includes('no-offline-executor')).map(t=>t.id),missingPermissions:tools.flatMap(t=>t.missingPermissions.map(p=>`${t.id}:${p}`)),test,integrity:copy(integrity),blockers};
 }
 function verify(id) {skill(id);const result=catalog.verify(id);verified.set(id,copy(result));event('verify',id,{status:result.status});return copy(result);}
 function ensureReady(id,handle) {
  if(!readiness(id,handle).ready) throw new Error('Skill is not ready');
  if(verify(id).status!=='passed') throw new Error('Package integrity failure');
  // Re-resolve expiring/revoked host grants at the action boundary.
  if(!readiness(id,handle).ready) throw new Error('Skill is not ready');
 }
 function route(request) {
  assertJson(request);exactFields(request,['intent','tags','nodeType'],['intent','tags'],'routing request');stringList([request.intent],{tokens:true});stringList(request.tags,{tokens:true});if(request.nodeType!==undefined) stringList([request.nodeType],{tokens:true});
  const candidates=[...entries.values()].map(m=>{
   const t=m.triggers,tags=new Set(request.tags),reasons=[],exclusions=[];let score=0;
   if(t.intents.includes(request.intent)) {score+=100;reasons.push(`intent:${request.intent}`);}
   for(const tag of t.anyTags) if(tags.has(tag)) {score+=10;reasons.push(`tag:${tag}`);}
   for(const tag of t.excludeTags) if(tags.has(tag)) exclusions.push(`excluded-tag:${tag}`);
   for(const tag of t.allTags) if(!tags.has(tag)) exclusions.push(`missing-tag:${tag}`);
   if(t.nodeTypes.length && !t.nodeTypes.includes(request.nodeType)) exclusions.push('node-type-mismatch');
   if(!score) exclusions.push('no-positive-trigger');
   return {id:m.id,version:m.version,versionHash:m.versionHash,selected:score>0&&!exclusions.length,score,reasons,exclusions};
  }).sort((a,b)=>Number(b.selected)-Number(a.selected)||b.score-a.score||(a.id<b.id?-1:a.id>b.id?1:0));
  event('route',null,{selected:candidates.filter(c=>c.selected).map(c=>c.id)});return candidates;
 }
 const api={route,readiness,verify,
  run(id,input,handle) {
   const m=skill(id);const errors=validateData(m.inputSchema,input);if(errors.length) throw new Error('Invalid input: '+errors.join('; '));ensureReady(id,handle);
   const output=executeBuiltin(m.handler,copy(input));const resultErrors=validateData(m.outputSchema,output);if(resultErrors.length) throw new Error('Invalid output: '+resultErrors.join('; '));event('run',id,{versionHash:m.versionHash,execution:'offline-deterministic'});return copy(output);
  },
  prompt(id,options,handle) {const m=skill(id);const errors=validateData(m.inputSchema,options.input);if(errors.length) throw new Error('Invalid input: '+errors.join('; '));ensureReady(id,handle);const result=composePrompt(catalog,m,options);event('prompt',id,{versionHash:m.versionHash});return result;},
  inspect(request,handle) {return {namespace:'cue.command-mesh.inspector/v1',executionMode:'offline-only',candidates:route(request).map(candidate=>{const r=readiness(candidate.id,handle);return {...candidate,readiness:r,test:r.test};})};},
  events:options=>log.read(options),
  historyInfo:()=>log.info()
 };
 return Object.freeze(api);
}
