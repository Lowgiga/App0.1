import * as THREE from 'three';
import {createGraphScene as createBaseScene} from '../../vendor/mesh-extensions/src/three-scene.ts';
import type {SpatialViewProps} from '../../vendor/mesh-extensions/src/render-types.ts';
import type {NodeAppearance} from './contracts.ts';
import {createAppearanceVisual,renderedAppearance,type AppearanceVisual} from './web-three.ts';

type SceneProps=Pick<SpatialViewProps,'scene'|'layout'|'config'>;
/** Appearance is excluded from this key so a preview cannot rebuild the scene or refit a camera. */
export function appearanceSceneKey(props:SceneProps){return JSON.stringify({nodes:props.scene.nodes.map(({id,title,kind,origin,status})=>[id,title,kind,origin,status]),edges:props.scene.edges,layout:props.layout,selected:props.config.selectedId,highlight:props.config.highlightRelations,style:props.config.visualStyle,quality:props.config.quality})}
export function createAppearanceGraphScene(initial:SceneProps){
 const base=createBaseScene(initial),visuals=new Map<string,AppearanceVisual>();let disposed=false;
 try{
  for(const mesh of [...base.pickables]){
   const id=String(mesh.userData.nodeId),node=initial.scene.nodes.find(n=>n.id===id)!;
   const visual=createAppearanceVisual(THREE,renderedAppearance(node),{radius:.14,wireframe:node.origin!=='own'||initial.config.visualStyle==='hologram'});
   visual.group.position.copy(mesh.position);visual.core.userData.nodeId=id;visual.picker.userData.nodeId=id;mesh.removeFromParent();base.scene.add(visual.group);visuals.set(id,visual);
  }
  base.pickables.splice(0,base.pickables.length,...[...visuals.values()].map(v=>v.picker));
  const update=(props:SceneProps)=>{for(const node of props.scene.nodes){const visual=visuals.get(node.id);if(!visual)continue;visual.update(renderedAppearance(node as typeof node&{appearance?:NodeAppearance}),node.id===props.config.selectedId);const related=!props.config.highlightRelations||!props.config.selectedId||node.id===props.config.selectedId||props.scene.edges.some(e=>e.from===props.config.selectedId&&e.to===node.id||e.to===props.config.selectedId&&e.from===node.id);visual.core.material.opacity=related?.85:.3;visual.shell.material.opacity=related?.38:.14;visual.orbit.material.opacity=related?.65:.2}};
  const animate=(seconds:number,allowed:boolean)=>{for(const visual of visuals.values())visual.animate(seconds,allowed)};
  update(initial);
  return{...base,update,animate,dispose(){if(disposed)return;disposed=true;for(const v of visuals.values())v.dispose();visuals.clear();base.dispose()}};
 }catch(error){for(const v of visuals.values())v.dispose();base.dispose();throw error}
}
export type AppearanceGraphScene=ReturnType<typeof createAppearanceGraphScene>;
