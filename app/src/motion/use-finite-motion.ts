import {useEffect,useRef,type RefObject} from 'react';

export type PresentationMotionMode='subtle'|'hologram'|'off';
export type FiniteMotionKind='surface'|'bubble'|'cards'|'gather'|'dock';
export interface FiniteMotionOptions {
 /** Presentation identity only. Never a command or an animation-end callback. */
 eventKey:string|null;kind:FiniteMotionKind;mode:PresentationMotionMode;powerSaver:boolean;
 paused?:boolean;enabled?:boolean;
}
const ease='cubic-bezier(.22,1,.36,1)';
/** Finite, latest-only decoration. DOM underneath is always the correct end state.
 * No timers/RAF, finished promises, queues, writes, navigation or focus changes.
 * A microtask lets StrictMode discard its probe before acquiring any resources.
 */
export function useFiniteMotion<T extends HTMLElement>(ref:RefObject<T|null>,{eventKey,kind,mode,powerSaver,paused=false,enabled=true}:FiniteMotionOptions){
 const lastEvent=useRef<string|null>(null);
 useEffect(()=>{
  let disposed=false,cleanup=()=>{};
  queueMicrotask(()=>{
   if(disposed||!eventKey||lastEvent.current===eventKey)return;
   lastEvent.current=eventKey;
   const host=ref.current;
   if(!host||!enabled||paused||powerSaver||mode==='off'||document.hidden)return;
   const media=typeof window.matchMedia==='function'?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
   // Unknown motion/visibility capability fails to a fully usable static view.
   if(!media||media.matches||typeof IntersectionObserver!=='function')return;
   let consumed=false;
   const handles=new Set<Animation>();
   const cancel=()=>{
    consumed=true;
    for(const animation of handles){animation.onfinish=null;animation.oncancel=null;animation.cancel()}
    handles.clear();
   };
   const stopIfHidden=()=>{if(document.hidden||media.matches)cancel()};
   const observer=new IntersectionObserver(entries=>{
    const entry=entries.find(value=>value.target===host);
    if(!entry)return;
    if(!entry.isIntersecting||entry.intersectionRatio<=0){cancel();return}
    if(consumed||disposed)return;
    consumed=true;
    if(document.hidden||media.matches)return;
    const cubes=kind==='gather'||kind==='dock';
    const targets=cubes?Array.from(host.querySelectorAll<HTMLElement>('[data-motion-piece]')).slice(0,kind==='gather'?24:16):kind==='cards'?Array.from(host.querySelectorAll<HTMLElement>('[data-motion-card]')).slice(0,6):[host];
    try{
     targets.forEach((target,index)=>{
      if(typeof target.animate!=='function')return;
      const holo=mode==='hologram';
      const angle=index*2.399963229728653;
      const radius=(holo?48:24)*(0.65+(index%3)*0.175);
      const x=Math.round(Math.cos(angle)*radius),y=Math.round(Math.sin(angle)*radius);
      const frames:Keyframe[]=cubes?[
       {transform:`translate(${x}px, ${y}px) rotate(${index%2?35:-35}deg) scale(.45)`,opacity:.3},
       {transform:'translate(0px, 0px) rotate(0deg) scale(1)',opacity:1},
      ]:kind==='bubble'?[
       {transform:'translateY(6px) scale(.98)',opacity:.75},{transform:'translateY(0px) scale(1)',opacity:1},
      ]:[
       {transform:kind==='cards'?'translateY(8px)':'translateY(12px) scale(.985)',opacity:.8},
       {transform:'translateY(0px) scale(1)',opacity:1},
      ];
      const duration=kind==='gather'?(holo?620:500):kind==='dock'?(holo?480:360):kind==='bubble'?220:kind==='cards'?250:260;
      const delay=cubes?index*(kind==='gather'?12:8):kind==='cards'?index*25:0;
      const animation=target.animate(frames,{duration,delay,easing:ease,iterations:1,fill:'none'});
      handles.add(animation);
      // Release compositing resources; never advance any domain state here.
      animation.onfinish=()=>{animation.onfinish=null;animation.oncancel=null;handles.delete(animation);animation.cancel()};
      animation.oncancel=()=>{animation.onfinish=null;animation.oncancel=null;handles.delete(animation)};
     });
    }catch{cancel()}
   },{threshold:0});
   document.addEventListener('visibilitychange',stopIfHidden);media.addEventListener('change',stopIfHidden);observer.observe(host);
   cleanup=()=>{cancel();observer.disconnect();document.removeEventListener('visibilitychange',stopIfHidden);media.removeEventListener('change',stopIfHidden)};
  });
  return()=>{disposed=true;cleanup()};
 },[ref,eventKey,kind,mode,powerSaver,paused,enabled]);
}
