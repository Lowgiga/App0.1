import {useEffect,useRef,useState,type CSSProperties,type KeyboardEvent} from 'react';
import {mobileAction,parseMobilePreferences,type MobileActionId,type MobilePreferences,type MobileTarget} from './mobile-contract.ts';
import {mobileViewportMetrics} from './mobile-viewport.ts';
import './mobile.css';

type Props={value:MobilePreferences;selectedAction?:MobileActionId|null;onNavigate:(target:MobileTarget)=>void;active?:boolean;disabled?:boolean;unavailable?:readonly MobileActionId[]};
function editing(element:Element|null):boolean {
  if(!(element instanceof HTMLElement))return false;
  if(element.closest('[contenteditable="true"],[contenteditable=""],[role="textbox"]'))return true;
  if(element.tagName==='TEXTAREA'||element.tagName==='SELECT')return !(element as HTMLTextAreaElement).disabled;
  if(element.tagName==='INPUT') {const input=element as HTMLInputElement;return !input.disabled&&!input.readOnly&&!['button','submit','reset','checkbox','radio','range','color','file','hidden'].includes(input.type);}
  return false;
}

export function MobileActionBar({value,selectedAction=null,onNavigate,active=true,disabled=false,unavailable=[]}:Props) {
  const slots=parseMobilePreferences(value).slots;
  const nav=useRef<HTMLElement>(null),[barHeight,setBarHeight]=useState(0);
  const [viewport,setViewport]=useState({bottomInset:0,keyboardOccluded:false,editing:false});
  useEffect(()=>{
    let alive=true;const visual=window.visualViewport;
    const update=()=>{if(alive)setViewport({...mobileViewportMetrics(window.innerHeight,visual),editing:editing(document.activeElement)})};
    const focus=()=>queueMicrotask(update);
    update();window.addEventListener('resize',update);visual?.addEventListener('resize',update);visual?.addEventListener('scroll',update);
    document.addEventListener('focusin',focus);document.addEventListener('focusout',focus);
    return()=>{alive=false;window.removeEventListener('resize',update);visual?.removeEventListener('resize',update);visual?.removeEventListener('scroll',update);document.removeEventListener('focusin',focus);document.removeEventListener('focusout',focus)};
  },[]);
  // Hide while editing even on WebViews without VisualViewport or with
  // adjustResize, where the layout viewport itself shrinks with the IME.
  const hidden=!active||viewport.editing||viewport.keyboardOccluded||slots.every(slot=>slot===null);
  useEffect(()=>{
    if(hidden||!nav.current)return;const element=nav.current;
    const measure=()=>{const height=element.getBoundingClientRect().height;if(height>0)setBarHeight(height)};
    measure();const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);observer?.observe(element);
    window.addEventListener('resize',measure);return()=>{observer?.disconnect();window.removeEventListener('resize',measure)};
  },[hidden]);
  function moveFocus(event:KeyboardEvent<HTMLElement>) {
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    const buttons=Array.from(nav.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]),current=buttons.indexOf(document.activeElement as HTMLButtonElement);
    if(current<0||buttons.length===0)return;event.preventDefault();
    const index=event.key==='Home'?0:event.key==='End'?buttons.length-1:(current+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
    buttons[index].focus();
  }
  if(hidden)return null;
  const style={'--lq-mobile-bottom-inset':viewport.bottomInset+'px',...(barHeight>0?{'--lq-mobile-bar-height':barHeight+'px'}:{})} as CSSProperties;
  return <div className="lq-mobile-actionbar-host" style={style}>
    <div className="lq-mobile-actionbar-spacer" aria-hidden="true"/>
    <nav ref={nav} className="lq-mobile-actionbar" aria-label="App-Schnelltasten" onKeyDown={moveFocus}>
      {slots.map((slot,index)=>{const action=mobileAction(slot);return action?<button key={action.id} type="button" data-slot-index={index} aria-current={selectedAction===action.id?'page':undefined} disabled={disabled||unavailable.includes(action.id)} onClick={()=>{if(active&&!disabled&&!unavailable.includes(action.id))onNavigate(action.target)}}>{action.label}</button>:null})}
    </nav>
  </div>;
}
