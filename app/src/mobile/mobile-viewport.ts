export type MobileViewport = Pick<VisualViewport,'height'|'offsetTop'|'scale'>;
export function mobileViewportMetrics(layoutHeight:number,viewport:MobileViewport|null) {
  const normal={bottomInset:0,keyboardOccluded:false};
  if(!viewport||!Number.isFinite(layoutHeight)||layoutHeight<=0||!Number.isFinite(viewport.height)||viewport.height<=0||!Number.isFinite(viewport.offsetTop)||viewport.offsetTop<0||!Number.isFinite(viewport.scale)||Math.abs(viewport.scale-1)>0.05)return normal;
  const bottomInset=Math.max(0,Math.min(layoutHeight,layoutHeight-viewport.height-viewport.offsetTop));
  return {bottomInset,keyboardOccluded:bottomInset>80};
}
