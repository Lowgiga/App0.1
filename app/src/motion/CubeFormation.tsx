import {useRef,type CSSProperties} from 'react';
import {useFiniteMotion,type PresentationMotionMode} from './use-finite-motion.ts';
import './assistant-motion.css';
interface Props {kind:'gather'|'dock';eventKey:string|null;mode:PresentationMotionMode;powerSaver:boolean;enabled?:boolean;paused?:boolean}
/** Original geometric decoration. No text/status, pointer handling or domain API. */
export function CubeFormation({kind,eventKey,mode,powerSaver,enabled=true,paused=false}:Props){
 const host=useRef<HTMLDivElement>(null);
 useFiniteMotion(host,{kind,eventKey,mode,powerSaver,enabled,paused});
 const count=kind==='gather'?(mode==='hologram'?24:12):(mode==='hologram'?16:8),columns=kind==='gather'?(mode==='hologram'?6:4):4;
 const rows=Math.ceil(count/columns);
 return <div ref={host} className="lq-motion-formation" aria-hidden="true" data-formation={enabled?kind:'none'} data-active={enabled?'true':'false'} data-motion={powerSaver?'off':mode}>
  {Array.from({length:count},(_,index)=><span key={index} className="lq-motion-cube" data-motion-piece style={{'--cube-x':`${(index%columns-(columns-1)/2)*13}px`,'--cube-y':`${(Math.floor(index/columns)-(rows-1)/2)*13}px`} as CSSProperties}><i className="lq-cube-top"/><i className="lq-cube-left"/><i className="lq-cube-right"/></span>)}
 </div>;
}
