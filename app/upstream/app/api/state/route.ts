import {workSizeError} from '@/lib/work-budget';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {workContract,savedWorkContract} from '@/lib/work-contract';
import {readWork,writeWork} from '@/lib/work-storage';
import {workChangeErrors,withCanonicalDecisionTimes,withAppEvents} from '@/lib/work-updates';
import data from '@/lib/mesh-data.json';
import {readJsonRequest} from '../request-body';
import {projectState,preserveLegacyFields} from '@/lib/state-compat';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
function stateResponse(state: ReturnType<typeof savedWorkContract.parse>,request:Request){return json(projectState(state,request.headers.get('X-Mesh-State-Version')))}
export async function GET(request:Request){
 const user=await getChatGPTUser();
 if(!user)return json({error:'Authentication required'},401);
 try{return stateResponse(await readWork(user.userId),request)}catch{return json({error:'Storage unavailable'},503)}
}
export async function PUT(request:Request){
 const user=await getChatGPTUser();
 if(!user)return json({error:'Authentication required'},401);
 const input=await readJsonRequest(request);
 if('response' in input)return input.response;
 const body=input.body;
 const parsed=workContract.safeParse(body);
 if(!parsed.success)return json({error:parsed.error.issues.find(i=>i.code==='custom')?.message||'Ungültige Eingabe. Bitte Felder und Werte prüfen.'},400);
 try{
  const current=await readWork(user.userId);
  const {expectedUpdatedAt,stateVersion:_incomingVersion,...changes}=parsed.data;
  if(expectedUpdatedAt!==current.updatedAt)return json({error:'State changed; reload before saving'},409);
  const modernChanges=preserveLegacyFields(current,changes,request.headers.get('X-Mesh-State-Version'));
  const now=new Date();
  const parsedCandidate=savedWorkContract.safeParse({...current,...modernChanges});
  if(!parsedCandidate.success)return json({error:parsedCandidate.error.issues[0]?.message||'Ungültiger Arbeitsstand.'},400);
  const candidate=withCanonicalDecisionTimes(current,parsedCandidate.data,now);
  const errors=workChangeErrors(current,candidate,now,data.sources.map(s=>s.id));
  if(errors.length)return json({error:errors[0]},400);
  const complete=savedWorkContract.safeParse(withAppEvents(current,candidate,now));
  if(!complete.success)return json({error:complete.error.issues[0]?.message||'Ungültiger Missionsstand.'},400);
  const sizeError=workSizeError(complete.data);if(sizeError)return json({error:sizeError},400);
  const {updatedAt,...payload}=complete.data;
  const result=await writeWork(user.userId,payload,expectedUpdatedAt);
  if(!result)return json({error:'State changed; reload before saving'},409);
  return stateResponse(savedWorkContract.parse(result),request);
 }catch{return json({error:'Storage unavailable'},503)}
}
