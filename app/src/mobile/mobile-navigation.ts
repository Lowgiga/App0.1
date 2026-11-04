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
export function navigateStudioTab(tab:Extract<MobileTarget,{kind:'studio'}>['tab']) {
  if(!studioTabIds.includes(tab))throw new Error('Ungültiger Studio-Bereich.');
  const next=new URL(window.location.href);next.searchParams.set('studio','1');next.searchParams.set('studioTab',tab);
  if(next.href!==window.location.href)window.history.pushState({},'',next);
  notifyAppRoute();window.scrollTo({top:0,behavior:'instant'});
}
