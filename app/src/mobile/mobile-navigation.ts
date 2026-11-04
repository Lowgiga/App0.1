import {personalContextContract} from '../personal-continuation.ts';
import {readContinuationContext,type ContinuationContext} from '../personal-continuation-route.ts';
import {useSyncExternalStore} from 'react';
import {viewIds} from '../../upstream/lib/work-contract.ts';
import type {MobileActionId,MobileTarget} from './mobile-contract.ts';
export const studioTabIds=['graph','skills','backup','surface','memory','assistant'] as const;
export type StudioTab=typeof studioTabIds[number];
// Set true only in the serial integration that installs the real AssistantPanel.
export const STUDIO_ASSISTANT_AVAILABLE=true;
export function readMobileRoute(href:string,assistantAvailable:boolean=STUDIO_ASSISTANT_AVAILABLE):{studio:boolean;studioTab:StudioTab;selectedAction:MobileActionId} {
  const query=new URL(href).searchParams,studio=query.get('studio')==='1',requested=query.get('studioTab'),view=query.get('view');
  const studioTab=studioTabIds.includes(requested as StudioTab)&&(requested!=='assistant'||assistantAvailable)?requested as StudioTab:'graph';
  return {studio,studioTab,selectedAction:studio?`studio:${studioTab}`:`view:${viewIds.includes(view as typeof viewIds[number])?view as typeof viewIds[number]:'overview'}`};
}
export function notifyAppRoute(){window.dispatchEvent(new Event('cue:route-changed'));}
function subscribe(listener:()=>void){window.addEventListener('popstate',listener);window.addEventListener('cue:route-changed',listener);return()=>{window.removeEventListener('popstate',listener);window.removeEventListener('cue:route-changed',listener)}}
export function useMobileRoute(assistantAvailable:boolean=STUDIO_ASSISTANT_AVAILABLE){return readMobileRoute(useSyncExternalStore(subscribe,()=>window.location.href,()=> 'https://localhost/'),assistantAvailable);}
/** This history entry remembers only an exact Memory incarnation, never a draft or approval. */
function memoryReturnContext(href:string,state:unknown):ContinuationContext|null {
  const query=new URL(href).searchParams;
  if(query.getAll('studio').length!==1||query.get('studio')!=='1'||query.getAll('studioTab').length!==1||!studioTabIds.includes(query.get('studioTab') as StudioTab)||query.get('studioTab')==='memory'||query.has('contextId')||query.has('contextCreatedAt'))return null;
  if(!state||typeof state!=='object')return null;
  const value=(state as Record<string,unknown>).lowQuantFlowMemoryReturn;
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const record=value as Record<string,unknown>;
  if(Object.keys(record).sort().join(',')!=='context,schema,studioTab'||record.schema!=='lowquantflow.memory-return/v1'||record.studioTab!==query.get('studioTab'))return null;
  const parsed=personalContextContract.safeParse(record.context);return parsed.success?parsed.data:null;
}
export function navigateStudioTab(tab:Extract<MobileTarget,{kind:'studio'}>['tab']) {
  if(!studioTabIds.includes(tab))throw new Error('Ungültiger Studio-Bereich.');
  const next=new URL(window.location.href),parsed=readContinuationContext(next.href);
  const context=parsed.kind==='valid'&&next.searchParams.get('studio')==='1'&&next.searchParams.get('studioTab')==='memory'?parsed.context:memoryReturnContext(next.href,window.history.state);
  next.searchParams.set('studio','1');next.searchParams.set('studioTab',tab);
  let state:Record<string,unknown>={};
  if(tab==='memory'){
    if(context){next.searchParams.set('contextId',context.contextId);next.searchParams.set('contextCreatedAt',context.contextCreatedAt)}
  }else{
    next.searchParams.delete('contextId');next.searchParams.delete('contextCreatedAt');
    if(context)state={lowQuantFlowMemoryReturn:{schema:'lowquantflow.memory-return/v1',studioTab:tab,context}};
  }
  if(next.href!==window.location.href)window.history.pushState(state,'',next);
  notifyAppRoute();window.scrollTo({top:0,behavior:'instant'});
}
