import {savedWorkContract,type WorkState} from '../upstream/lib/work-contract.ts';
import {decodeSnapshot,mergeSnapshot} from '../upstream/lib/work-snapshots.ts';
import {WORK_WRITE_BUDGET,workBytes} from '../upstream/lib/work-budget.ts';
import {workReferenceErrors} from '../upstream/lib/work-updates.ts';
import {prepareLocalWrite} from './local-domain.ts';
import {LocalStateError} from './local-errors.ts';
export const LEGACY_INPUT_LIMIT=3*1024*1024;
export interface LegacyImportSummary {
 newRooms:number;retainedRooms:number;importedPosts:number;skippedPosts:number;duplicatePosts:number;
 duplicateRecords:number;rejectedRecords:number;importedNotes:number;importedTasks:number;defaultedTasks:number;
 resetMissions:number;resetApprovals:number;importedMarkers:number;retainedMarkers:number;
 importedLearning:number;retainedLearning:number;ignoredEvents:number;ignoredInteractions:number;evictedEvents:number;
}
export interface LegacyImportPreview {
 planId:string;expectedUpdatedAt:string|null;summary:LegacyImportSummary;inputBytes:number;targetBytes:number;
 budgetBytes:number;remainingBytes:number;canCommit:boolean;
}
export interface LegacyImportPlan {preview:LegacyImportPreview;state:WorkState;base:string;}
const invalid=(message:string)=>new LocalStateError('VALIDATION',message,400);
const countNew=<T extends {id:string}>(incoming:T[],current:T[])=>incoming.filter(x=>!current.some(c=>c.id===x.id)).length;
/** Keep native JSON semantics, but never silently select the last duplicate member.
 * The input byte limit bounds this iterative scan; no unrelated nesting limit is added.
 * JSON.parse validates syntax first, so a string followed by ':' is an object key.
 */
