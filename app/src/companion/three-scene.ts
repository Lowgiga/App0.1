import * as THREE from 'three';
import modelData from './assets/paz-companion.glb?url&inline';
import {decodeInlineAsset,parseOfflineCompanion,disposeModel} from './offline-asset.ts';
import {pingPongPose,type CompanionClip,companionPresentation} from './state.ts';
import type {CompanionScene} from './controller.ts';

/** Only packaged asset bytes are parsed: no loadAsync, external URL or importer. */
export async function createThreeCompanion(host:HTMLElement,signal:AbortSignal):Promise<CompanionScene>{
 const gltf=await parseOfflineCompanion(decodeInlineAsset(modelData),signal);
 let renderer:THREE.WebGLRenderer;
 try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,powerPreference:'low-power'})}
 catch(error){disposeModel(gltf.scene);throw error}
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.1,50),actor=new THREE.Group();
 const mixer=new THREE.AnimationMixer(gltf.scene);
 let disposed=false,contextLost=false,current:THREE.AnimationAction|null=null,clipName:CompanionClip='Idle',walking=true,travel=0;
 const actions=new Map(gltf.animations.map(clip=>[clip.name,mixer.clipAction(clip)]));
 const contextLoss=(event:Event)=>{event.preventDefault();contextLost=true};
 function dispose(){
  if(disposed)return;disposed=true;
  renderer.domElement.removeEventListener('webglcontextlost',contextLoss);
  mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);actor.removeFromParent();disposeModel(gltf.scene);
  renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
 }
 function select(name:CompanionClip){
  const action=actions.get(name)??actions.get('Idle');if(!action||action===current)return;
  action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);
  action.setLoop(name==='Celebrate'||name==='Idea'?THREE.LoopOnce:THREE.LoopRepeat,name==='Celebrate'||name==='Idea'?1:Infinity);
  action.clampWhenFinished=true;action.play();if(current)current.crossFadeTo(action,.24,false);current=action;
 }
 try{
  const box=new THREE.Box3().setFromObject(gltf.scene),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  const scale=1.9/Math.max(size.y,.01);gltf.scene.scale.setScalar(scale);gltf.scene.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);
  actor.add(gltf.scene);scene.add(actor);
  scene.add(new THREE.HemisphereLight(0xc8edff,0x404837,2.8));
  const key=new THREE.DirectionalLight(0xffffff,5);key.position.set(3,4,5);scene.add(key);
  const fill=new THREE.DirectionalLight(0x9cffa0,2.2);fill.position.set(-3,2,2);scene.add(fill);
  camera.position.set(0,1.45,7);camera.lookAt(0,1.0,0);
  renderer.setPixelRatio(Math.min(1.5,window.devicePixelRatio||1));renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  renderer.domElement.setAttribute('aria-hidden','true');renderer.domElement.className='companion-canvas';
  renderer.domElement.addEventListener('webglcontextlost',contextLoss);
  if(signal.aborted){dispose();throw new DOMException('Companion load cancelled','AbortError')}
  host.appendChild(renderer.domElement);select('Walk');
  mixer.addEventListener('finished',()=>{if(clipName==='Celebrate'||clipName==='Idea')select('Idle')});
  return {
   setPresentation(p:ReturnType<typeof companionPresentation>){if(disposed)return;walking=p.clip==='Idle';clipName=p.clip;select(walking?'Walk':p.clip);if(!walking)actor.rotation.y=0},
   update(dt:number){
    if(disposed||contextLost)throw new Error('Companion renderer unavailable');
    if(walking){travel+=dt;const pose=pingPongPose(travel);actor.position.x=pose.x;actor.rotation.y=pose.rotationY}
    mixer.update(dt);
   },
   resize(width:number,height:number){if(disposed)return;camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false)},
   render(){if(disposed||contextLost)throw new Error('Companion renderer unavailable');renderer.render(scene,camera)},
   dispose,
  };
 }catch(error){dispose();throw error}
}
