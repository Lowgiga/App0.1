import type * as Three from 'three';
import type {NodeAppearance} from './contracts.ts';

/** Host-owned layers. Replacing style never replaces a renderer, node center, or camera. */
export function createAppearanceVisual(T: typeof Three, initial: NodeAppearance, options: {radius:number;wireframe?:boolean;opacity?:number}) {
 const group=new T.Group();
 let appearance=initial,selected=false,disposed=false;
 const geometry=(shape:NodeAppearance['shape'],radius:number)=>shape==='cube'?new T.BoxGeometry(radius*2/Math.sqrt(3),radius*2/Math.sqrt(3),radius*2/Math.sqrt(3)):new T.IcosahedronGeometry(radius,1);
 const core=new T.Mesh(geometry(initial.shape,options.radius*.24),new T.MeshBasicMaterial({color:initial.core,wireframe:!!options.wireframe,transparent:true,opacity:options.opacity??.85}));
 const shell=new T.Mesh(geometry(initial.shape,options.radius),new T.MeshBasicMaterial({color:initial.shell,wireframe:true,transparent:true,opacity:.38,depthWrite:false}));
 const orbit=new T.Mesh(new T.TorusGeometry(options.radius*1.4,options.radius*.025,4,32),new T.MeshBasicMaterial({color:initial.orbit,transparent:true,opacity:.65,depthWrite:false}));
 const picker=new T.Mesh(new T.SphereGeometry(options.radius,12,8),new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false}));
 picker.userData.appearanceLayer='picker';
 const coreMaterial=core.material;
 orbit.rotation.x=Math.PI/2.7;
 core.userData.appearanceLayer='core';shell.userData.appearanceLayer='shell';orbit.userData.appearanceLayer='orbit';
 group.add(core,shell,orbit,picker);
 const factor=()=>({small:.8,normal:1,large:1.25}[appearance.size])*(selected?1.22:1);
 const update=(next:NodeAppearance,focus=false)=>{
  if(disposed)return;
  if(next.shape!==appearance.shape){const oldCore=core.geometry,oldShell=shell.geometry;core.geometry=geometry(next.shape,options.radius*.24);shell.geometry=geometry(next.shape,options.radius);oldCore.dispose();oldShell.dispose()}
  appearance=next;selected=focus;coreMaterial.color.set(next.core);shell.material.color.set(next.shell);orbit.material.color.set(next.orbit);group.scale.setScalar(factor());
 };
 const animate=(seconds:number,allowed:boolean)=>{if(disposed)return;const pulse=allowed&&appearance.motion==='breathe'?1+.035*Math.sin(seconds*2*Math.PI/6):1;shell.scale.setScalar(pulse);orbit.scale.setScalar(pulse)};
 const dispose=()=>{if(disposed)return;disposed=true;for(const mesh of [core,shell,orbit,picker]){mesh.geometry.dispose();(mesh===core?coreMaterial:mesh.material).dispose()}group.removeFromParent();group.clear()};
 update(initial);
 return{group,core,shell,orbit,picker,update,animate,dispose};
}
export type AppearanceVisual=ReturnType<typeof createAppearanceVisual>;
export function renderedAppearance(node:{id?:string;appearance?:NodeAppearance;color?:number}):NodeAppearance {
 if(node.appearance)return node.appearance;
 const color='#'+(node.color??0xc7efa0).toString(16).padStart(6,'0');
 return{core:color,shell:color,orbit:color,shape:'polyhedron',size:'normal',motion:'off'};
}