function parseUnambiguousJson(raw:string):unknown {
 const value:unknown=JSON.parse(raw);
 const containers:(Set<string>|null)[]=[];
 for(let i=0;i<raw.length;i++){
  const char=raw[i];
  if(char==='{'){containers.push(new Set());continue}
  if(char==='['){containers.push(null);continue}
  if(char==='}'||char===']'){containers.pop();continue}
  if(char!=='"')continue;
  const start=i;
  for(i++;i<raw.length;i++){
   if(raw[i]==='\\'){i++;continue}
   if(raw[i]==='"')break;
  }
  let next=i+1;while(next<raw.length&&/[\t\n\r ]/.test(raw[next]))next++;
  if(raw[next]!==':')continue;
  const key:string=JSON.parse(raw.slice(start,i+1)),keys=containers.at(-1);
  if(!keys)throw Error('Ungültiges JSON-Objekt.');
  if(keys.has(key))throw Error('Mehrdeutiges JSON: doppelte Objektschlüssel sind nicht erlaubt. Es wurde nichts übernommen.');
  keys.add(key);
 }
 return value;
}
/** Pure for supplied time and IDs. No storage, clock, randomness, network, or input mutation. */
export function planLegacyImport(current:WorkState,raw:string,sources:readonly string[],now:Date,planId:string,eventIds:readonly string[]):LegacyImportPlan {
 const inputBytes=new TextEncoder().encode(raw).byteLength;
 if(inputBytes>LEGACY_INPUT_LIMIT)throw new LocalStateError('TOO_LARGE','Die Datei darf höchstens 3 MiB (3.145.728 Byte) groß sein.',413);
 if(!Number.isFinite(now.getTime()))throw invalid('Ungültige Gerätezeit. Es wurde nichts gespeichert.');
 let incoming:WorkState;let decoded:{work:{tasks?:unknown}};
 try{decoded=parseUnambiguousJson(raw) as typeof decoded;incoming=decodeSnapshot(decoded);}catch(error){throw invalid('Import vollständig abgelehnt: '+(error instanceof Error?error.message:'Ungültige Datei.'))}
 const sourceErrors=workReferenceErrors(incoming,sources);if(sourceErrors.length)throw invalid('Import vollständig abgelehnt: '+sourceErrors[0]);
 const sourceTasks=Object.hasOwn(decoded.work,'tasks')?incoming.tasks:[];
 for(const m of incoming.command.missions)if(!current.command.missions.some(c=>c.id===m.id)&&(`Importiert aus Phase ${m.stage}; Abnahme neu prüfen.\n${m.checkpoint}`).length>3000)throw invalid(`Checkpoint der Mission „${m.title}“ würde gekürzt. Kürze den Checkpoint in einer Kopie der Quelldatei und prüfe erneut. Es wurde nichts übernommen.`);
 let merged:WorkState;
 try{merged=mergeSnapshot(current,incoming,sources,now);}catch(error){throw invalid('Import vollständig abgelehnt: '+(error instanceof Error?error.message:'Ungültige Referenzen.'))}
 const {updatedAt,...body}=merged;
 const transformed=prepareLocalWrite(current,{...body,expectedUpdatedAt:current.updatedAt},now,sources,'4',eventIds);
 const revision=new Date(Math.max(now.getTime(),current.updatedAt?Date.parse(current.updatedAt)+1:0)).toISOString();
 const state=savedWorkContract.parse({...transformed,updatedAt:revision});
 const retained=incoming.rooms.filter(r=>current.rooms.some(c=>c.id===r.id));
 const fresh=incoming.rooms.filter(r=>!current.rooms.some(c=>c.id===r.id));
 const tasksBefore=current.updatedAt===null?[]:current.tasks;
 const newNotes=countNew(incoming.notes,current.notes),newTasks=countNew(sourceTasks,tasksBefore);
 const newMissions=countNew(incoming.command.missions,current.command.missions),newApprovals=countNew(incoming.command.approvals,current.command.approvals);
 const keys=(input:object,previous:object)=>Object.keys(input).filter(k=>!Object.hasOwn(previous,k)).length;
 const summary:LegacyImportSummary={
  newRooms:fresh.length,retainedRooms:retained.length,importedPosts:fresh.reduce((n,r)=>n+r.messages.length,0),
  skippedPosts:retained.reduce((n,r)=>n+r.messages.length,0),
  duplicatePosts:retained.reduce((n,r)=>n+r.messages.filter(m=>current.rooms.find(c=>c.id===r.id)!.messages.some(c=>c.id===m.id)).length,0),
  duplicateRecords:retained.length+incoming.notes.length-newNotes+sourceTasks.length-newTasks+incoming.command.missions.length-newMissions+incoming.command.approvals.length-newApprovals,
  rejectedRecords:0,importedNotes:newNotes,importedTasks:newTasks,defaultedTasks:sourceTasks===incoming.tasks?0:incoming.tasks.length,resetMissions:newMissions,resetApprovals:newApprovals,
  importedMarkers:keys(incoming.checks,current.checks),retainedMarkers:Object.keys(incoming.checks).length-keys(incoming.checks,current.checks),
  importedLearning:keys(incoming.learning,current.learning),retainedLearning:Object.keys(incoming.learning).length-keys(incoming.learning,current.learning),
  ignoredEvents:incoming.command.events.length,ignoredInteractions:incoming.command.interactions.length,
  evictedEvents:current.command.events.filter(e=>!state.command.events.some(s=>s.id===e.id)).length,
 };
 const targetBytes=workBytes(state);
 return {preview:{planId,expectedUpdatedAt:current.updatedAt,summary,inputBytes,targetBytes,budgetBytes:WORK_WRITE_BUDGET,remainingBytes:WORK_WRITE_BUDGET-targetBytes,canCommit:targetBytes<=WORK_WRITE_BUDGET},state,base:JSON.stringify(current)};
}
/** Commit checks exactly the approved immutable target against the transaction's current base. */
export function acceptLegacyImport(current:WorkState,plan:LegacyImportPlan,now:Date):WorkState {
 if(current.updatedAt!==plan.preview.expectedUpdatedAt||JSON.stringify(current)!==plan.base)throw new LocalStateError('CONFLICT','Der lokale Stand hat sich geändert. Vorschau erneut prüfen und bestätigen.',409);
 if(plan.state.command.approvals.some(a=>!current.command.approvals.some(c=>c.id===a.id)&&Date.parse(a.expiresAt)<=now.getTime()))throw new LocalStateError('CONFLICT','Die in der Vorschau vorgeschlagene Freigabe ist abgelaufen. Vorschau erneut prüfen und bestätigen.',409);
 if(!plan.preview.canCommit||workBytes(plan.state)>WORK_WRITE_BUDGET)throw invalid('Zielbestand überschreitet 1.750.000 UTF-8-Byte. Keine Änderung gespeichert. Sichere und verkleinere zuerst den Bestand.');
 return savedWorkContract.parse(plan.state);
}
