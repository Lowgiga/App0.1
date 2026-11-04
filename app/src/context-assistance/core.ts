import {z} from 'zod';
import {kindNames,type ExplorerGraph,type ExplorerNode} from '../../vendor/mesh-extensions/src/model.ts';
import type {ContextKey} from '../assistant/contracts.ts';

export const hintPreferencesSchema=z.object({enabled:z.boolean(),frequency:z.enum(['rare','balanced','frequent']),detail:z.enum(['compact','detailed'])}).strict();
export type HintPreferences=z.infer<typeof hintPreferencesSchema>;
export const defaultHintPreferences=():HintPreferences=>({enabled:true,frequency:'balanced',detail:'compact'});
export const hintRules={rare:{debounce:900,cooldown:120000,budget:3},balanced:{debounce:600,cooldown:30000,budget:5},frequent:{debounce:350,cooldown:8000,budget:10}} as const;
export type SelectionContext={schema:'lowquantflow.selection-context/v1';project:ContextKey|null;objectId:string;objectKind:ExplorerNode['kind'];source:ExplorerNode['provenance'];workRevision:string;selectionKind:'object';focus:'graph'|'inspector'};
export type LocalHint={mode:'offline-rules';context:SelectionContext;explanation:string;tip:string;idea:string;evidence:string[]};
type RoomIdentity={id:string;createdAt:string};
/** A selected object is a read-only evidence scope, never an instruction or a grant. */
export function selectionContext(graph:ExplorerGraph,selectedId:string|null,rooms:readonly RoomIdentity[],focus:SelectionContext['focus']):SelectionContext|null {
 if(graph.availability!=='available'||!graph.updatedAt||!selectedId)return null;
 const node=graph.nodes.find(n=>n.id===selectedId);if(!node)return null;
 const roomId=node.kind==='room'?node.entityId:node.kind==='mission'&&typeof node.attributes.roomId==='string'?node.attributes.roomId:null;
 const room=roomId?rooms.find(r=>r.id===roomId):null;
 return{schema:'lowquantflow.selection-context/v1',project:room?{contextId:room.id,contextCreatedAt:room.createdAt}:null,objectId:node.id,objectKind:node.kind,source:{...node.provenance},workRevision:graph.updatedAt,selectionKind:'object',focus};
}
export const contextKey=(context:SelectionContext)=>JSON.stringify(context);
export const sourceKey=(context:SelectionContext)=>JSON.stringify([context.project,context.workRevision,context.source.kind,context.source.reference,context.source.observedAt]);
function currentNode(context:SelectionContext,graph:ExplorerGraph):ExplorerNode|null {
 if(graph.availability!=='available'||graph.updatedAt!==context.workRevision)return null;
 return graph.nodes.find(n=>n.id===context.objectId&&n.kind===context.objectKind&&n.provenance.reference===context.source.reference&&n.provenance.kind===context.source.kind&&n.provenance.observedAt===context.source.observedAt)??null;
}
/** Deterministic local rules; no provider, prompt, network or mutation capability. */
export function buildLocalHint(context:SelectionContext,graph:ExplorerGraph,detail:HintPreferences['detail']):LocalHint|null {
 const node=currentNode(context,graph);if(!node)return null;
 const missing=graph.unresolved.filter(e=>e.from===node.id||e.to===node.id);
 const incident=graph.edges.filter(e=>e.from===node.id||e.to===node.id);
 const dependencies=incident.filter(e=>e.from===node.id&&e.relation==='depends-on');
 const sources=incident.filter(e=>e.relation==='reads'||e.relation==='supplies-context');
 const title=node.title.slice(0,160),explanation=`${title} · ${kindNames[node.kind]} · ${node.status??'Status unbekannt'}. ${incident.length} erfasste Beziehungen.`;
 let tip:string,idea:string;
 if(missing.length){tip=`${missing.length} Beziehung(en) von „${title}“ sind im aktuellen Stand nicht auflösbar.`;idea='Nächster Schritt: die fehlende Abhängigkeit im Inspector prüfen und den Verweis im Fachbereich gezielt ergänzen oder korrigieren.';}
 else if(node.kind==='source'){tip=node.provenance.observedAt?`Der erfasste Quellenstand ist ${node.provenance.observedAt}; neuere Inhalte wurden nicht geprüft.`:'Der Quellenstand ist unbekannt; Aktualität lässt sich aus diesem Snapshot nicht belegen.';idea=node.provenance.observedAt?'Weiterentwicklung: vor Verwendung in einer Mission den angegebenen Quellenstand mit der lokalen Quelldatei vergleichen.':'Weiterentwicklung: bei der nächsten Quellenpflege einen beobachteten Quellenstand erfassen, damit spätere Prüfungen nachvollziehbar bleiben.';}
 else if(dependencies.length){tip=`„${title}“ benötigt ${dependencies.length} erfasste Aufgabe(n).`;idea='Nächster Schritt: die verknüpften Aufgaben im Inspector auswählen und ihren Stand vor der Weiterarbeit prüfen.';}
 else if((node.kind==='mission'||node.kind==='room')&&sources.length===0){tip=`Für „${title}“ sind keine aufgelösten Quellenbeziehungen erfasst.`;idea='Weiterentwicklung: im Fachbereich eine passende vorhandene Quelle zuordnen und danach ihre Beziehung hier prüfen.';}
 else if(node.kind==='agent'){tip=`Dieses Arbeitsprofil hat ${incident.filter(e=>e.from===node.id&&e.relation==='owns').length} erfasste Zuständigkeit(en).`;idea='Nächster Schritt: die verantworteten Objekte im Inspector durchgehen und offene Arbeit anhand ihres tatsächlichen Status priorisieren.';}
 else {tip=`${sources.length} Quellenbeziehung(en) und ${dependencies.length} Abhängigkeit(en) sind für „${title}“ erfasst.`;idea=incident.length?'Nächster Schritt: eine erfasste Beziehung im Inspector öffnen, um den Zusammenhang dieses Objekts zu prüfen.':'Weiterentwicklung: prüfen, ob dieses einzelne Objekt mit einer bestehenden Mission oder Quelle verbunden werden sollte.';}
 const evidence=[`Objekt: ${node.id}`,`Referenz: ${context.source.reference}`,`Arbeitsstand: ${context.workRevision}`];
 if(detail==='detailed'){evidence.push(`Quellenstand: ${context.source.observedAt??'unbekannt'}`,context.project?`Raumkontext: ${context.project.contextId} · erstellt ${context.project.contextCreatedAt}`:'Arbeitsbereich: kein belegter Raumbezug');for(const edge of [...missing,...incident].slice(0,8))evidence.push(`Beziehung: ${edge.from} → ${edge.to} (${edge.relation})`);}
 return{mode:'offline-rules',context:structuredClone(context),explanation,tip,idea,evidence};
}
export type HintClock={now:()=>number;schedule:(callback:()=>void,delay:number)=>unknown;cancel:(id:any)=>void};
export const browserHintClock:HintClock={now:()=>Date.now(),schedule:(fn,delay)=>setTimeout(fn,delay),cancel:id=>clearTimeout(id)};
const WINDOW=600000;
/** Latest-only delivery with bounded source dedupe and quota. Cleanup is restartable for StrictMode. */
export class HintController {
 private epoch=0;private timer:unknown=null;private seen=new Map<string,number>();private delivered:number[]=[];private last=-Infinity;private current:SelectionContext|null=null;
 private readonly clock:HintClock;private readonly publish:(hint:LocalHint|null)=>void;private readonly generate:(context:SelectionContext,graph:ExplorerGraph,detail:HintPreferences['detail'])=>LocalHint|null|Promise<LocalHint|null>;
 constructor(options:{clock?:HintClock;publish:(hint:LocalHint|null)=>void;generate?:HintController['generate']}){this.clock=options.clock??browserHintClock;this.publish=options.publish;this.generate=options.generate??buildLocalHint;}
 pause(){this.epoch++;if(this.timer!==null)this.clock.cancel(this.timer);this.timer=null;this.current=null;this.publish(null);}
 dismiss(context:SelectionContext|null=this.current){if(context)this.seen.set(sourceKey(context),this.clock.now());this.pause();}
 update(context:SelectionContext|null,graph:ExplorerGraph,prefs:HintPreferences,visible:boolean){
  this.pause();this.current=context;const now=this.clock.now(),rules=hintRules[prefs.frequency];
  for(const [key,at] of this.seen)if(now-at>=WINDOW)this.seen.delete(key);
  this.delivered=this.delivered.filter(at=>now-at<WINDOW);
  if(!context||!visible||!prefs.enabled||!currentNode(context,graph)||this.seen.has(sourceKey(context))||this.delivered.length>=rules.budget||now-this.last<rules.cooldown)return;
  const epoch=this.epoch,key=sourceKey(context),copy=structuredClone(context),snapshot=structuredClone(graph);
  this.timer=this.clock.schedule(()=>{this.timer=null;void Promise.resolve().then(()=>this.generate(copy,snapshot,prefs.detail)).then(hint=>{
   if(epoch!==this.epoch||!hint||contextKey(hint.context)!==contextKey(copy))return;
   const at=this.clock.now();this.seen.set(key,at);while(this.seen.size>100)this.seen.delete(this.seen.keys().next().value!);
   this.delivered.push(at);this.last=at;this.publish(hint);
  }).catch(()=>{if(epoch===this.epoch)this.publish(null)});},rules.debounce);
 }
}
