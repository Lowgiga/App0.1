import {companionPresentation,initialCompanionState,type CompanionState} from './state.ts';

export interface CompanionScene {
 setPresentation(presentation:ReturnType<typeof companionPresentation>):void;
 update(deltaSeconds:number,elapsedSeconds:number):void;
 render():void;resize(width:number,height:number):void;dispose():void;
}
export interface CompanionRenderOptions {
 enabled:boolean;visible:boolean;pageVisible:boolean;motionEnabled:boolean;
 reducedMotion:boolean;powerSaver:boolean;paused:boolean;maxAnimationRate:number;
}
export type CompanionRenderStatus='disabled'|'static'|'loading'|'running'|'unavailable';
interface Runtime {
 load:(signal:AbortSignal)=>Promise<CompanionScene>;
 onStatus:(status:CompanionRenderStatus)=>void;
 clock?:()=>number;schedule?:(callback:()=>void,delayMs:number)=>number;cancel?:(id:number)=>void;
 frame?:(callback:()=>void)=>number;cancelFrame?:(id:number)=>void;
}
export const DEFAULT_MAX_ANIMATION_RATE=24;
/** One owner per mounted panel. No transport, provider, persistence or rights. */
export class CompanionController {
 private readonly abort=new AbortController();
 private readonly runtime:Required<Runtime>;
 private options:CompanionRenderOptions={enabled:false,visible:false,pageVisible:false,motionEnabled:false,reducedMotion:true,powerSaver:false,paused:false,maxAnimationRate:DEFAULT_MAX_ANIMATION_RATE};
 private scene:CompanionScene|null=null;
 private state=initialCompanionState();
 private loading=false;private failed=false;private disposed=false;
 private timer:number|null=null;private raf:number|null=null;
 private previous:number|null=null;private elapsed=0;private width=320;private height=200;
 private status:CompanionRenderStatus|null=null;
 constructor(runtime:Runtime){
  this.runtime={...runtime,clock:runtime.clock??(()=>performance.now()),schedule:runtime.schedule??((cb,ms)=>window.setTimeout(cb,ms)),cancel:runtime.cancel??(id=>window.clearTimeout(id)),frame:runtime.frame??(cb=>requestAnimationFrame(cb)),cancelFrame:runtime.cancelFrame??(id=>cancelAnimationFrame(id))};
 }
 private active(){const o=this.options;return !this.disposed&&!this.failed&&o.enabled&&o.visible&&o.pageVisible&&o.motionEnabled&&!o.reducedMotion&&!o.powerSaver&&!o.paused}
 private report(status:CompanionRenderStatus){if(this.status===status||this.disposed)return;this.status=status;this.runtime.onStatus(status)}
 configure(options:CompanionRenderOptions){
  if(this.disposed)return;
  const rate=Number.isFinite(options.maxAnimationRate)?Math.min(30,Math.max(1,options.maxAnimationRate)):DEFAULT_MAX_ANIMATION_RATE;
  this.options={...options,maxAnimationRate:rate};this.stopLoop();
  if(this.failed){this.report('unavailable');return}
  if(!this.active()){this.report(options.enabled?'static':'disabled');return}
  if(this.scene){this.report('running');this.draw();return}
  this.report('loading');if(this.loading)return;
  this.loading=true;
  void this.runtime.load(this.abort.signal).then(scene=>{
   this.loading=false;
   if(this.disposed||this.abort.signal.aborted){scene.dispose();return}
   this.scene=scene;
   try{scene.resize(this.width,this.height);scene.setPresentation(companionPresentation(this.state));if(this.active()){this.report('running');this.draw()}}
   catch{this.fail()}
  }).catch(()=>{this.loading=false;if(!this.disposed)this.fail()});
 }
 present(state:CompanionState){
  if(this.disposed)return;this.state=state;
  try{this.scene?.setPresentation(companionPresentation(state))}catch{this.fail()}
 }
 resize(width:number,height:number){
  if(this.disposed)return;
  this.width=Math.max(1,Math.min(2048,Number.isFinite(width)?width:320));
  this.height=Math.max(1,Math.min(2048,Number.isFinite(height)?height:200));
  try{this.scene?.resize(this.width,this.height)}catch{this.fail()}
 }
 private draw(){
  if(!this.active()||!this.scene)return;
  const now=this.runtime.clock(),dt=this.previous===null?0:Math.min(.1,Math.max(0,(now-this.previous)/1000));
  this.previous=now;this.elapsed+=dt;
  try{this.scene.update(dt,this.elapsed);this.scene.render()}catch{this.fail();return}
  if(!this.active())return;
  this.timer=this.runtime.schedule(()=>{this.timer=null;if(this.active())this.raf=this.runtime.frame(()=>{this.raf=null;this.draw()})},1000/this.options.maxAnimationRate);
 }
 private stopLoop(){if(this.timer!==null)this.runtime.cancel(this.timer);if(this.raf!==null)this.runtime.cancelFrame(this.raf);this.timer=null;this.raf=null;this.previous=null}
 private fail(){this.failed=true;this.stopLoop();const scene=this.scene;this.scene=null;try{scene?.dispose()}finally{this.report('unavailable')}}
 dispose(){
  if(this.disposed)return;this.disposed=true;this.abort.abort();this.stopLoop();
  const scene=this.scene;this.scene=null;scene?.dispose();
 }
}
