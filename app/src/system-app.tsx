import {lazy,Suspense,useEffect,useState} from 'react';
import MeshApp from '../overlay/mesh-app';
import {Button} from '@/components/ui/button';
import {Toaster} from '@/components/ui/sonner';
import {viewIds} from '../upstream/lib/work-contract';
import {useWorkState} from './shared-work-state';
import {SystemPreferencesProvider} from './system-preferences';
import {MobileShell} from './mobile/MobileShell';
import {MobileContextHint} from './mobile/MobileContextHint';
import {notifyAppRoute,useMobileRoute} from './mobile/mobile-navigation';
import {SystemModeMenu,SystemModeMenuProvider} from './SystemModeMenu';
import {usePersonalContinuationNavigation} from './personal-continuation-navigation';
import {validNavigation} from './system-navigation';
const Studio=lazy(()=>import('./studio/Studio'));
export default function SystemApp({data}:{data:any}){
 const route=useMobileRoute();
 const continuation=usePersonalContinuationNavigation();
 const params=new URLSearchParams(location.search),requested=params.get('view');
 const [studio,setStudio]=useState(params.get('studio')==='1'),[visited,setVisited]=useState(params.get('studio')==='1');
 const {storage,storageError,loadingWork,hasLoaded,loadWork,busy}=useWorkState();
 useEffect(()=>{const close=(event:Event)=>{setStudio(false);const target=(event as CustomEvent).detail;if(continuation.pending&&validNavigation(target)){const next=new URL(location.href);target.view==='overview'?next.searchParams.delete('view'):next.searchParams.set('view',target.view);target.query?next.searchParams.set('q',target.query):next.searchParams.delete('q');next.searchParams.delete('studio');history.pushState({},'',next);notifyAppRoute()}},pop=()=>{const open=new URLSearchParams(location.search).get('studio')==='1';setStudio(open);if(open)setVisited(true)};window.addEventListener('cue:navigate',close);window.addEventListener('popstate',pop);window.addEventListener('cue:route-changed',pop);return()=>{window.removeEventListener('cue:navigate',close);window.removeEventListener('popstate',pop);window.removeEventListener('cue:route-changed',pop)}},[continuation.pending]);
 function switchMode(open:boolean){setStudio(open);if(open)setVisited(true);const u=new URL(location.href);open?u.searchParams.set('studio','1'):u.searchParams.delete('studio');if(u.href!==location.href)history.pushState({},'',u);notifyAppRoute();window.scrollTo({top:0,behavior:'instant'})}
 return <SystemPreferencesProvider><SystemModeMenuProvider studio={studio} onSwitchMode={switchMode}>
 {continuation.notice&&<p role="status" aria-live="polite">{continuation.notice}</p>}
 <div hidden={studio} inert={studio}>{continuation.pending?<div className="system-startup"><p role="status">Persönlicher Startpunkt wird geprüft …</p><SystemModeMenu active={!studio}/></div>:<MeshApp active={!studio} data={data} initialView={requested&&viewIds.includes(requested as any)?requested as any:'overview'} initialQuery={params.get('q')??''} explicitView={params.has('view')||params.has('q')||continuation.resumed}/>}</div>
 {visited&&<main hidden={!studio} inert={!studio} className="workspace system-studio" aria-label="LowQuantFlow Studio"><header className="page-heading"><div><h1>LowQuantFlow Studio</h1><MobileContextHint selectedAction={route.selectedAction}/></div><SystemModeMenu active={studio}/></header><div className="system-state" role="status">{storage}{(loadingWork||busy)&&' · Verarbeitung läuft'}{!hasLoaded&&<Button variant="outline" disabled={busy||loadingWork} onClick={loadWork}>Erneut laden</Button>}</div>{storageError&&<p role="alert">Daten sind möglicherweise veraltet. Neue Ausführung und Speicherung bleiben gesperrt; sichtbare Entwürfe vor dem Neuladen sichern.</p>}<Suspense fallback={<p role="status">Studio wird geladen …</p>}><Studio data={data} active={studio}/></Suspense></main>}
 <MobileShell/><Toaster richColors position="bottom-right"/></SystemModeMenuProvider></SystemPreferencesProvider>
}
