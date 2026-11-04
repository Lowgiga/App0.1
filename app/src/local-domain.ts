import { workContract, savedWorkContract, type WorkState } from '../upstream/lib/work-contract.ts';
import { actionContract } from '../upstream/lib/interaction-contract.ts';
import { workChangeErrors, withCanonicalDecisionTimes, withAppEvents } from '../overlay/lib/work-updates.ts';
import { applyIntelligenceAction } from '../overlay/lib/intelligence-actions.ts';
import { getAttention } from '../overlay/lib/intelligence.ts';
import { workSizeError } from '../upstream/lib/work-budget.ts';
import { preserveLegacyFields } from '../upstream/lib/state-compat.ts';
import { LocalStateError } from './local-errors.ts';
import { createId } from '../upstream/lib/ids.ts';
// Upstream infers the UUID template type from crypto.randomUUID; createId has the same UUID v4 contract.
const makeId=()=>createId() as ReturnType<Crypto['randomUUID']>;
const invalid=(message:string)=>new LocalStateError('VALIDATION',message,400);
const parseState=(value:unknown)=>{const parsed=savedWorkContract.safeParse(value);if(!parsed.success)throw invalid(parsed.error.issues[0]?.message||'Ungültiger Arbeitsstand.');return parsed.data;};
function checkRevision(current:WorkState,expected:string|null){if(current.updatedAt!==expected)throw new LocalStateError('CONFLICT','Ein anderer lokaler Tab hat gespeichert. Neu laden und Entwürfe bewusst neu prüfen.',409);}
function complete(current:WorkState,candidate:WorkState,now:Date,sources:readonly string[],internal=false,enforceBudget=true,eventIds?:readonly string[]):WorkState {
  const errors=workChangeErrors(current,candidate,now,sources,internal);if(errors.length)throw invalid(errors[0]);
  let index=0;
  const nextId=eventIds?()=>{const id=eventIds[index++];if(!id)throw invalid('Ereignis-IDs fehlen. Vorschau erneut erstellen.');return id as ReturnType<Crypto['randomUUID']>}:makeId;
  const state=parseState(withAppEvents(current,candidate,now,nextId));
  const sizeError=enforceBudget?workSizeError(state):null;if(sizeError)throw invalid(sizeError);
  return state;
}
/** Local state route: frozen contracts plus explicit canonical-event overlay. */
export function applyLocalWrite(current:WorkState,input:unknown,now:Date,sources:readonly string[],version:string|null):WorkState {
  const state=prepareLocalWrite(current,input,now,sources,version);
  const sizeError=workSizeError(state);if(sizeError)throw invalid(sizeError);
  return state;
}
/** One canonical transformation pipeline; imports measure its complete result before acceptance. */
export function prepareLocalWrite(current:WorkState,input:unknown,now:Date,sources:readonly string[],version:string|null,eventIds?:readonly string[]):WorkState {
  const parsed=workContract.safeParse(input);if(!parsed.success)throw invalid(parsed.error.issues.find(i=>i.code==='custom')?.message||'Ungültige Eingabe. Bitte Felder und Werte prüfen.');
  const {expectedUpdatedAt,stateVersion:_version,...changes}=parsed.data;checkRevision(current,expectedUpdatedAt);
  const modern=preserveLegacyFields(current,changes,version);
  return complete(current,withCanonicalDecisionTimes(current,parseState({...current,...modern}),now),now,sources,false,false,eventIds);
}
/** Mirrors upstream actions route; never executes an external action. */
export function applyLocalAction(current:WorkState,input:unknown,now:Date,sources:readonly string[]):WorkState {
  const parsed=actionContract.safeParse(input);if(!parsed.success)throw invalid('Ungültige App-Aktion. Bitte Ziel und Begründung prüfen.');checkRevision(current,parsed.data.expectedUpdatedAt);
  let candidate:WorkState;try{candidate=parseState(applyIntelligenceAction(current,parsed.data,now,makeId));}catch(error){throw error instanceof LocalStateError?error:invalid(error instanceof Error?error.message:'Diese Aktion ist nicht mehr aktuell.');}
  const state=complete(current,candidate,now,sources,true);
  if(parsed.data.action==='risk-plan'){const record=state.command.interactions.at(-1)!;const risk=getAttention(state,now.getTime()).find(a=>a.id===record.sourceId);if(risk)record.fingerprint=risk.fingerprint;}
  return parseState(state);
}
