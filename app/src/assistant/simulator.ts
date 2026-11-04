import {advisoryRequestContract,type AdvisoryAdapter,type AdvisoryRequest,type AssistantResult,type ModelCapabilities} from './contracts.ts';
import {AssistantRuntimeError} from './policy.ts';

/** Fixed versioned scenarios, never an inference or executed external check. */
export const SIMULATOR_VERSION='lowquantflow.assistant-simulator/v1';
export type SimulatorCase='success'|'schema-error'|'foreign-reference'|'timeout'|'abort';
const cases:readonly SimulatorCase[]=['success','schema-error','foreign-reference','timeout','abort'];
const capabilities:ModelCapabilities=Object.freeze({bindingId:'simulator-v1',status:'simulated',execution:'deterministic',structuredOutput:true,cancellation:true,maxInputTokens:null,maxOutputTokens:null,verifiedAt:null});

function success(request:AdvisoryRequest):AssistantResult{
 const {context,runId,role,task}=request,stale=context.draft?.stale===true;
 const result:AssistantResult={schema:'lowquantflow.assistant-result/v1',runId,context:structuredClone(context.context),basis:structuredClone(context.basis),producer:{role,mode:'simulated',bindingId:capabilities.bindingId},summary:'Simulation: Das bestätigte Ziel fehlt. Welches Ziel soll das Projekt verfolgen?',claims:[],blockers:[],configProposal:null,checks:[],nextAction:'ask-user'};
 if(context.goal){
  result.claims=[{text:context.goal.text,kind:'confirmed',evidenceRefs:structuredClone(context.goal.evidenceRefs)}];
  result.summary=`Simulation: Zum bestätigten Ziel „${context.goal.text}“ liegen keine belegten Revisionsblocker vor. Es wurde kein Build oder externer Anschluss geprüft.`;
  result.nextAction='none';
 }
 if(context.claims.length){
  // Claims remain explicitly unconfirmed; this fixture does not resolve their truth.
  result.claims.push(...context.claims.slice(0,1).map(claim=>({text:claim.text,kind:'external-claim' as const,evidenceRefs:structuredClone(claim.evidenceRefs)})));
  result.summary=`Simulation: ${context.goal?`Das bestätigte Ziel lautet „${context.goal.text}“. `:''}Daneben liegt eine unbestätigte Aussage vor. Welche Aussage soll zuerst mit einem aktuellen Beleg geklärt werden?`;
  result.nextAction='ask-user';
 }
 if(stale&&context.draft){
  result.blockers=[{code:'STALE_DRAFT',evidenceRefs:[{kind:'draft',id:context.draft.id,revision:context.draft.revision}]}];
  result.summary=`Simulation: ${context.goal?`Zum bestätigten Ziel „${context.goal.text}“: `:''}Dein Entwurf bezieht sich auf einen älteren Stand. Eine ausführliche Änderungsansicht hilft, Unterschiede vor der Übernahme zu erkennen. Die veraltete Entwurfbasis bleibt unverändert; zuerst den aktuellen Stand vergleichen.`;
  result.configProposal={kind:'set-continuation-detail',value:'detailed'};result.nextAction='review-config';
 }
 if(task==='review-proposal'){
  result.summary=`Simulation: Der Vorschlag „${request.configProposal!.kind}“ braucht weiterhin die deterministische Kontext-, Revisions- und Katalogprüfung. Die Darstellungseinstellung verändert keine Entwurfbasis. Diese Beratung ist kein ausgeführter Test.`;
  result.configProposal=null;result.nextAction='none';result.blockers=[];
 }else if(task==='extract-labels'){
  result.summary='Simulation: Die vorhandenen Belegarten wurden lokal gelesen; keine Modellklassifikation ausgeführt.';
  result.configProposal=null;result.nextAction='none';result.blockers=[];result.claims=[];
 }
 return result;
}
export function createSimulator(fixtures:readonly SimulatorCase[]=['success']):AdvisoryAdapter{
 if(!Array.isArray(fixtures)||fixtures.length===0||fixtures.length>3||fixtures.some(value=>!cases.includes(value)))throw new AssistantRuntimeError('INVALID_REQUEST');
 const script=[...fixtures];let index=0;
 return {capabilities,async invoke(input,signal){
  if(signal.aborted)throw new AssistantRuntimeError('ABORTED');
  const parsed=advisoryRequestContract.safeParse(input);if(!parsed.success)throw new AssistantRuntimeError('INVALID_REQUEST');
  const scenario=script[Math.min(index++,script.length-1)];
  if(scenario==='abort')throw new AssistantRuntimeError('ABORTED');
  if(scenario==='timeout')return new Promise((_resolve,reject)=>{const stop=()=>reject(new AssistantRuntimeError('ABORTED'));signal.addEventListener('abort',stop,{once:true});if(signal.aborted){signal.removeEventListener('abort',stop);stop()}});
  if(scenario==='schema-error')return{schema:SIMULATOR_VERSION,summary:7};
  const result=success(parsed.data);
  if(scenario==='foreign-reference')result.claims=[{text:'Fremder Beleg',kind:'confirmed',evidenceRefs:[{kind:'memory-entry',id:'ffffffff-ffff-4fff-8fff-ffffffffffff',revision:1}]}];
  return result;
 }};
}
