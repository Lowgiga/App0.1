import type {WorkState} from '../../upstream/lib/work-contract.ts';
import {appearanceBindingContract,type AppearanceBinding,type AppearanceState,type NodeAppearance} from './contracts.ts';
export type AppearanceNode={id:string;entityId:string;kind:string;color?:number};
const colors:Readonly<Record<string,number>>={agent:0xc7efa0,mission:0x8bddd0,task:0xffd092,room:0xb8c7ff,source:0xb3e8ff,system:0xcab8f4,lesson:0xf3b4cf};
export function appearanceBinding(node:AppearanceNode,work:WorkState):AppearanceBinding|null{
 if((node.kind!=='room'&&node.kind!=='mission')||node.id!==`${node.kind}:${node.entityId}`)return null;
 const entity=node.kind==='room'?work.rooms.find(room=>room.id===node.entityId&&room.status!=='Archiviert'):work.command.missions.find(mission=>mission.id===node.entityId&&!mission.archived);
 if(!entity)return null;
 const result=appearanceBindingContract.safeParse({kind:node.kind,id:entity.id,createdAt:entity.createdAt});
 return result.success?result.data:null;
}
export function sizeScale(size:NodeAppearance['size']):number{return{small:0.8,normal:1,large:1.25}[size]}
export function resolveNodeAppearance(node:AppearanceNode,work:WorkState,state:AppearanceState):NodeAppearance{
 // Known semantic colors, rather than node.color, make repeated projection and cancel idempotent.
 const color=colors[node.kind]??0xcab8f4;
 const hex='#'+color.toString(16).padStart(6,'0').toUpperCase();
 const binding=appearanceBinding(node,work);
 const override=binding?state.overrides.find(({binding:other})=>other.kind===binding.kind&&other.id===binding.id&&other.createdAt===binding.createdAt)?.style:undefined;
 return{core:hex,shell:hex,orbit:hex,shape:'polyhedron',size:'normal',motion:'off',...state.global,...override};
}
export function projectSpaceAppearance<T extends {nodes:readonly AppearanceNode[]}>(graph:T,work:WorkState,state:AppearanceState):Omit<T,'nodes'>&{nodes:Array<T['nodes'][number]&{appearance:NodeAppearance;color:number}>}{
 return{...graph,nodes:graph.nodes.map(node=>{const appearance=resolveNodeAppearance(node,work,state);return{...node,appearance,color:parseInt(appearance.core.slice(1),16)}})};
}
