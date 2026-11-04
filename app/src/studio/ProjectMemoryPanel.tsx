import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {useWorkState} from '../shared-work-state.tsx';
import {useWorkTransport} from '../work-transport.tsx';
import {saveTextFile} from '../platform/runtime.ts';
import {projectMemoryExport,memoryKinds,type MemoryEntry} from '../project-memory.ts';
import {personalViewContract,type PersonalView} from '../personal-continuation.ts';
import {usePersonalMemory} from '../use-personal-memory.ts';
import {readContinuationContext,continuationMemoryHref,type ContinuationContext} from '../personal-continuation-navigation.ts';
import {notifyAppRoute,readMobileRoute} from '../mobile/mobile-navigation.ts';
import type {MeshRoom} from '../../upstream/lib/work-contract.ts';

const labels={goal:'Ziel',decision:'Entscheidung',rejectedApproach:'Verworfener Ansatz',openQuestion:'Offene Frage',nextStep:'Nächster Schritt'};
const statuses={proposed:'Vorschlag',confirmed:'Bestätigt','external-claim':'Externe Behauptung',superseded:'Abgelöst',forgotten:'Vergessen'};
type PendingSelection={context:ContinuationContext|null;href:string;fromHistory:boolean};
const sameContext=(a:ContinuationContext|null,b:ContinuationContext|null)=>a?.contextId===b?.contextId&&a?.contextCreatedAt===b?.contextCreatedAt;
function urlContext(){const parsed=readContinuationContext(location.href);return parsed.kind==='valid'?parsed.context:null}
export function ProjectMemoryPanel({active=true}:{active?:boolean}){
 const shared=useWorkState(),transport=useWorkTransport(),[context,setContext]=useState<ContinuationContext|null>(urlContext),[notice,setNotice]=useState(''),[pending,setPending]=useState<PendingSelection|null>(null),[switching,setSwitching]=useState(false),[routeBlocked,setRouteBlocked]=useState(false);
 const selected=useRef(context),leave=useRef<(()=>Promise<boolean>)|null>(null),selectionGeneration=useRef(0),alive=useRef(false),view=useRef<PersonalView|null>(null),remembered=useRef(''),pendingRemember=useRef('');
 const room=shared.hasLoaded?shared.work.rooms.find(r=>r.id===context?.contextId&&r.createdAt===context?.contextCreatedAt):undefined;
 function writeUrl(next:ContinuationContext,replace=false){const href=continuationMemoryHref(location.href,next);if(href!==location.href){replace?history.replaceState({},'',href):history.pushState({},'',href);notifyAppRoute()}}
 async function select(next:ContinuationContext|null,fromHistory=false,routeNotice=''){
  const id=++selectionGeneration.current;
  setRouteBlocked(next===null);
  if(sameContext(next,selected.current)){setSwitching(false);if(routeNotice)setNotice(routeNotice);return}
  const originHref=location.href,targetHref=next?continuationMemoryHref(originHref,next):originHref;setSwitching(true);
  const safe=await (leave.current?.()??Promise.resolve(true));if(!alive.current||id!==selectionGeneration.current)return;
  if(location.href!==originHref){selectionGeneration.current++;setSwitching(false);setRouteBlocked(false);return}
  setSwitching(false);if(!safe){setPending({context:next,href:targetHref,fromHistory});setNotice('Wechsel angehalten: Entwurf nicht bestätigt gesichert. Bleiben und Text sichern oder bewusst ohne Sicherung wechseln.');if(fromHistory&&selected.current)writeUrl(selected.current,true);return}
  selected.current=next;leave.current=null;pendingRemember.current=fromHistory||!next?'':next.contextId+'@'+next.contextCreatedAt;setContext(next);setPending(null);setNotice(routeNotice);if(!fromHistory&&next)writeUrl(next);
 }
 useEffect(()=>{alive.current=true;const onOriginal=()=>{selectionGeneration.current++;setSwitching(false);setRouteBlocked(false);setPending(null);setNotice('')};const onRoute=()=>{selectionGeneration.current++;setSwitching(false);const parsed=readContinuationContext(location.href);if(parsed.kind==='valid'){void select(parsed.context,true);return}const route=readMobileRoute(location.href);if(route.studio&&route.studioTab==='memory')void select(null,true,parsed.kind==='invalid'?'Projektlink ungültig oder unvollständig. Bitte Projektkontext bewusst wählen.':'Kein Projektkontext im Link. Bitte Projektkontext bewusst wählen.');else{setRouteBlocked(false);setPending(null);setNotice('')}};window.addEventListener('popstate',onRoute);window.addEventListener('cue:route-changed',onRoute);window.addEventListener('cue:navigate',onOriginal);return()=>{alive.current=false;selectionGeneration.current++;window.removeEventListener('popstate',onRoute);window.removeEventListener('cue:route-changed',onRoute);window.removeEventListener('cue:navigate',onOriginal)}},[]);
 async function remember(next:ContinuationContext){
  const key=next.contextId+'@'+next.contextCreatedAt;if(remembered.current===key||pendingRemember.current!==key||!active)return;remembered.current=key;
  try{
   if(!view.current){const response=await transport.request('/api/personal-continuation',{method:'POST',body:JSON.stringify({operation:'read-view'})});if(!response.ok)throw Error();view.current=personalViewContract.parse(await response.json())}
   if(!alive.current||!sameContext(selected.current,next))return;
   const response=await transport.request('/api/personal-continuation',{method:'POST',body:JSON.stringify({operation:'remember',expectedRevision:view.current.revision,...next})});if(!response.ok)throw Error();const saved=personalViewContract.parse(await response.json());if(saved.revision!==view.current.revision+1||saved.contextId!==next.contextId||saved.contextCreatedAt!==next.contextCreatedAt)throw Error();view.current=saved;
  }catch{if(alive.current)setNotice('Arbeitspunkt nicht bestätigt gemerkt. Entwurfsicherung wird separat angezeigt; keine automatische Wiederholung.')}
 }
 return <section className="panel project-memory" aria-label="Projektgedächtnis"><h2>Projektgedächtnis</h2>
  <p>Ein bestehender Missionraum ist ein eigener Projektkontext. Alte Aufgaben, globale Notizen und fremde Raumquellen werden nicht zugeordnet. Alles bleibt lokal; eine Bestätigung erteilt keine Ausführungsrechte.</p>
  <label>Projektkontext wählen<select aria-label="Projektkontext" value={room?.id??''} disabled={!shared.hasLoaded||shared.loadingWork||switching} onChange={event=>{const target=shared.work.rooms.find(r=>r.id===event.target.value);if(target)void select({contextId:target.id,contextCreatedAt:target.createdAt})}}><option value="">Projektkontext wählen</option>{shared.work.rooms.map(r=><option key={r.id+'@'+r.createdAt} value={r.id}>{r.title}{r.status==='Archiviert'?' · archiviert':''}</option>)}</select></label>
  <p>Persönliche Entwürfe werden nach einer kurzen Eingabepause separat auf diesem Gerät gesichert. Nur bestätigte Sicherungen überstehen ein abruptes Beenden. Sie sind nicht im Systembackup oder Projektexport enthalten. Keine Zugangsdaten eintragen.</p>
  {notice&&<p role="status">{notice}</p>}{pending&&<div className="actions-row"><Button variant="outline" onClick={()=>{setPending(null);setNotice('Wechsel abgebrochen. Entwurf bleibt geöffnet.')}}>Beim Entwurf bleiben</Button><Button variant="outline" onClick={()=>{const target=pending,next=target.context;selectionGeneration.current++;selected.current=next;leave.current=null;setContext(next);setRouteBlocked(next===null);setPending(null);setNotice('Ungesicherte lokale Änderungen bewusst verlassen.');if(target.fromHistory){history.replaceState({},'',target.href);notifyAppRoute()}else if(next)writeUrl(next)}}>Ohne Sicherung wechseln</Button></div>}
  {!shared.hasLoaded&&<p role="status">Arbeitsstand noch nicht verfügbar.</p>}
  {shared.hasLoaded&&shared.work.rooms.length===0&&<p>Lege einen Missionraum im bestehenden Bereich Missionräume an. Es werden keine Projekte automatisch erzeugt.</p>}
  {context&&shared.hasLoaded&&<ContextMemory key={context.contextId+'@'+context.contextCreatedAt} context={context} room={room} active={active} routeBlocked={routeBlocked} onLeave={fn=>{leave.current=fn}} onLoaded={()=>void remember(context)}/>}
 </section>
}
function ContextMemory({context,room,active,routeBlocked,onLeave,onLoaded}:{context:ContinuationContext;room:MeshRoom|undefined;active:boolean;routeBlocked:boolean;onLeave:(fn:()=>Promise<boolean>)=>void;onLoaded:()=>void}){
 const shared=useWorkState(),editor=usePersonalMemory({id:context.contextId,createdAt:context.contextCreatedAt}),m=editor.state,memory=m.snapshot?.memory,composer=m.composer;
 const [query,setQuery]=useState(''),[showForgotten,setShowForgotten]=useState(false),[compared,setCompared]=useState(false),[exportNotice,setExportNotice]=useState('');
 const latest=useRef(editor);latest.current=editor;const mounted=useRef(false),exportGate=useRef(false),exportGeneration=useRef(0);
 useEffect(()=>{mounted.current=true;onLeave(()=>latest.current.flush());return()=>{mounted.current=false;exportGeneration.current++}},[]);
 useEffect(()=>{if(memory&&active&&room&&room.status!=='Archiviert')onLoaded()},[!!memory,active]);
 useEffect(()=>setCompared(false),[memory?.revision,m.snapshot?.workUpdatedAt,m.base?.memoryRevision,m.base?.workUpdatedAt]);
 const staleWork=!!m.snapshot&&m.snapshot.workUpdatedAt!==shared.work.updatedAt;
 const readOnly=routeBlocked||!room||room.status==='Archiviert'||m.snapshot?.contextStatus!=='active'||shared.storageError||shared.loadingWork||shared.busy;
 const disabled=!memory||m.busy||m.locked||staleWork||readOnly;
 const activeDraft=m.snapshot?.draft?.status==='active';
 const draftText=m.opened||m.dirty?composer.text:activeDraft?m.snapshot!.draft!.composer.text:'';
 const invalidTarget=!!composer.editingEntryId&&!memory?.entries.some(e=>e.id===composer.editingEntryId&&!['forgotten','superseded'].includes(e.status));
 const invalidSource=composer.origin==='external-claim'&&!composer.editingEntryId&&!room?.sources.includes(composer.sourceId??'');
 async function exportDraft(){const result=await saveTextFile('LowQuantFlow-personal-draft-'+context.contextId+'.txt',draftText,'text/plain');if(mounted.current)setExportNotice(result.status==='saved'?'Entwurf als Text gesichert.':result.status==='dispatched'?'Entwurf an Browser übergeben. Downloads prüfen.':'Textdatei nicht bestätigt gesichert.')}
 async function exportProject(){
  if(disabled||exportGate.current||!memory)return;exportGate.current=true;const id=++exportGeneration.current,revision=memory.revision;
  try{const loaded=await editor.load();if(!loaded||!mounted.current||id!==exportGeneration.current)return;const latestMemory=latest.current.state.snapshot?.memory;if(!latestMemory||latestMemory.revision!==revision){setExportNotice('Projektstand vor Export geändert. Neu prüfen.');return}const result=await saveTextFile('LowQuantFlow-project-memory-'+context.contextId+'.json',JSON.stringify(projectMemoryExport(latestMemory),null,2),'application/json');if(mounted.current)setExportNotice(result.status==='saved'?'Projektexport gespeichert.':result.status==='dispatched'?'Projektexport an Browser übergeben. Downloads prüfen.':'Projektexport nicht bestätigt gespeichert.')}finally{exportGate.current=false}
 }
 const visible=memory?.entries.filter(e=>(showForgotten?['forgotten','superseded'].includes(e.status):!['forgotten','superseded'].includes(e.status))&&e.text.toLocaleLowerCase().includes(query.toLocaleLowerCase()))??[];
 return <div className="project-memory-context">
  <p role="status" aria-live="polite">{m.busy?'Projektgedächtnis wird verarbeitet …':memory?'Revision '+memory.revision+' · '+(memory.updatedAt??'noch nicht gespeichert'):'Noch kein geladener Gedächtnisstand'} {m.notice}</p>
  {(readOnly||staleWork)&&<p role="status">Nur lesen: {routeBlocked?'Projektlink gewechselt. Entwurf wird vor dem Verlassen gesichert.':!room?'Projekt nicht mehr vorhanden. Abgetrennter Entwurf bleibt unter seiner ursprünglichen Projektidentität erhalten.':room.status==='Archiviert'?'Projektkontext archiviert.':staleWork?'Arbeitsrevision geändert. Stand vor Änderungen neu laden.':'Arbeitsstand nicht verlässlich geladen.'}</p>}
  {m.error&&<p role="alert">{m.error}</p>}
  <div className="actions-row"><Button variant="outline" disabled={m.busy||shared.loadingWork||shared.storageError} onClick={()=>void editor.load()}>Stand neu laden</Button><Button variant="outline" disabled={disabled} onClick={()=>void exportProject()}>Projekt exportieren</Button><Button variant="outline" disabled={!m.opened&&!m.dirty&&!activeDraft} onClick={()=>void exportDraft()}>Entwurf als Text sichern</Button></div>
  {exportNotice&&<p role="status">{exportNotice}</p>}
  <p>Projektexport enthält aktive Einträge mit Herkunft und Status, ohne Revisionshistorie oder persönliche Entwürfe. Das Systembackup enthält den gesamten Projektgedächtnisverlauf, auch Vergessenes, jedoch keine persönlichen Entwürfe; ein Restore ist weiterhin nicht verfügbar.</p>
  {activeDraft&&<aside aria-label="Persönlicher Entwurf"><h3>Gesicherter persönlicher Entwurf</h3><p>Entwurfrevision {m.snapshot!.draft!.revision} · Basis Gedächtnisrevision {m.snapshot!.draft!.base.memoryRevision} · {m.snapshot!.draft!.updatedAt}</p>{(editor.pendingRestore||m.locked)&&<><p className="memory-text">{m.snapshot!.draft!.composer.text}</p><Button variant="outline" disabled={m.busy} onClick={()=>{if(!m.dirty||window.confirm('Lokale ungesicherte Fassung durch den gesicherten Entwurf ersetzen? Vorher bei Bedarf als Text sichern.'))editor.open()}}>Entwurf öffnen</Button></>}<Button variant="outline" disabled={m.busy||m.locked} onClick={()=>{if(window.confirm('Diesen persönlichen Entwurf ausdrücklich verwerfen? Er wird nicht ins Projektgedächtnis übernommen.'))void editor.discard()}}>Entwurf verwerfen</Button></aside>}
  {editor.stale&&<aside role="alert" aria-label="Entwurfskonflikt"><h3>Entwurf basiert auf einem anderen Stand</h3><p>Alte Basis: Gedächtnisrevision {m.base?.memoryRevision}, Arbeitsstand {m.base?.workUpdatedAt??'leer'}. Aktuell geladen: Gedächtnisrevision {memory?.revision}, Arbeitsstand {m.snapshot?.workUpdatedAt??'leer'}. Der Text wurde nicht neu basiert.</p><p>Aktuelle Einträge stehen unten zum Vergleich. {invalidTarget?'Das Korrekturziel fehlt oder ist nicht mehr aktiv.':''}{invalidSource?'Die Projektquelle fehlt.':''}</p><label><input type="checkbox" checked={compared} onChange={event=>setCompared(event.target.checked)}/>Aktuellen Projektstand mit Entwurf verglichen</label><Button variant="outline" disabled={!compared||disabled||invalidTarget||invalidSource} onClick={()=>void editor.rebase()}>Aktuellen Stand ausdrücklich als Basis wählen</Button></aside>}
  <form onSubmit={event=>{event.preventDefault();if(!disabled&&!editor.stale&&!editor.pendingRestore)void editor.apply()}}>
   <fieldset disabled={!m.snapshot||readOnly||editor.pendingRestore}><legend>{composer.editingEntryId?'Eintrag korrigieren':'Neuer unbestätigter Eintrag'}</legend>
    <label>Art<select aria-label="Gedächtnisart" value={composer.kind} disabled={!!composer.editingEntryId} onChange={event=>editor.change({kind:event.target.value as MemoryEntry['kind']})}>{memoryKinds.map(kind=><option key={kind} value={kind}>{labels[kind]}</option>)}</select></label>
    {!composer.editingEntryId&&<><label>Herkunft<select aria-label="Herkunft" value={composer.origin} onChange={event=>editor.change({origin:event.target.value as MemoryEntry['origin']['kind'],sourceId:null})}><option value="manual">Eigene Eingabe</option><option value="proposal">Vorschlag</option><option value="external-claim">Externe Behauptung</option></select></label>{composer.origin==='external-claim'&&<label>Projektquelle<select aria-label="Projektquelle" value={composer.sourceId??''} onChange={event=>editor.change({sourceId:event.target.value||null})}><option value="">Quelle auswählen</option>{room?.sources.map(id=><option key={id} value={id}>{id}</option>)}</select></label>}</>}
    <label>Gedächtnistext<textarea aria-label="Gedächtnistext" maxLength={2000} value={composer.text} onChange={event=>editor.change({text:event.target.value})} required/></label>
    <Button type="submit" disabled={disabled||editor.stale||editor.pendingRestore||!composer.text.trim()||invalidTarget||invalidSource}>{composer.editingEntryId?'Korrektur als Vorschlag speichern':'Vorschlag speichern'}</Button>
    <Button type="button" variant="outline" disabled={!m.dirty||m.busy||m.locked} onClick={()=>void editor.flush()}>Entwurf jetzt sichern</Button>
   </fieldset>
   {composer.editingEntryId&&<Button type="button" variant="outline" disabled={m.busy||m.locked} onClick={()=>{if(window.confirm('Korrekturentwurf verwerfen?'))void editor.discard()}}>Korrektur abbrechen</Button>}
  </form>
  <label>In diesem Projekt suchen<input aria-label="Projektgedächtnis durchsuchen" type="search" value={query} maxLength={200} onChange={event=>setQuery(event.target.value)}/></label>
  <Button variant="outline" onClick={()=>setShowForgotten(!showForgotten)}>{showForgotten?'Aktive Einträge anzeigen':'Vergessene und abgelöste Einträge anzeigen'}</Button>
  <p>Vergessen blendet Einträge aus aktiver Suche und Projektexport aus. Sie bleiben lokal und im Systembackup reversibel erhalten; keine endgültige Löschung.</p>
  {visible.map(entry=><article key={entry.id} data-memory-entry={entry.id} data-memory-status={entry.status} aria-label={labels[entry.kind]+' · '+statuses[entry.status]}><h3>{labels[entry.kind]} · {statuses[entry.status]}</h3><p className="memory-text">{entry.text}</p><p>Revision {entry.revision} · Herkunft {entry.origin.kind}{entry.origin.sourceId?' · '+entry.origin.sourceId:''}</p>{entry.replaces&&<p>Ablösung von Eintrag {entry.replaces} erfordert eine ausdrückliche Bestätigung.</p>}
   <div className="actions-row">{(entry.status==='proposed'||entry.status==='external-claim')&&<Button disabled={disabled||m.dirty||activeDraft} onClick={()=>void editor.mutate('confirm',{entryId:entry.id,...(entry.replaces?{replaceConfirmed:true}:{})})}>{entry.replaces?'Bestätigte Entscheidung ablösen':'Bestätigen'}</Button>}{!['forgotten','superseded'].includes(entry.status)&&<Button variant="outline" disabled={disabled||m.dirty||activeDraft} onClick={()=>editor.change({editingEntryId:entry.id,kind:entry.kind,text:entry.text,origin:'manual',sourceId:null})}>Korrigieren</Button>}{entry.status!=='forgotten'?<Button variant="outline" disabled={disabled||m.dirty||activeDraft} onClick={()=>void editor.mutate('forget',{entryId:entry.id})}>Vergessen</Button>:<Button variant="outline" disabled={disabled||m.dirty||activeDraft} onClick={()=>void editor.mutate('restore',{entryId:entry.id})}>Als Vorschlag zurückholen</Button>}</div>
   <details><summary>Herkunft und Revisionen ansehen</summary><pre>{JSON.stringify({origin:entry.origin,history:entry.history},null,2)}</pre></details>
  </article>)}
 </div>
}
