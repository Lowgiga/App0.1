import {taskContract,savedWorkContract,type WorkState,type MeshTask} from '../upstream/lib/work-contract.ts';
import {workReferenceErrors,workChangeErrors} from '../overlay/lib/work-updates.ts';
import {workSizeError} from '../upstream/lib/work-budget.ts';
import {prepareLocalWrite} from './local-domain.ts';
import {taskReviewInvalidations,taskPrerequisiteChanged} from './task-review-impact.ts';

export interface TaskChangePlan {
 version:1;expectedUpdatedAt:string|null;taskId:string;plannedAt:string;knownSources:string[];
 before:WorkState;requested:MeshTask|null;next:WorkState|null;
 changes:Array<{taskId:string;fields:string[]}>;
 affected:Array<{taskId:string;path:string[];reviewRequired:boolean}>;
 missions:Array<{missionId:string;taskPath:string[];reviewRequired:boolean}>;
 unchangedTaskIds:string[];blockers:string[];needsConfirmation:boolean;
}
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const clone=<T,>(value:T):T=>structuredClone(value);
const message=(error:unknown)=>error instanceof Error?error.message:'Die Änderung ist nicht gültig.';
function validateCandidate(before:WorkState,next:WorkState,sources:readonly string[],now:Date){
 const {updatedAt,...body}=next;
 const occupied=new Set(before.command.events.map(e=>e.id)),eventIds:string[]=[];
 for(let i=0;eventIds.length<200;i++){const id=`ffffffff-ffff-4fff-8fff-${String(i).padStart(12,'0')}`;if(!occupied.has(id))eventIds.push(id)}
 // Same canonical pipeline as the normal command, including its event budget.
 // Deterministic IDs are used only for sizing; they are never saved or returned.
 const prepared=prepareLocalWrite(before,{...body,expectedUpdatedAt:updatedAt},now,sources,'4',eventIds);
 const error=workSizeError({...prepared,updatedAt:new Date(Math.max(now.getTime(),updatedAt?Date.parse(updatedAt)+1:0)).toISOString()});if(error)throw Error(error);
}
/** Pure proposal for one EXISTING task. Nothing is stored, executed or confirmed. */
export function planTaskChange(current:WorkState,input:unknown,knownSources:readonly string[],now:Date):TaskChangePlan{
 const parsed=taskContract.safeParse(input),before=clone(current);
 const plan:TaskChangePlan={version:1,expectedUpdatedAt:current.updatedAt,taskId:parsed.success?parsed.data.id:'',plannedAt:Number.isFinite(now.getTime())?now.toISOString():'',knownSources:[...knownSources].sort(),before,requested:parsed.success?clone(parsed.data):null,next:null,changes:[],affected:[],missions:[],unchangedTaskIds:current.tasks.map(t=>t.id),blockers:[],needsConfirmation:false};
 const block=(items:string[])=>{plan.blockers=[...new Set(items)];return plan};
 if(!plan.plannedAt)return block(['Ungültige Gerätezeit. Vorschau kann nicht gebunden werden.']);
 const validCurrent=savedWorkContract.safeParse(current);
 if(!validCurrent.success)return block(validCurrent.error.issues.map(i=>i.message));
 const references=workReferenceErrors(current,knownSources);if(references.length)return block(references);
 if(!parsed.success)return block(parsed.error.issues.map(i=>i.message));
 const old=current.tasks.find(t=>t.id===parsed.data.id);if(!old)return block(['Die vorhandene Aufgabe fehlt. Aufgabe neu öffnen; keine neue Aufgabe über diese Vorschau anlegen.']);
 let next=clone(current);next.tasks=next.tasks.map(t=>t.id===old.id?clone(parsed.data):t);
 const invalidated=new Set(taskReviewInvalidations(current,next));
 next.tasks=next.tasks.map(t=>invalidated.has(t.id)?{...t,reviewed:false,status:t.status==='Erledigt'?'Review':t.status}:t);
 const paths=new Map<string,string[]>();
 if(taskPrerequisiteChanged(old,next.tasks.find(t=>t.id===old.id))){
  paths.set(old.id,[old.id]);const queue=[old.id];
  for(let i=0;i<queue.length;i++)for(const task of current.tasks){if(paths.has(task.id)||!task.dependencies.includes(queue[i]))continue;paths.set(task.id,[...paths.get(queue[i])!,task.id]);queue.push(task.id)}
 }
 plan.affected=current.tasks.filter(t=>t.id!==old.id&&paths.has(t.id)).map(t=>({taskId:t.id,path:paths.get(t.id)!,reviewRequired:invalidated.has(t.id)}));
 plan.missions=current.command.missions.flatMap(m=>{
  const taskPath=m.taskIds.map(id=>paths.get(id)).filter((p):p is string[]=>!!p).sort((a,b)=>a.length-b.length||a.join('/').localeCompare(b.join('/')))[0];
  return taskPath?[{missionId:m.id,taskPath,reviewRequired:['Approved','Done'].includes(m.stage)}]:[];
 });
 const missionIds=new Set(plan.missions.filter(m=>m.reviewRequired).map(m=>m.missionId));
 next.command.missions=next.command.missions.map(m=>missionIds.has(m.id)?{...m,stage:'Review',reviewed:false}:m);
 const normalized=savedWorkContract.safeParse(next);
 if(!normalized.success)return block(normalized.error.issues.map(i=>i.message));
 next=normalized.data;
 const errors=workChangeErrors(current,next,now,knownSources);if(errors.length)return block(errors);
 try{validateCandidate(current,next,knownSources,now)}catch(error){return block([message(error)])}
 plan.next=next;
 plan.changes=next.tasks.flatMap(t=>{const previous=current.tasks.find(b=>b.id===t.id)!;const fields=(Object.keys(t) as (keyof MeshTask)[]).filter(k=>!equal(previous[k],t[k]));return fields.length?[{taskId:t.id,fields}]:[]});
 plan.unchangedTaskIds=current.tasks.filter(t=>!plan.changes.some(c=>c.taskId===t.id)).map(t=>t.id);
 plan.needsConfirmation=plan.changes.length>0||missionIds.size>0;
 return plan;
}
/** Checks the entire shown plan against exact current data, draft and source IDs.
 * Caller must use normal changeWork/PUT: this is neither a store nor authority. */
export function taskChangeCandidate(plan:TaskChangePlan,current:WorkState,draft:unknown,knownSources:readonly string[],now:Date):WorkState{
 if(!plan||plan.version!==1||!plan.next||!plan.needsConfirmation||plan.blockers?.length)throw Error('Vorschau fehlt oder ist nicht übernehmbar.');
 const recomputed=planTaskChange(current,draft,knownSources,new Date(plan.plannedAt));
 if(!equal(plan,recomputed))throw Error('Vorschau veraltet oder verändert. Änderung neu prüfen.');
 if(!Number.isFinite(now.getTime()))throw Error('Ungültige Gerätezeit.');
 validateCandidate(current,plan.next,knownSources,now);
 return clone(plan.next);
}
