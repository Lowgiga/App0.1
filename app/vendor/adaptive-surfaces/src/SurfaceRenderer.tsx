import React,{Component,useLayoutEffect,useRef,useSyncExternalStore} from 'react';
import type {DataProjection,HostSlotProps,Limits,SurfaceComponent,SurfaceProps} from './types.ts';
import {byteLength} from './json.ts';
const kindFor={Status:'status',Metric:'metric',TaskList:'tasks',SourceList:'sources',EventList:'events',GraphSlot:'graph',SkillSuggestionSlot:'skills'} as const;
function validData(p:DataProjection,expected:string,limits:Readonly<Limits>):boolean {
 if(!p||typeof p!=='object'||p.kind!==expected||!['known','unknown','stale'].includes(p.state))return false;
 if(p.state==='unknown')return true;
 const text=(v:unknown):v is string=>typeof v==='string'&&byteLength(v)<=limits.maxTextBytes;
 if(p.kind==='metric')return typeof p.value==='number'&&Number.isFinite(p.value)&&(p.unit===undefined||text(p.unit));
 if(p.kind==='status'||p.kind==='text')return text(p.value);
 if(p.kind==='tasks'||p.kind==='sources'||p.kind==='events'){if(!Array.isArray(p.value)||p.value.length>limits.maxRows)return false;const ids=new Set<string>();return p.value.every(r=>{if(!r||!text(r.id)||!r.id||!text(r.label)||(r.detail!==undefined&&!text(r.detail))||ids.has(r.id))return false;ids.add(r.id);return true})}
 return p.kind==='graph'||p.kind==='skills';
}
interface SlotBoundaryProps {children:React.ReactNode;slot:unknown;projection:DataProjection;revision:number;reducedMotion:boolean;componentId:string}
class SlotBoundary extends Component<SlotBoundaryProps,{failed:boolean}> {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true}}
 componentDidUpdate(prev:Readonly<SlotBoundaryProps>){
  const changed=prev.slot!==this.props.slot||prev.projection!==this.props.projection||prev.revision!==this.props.revision||prev.reducedMotion!==this.props.reducedMotion||prev.componentId!==this.props.componentId;
  // Retry only when actual host-owned slot inputs change, never on unrelated rerenders.
  if(changed&&this.state.failed)this.setState({failed:false});
 }
 render(){return this.state.failed?<p role="status">Hostansicht fehlgeschlagen. Die Hülle bleibt verfügbar.</p>:this.props.children}
}
function BoundContent({component,data,slots,revision,reducedMotion,limits}:{component:Exclude<SurfaceComponent,{type:'Text'|'Group'}>;data:SurfaceProps['data'];slots:SurfaceProps['slots'];revision:number;reducedMotion:boolean;limits:Readonly<Limits>}) {
 const projection=data.get(component.dataRef);
 if(!projection)return <p data-unknown>Datenstand unbekannt</p>;
 if(!validData(projection,kindFor[component.type],limits))return <p role="status">Hostdaten ungültig. Darstellung zurückgewiesen.</p>;
 if(projection.state==='unknown')return <p data-unknown>Datenstand unbekannt</p>;
 let content:React.ReactNode;
 if(projection.kind==='metric')content=<p><strong data-value>{projection.value}</strong>{projection.unit&&<span> {projection.unit}</span>}</p>;
 else if(projection.kind==='status'||projection.kind==='text')content=<p data-value>{projection.value}</p>;
 else if(projection.kind==='tasks'||projection.kind==='sources'||projection.kind==='events')content=projection.value.length?<ul>{projection.value.map(row=><li key={row.id} data-row-id={row.id}><span>{row.label}</span>{row.detail&&<p>{row.detail}</p>}</li>)}</ul>:<p>Keine Einträge (bekannter Datenstand)</p>;
 else {const Slot=projection.kind==='graph'?slots?.Graph:slots?.Skills;const props:HostSlotProps={value:projection.value,state:projection.state,componentId:component.id,surfaceRevision:revision,reducedMotion};content=Slot?<SlotBoundary slot={Slot} projection={projection} revision={revision} reducedMotion={reducedMotion} componentId={component.id}><Slot {...props}/></SlotBoundary>:<p>Hostansicht nicht registriert</p>}
 return <div className="cue-surface__bound"><small>Hostprojektion · kein Berechtigungsnachweis</small>{projection.state==='stale'&&<p className="cue-surface__stale">Veralteter Datenstand</p>}{content}</div>;
}
function Action({component,session,revision,onIntent}: {component:SurfaceComponent;session:SurfaceProps['session'];revision:number;onIntent:SurfaceProps['onIntent']}) {
 const current=useSyncExternalStore(session.subscribeActions,()=>session.getActionState(component.id),()=>session.getActionState(component.id));
 if(!component.actionRef)return null;
 const action=session.getAction(component.actionRef);if(!action)return <p role="status">Hostaktion nicht verfügbar</p>;
 function activate(){if(onIntent)void session.dispatchIntent(component.id,revision,onIntent)}
 return <div className="cue-surface__action"><button type="button" data-action-ref={component.actionRef} data-focus-key={`${component.id}:action`} disabled={!onIntent||!!current} aria-busy={current?.state==='pending'} onClick={activate}>{action.kind==='navigate'?'Navigation':'Vorschlag'}: {action.label}</button>{!onIntent&&<small>Kein Hostempfänger registriert</small>}{current&&<p role="status">{({pending:'Übergabe läuft',sent:'Intent an Host übergeben. Keine Freigabe erteilt.',error:'Übergabe fehlgeschlagen. Keine automatische Wiederholung.',stale:'Aktion nicht mehr aktuell oder bereits übergeben.',unavailable:'Hostübergaben ausgelastet. Keine Aktion gestartet.'})[current.state]}</p>}</div>;
}
export function SurfaceRenderer({session,data,slots,onIntent,reducedMotion=true}:SurfaceProps) {
 const snapshot=useSyncExternalStore(session.subscribe,session.getSnapshot,session.getSnapshot);const container=useRef<HTMLDivElement>(null),anchor=useRef<HTMLDivElement>(null),lastFocus=useRef<string|null>(null);
 useLayoutEffect(()=>{const key=lastFocus.current;if(!key||!container.current)return;const active=document.activeElement;if(active&&container.current.contains(active))return;if(active&&active!==document.body)return;const next=Array.from(container.current.querySelectorAll<HTMLElement>('[data-focus-key]')).find(e=>e.dataset.focusKey===key);(next??anchor.current)?.focus({preventScroll:true});},[snapshot.proposal]);
 const nodes=new Map(snapshot.proposal?.components.map(c=>[c.id,c]));
 function renderNode(id:string,focused=false):React.ReactNode {const c=nodes.get(id)!;return <section key={c.id} data-component-id={c.id} data-emphasized={focused||undefined} className={`cue-surface__component cue-surface__${c.type}`}>
   {c.type==='Group'?<div className="cue-surface__layout" data-layout={c.props.layout}>{c.children.map(child=>renderNode(child,c.props.layout==='focus'&&c.props.focusId===child))}</div>:<><small className="cue-surface__proposal-label">Ungeprüfter Vorschlag · {c.type==='Text'?'Text':'Beschriftung'}</small>{c.type==='Text'?<p className="cue-surface__text">{c.props.text}</p>:<><h3>{c.props.label}</h3><BoundContent component={c} data={data} slots={slots} revision={snapshot.revision} reducedMotion={reducedMotion} limits={session.limits}/></>}</>}
   <Action component={c} session={session} revision={snapshot.revision} onIntent={onIntent}/>
 </section>}
 return <div ref={container} className="cue-surface" data-reduced-motion={reducedMotion} onFocusCapture={e=>{const target=e.target as HTMLElement;lastFocus.current=target.dataset.focusKey??null}} onBlurCapture={e=>{if(e.relatedTarget&&!e.currentTarget.contains(e.relatedTarget as Node))lastFocus.current=null}}>
  <div ref={anchor} className="cue-surface__provenance" tabIndex={-1} data-surface-anchor><strong>Vorgeschlagene Oberfläche</strong><p>Quelle laut Host: {snapshot.provenance.sourceLabel}{snapshot.provenance.runLabel?` · ${snapshot.provenance.runLabel}`:''}</p><small>Darstellungsvorschläge sind keine verifizierten Systemzustände, Freigaben oder Berechtigungen. Revision {snapshot.revision}</small></div>
  {snapshot.error&&<p role="status" className="cue-surface__error">Aktualisierung abgelehnt ({snapshot.error}). {snapshot.proposal?'Letzte gültige Fläche bleibt sichtbar.':'Keine gültige Fläche geladen.'}</p>}
  {snapshot.proposal?renderNode(snapshot.proposal.rootId):<p>Keine gültige Fläche geladen</p>}
 </div>;
}
