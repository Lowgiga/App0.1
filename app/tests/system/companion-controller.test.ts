import test from 'node:test';
import assert from 'node:assert/strict';
import {CompanionController, type CompanionScene} from '../../src/companion/controller.ts';
import {initialCompanionState,reduceCompanion} from '../../src/companion/state.ts';

const tick=()=>new Promise(r=>setImmediate(r));
function harness(pending=false){
 let finish!:(scene:CompanionScene)=>void,loads=0,disposed=0,frames=0,renders=0,time=0,next=0,signal:AbortSignal|undefined;
 const timers=new Map<number,()=>void>(),rafs=new Map<number,()=>void>();
 const scene:CompanionScene={update(){frames++},render(){renders++},resize(){},setPresentation(){},dispose(){disposed++}};
 const statuses:string[]=[];
 const controller=new CompanionController({load:async s=>{loads++;signal=s;return pending?new Promise<CompanionScene>(r=>{finish=r}):scene},onStatus:s=>statuses.push(s),clock:()=>time,schedule:cb=>{timers.set(++next,cb);return next},cancel:id=>{timers.delete(id)},frame:cb=>{rafs.set(++next,cb);return next},cancelFrame:id=>{rafs.delete(id)}});
 const visible={enabled:true,visible:true,pageVisible:true,motionEnabled:true,reducedMotion:false,powerSaver:false,paused:false,maxAnimationRate:24};
 return {controller,scene,visible,statuses,finish:()=>finish(scene),signal:()=>signal,stats:()=>({loads,disposed,frames,renders,timers:timers.size,rafs:rafs.size}),async frame(ms=50){time+=ms;for(const [id,cb] of [...timers]){timers.delete(id);cb()}for(const [id,cb] of [...rafs]){rafs.delete(id);cb()}await tick()}};
}
test('load once; events and size updates never recreate resources; owner disposes once',async()=>{
 const h=harness();h.controller.configure(h.visible);await tick();
 h.controller.present(reduceCompanion(initialCompanionState(),{type:'requestStarted',requestId:'a',eventId:'1',simulation:true},0));
 h.controller.resize(300,220);await h.frame();h.controller.configure({...h.visible,maxAnimationRate:10});await h.frame(100);
 assert.equal(h.stats().loads,1);assert.ok(h.stats().frames>0);h.controller.dispose();h.controller.dispose();
 assert.equal(h.stats().disposed,1);assert.equal(h.stats().timers+h.stats().rafs,0);
});
for(const gate of ['visible','pageVisible','motionEnabled','enabled'] as const)test(gate+' gate cancels pending work and frames',async()=>{
 const h=harness();h.controller.configure({...h.visible,[gate]:false});await tick();assert.equal(h.stats().loads,0);
 h.controller.configure(h.visible);await tick();await h.frame();const before=h.stats().frames;
 h.controller.configure({...h.visible,[gate]:false});await h.frame(1000);assert.equal(h.stats().frames,before);assert.equal(h.stats().timers+h.stats().rafs,0);
 h.controller.configure(h.visible);await tick();await h.frame();assert.equal(h.stats().loads,1);h.controller.dispose();
});
for(const gate of ['reducedMotion','powerSaver','paused'] as const)test(gate+' uses static fallback and schedules no GPU loop',async()=>{
 const h=harness();h.controller.configure({...h.visible,[gate]:true});await tick();assert.equal(h.stats().loads,0);
 h.controller.configure(h.visible);await tick();await h.frame();h.controller.configure({...h.visible,[gate]:true});
 assert.equal(h.stats().timers+h.stats().rafs,0);assert.equal(h.statuses.at(-1),'static');h.controller.dispose();
});
test('unmount aborts generation; late fulfilled scene is disposed and never rendered',async()=>{
 const h=harness(true);h.controller.configure(h.visible);await tick();h.controller.dispose();assert.equal(h.signal()?.aborted,true);
 h.finish();await tick();assert.equal(h.stats().disposed,1);assert.equal(h.stats().renders,0);assert.equal(h.stats().timers+h.stats().rafs,0);
});
test('hiding during load pauses late result without reload, resume uses same scene',async()=>{
 const h=harness(true);h.controller.configure(h.visible);await tick();h.controller.configure({...h.visible,pageVisible:false});h.finish();await tick();
 assert.equal(h.stats().renders,0);h.controller.configure(h.visible);await h.frame();assert.equal(h.stats().loads,1);assert.ok(h.stats().renders>0);h.controller.dispose();
});
test('render error releases resources and remains in complete text mode without retry loop',async()=>{
 const h=harness();h.scene.render=()=>{throw new Error('lost WebGL')};h.controller.configure(h.visible);await tick();await h.frame();
 assert.equal(h.statuses.at(-1),'unavailable');assert.equal(h.stats().disposed,1);h.controller.configure(h.visible);await tick();assert.equal(h.stats().loads,1);h.controller.dispose();
});
test('repeated mounts each release exactly their own resources',async()=>{
 for(let i=0;i<4;i++){const h=harness();h.controller.configure(h.visible);await tick();h.controller.dispose();await h.frame();assert.equal(h.stats().disposed,1);assert.equal(h.stats().timers+h.stats().rafs,0)}
});
