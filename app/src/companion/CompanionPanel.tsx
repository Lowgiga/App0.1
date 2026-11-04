import {useEffect,useId,useRef,useState} from 'react';
import {CompanionController,DEFAULT_MAX_ANIMATION_RATE,type CompanionRenderStatus} from './controller.ts';
import {companionPresentation,expireCompanionWork,initialCompanionState,reduceCompanion,WORK_STATUS_TIMEOUT_MS,type CompanionHostEvent} from './state.ts';
import './companion.css';
import {useFiniteMotion,type PresentationMotionMode} from '../motion/use-finite-motion.ts';
import '../motion/assistant-motion.css';

export interface CompanionPanelProps {
 /** Existing host settings own these options. This panel persists nothing. */
 enabled?:boolean;motionEnabled?:boolean;motion?:PresentationMotionMode;powerSaver?:boolean;maxAnimationRate?:number;
 event?:CompanionHostEvent|null;
}
export function CompanionPanel({enabled=false,motionEnabled=false,motion='subtle',powerSaver=false,maxAnimationRate=DEFAULT_MAX_ANIMATION_RATE,event}:CompanionPanelProps){
 const id=useId(),stage=useRef<HTMLDivElement>(null),owner=useRef<CompanionController|null>(null),refresh=useRef<()=>void>(()=>{});
 const [state,setState]=useState(initialCompanionState),[paused,setPaused]=useState(false),[status,setStatus]=useState<CompanionRenderStatus>('static');
 const bubble=useRef<HTMLDivElement>(null);
 useFiniteMotion(bubble,{eventKey:state.phase,kind:'bubble',mode:motionEnabled?motion:'off',powerSaver,paused,enabled:enabled&&!['waiting','error'].includes(state.phase)});
 const latest=useRef({enabled,motionEnabled,powerSaver,maxAnimationRate,paused,state});
 latest.current={enabled,motionEnabled,powerSaver,maxAnimationRate,paused,state};
 useEffect(()=>{if(event)setState(previous=>reduceCompanion(previous,event,Date.now()))},[event]);
 useEffect(()=>{
  if(state.phase!=='working'||state.startedAt===null)return;
  const timer=window.setTimeout(()=>setState(previous=>expireCompanionWork(previous,Date.now())),Math.max(0,state.startedAt+WORK_STATUS_TIMEOUT_MS-Date.now()));
  return ()=>window.clearTimeout(timer);
 },[state.phase,state.startedAt]);
 useEffect(()=>{
  const host=stage.current;if(!enabled||!host)return;
  let live=true,visible=false;
  const media=typeof window.matchMedia==='function'?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
  const controller=new CompanionController({
   load:async signal=>{const module=await import('./three-scene.ts');if(signal.aborted)throw new DOMException('Companion load cancelled','AbortError');return module.createThreeCompanion(host,signal)},
   onStatus:value=>{if(live)setStatus(value)},
  });
  owner.current=controller;controller.present(latest.current.state);
  const configure=()=>{const options=latest.current;controller.configure({...options,visible,pageVisible:!document.hidden,reducedMotion:media?.matches??true})};
  refresh.current=configure;
  const resize=()=>controller.resize(host.clientWidth||320,host.clientHeight||200);
  const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{visible=entries.some(entry=>entry.target===host&&entry.isIntersecting&&entry.intersectionRatio>0);configure()},{threshold:0}):null;
  const size=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;
  observer?.observe(host);size?.observe(host);
  document.addEventListener('visibilitychange',configure);media?.addEventListener('change',configure);
  resize();configure();
  return ()=>{
   live=false;refresh.current=()=>{};observer?.disconnect();size?.disconnect();document.removeEventListener('visibilitychange',configure);media?.removeEventListener('change',configure);
   controller.dispose();if(owner.current===controller)owner.current=null;
  };
 },[enabled]);
 useEffect(()=>{refresh.current()},[motionEnabled,powerSaver,maxAnimationRate,paused]);
 useEffect(()=>{owner.current?.present(state)},[state]);
 if(!enabled)return null;
 const p=companionPresentation(state),animated=status==='running';
 return <section className="companion-panel" aria-labelledby={id} data-companion-phase={state.phase} data-render-status={status}>
  <div className="companion-heading"><h3 id={id}>Projektbegleiter</h3><span>Offline · optional</span></div>
  <div ref={stage} className="companion-stage" aria-hidden="true">
   {!animated&&<svg className="companion-static" viewBox="0 0 140 140" focusable="false" aria-hidden="true"><circle cx="70" cy="70" r="54" fill="currentColor" opacity=".08"/><rect x="33" y="36" width="74" height="70" rx="24" fill="currentColor" opacity=".2"/><circle cx="54" cy="67" r="6" fill="currentColor"/><circle cx="86" cy="67" r="6" fill="currentColor"/><path d="M54 87 Q70 95 86 87" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg>}
  </div>
  <div ref={bubble} className="companion-bubble" role="status" aria-live="polite" aria-atomic="true">
   <strong>{p.label}</strong><p>{p.text}</p>
   {p.receiptId&&<p className="companion-receipt" data-receipt={p.receiptId}>Speicherbeleg: {p.receiptId}</p>}
  </div>
  <div className="companion-controls">
   <button type="button" aria-label={paused?'Begleiterbewegung fortsetzen':'Begleiterbewegung pausieren'} aria-pressed={paused} onClick={()=>setPaused(value=>!value)}>{paused?'Bewegung fortsetzen':'Bewegung pausieren'}</button>
   <span className="companion-mode">{status==='unavailable'?'3D nicht verfügbar · Textansicht':animated?'Lokale 3D-Ansicht':status==='loading'?'Lokales Modell wird geladen':'Statische 2D- und Textansicht'}</span>
  </div>
  <details className="companion-attribution"><summary>Modellherkunft &amp; Lizenz</summary><p>Android-Roboter: nach einer von Google bereitgestellten Vorlage modifiziert, unter <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">CC BY 3.0</a>. PAZ Companion contributors: eigener schwarzer/neongrüner 3D-Körper, Gelenke, Ketten, Materialien und sechs Clips. Android is a trademark of Google LLC. Keine Verbindung zu oder Bestätigung durch Google. <a href="https://developer.android.com/distribute/marketing-tools/brand-guidelines" target="_blank" rel="noreferrer">Quelle und Markenhinweise</a></p></details>
 </section>;
}
