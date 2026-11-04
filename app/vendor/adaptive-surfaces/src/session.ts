import {COMPONENT_TYPES,type ActionDefinition,type ActionIntent,type ActionDeliveryState,type IntentReceiver,type Limits,type SessionConfig,type SurfaceSession,type SurfaceSnapshot} from './types.ts';
import {byteLength,deepFreeze,parseBoundedJSON,safeRef,SurfaceError} from './json.ts';
import {validateProposal} from './validate.ts';
export const DEFAULT_LIMITS:Readonly<Limits> = Object.freeze({maxBytes:262144,maxComponents:200,maxDepth:12,maxJsonDepth:32,maxTextBytes:8192,maxRows:200,minUpdateIntervalMs:50});
export function createSurfaceSession(config:SessionConfig):SurfaceSession {
 const limits={...DEFAULT_LIMITS};for(const [key,value] of Object.entries(config.limits??{})){if(!(key in limits)||typeof value!=='number'||!Number.isSafeInteger(value)||value<(key==='minUpdateIntervalMs'?0:1)||(key!=='minUpdateIntervalMs'&&value>DEFAULT_LIMITS[key as keyof Limits]))throw new Error('Invalid host limits');limits[key as keyof Limits]=value}Object.freeze(limits);
 const id=(x:string)=>/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(x);if(!id(config.sessionId)||!id(config.surfaceId))throw new Error('Invalid host namespace');
 const sessionId=config.sessionId,surfaceId=config.surfaceId,now=config.now??(()=>performance.now());
 if(!config.provenance||typeof config.provenance.sourceLabel!=='string'||!config.provenance.sourceLabel.trim()||byteLength(config.provenance.sourceLabel)>512)throw new Error('Invalid host provenance');
 const provenance=deepFreeze({sourceLabel:config.provenance.sourceLabel,...(config.provenance.runLabel?{runLabel:config.provenance.runLabel.slice(0,256)}:{})});
 const registry=new Set(config.registeredComponents);if([...registry].some(t=>!COMPONENT_TYPES.includes(t)))throw new Error('Invalid host component');
 const actions=new Map<string,ActionDefinition>();for(const [key,action] of config.actions){if(!safeRef(key)||!action||!['navigate','suggest'].includes(action.kind)||typeof action.label!=='string'||!action.label.trim()||action.label.length>256||!action.target)throw new Error('Invalid host action');
  const allowed=action.kind==='navigate'?['tasks','sources','graph','skills','events']:['inspect-task','review-source','review-skill'];const field=action.kind==='navigate'?'view':'topic';const target=action.target as unknown as Record<string,unknown>;
  if(!allowed.includes(target[field] as string)||Object.keys(action).some(k=>!['kind','label','target'].includes(k))||Object.keys(target).some(k=>![field,'entityId'].includes(k))||(target.entityId!==undefined&&(typeof target.entityId!=='string'||target.entityId.length>256)))throw new Error('Invalid host action');
  actions.set(key,deepFreeze(JSON.parse(JSON.stringify(action)) as ActionDefinition));
 }
 let snapshot:SurfaceSnapshot=deepFreeze({revision:0,proposal:null,provenance,error:null});
 let lastAttempt=-Infinity;
 const listeners=new Set<()=>void>(), actionListeners=new Set<()=>void>(), issued=new Set<string>();
 // Host-session ownership keeps delivery locks alive across component and renderer remounts.
 const deliveries=new Map<string,Readonly<ActionDeliveryState>>();
 function notify(target=listeners){for(const listener of target)try{listener()}catch{/* Isolate host subscriber failures. */}}
 function reject(code:string){if(snapshot.error===code)return {ok:false,code};snapshot=deepFreeze({...snapshot,error:code});notify();return {ok:false,code}}
 function getActionState(componentId:string):Readonly<ActionDeliveryState>|null {
  const state=deliveries.get(componentId);
  return state && (state.state==='pending'||state.revision===snapshot.revision)?state:null;
 }
 function getIntent(componentId:string,revision:number):ActionIntent|null {
  if(!snapshot.proposal||revision!==snapshot.revision||issued.has(componentId)||deliveries.get(componentId)?.state==='pending')return null;
  const c=snapshot.proposal.components.find(n=>n.id===componentId);
  if(!c?.actionRef)return null;
  const action=actions.get(c.actionRef);if(!action)return null;
  issued.add(componentId);
  return deepFreeze({sessionId,surfaceId,surfaceRevision:revision,componentId,actionRef:c.actionRef,kind:action.kind,target:action.target} as ActionIntent);
 }
 async function dispatchIntent(componentId:string,revision:number,receiver:IntentReceiver):Promise<void> {
  if(deliveries.get(componentId)?.state==='pending')return;
  if(!snapshot.proposal?.components.some(c=>c.id===componentId)||revision!==snapshot.revision)return;
  if([...deliveries.values()].filter(s=>s.state==='pending').length>=limits.maxComponents){
   deliveries.set(componentId,Object.freeze({revision,state:'unavailable'}));notify(actionListeners);return;
  }
  const intent=getIntent(componentId,revision);
  if(!intent){deliveries.set(componentId,Object.freeze({revision,state:'stale'}));notify(actionListeners);return;}
  const pending=Object.freeze({revision,state:'pending' as const});
  deliveries.set(componentId,pending);notify(actionListeners);
  let result:'sent'|'error'='sent';
  try{await receiver(intent)}catch{result='error'}
  // Only this exact delivery may release its lock. Old results cannot overwrite newer UI.
  if(deliveries.get(componentId)===pending){
   if(snapshot.revision===revision)deliveries.set(componentId,Object.freeze({revision,state:result}));
   else deliveries.delete(componentId);
   notify(actionListeners);
  }
 }
 return Object.freeze({limits,getSnapshot:()=>snapshot,
  subscribe(listener:()=>void){listeners.add(listener);return ()=>{listeners.delete(listener)}},
  subscribeActions(listener:()=>void){actionListeners.add(listener);return ()=>{actionListeners.delete(listener)}},
  getAction:(ref:string)=>actions.get(ref),getActionState,getIntent,dispatchIntent,
  submit(raw:string){
   const t=now();if(!Number.isFinite(t))return reject('clock');
   if(t-lastAttempt<limits.minUpdateIntervalMs)return reject('rate-limit');lastAttempt=t;
   try{
    const p=validateProposal(parseBoundedJSON(raw,limits.maxBytes,limits.maxJsonDepth,limits.maxTextBytes),limits,registry,new Set(actions.keys()));
    if(p.sessionId!==sessionId||p.surfaceId!==surfaceId)throw new SurfaceError('namespace');
    if(p.baseRevision!==snapshot.revision)throw new SurfaceError('revision');
    snapshot=deepFreeze({revision:snapshot.revision+1,proposal:p,provenance,error:null});issued.clear();
    for(const [id,state] of deliveries)if(state.state!=='pending')deliveries.delete(id);
    notify();notify(actionListeners);return {ok:true};
   }catch(error){return reject(error instanceof SurfaceError?error.code:'validation')}
  }
 });
}
