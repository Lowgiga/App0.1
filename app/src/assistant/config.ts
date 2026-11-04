import {createId} from '../../upstream/lib/ids.ts';
import {AssistantContractError,assistantConfigContract,canonicalValue,configChangeContract,configProposalContract,contextKeyContract,parseAssistantSnapshot,type AssistantConfig,type AssistantSnapshot,type ConfigChange,type ConfigProposal,type ConfigValidation,type ContextKey,type FeatureId} from './contracts.ts';
export type {ConfigProposal,ConfigValidation} from './contracts.ts';

export function defaultAssistantConfig(context:ContextKey):AssistantConfig {
 return assistantConfigContract.parse({schema:'lowquantflow.assistant-config/v1',context:contextKeyContract.parse(context),revision:0,
  purposes:{
   continuation:{goal:'Ohne Kontextverlust weiterarbeiten',benefit:'Bestätigten Stand und offene Entwürfe erkennen',successMeasure:'Der richtige Projektstand öffnet; veraltete Entwürfe bleiben gesperrt'},
   advice:{goal:'Den passenden nächsten Schritt verstehen',benefit:'Belegte Blocker vor weiteren Vorschlägen erkennen',successMeasure:'Ein konkreter nächster Schritt mit passendem Beleg'},
   review:{goal:'Riskante Vorschläge früh erkennen',benefit:'Einwände und nötige Prüfungen nachvollziehen',successMeasure:'Harte Validatoren werden unabhängig von der Erklärungstiefe eingehalten'},
   suggestions:{goal:'Im Dialog sinnvoll nachschärfen',benefit:'Änderungen nur bei passendem Anlass vorschlagen',successMeasure:'Höchstens ein unveränderter Vorschlag je Projektbasis'},
   'local-helper':{goal:'Kleine Arbeit ohne Netz vorstrukturieren',benefit:'Eine verfügbare lokale Prüfung gezielt nutzen',successMeasure:'Ohne geprüfte Bindung bleibt die tatsächliche Fähigkeit nicht verfügbar'}
  },continuation:{enabled:true,detail:'compact'},advice:{priority:'blockers-first'},review:{depth:'standard'},suggestions:{frequency:'on-request'},localHelper:{requested:false}
 });
}
function candidate(snapshot:AssistantSnapshot,change:ConfigChange):Pick<ConfigProposal,'before'|'after'|'effect'> {
 const before=structuredClone(snapshot.config),after=structuredClone(before);
 let feature:FeatureId,sideEffect:string;
 switch(change.kind){
  case 'set-purpose':feature=change.feature;after.purposes[feature]={goal:change.goal,benefit:change.benefit,successMeasure:change.successMeasure};sideEffect='Ändert ausschließlich die erklärenden Zwecktexte';break;
  case 'set-continuation-enabled':feature='continuation';after.continuation.enabled=change.value;sideEffect=change.value?'Fortsetzungsansicht wird angezeigt':'Fortsetzungsansicht wird ausgeblendet';break;
  case 'set-continuation-detail':feature='continuation';after.continuation.detail=change.value;sideEffect=change.value==='detailed'?'Mehr Erläuterung auf der Fortsetzungskarte':'Kompakte Erläuterung auf der Fortsetzungskarte';break;
  case 'set-advice-priority':feature='advice';after.advice.priority=change.value;sideEffect='Ändert die Reihenfolge der Hinweise; technische Blocker behalten Vorrang';break;
  case 'set-review-depth':feature='review';after.review.depth=change.value;sideEffect='Ändert den Erklärumfang; alle harten Validatoren bleiben erforderlich';break;
  case 'set-suggestion-frequency':feature='suggestions';after.suggestions.frequency=change.value;sideEffect='Ändert den Vorschlagsanlass ohne Hintergrundtimer oder Systemnotification';break;
  case 'set-local-helper-requested':feature='local-helper';after.localHelper.requested=change.value;sideEffect='Speichert nur einen Wunsch; keine Modellbindung oder Ausführungsrechte entstehen';break;
 }
 if(canonicalValue(before)===canonicalValue(after))throw new AssistantContractError('NO_CHANGE');
 if(before.revision===Number.MAX_SAFE_INTEGER)throw new AssistantContractError('INVALID_CHANGE');
 after.revision++;
 return {before,after:assistantConfigContract.parse(after),effect:{benefit:after.purposes[feature].benefit,sideEffect}};
}
export function proposeConfig(input:AssistantSnapshot,rawChange:unknown):ConfigProposal {
 const snapshot=parseAssistantSnapshot(input),parsed=configChangeContract.safeParse(rawChange);
 if(!parsed.success)throw new AssistantContractError('INVALID_CHANGE');
 const values=candidate(snapshot,parsed.data);
 return configProposalContract.parse({schema:'lowquantflow.assistant-config-proposal/v1',id:createId(),context:{...snapshot.context},basis:{...snapshot.basis},change:parsed.data,...values});
}
export function validateConfigProposal(input:unknown,freshSnapshot:AssistantSnapshot):ConfigValidation {
 const parsed=configProposalContract.safeParse(input);if(!parsed.success)return {ok:false,code:'INVALID_CHANGE'};
 try{
  const snapshot=parseAssistantSnapshot(freshSnapshot),proposal=parsed.data;
  if(canonicalValue(proposal.context)!==canonicalValue(snapshot.context))return {ok:false,code:'CONTEXT_MISMATCH'};
  if(canonicalValue(proposal.basis)!==canonicalValue(snapshot.basis))return {ok:false,code:'STALE_BASIS'};
  const expected=candidate(snapshot,proposal.change);
  if(canonicalValue(proposal.before)!==canonicalValue(expected.before)||canonicalValue(proposal.after)!==canonicalValue(expected.after)||canonicalValue(proposal.effect)!==canonicalValue(expected.effect))return {ok:false,code:'INVALID_CHANGE'};
  return {ok:true};
 }catch(error){
  const code=error instanceof AssistantContractError?error.code:'INVALID_CHANGE';
  return {ok:false,code:code==='CONTEXT_MISMATCH'||code==='ARCHIVED'||code==='STALE_BASIS'||code==='NO_CHANGE'?code:'INVALID_CHANGE'};
 }
}
