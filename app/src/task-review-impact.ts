import type {WorkState,MeshTask} from '../upstream/lib/work-contract.ts';
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export const taskReviewContent=(task:MeshTask|undefined)=>task&&({title:task.title,owner:task.owner,acceptance:task.acceptance,evidence:task.evidence,dependencies:task.dependencies});
export const taskPrerequisiteChanged=(before:MeshTask|undefined,after:MeshTask|undefined)=>!equal(taskReviewContent(before),taskReviewContent(after))||before?.status!==after?.status||before?.reviewed!==after?.reviewed;
/** R2's existing saved-content/prerequisite rule, shared by validation and preview. */
export function taskReviewInvalidations(current:WorkState,next:WorkState):string[]{
 const oldTasks=new Map(current.tasks.map(t=>[t.id,t])),newTasks=new Map(next.tasks.map(t=>[t.id,t]));
 return next.tasks.filter(task=>{
  const old=oldTasks.get(task.id);if(!old?.reviewed)return false;
  let changed=!equal(taskReviewContent(old),taskReviewContent(task));const visited=new Set<string>();
  const inspect=(id:string)=>{if(visited.has(id))return;visited.add(id);const before=oldTasks.get(id),after=newTasks.get(id);if(taskPrerequisiteChanged(before,after))changed=true;before?.dependencies.forEach(inspect)};
  old.dependencies.forEach(inspect);return changed;
 }).map(t=>t.id);
}
