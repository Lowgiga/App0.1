import {exactFields,hashManifestWeb,validateData,validateManifest} from '../../skill-core/src/contract.mjs';
import {builtinTools} from '../../skill-core/src/handlers.mjs';
import {fail,hashJson,isHash,isId,snapshot} from './data.mjs';
const states=['running','paused','completed','aborted','failed','budget-exhausted'];
export async function prepareSpec(spec,catalog,initial) {
 exactFields(spec,['namespace','pipelineId','limits','steps']);
 if(spec.namespace!=='cue.local-pipeline/v1'||!isId(spec.pipelineId)) fail('SPEC_ID');
 exactFields(spec.limits,['maxSteps','maxElapsedMs']);
 const {maxSteps,maxElapsedMs}=spec.limits;
 if(!Number.isSafeInteger(maxSteps)||maxSteps<1||maxSteps>8||!Number.isSafeInteger(maxElapsedMs)||maxElapsedMs<1||maxElapsedMs>1000) fail('SPEC_LIMITS');
 if(!Array.isArray(spec.steps)||!spec.steps.length||spec.steps.length>maxSteps) fail('SPEC_STEP_LIMIT');
 const current=new Map(catalog.list().map(m=>[m.id,snapshot(m)])),ids=new Set(),bindings=[];
 for(const step of spec.steps) {
  exactFields(step,['stepId','kind','skillId','version','versionHash','input']);
  if(!isId(step.stepId)||ids.has(step.stepId)) fail('SPEC_STEP_ID');ids.add(step.stepId);
  const m=current.get(step.skillId),original=initial.get(step.skillId);
  if(!m||!original) fail('SPEC_SKILL');validateManifest(m,m.name);
  if(m.version!==step.version||m.versionHash!==step.versionHash||m.version!==original.version||m.versionHash!==original.versionHash||await hashManifestWeb(m)!==m.versionHash) fail('VERSION_DRIFT');
  if(!['inspect-mission','validate-local-result','run-offline-skill'].includes(step.kind)||step.kind==='inspect-mission'&&m.handler!=='mission-check') fail('SPEC_KIND');
  if(m.id!=='cue.'+m.handler || !Object.hasOwn(builtinTools,m.handler)) fail('SPEC_HANDLER');
  if(m.tools.some(t=>t.effect!=='local-compute'||t.authentication!=='none'||!Object.values(builtinTools).some(b=>b.id===t.id))) fail('EXTERNAL_EFFECT_DISABLED');
  snapshot(step.input,131072);if(validateData(m.inputSchema,step.input).length) fail('INPUT_INVALID');
  bindings.push({manifest:m,inputHash:await hashJson(step.input)});
 }
 return {spec,bindings,revisionHash:await hashJson(spec)};
}
export function validateReference(value,pipelineId) {
 const ref=snapshot(value,1024);exactFields(ref,['pipelineId','revision']);
 if(ref.pipelineId!==pipelineId||!isId(ref.pipelineId)||!Number.isSafeInteger(ref.revision)||ref.revision<1) fail('CHECKPOINT_REFERENCE');return ref;
}
export function validateEnvelope(raw) {
 try {
  const result=snapshot(raw,1049600);exactFields(result,['revision','record']);
  if(!Number.isSafeInteger(result.revision)||result.revision<1) fail('CHECKPOINT_CORRUPT');return result;
 } catch {fail('CHECKPOINT_CORRUPT');}
}
export async function validateCheckpoint(record,prepared) {
 try {
  exactFields(record,['namespace','pipelineId','revisionHash','nextStepIndex','completed','state','code'],['namespace','pipelineId','revisionHash','nextStepIndex','completed','state']);
  if(record.namespace!=='cue.local-checkpoint/v1'||record.pipelineId!==prepared.spec.pipelineId||!isHash(record.revisionHash)) fail('CHECKPOINT_CORRUPT');
  if(record.revisionHash!==prepared.revisionHash) fail('CHECKPOINT_DRIFT');
  if(!states.includes(record.state)||!Number.isSafeInteger(record.nextStepIndex)||record.nextStepIndex<0||record.nextStepIndex>prepared.spec.steps.length||!Array.isArray(record.completed)||record.completed.length!==record.nextStepIndex) fail('CHECKPOINT_CORRUPT');
  if(record.state==='completed'&&record.nextStepIndex!==prepared.spec.steps.length) fail('CHECKPOINT_CORRUPT');
  if('code' in record && (typeof record.code!=='string'||!/^[A-Z_]{1,60}$/.test(record.code))) fail('CHECKPOINT_CORRUPT');
  for(let i=0;i<record.completed.length;i++) {
   const c=record.completed[i],step=prepared.spec.steps[i],binding=prepared.bindings[i];
   exactFields(c,['stepId','skillId','version','versionHash','inputHash','outputHash','output']);
   if(['stepId','skillId','version','versionHash'].some(k=>c[k]!==step[k])||c.inputHash!==binding.inputHash||!isHash(c.outputHash)) fail('CHECKPOINT_CORRUPT');
   snapshot(c.output,131072);if(validateData(binding.manifest.outputSchema,c.output).length||await hashJson(c.output)!==c.outputHash) fail('CHECKPOINT_CORRUPT');
  }
  return record;
 } catch(error) {fail(error.code==='CHECKPOINT_DRIFT'?'CHECKPOINT_DRIFT':'CHECKPOINT_CORRUPT');}
}
