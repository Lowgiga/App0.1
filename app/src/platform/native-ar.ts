import {z} from 'zod';
import {nodeAppearanceContract as appearanceSchema} from '../appearance/contracts';
import {contentDigest} from '../../upstream/lib/content-digest';
import {kindNames,originNames,type SpaceGraph} from '../../overlay/lib/space-model';
const invalidUnicode=/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;
const controls=/[\u0000-\u001F\u007F-\u009F]/u;
const multilineControls=/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/u;
const text=(max:number,multiline=false,empty=false)=>z.string().max(max).refine(s=>(empty||!!s.trim())&&!invalidUnicode.test(s)&&!(multiline?multilineControls:controls).test(s));
const nodeSchema=z.object({color:z.number().int().min(0).max(0xffffff).optional(),id:text(128),label:text(120),detail:text(1000,true,true).optional(),x:z.number().finite().min(-1).max(1),y:z.number().finite().min(-1).max(1),z:z.number().finite().min(-1).max(1)}).strict();
// Keep the legacy node schema closed: v1 cannot silently discard v2-only appearance.
const snapshotBase=z.object({motionAllowed:z.boolean().optional(),snapshotRevision:text(128),title:text(120),edges:z.array(z.object({from:z.number().int().nonnegative(),to:z.number().int().nonnegative()}).strict()).max(4096)}).strict();
const snapshotSchema=z.discriminatedUnion('version',[
 snapshotBase.extend({version:z.literal(1),nodes:z.array(nodeSchema).min(1).max(256)}),
 snapshotBase.extend({version:z.literal(2),nodes:z.array(nodeSchema.extend({appearance:appearanceSchema})).min(1).max(256)})
]).superRefine((s,ctx)=>{
 if(new Set(s.nodes.map(n=>n.id)).size!==s.nodes.length)ctx.addIssue({code:'custom',message:'Duplicate ID'});
 for(const e of s.edges)if(e.from===e.to||e.from>=s.nodes.length||e.to>=s.nodes.length)ctx.addIssue({code:'custom',message:'Invalid edge index'});
 if(new TextEncoder().encode(JSON.stringify(s)).length>524288)ctx.addIssue({code:'custom',message:'512 KiB limit'});
});
export type NativeSnapshot=z.infer<typeof snapshotSchema>;
export type NativeSnapshotV2=Extract<NativeSnapshot,{version:2}>;
export type NativeProjection={snapshot:NativeSnapshotV2;compactedLabels:number;compactedDetails:number;overlappingEdges:number};
export const availabilityLabels={'supported-installed':'ARCore-Unterstützung gemeldet; Dienst installiert','supported-not-installed':'ARCore-Unterstützung gemeldet; Google-Dienst fehlt','supported-outdated':'ARCore-Unterstützung gemeldet; Google-Dienst veraltet',unsupported:'Gerät meldet keine ARCore-Unterstützung',checking:'Kompatibilität noch nicht bestimmt; bei Bedarf bewusst erneut prüfen',unknown:'Kompatibilität unbekannt'} as const;
const availabilitySchema=z.object({available:z.boolean(),status:z.enum(['supported-installed','supported-not-installed','supported-outdated','unsupported','checking','unknown'])}).strict().refine(v=>v.available===v.status.startsWith('supported-'));
export type NativeAvailability=z.infer<typeof availabilitySchema>;
const resultSchema=z.object({status:z.enum(['closed','unavailable','permission-denied','error']),placed:z.boolean(),snapshotRevision:text(128),selectedNodeId:text(128).optional(),message:text(2000,true,true).optional(),openDetails:z.boolean().optional()}).strict().refine(v=>!v.openDetails||(v.status==='closed'&&!!v.selectedNodeId));
export type NativeARResult=z.infer<typeof resultSchema>;
function compact(value:string,max:number,multiline=false){let s=value.replace(new RegExp(invalidUnicode.source,'gu'),'�').replace(new RegExp((multiline?multilineControls:controls).source,'gu'),' ').trim();if(!s)s='Ohne Text';if(s.length>max){s=s.slice(0,max-1);if(/[\uD800-\uDBFF]$/.test(s))s=s.slice(0,-1);s+='…'}return s}
export function buildNativeSnapshot(graph:SpaceGraph,context:{stateRevision:string|null;scope:string;known:boolean;motionAllowed?:boolean}):NativeProjection{
 if(!context.known)throw new Error('Der Arbeitsstand ist noch nicht sicher geladen.');
 if(!graph.nodes.length)throw new Error('Dieser Bereich enthält keine Knoten.');
 if(graph.nodes.length>256)throw new Error(`${graph.nodes.length} Knoten überschreiten das AR-Limit 256. Wähle einen kleineren Bereich oder eine Nachbarschaft.`);
 if(graph.edges.length>4096)throw new Error(`${graph.edges.length} Beziehungen überschreiten das AR-Limit 4096. Wähle einen kleineren Bereich.`);
 const indices=new Map<string,number>();for(const[n,i]of graph.nodes.map((n,i)=>[n,i] as const)){if(!text(128).safeParse(n.id).success||indices.has(n.id))throw new Error('Eine Knoten-Kennung ist für AR ungültig oder doppelt.');indices.set(n.id,i);if(n.position.length!==3||!n.position.every(Number.isFinite))throw new Error('Knotenposition ist nicht endlich.');}
 const mins=[0,1,2].map(i=>Math.min(...graph.nodes.map(n=>n.position[i]))),maxs=[0,1,2].map(i=>Math.max(...graph.nodes.map(n=>n.position[i])));
 const center=mins.map((min,i)=>min/2+maxs[i]/2),span=Math.max(...mins.map((min,i)=>maxs[i]/2-min/2));let compactedLabels=0,compactedDetails=0;
 const nodes=graph.nodes.map(n=>{const label=compact(n.title,120),raw=`${kindNames[n.kind]} · ${originNames[n.origin]}\n${n.detail}`,detail=compact(raw,1000,true);if(label!==n.title)compactedLabels++;if(detail!==raw)compactedDetails++;const[x,y,z]=n.position.map((p,i)=>span?Math.max(-1,Math.min(1,p/span-center[i]/span)):0);const style=(n as typeof n & {appearance?:unknown}).appearance;
 const rgb=n.color??0x6befa5;
 if(!Number.isInteger(rgb)||rgb<0||rgb>0xffffff)throw new Error('Ungültige Farbe im AR-Snapshot.');
 const color='#'+rgb.toString(16).padStart(6,'0').toUpperCase();
 const checkedStyle=appearanceSchema.safeParse(style===undefined?{core:color,shell:color,orbit:color,shape:'polyhedron',size:'normal',motion:'off'}:style);
 if(!checkedStyle.success)throw new Error('Ungültige Erscheinung im AR-Snapshot.');
 const appearance=checkedStyle.data;
 return{id:n.id,label,detail,x,y,z,color:n.color,appearance}});
 const pairs=new Set<string>();let overlappingEdges=0;const edges=graph.edges.map(e=>{const from=indices.get(e.from),to=indices.get(e.to);if(from===undefined||to===undefined||from===to)throw new Error('Eine Kante hat keine gültigen getrennten Endpunkte.');const pair=[Math.min(from,to),Math.max(from,to)].join('/');if(pairs.has(pair))overlappingEdges++;pairs.add(pair);return{from,to}});
 // Include unabridged semantics and local revision, so edits hidden by text limits still invalidate results.
 const snapshotRevision=contentDigest(JSON.stringify({version:2,graph,context,appearance:nodes.map(n=>n.appearance),motionAllowed:context.motionAllowed===true}));
 const snapshot={motionAllowed:context.motionAllowed===true,version:2 as const,snapshotRevision,title:compact('LowQuantFlow · '+context.scope,120),nodes,edges};
 const checked=snapshotSchema.safeParse(snapshot);if(!checked.success||checked.data.version!==2)throw new Error('AR-Snapshot passt nicht in den geprüften Datenvertrag (max. 512 KiB).');
 return{snapshot:checked.data,compactedLabels,compactedDetails,overlappingEdges};
}
export interface NativeARService {native:boolean;availability():Promise<NativeAvailability>;open(snapshot:NativeSnapshot):Promise<NativeARResult>}
export function createNativeARService(bridge:{native:boolean;getAvailability():Promise<unknown>;open(input:{snapshot:NativeSnapshot}):Promise<unknown>}):NativeARService{
 let busy=false;
 const call=async<T>(action:()=>Promise<T>)=>{if(!bridge.native)throw new Error('Native Kamera-AR steht nur in dieser Android-App zur Verfügung.');if(busy)throw new Error('Eine native AR-Anfrage läuft bereits.');busy=true;try{return await action()}finally{busy=false}};
 return{native:bridge.native,availability:()=>call(async()=>{const parsed=availabilitySchema.safeParse(await bridge.getAvailability());if(!parsed.success)throw new Error('Ungültige Antwort zur AR-Kompatibilität.');return parsed.data}),open:snapshot=>call(async()=>{const parsed=snapshotSchema.safeParse(snapshot);if(!parsed.success)throw new Error('Ungültiger AR-Snapshot.');const revision=parsed.data.snapshotRevision,members=new Set(parsed.data.nodes.map(n=>n.id));const response=resultSchema.safeParse(await bridge.open({snapshot:parsed.data}));if(!response.success||response.data.snapshotRevision!==revision||(response.data.selectedNodeId&&!members.has(response.data.selectedNodeId)))throw new Error('Ungültige native AR-Antwort. Auswahl verworfen.');return response.data})};
}
export function acceptNativeSelection(result:NativeARResult,current:NativeSnapshot):string|null{return result.status==='closed'&&result.snapshotRevision===current.snapshotRevision&&current.nodes.some(n=>n.id===result.selectedNodeId)?result.selectedNodeId!:null}
