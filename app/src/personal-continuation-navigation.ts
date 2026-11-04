import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {personalViewContract,type PersonalView} from './personal-continuation.ts';
import {useWorkState} from './shared-work-state.tsx';
import {useWorkTransport} from './work-transport.tsx';
import {notifyAppRoute} from './mobile/mobile-navigation.ts';

import {readContinuationContext,continuationMemoryHref,type ContinuationContext} from './personal-continuation-route.ts';
export {readContinuationContext,continuationMemoryHref,type ContinuationContext,type ContinuationContextRoute} from './personal-continuation-route.ts';
/** One UI action, never serialized into a route, history entry, or storage. */
export type DraftOpenRequest={id:number;context:ContinuationContext;revision:number;href:string;signal:AbortSignal};

export function hasExplicitContinuationNavigation(href:string):boolean{
 const query=new URL(href).searchParams;
 return ['view','q','studio','studioTab','contextId','contextCreatedAt','tab'].some(key=>query.has(key));
}

type ReadState={kind:'pending'}|{kind:'failed'}|{kind:'loaded';view:PersonalView};
type StartupState={pending:boolean;notice:string;resumed:boolean};
const invalidLink='Der Projektlink ist unvollständig, ungültig oder gehört zu einem anderen Bereich. Die angeforderte Ansicht bleibt erhalten; es wird kein gespeicherter Projektkontext eingesetzt.';
const unavailableView='Der persönliche Startpunkt konnte nicht verlässlich geladen werden. Die bestehende Startansicht bleibt erhalten.';

/** One startup attempt. Explicit navigation and history traversal always terminate it. */
export function usePersonalContinuationNavigation():StartupState{
 const shared=useWorkState(),transport=useWorkTransport();
 const [initial]=useState(()=>{const href=window.location.href;return{href,historyLength:window.history.length,context:readContinuationContext(href),explicit:hasExplicitContinuationNavigation(href)}});
 const needsStart=initial.context.kind==='valid'||!initial.explicit;
 const finished=useRef(!needsStart),interrupted=useRef(false);
 const [state,setState]=useState<StartupState>({pending:needsStart,notice:initial.context.kind==='invalid'?invalidLink:'',resumed:false});
 const [read,setRead]=useState<ReadState>({kind:'pending'});

 // Install before passive child effects. The original workspace is held only while
 // startup is pending, so its implicit startView normalization is not user navigation.
 useLayoutEffect(()=>{
  const cancel=(event:Event)=>{
   if(finished.current){
    // Background workspace normalization is not a corrected Studio destination.
    // A later real destination clears only the old notice, never restarts resume.
    const destination=(href:string)=>{const query=new URL(href).searchParams;return JSON.stringify(['studio','studioTab','contextId','contextCreatedAt',...(query.get('studio')==='1'?[]:['view','q'])].map(key=>[key,query.getAll(key)]))};
    const foreground=(href:string)=>{const query=new URL(href).searchParams;return JSON.stringify(['studio','studioTab','contextId','contextCreatedAt'].map(key=>[key,query.getAll(key)]))};
    const deliberate=event.type==='popstate'||event.type==='cue:navigate'||foreground(window.location.href)!==foreground(initial.href)||window.history.length!==initial.historyLength;
    if(deliberate&&destination(window.location.href)!==destination(initial.href))setState(previous=>previous.notice?{...previous,notice:''}:previous);
    return;
   }
   interrupted.current=true;finished.current=true;
   setState({pending:false,notice:'',resumed:false});
  };
  for(const event of ['popstate','cue:navigate','cue:route-changed'])window.addEventListener(event,cancel);
  return()=>{for(const event of ['popstate','cue:navigate','cue:route-changed'])window.removeEventListener(event,cancel)};
 },[]);

 useEffect(()=>{
  if(initial.explicit||finished.current)return;
  const controller=new AbortController();let active=true;
  void(async()=>{
   try{
    const response=await transport.request('/api/personal-continuation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'read-view'}),signal:controller.signal,cache:'no-store'});
    if(!response.ok)throw new Error('read');
    const view=personalViewContract.parse(await response.json());
    if(active&&!controller.signal.aborted&&!finished.current)setRead({kind:'loaded',view});
   }catch{if(active&&!controller.signal.aborted&&!finished.current)setRead({kind:'failed'})}
  })();
  return()=>{active=false;controller.abort()};
 },[initial.explicit,transport]);

 useEffect(()=>{
  if(finished.current||interrupted.current||shared.loadingWork)return;
  const settle=(notice='',resumed=false)=>{finished.current=true;setState({pending:false,notice,resumed})};
  // pushState/replaceState do not emit browser events. Also guard integrations that
  // changed the URL without the application's route notification.
  if(window.location.href!==initial.href||window.history.length!==initial.historyLength){settle();return}
  if(shared.storageError||!shared.hasLoaded){settle('Der persönliche Startpunkt wurde nicht geöffnet, weil der Arbeitsstand nicht verlässlich geladen ist.');return}
  let context:ContinuationContext;
  if(initial.context.kind==='valid')context=initial.context.context;
  else{
   if(read.kind==='pending')return;
   if(read.kind==='failed'){settle(unavailableView);return}
   if(read.view.contextId===null||read.view.contextCreatedAt===null){settle();return}
   context={contextId:read.view.contextId,contextCreatedAt:read.view.contextCreatedAt};
  }
  const room=shared.work.rooms.find(candidate=>candidate.id===context.contextId&&candidate.createdAt===context.contextCreatedAt);
  if(!room){settle(initial.context.kind==='valid'?'Der Projektkontext aus diesem Link ist nicht mehr verfügbar oder gehört zu einem früheren Projektstand. Vorhandene Entwürfe bleiben erhalten.':'Der gespeicherte Projektkontext ist nicht mehr verfügbar oder gehört zu einem früheren Projektstand. Die bestehende Startansicht bleibt erhalten; vorhandene Entwürfe bleiben erhalten.');return}
  // Archived rooms may be displayed; their editor retains the existing read-only gate.
  const current=new URL(window.location.href);
  const alreadyMemory=current.searchParams.get('studio')==='1'&&current.searchParams.get('studioTab')==='memory';
  const href=alreadyMemory?current.href:continuationMemoryHref(current.href,context);
  settle('',true);
  if(href!==window.location.href){window.history.replaceState(window.history.state,'',href);notifyAppRoute()}
 },[initial,read,shared.hasLoaded,shared.loadingWork,shared.storageError,shared.work]);
 return state;
}
