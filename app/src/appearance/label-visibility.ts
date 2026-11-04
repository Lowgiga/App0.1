export type LabelBox={id:string;left:number;top:number;width:number;height:number};
/** Keep projected names readable without moving nodes or changing camera framing. */
export function readableLabelIds(boxes:LabelBox[],selectedId:string|null,focusedId:string|null,gap=4):Set<string>{
 const priority=(id:string)=>id===focusedId?2:id===selectedId?1:0;
 const accepted:LabelBox[]=[];
 for(const box of [...boxes].sort((a,b)=>priority(b.id)-priority(a.id))){
  if(![box.left,box.top,box.width,box.height].every(Number.isFinite)||box.width<=0||box.height<=0)continue;
  if(accepted.some(other=>box.left<other.left+other.width+gap&&box.left+box.width+gap>other.left&&box.top<other.top+other.height+gap&&box.top+box.height+gap>other.top))continue;
  accepted.push(box);
 }
 return new Set(accepted.map(box=>box.id));
}

export function containLabelBox(box:LabelBox,bounds:{left:number;top:number;width:number;height:number}):LabelBox{
 return {...box,left:Math.max(bounds.left,Math.min(box.left,bounds.left+bounds.width-box.width)),top:Math.max(bounds.top,Math.min(box.top,bounds.top+bounds.height-box.height))};
}

// Vendor focus outline: 3px outline + 3px offset; keep one extra pixel inside.
export const LABEL_FOCUS_INSET=7;
type ProjectedLabel={id:string;x:number;y:number;visible:boolean};
/** DOM reads occur in one explicit measurement batch, never on each animation frame. */
export function createLabelLayout(container:HTMLElement,labelNodes:Map<string,HTMLButtonElement>){
 const owner=container.ownerDocument,sizes=new Map<string,{width:number;height:number}>();
 let width=640,height=440,dirty=true,mode:'none'|'selected'|'all'='selected';
 const invalidate=()=>{dirty=true};
 const resize=(nextWidth:number,nextHeight:number)=>{if(width!==nextWidth||height!==nextHeight){width=nextWidth;height=nextHeight;invalidate()}};
 const sync=(nodes:readonly {id:string;title:string}[],nextMode:typeof mode,selectedId:string|null,onSelect:(id:string)=>void)=>{
  mode=nextMode;const keep=new Set<string>();
  for(const node of nodes){
   if(mode==='none'||mode==='selected'&&node.id!==selectedId)continue;keep.add(node.id);
   let button=labelNodes.get(node.id);
   if(!button){button=owner.createElement('button');button.className='mesh-three-label';container.append(button);labelNodes.set(node.id,button);invalidate()}
   const text=node.title.length>36?node.title.slice(0,35)+'…':node.title;
   if(button.textContent!==text||button.title!==node.title){button.textContent=text;button.title=node.title;button.setAttribute('aria-label',node.title);invalidate()}
   button.setAttribute('aria-pressed',String(node.id===selectedId));button.onclick=()=>onSelect(node.id);
  }
  for(const [id,button]of labelNodes)if(!keep.has(id)){button.remove();labelNodes.delete(id);sizes.delete(id)}
 };
 const draw=(projected:ProjectedLabel[],selectedId:string|null)=>{
  const focusedId=[...labelNodes].find(([,button])=>owner.activeElement===button)?.[0]??null;
  if(dirty){
   // All reveal/width writes precede every measurement. The final visibility pass
   // runs synchronously before paint; a focused node is never removed/recreated.
   for(const button of labelNodes.values()){button.hidden=false;button.style.maxWidth=Math.max(1,Math.min(210,width-2*LABEL_FOCUS_INSET))+'px'}
   for(const [id,button]of labelNodes){const rect=button.getBoundingClientRect();sizes.set(id,{width:rect.width,height:rect.height})}
   dirty=false;
  }
  const bounds={left:LABEL_FOCUS_INSET,top:LABEL_FOCUS_INSET,width:Math.max(0,width-2*LABEL_FOCUS_INSET),height:Math.max(0,height-2*LABEL_FOCUS_INSET)},boxes:LabelBox[]=[];
  for(const point of projected){const size=sizes.get(point.id);if(!size||!Number.isFinite(point.x)||!Number.isFinite(point.y)||!point.visible&&point.id!==focusedId)continue;
   boxes.push(containLabelBox({id:point.id,left:(point.x+1)*width/2-size.width/2,top:(1-point.y)*height/2+16,...size},bounds));
  }
  const visible=mode==='all'?readableLabelIds(boxes,selectedId,focusedId):new Set(boxes.map(box=>box.id));
  for(const [id,button]of labelNodes){const hidden=!visible.has(id);if(button.hidden!==hidden)button.hidden=hidden}
  for(const box of boxes){const button=labelNodes.get(box.id)!;if(button.hidden)continue;const left=box.left+box.width/2+'px',top=box.top-16+'px';if(button.style.left!==left)button.style.left=left;if(button.style.top!==top)button.style.top=top}
 };
 return{sync,resize,draw,invalidate};
}
