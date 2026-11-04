import schema from '../schema/surface-v1.schema.json' with {type:'json'};
import {SurfaceError} from './json.ts';
import type {ComponentKind,Limits,SurfaceProposal} from './types.ts';
type Schema = { $ref?:string;type?:string;const?:unknown;enum?:unknown[];oneOf?:Schema[];properties?:Record<string,Schema>;required?:string[];additionalProperties?:boolean;items?:Schema;minItems?:number;maxItems?:number;minLength?:number;maxLength?:number;pattern?:string;minimum?:number;maximum?:number };
// Evaluates only the small, fixed keyword subset used by the bundled trusted schema.
// Never accepts schemas or schema URLs from a proposal. It is not a general schema engine.
function matches(value:unknown,s:Schema):boolean {
 if(s.$ref)return s.$ref==='#/$defs/component' && matches(value,schema.$defs.component as unknown as Schema);
 if(s.oneOf)return s.oneOf.filter(x=>matches(value,x)).length===1;
 if('const'in s&&value!==s.const)return false;if(s.enum&&!s.enum.includes(value))return false;
 if(s.type==='object'){if(!value||typeof value!=='object'||Array.isArray(value))return false;const o=value as Record<string,unknown>;if(s.required?.some(k=>!Object.hasOwn(o,k)))return false;return Object.keys(o).every(k=>s.properties&&Object.hasOwn(s.properties,k)&&matches(o[k],s.properties[k]))}
 if(s.type==='array')return Array.isArray(value)&&value.length>=(s.minItems??0)&&value.length<=(s.maxItems??Infinity)&&value.every(v=>!s.items||matches(v,s.items));
 if(s.type==='string')return typeof value==='string'&&[...value].length>=(s.minLength??0)&&[...value].length<=(s.maxLength??Infinity)&&(!s.pattern||new RegExp(s.pattern).test(value));
 if(s.type==='integer')return typeof value==='number'&&Number.isSafeInteger(value)&&value>=(s.minimum??-Infinity)&&value<=(s.maximum??Infinity);
 return !s.type;
}
export function validateProposal(value:unknown,limits:Limits,registered:ReadonlySet<ComponentKind>,actions:ReadonlySet<string>):SurfaceProposal {
 if(!matches(value,schema as Schema))throw new SurfaceError('schema');
 const p=value as SurfaceProposal;if(p.components.length>limits.maxComponents)throw new SurfaceError('nodes');
 const nodes=new Map(p.components.map(c=>[c.id,c]));if(nodes.size!==p.components.length)throw new SurfaceError('duplicate-id');
 for(const c of p.components){if(!registered.has(c.type))throw new SurfaceError('unregistered-component');if(c.actionRef&&!actions.has(c.actionRef))throw new SurfaceError('forbidden-action');if(c.type==='Group'){if(c.props.layout==='focus'){if(!c.props.focusId||!c.children.includes(c.props.focusId))throw new SurfaceError('focus')}else if(c.props.focusId)throw new SurfaceError('focus')}}
 if(nodes.get(p.rootId)?.type!=='Group')throw new SurfaceError('root');
 const visited=new Set<string>(),active=new Set<string>();
 function walk(id:string,depth:number){if(depth>limits.maxDepth)throw new SurfaceError('depth');if(active.has(id))throw new SurfaceError('cycle');if(visited.has(id))throw new SurfaceError('multiple-parents');const n=nodes.get(id);if(!n)throw new SurfaceError('missing-child');active.add(id);visited.add(id);if(n.type==='Group')n.children.forEach(c=>walk(c,depth+1));active.delete(id)}
 walk(p.rootId,1);if(visited.size!==nodes.size)throw new SurfaceError('unreachable');return p;
}
