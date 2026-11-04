import {useEffect,useRef} from 'react';
import type {NodeAppearance} from './contracts.ts';
import {sizeScale} from './projection.ts';
/** SVG mirrors the three layer channels; only decorative layers breathe, never the hit target. */
export function AppearanceGlyph({appearance,radius=14,selected=false,motionAllowed=false}:{appearance:NodeAppearance;radius?:number;selected?:boolean;motionAllowed?:boolean}){
 const decoration=useRef<SVGGElement>(null);
 useEffect(()=>{
  const element=decoration.current;if(!element)return;const owner=element.ownerDocument,win=owner.defaultView;if(!win)return;
  const media=win.matchMedia?.('(prefers-reduced-motion: reduce)');let animation:Animation|null=null,visible=true;
  const sync=()=>{animation?.cancel();animation=null;if(motionAllowed&&appearance.motion==='breathe'&&!owner.hidden&&!media?.matches&&visible&&element.animate)animation=element.animate([{transform:'scale(1)'},{transform:'scale(1.035)',offset:.25},{transform:'scale(1)',offset:.5},{transform:'scale(.965)',offset:.75},{transform:'scale(1)'}],{duration:6000,iterations:Infinity})};
  const observer=win.IntersectionObserver?new win.IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??false;sync()}):null;observer?.observe(element);
  media?.addEventListener('change',sync);owner.addEventListener('visibilitychange',sync);sync();return()=>{animation?.cancel();observer?.disconnect();media?.removeEventListener('change',sync);owner.removeEventListener('visibilitychange',sync)};
 },[appearance.motion,motionAllowed]);
 const r=radius*sizeScale(appearance.size),shape=(size:number,fill:string,stroke?:string)=>appearance.shape==='cube'?<rect x={-size*.75} y={-size*.75} width={size*1.5} height={size*1.5} fill={fill} stroke={stroke} strokeWidth={1.4}/>:<path d={`M0 ${-size} L${size*.95} ${-size*.3} L${size*.59} ${size*.81} L${-size*.59} ${size*.81} L${-size*.95} ${-size*.3} Z`} fill={fill} stroke={stroke} strokeWidth={1.4}/>;
 return <g data-appearance-shape={appearance.shape} data-appearance-size={appearance.size}>
  <circle data-appearance-hit-target="true" r={Math.max(24,r*1.45)} fill="transparent"/>
  {selected&&<><circle data-appearance-selection-ring="halo" r={r*1.6} fill="none" stroke="#07111E" strokeWidth={4.5} pointerEvents="none"/><circle data-appearance-selection-ring="ink" r={r*1.6} fill="none" stroke="#FFFFFF" strokeWidth={1.5} pointerEvents="none"/></>}
  <circle data-appearance-focus-ring="halo" r={Math.max(24,r*1.45)} fill="none" stroke="#07111E" strokeWidth={6} opacity={0} pointerEvents="none"/>
  <circle data-appearance-focus-ring="ink" r={Math.max(24,r*1.45)} fill="none" stroke="#FFFFFF" strokeWidth={3} opacity={0} pointerEvents="none"/>
  <g ref={decoration} style={{transformOrigin:'0px 0px'}}><g data-appearance-layer="shell">{shape(r,'none',appearance.shell)}</g><ellipse data-appearance-layer="orbit" rx={r*1.4} ry={r*.5} fill="none" stroke={appearance.orbit} strokeWidth={1.3} transform="rotate(-25)"/></g>
  <g data-appearance-layer="core">{shape(r*.24,appearance.core)}</g>
 </g>;
}
export function NodeAppearanceSwatch({appearance,motionAllowed=false}:{appearance:NodeAppearance;motionAllowed?:boolean}){return <svg aria-hidden="true" width="40" height="40" viewBox="-22 -22 44 44" style={{display:'inline-block',verticalAlign:'middle',flexShrink:0}}><AppearanceGlyph appearance={appearance} radius={11} motionAllowed={motionAllowed}/></svg>}
