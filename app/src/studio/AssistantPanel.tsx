import {useEffect,useRef,useState} from 'react';
import {useWorkState} from '../shared-work-state.tsx';
import {assistantIsBusy,useAssistantSession,type AssistantProof} from '../assistant/use-assistant-session.ts';
import type {ContextKey} from '../assistant/contracts.ts';
import {AssistantConfigPreview} from './AssistantConfigPreview.tsx';
import {AssistantCompanion} from './AssistantCompanion.tsx';
import {AssistantFormation} from '../motion/AssistantFormation.tsx';
import {useFiniteMotion} from '../motion/use-finite-motion.ts';
import './assistant.css';
import {AssistantAdvice,sourceName} from './AssistantAdvice.tsx';
import {producerLabel} from '../assistant/provenance.ts';
export function AssistantPanel({onOpenMemory}:{onOpenMemory:(context:ContextKey,draftRevision?:number)=>void}){
 const shared=useWorkState(),[selected,setSelected]=useState('');
 const room=shared.work.rooms.find(r=>r.id===selected);
 const reduceMotion=shared.work.settings.motion==='off'||shared.work.settings.powerSaver;
 return <section className="assistant-panel" aria-label="Projektassistent" data-motion={reduceMotion?'off':shared.work.settings.motion}>
  <header className="assistant-heading"><div><span className="assistant-eyebrow">DEIN NÄCHSTER SCHRITT</span><h2>Erst verstehen. Dann entscheiden.</h2><p>Belegtes Projektwissen und nachvollziehbare lokale Änderungen.</p></div><span className="assistant-mode">Offline-Simulation</span></header>
  <div className="assistant-project"><label htmlFor="assistant-project">Projektkontext wählen</label><select id="assistant-project" aria-label="Assistenten-Projektkontext" value={room?.id??''} disabled={!shared.hasLoaded||shared.loadingWork} onChange={event=>setSelected(event.target.value)}><option value="">Projektkontext wählen</option>{shared.work.rooms.map(r=><option key={r.id+'@'+r.createdAt} value={r.id}>{r.title}{r.status==='Archiviert'?' · archiviert':''}</option>)}</select><p>Ein Missionraum ist ein eigener Projektkontext. Globale Aufgaben und Prüfläufe werden nicht als Projektwissen übernommen.</p></div>
  {!shared.hasLoaded?<p role="status">Der lokale Arbeitsstand wird geladen.</p>:shared.work.rooms.length===0?<p>Lege zuerst einen Missionraum im bestehenden Arbeitsbereich an.</p>:!room?<div className="assistant-empty"><span aria-hidden="true">↗</span><h3>Womit möchtest du weiterarbeiten?</h3><p>Wähle einen bestehenden Projektkontext. Es wird keine Beratung automatisch gestartet.</p></div>:<AssistantContext key={room.id+'@'+room.createdAt} context={{contextId:room.id,contextCreatedAt:room.createdAt}} title={room.title} onOpenMemory={onOpenMemory}/>}
  <footer className="assistant-boundary"><span>Nur dieses Gerät</span><span>Keine Providerverbindung</span><span>Konfiguration und Receipts nicht im Systembackup</span></footer>
 </section>;
}
function AssistantContext({context,title,onOpenMemory}:{context:ContextKey;title:string;onOpenMemory:(context:ContextKey,draftRevision?:number)=>void}){
 const shared=useWorkState();
 const {session,state,blocked}=useAssistantSession(context),proposalButton=useRef<HTMLButtonElement>(null);
 const busy=assistantIsBusy(state.phase),snapshot=state.snapshot,envelope=state.context;
 const detail=snapshot?.config.continuation.detail??'compact';
 const awaiting=state.phase==='checked',canStart=!blocked&&!busy&&['ready','saved'].includes(state.phase)&&!!snapshot;
 const lastEvent=state.events.at(-1);
 const cards=useRef<HTMLDivElement>(null),result=useRef<HTMLDivElement>(null);
 const motion=shared.work.settings.motion,powerSaver=shared.work.settings.powerSaver;
 useFiniteMotion(cards,{eventKey:`context:${context.contextId}@${context.contextCreatedAt}`,kind:'cards',mode:motion,powerSaver,enabled:!blocked});
 useFiniteMotion(result,{eventKey:state.result?.runId??null,kind:'surface',mode:motion,powerSaver,enabled:!blocked});
 return <div className="assistant-session" data-phase={state.phase}>
  <div className="assistant-basis"><strong>{title}</strong><span>{snapshot?`Gedächtnis ${snapshot.basis.memoryRevision} · Konfiguration ${snapshot.basis.configRevision}`:'Basis noch nicht bestätigt'}</span>{blocked&&<span className="assistant-warning">Stand gesperrt oder geändert</span>}</div>
  <div className="assistant-status-row"><p className="assistant-status" role="status" aria-live="polite" aria-atomic="true">{busy?({loading:'Projektbasis wird gelesen …',advising:'Offline-Beratung wird simuliert …',navigating:'Fortsetzungsbasis wird erneut geprüft …',previewing:'Lokale Vorschau wird erzeugt …',reviewing:'Vorschlag wird lokal geprüft …',committing:'Konkrete Änderung wird gespeichert …',reconciling:'Commitbeleg wird erneut gelesen …'} as Record<string,string>)[state.phase]:state.notice}</p><AssistantFormation state={state} context={context} blocked={blocked} mode={motion} powerSaver={powerSaver}/></div>
  {blocked&&<p role="alert">Arbeitsstand nicht aktuell oder nicht beschreibbar. Neue Beratung und Übernahme bleiben gesperrt. Den Arbeitsstand und anschließend die Projektbasis neu laden.</p>}
  {!!state.activity?.pendingAdapterCalls&&!busy&&<p role="status">Ergebnis verworfen. {state.activity.pendingAdapterCalls} Adapteraufruf noch nicht beendet; ein Engine-Ende ist nicht nachgewiesen.</p>}
  {state.error&&<p role="alert">{state.error}</p>}
  <AssistantCompanion state={state} context={context} blocked={blocked} motionEnabled={motion!=='off'} motion={motion} powerSaver={powerSaver}/>
  <div ref={cards} className="assistant-grid">
   <article className="assistant-card assistant-context-card" data-motion-card data-assistant-detail={detail}>
    <span className="assistant-step-tag">01 · DEIN PROJEKTSTAND</span><h3>Was ist belegt?</h3>
    {snapshot?.config.continuation.enabled===false?<p>Die Fortsetzungskarte ist in diesem Projekt deaktiviert.</p>:<>
     <p className="assistant-goal">{envelope?envelope.goal?.text??'Ein bestätigtes Projektziel fehlt':state.phase==='loading'?'Bestätigte Projektgrundlage wird gelesen …':'Bestätigte Projektgrundlage noch nicht verfügbar'}</p>
     {envelope?.goal&&<p className="assistant-evidence-label">Bestätigtes Ziel aus dem Projektgedächtnis</p>}
     {detail==='detailed'&&envelope&&<div className="assistant-evidence-expanded"><h4>Bestätigte Grundlage</h4>{[...(envelope.goal?[envelope.goal]:[]),...envelope.confirmed].length===0?<p>Noch keine bestätigten Einträge.</p>:<ul>{[...(envelope.goal?[envelope.goal]:[]),...envelope.confirmed].map((item,i)=><li key={i}><p>{item.text}</p><small>{item.evidenceRefs.map(sourceName).join('; ')}</small></li>)}</ul>}<p>Arbeitsstand: {snapshot?.basis.workUpdatedAt??'noch nicht gespeichert'}.</p></div>}
     {envelope&&<details><summary>Quellen und Grenzen ({envelope.confirmed.length+(envelope.goal?1:0)} bestätigte Einträge)</summary><ul>{[...(envelope.goal?[envelope.goal]:[]),...envelope.confirmed].flatMap(item=>item.evidenceRefs.map(ref=><li key={sourceName(ref)}>{sourceName(ref)}</li>))}</ul><p>{envelope.claims.length} unbestätigte Aussagen. {envelope.omissions.reduce((sum,item)=>sum+item.count,0)} Einträge ausgelassen.</p>{envelope.claims.length>0&&<ul>{envelope.claims.map((item,i)=><li key={i}>Unbestätigt: {item.text}</li>)}</ul>}<p>Ausgelassene Raumtexte sind keine bestätigten Belege. Die übereinstimmenden Revisionen wurden durch getrennte Lesezugriffe abgeglichen.</p></details>}
    </>}
    {snapshot&&snapshot.config.continuation.enabled&&state.continuation&&<div data-assistant-continuation>
     <h4>Hier weiterarbeiten</h4>
     <p>Projekt: {title} · erstellt {context.contextCreatedAt}</p>
     {snapshot.memory.entries.filter(entry=>entry.kind==='nextStep'&&entry.status==='confirmed').length===0?<p>Kein bestätigter nächster Schritt im Projektgedächtnis.</p>:<ul>{snapshot.memory.entries.filter(entry=>entry.kind==='nextStep'&&entry.status==='confirmed').map(entry=><li key={entry.id}><strong>Bestätigter nächster Schritt</strong><p>{entry.text}</p><small>{sourceName({kind:'memory-entry',id:entry.id,revision:entry.revision})}</small></li>)}</ul>}
     <p>{state.continuation.status==='none'?'Kein gespeicherter persönlicher Entwurf.':state.continuation.status==='active'?'Gesicherter persönlicher Entwurf · unbestätigt':state.continuation.status==='applied'?'Letzter Entwurf als Vorschlag übernommen; kein aktiver Entwurf.':'Letzter Entwurf verworfen; kein aktiver Entwurf.'}</p>
     {state.continuation.revision!==null&&<p>Revision {state.continuation.revision} · gespeichert {state.continuation.updatedAt} · {state.continuation.kind?({goal:'Ziel',decision:'Entscheidung',rejectedApproach:'Verworfener Ansatz',openQuestion:'Offene Frage',nextStep:'Nächster Schritt'})[state.continuation.kind]:''}</p>}
     {state.continuation.status==='active'&&<><p>{state.continuation.stale?'Entwurfsbasis hat sich geändert. Im Projektgedächtnis ausdrücklich vergleichen.':'Entwurfsbasis entspricht dem gelesenen Projektstand.'}</p><p>Die Beratung erhält nur den Projektbezug und die Entwurfrevision. Entwurfstext und ungesicherte Eingaben sind keine bestätigten Belege.</p></>}
    </div>}
    {snapshot?.config.continuation.enabled&&state.continuation?.status==='active'&&state.continuation.revision!==null&&<button type="button" disabled={!canStart} onClick={()=>{const href=window.location.href;void session.openMemory((destination,revision)=>{if(window.location.href===href)onOpenMemory(destination,revision)},state.continuation!.revision!)}}>Entwurf öffnen</button>}
    <button type="button" onClick={()=>{const href=window.location.href;void session.openMemory(destination=>{if(window.location.href===href)onOpenMemory(destination)})}} disabled={blocked||busy||!snapshot||!['ready','saved','preview','checked'].includes(state.phase)}>Projektgedächtnis öffnen</button>
   </article>
   <article className="assistant-card assistant-advice" data-motion-card><span className="assistant-step-tag">LOKALE BERATUNG</span><h3>Ein nächster Schritt, mit Grundlage</h3><p>Advisor und Fachprüfung verwenden feste Offline-Szenarien. Kein echtes Modell verbunden. Der lokale Modellhelfer ist nicht verfügbar.</p>
    <div className="assistant-actions"><button type="button" className="assistant-primary" disabled={!canStart} onClick={()=>void session.advise()}><span className="lq-button-visual">Beratung simulieren</span></button>{state.phase==='advising'&&<button type="button" onClick={()=>session.cancel()}>Beratung stoppen</button>}</div>
    {state.result&&!blocked&&snapshot&&<div ref={result} className="assistant-result"><span className="assistant-mode">{producerLabel(state.result.producer)}</span><h4>Einordnung durch den Host</h4><p>{state.result.summary}</p><AssistantAdvice result={state.result} config={snapshot.config}/><p>{state.result.nextAction==='ask-user'?'Nächster Schritt: bestätigtes Ziel und offene Fragen im Projektgedächtnis klären.':'Nächster Schritt: den belegten Projektstand prüfen; keine automatische Aktion.'}</p><small>Beratungsbasis: Gedächtnis {state.result.basis.memoryRevision}, Konfiguration {state.result.basis.configRevision}</small></div>}
    {lastEvent&&<details><summary>Gemessener Sitzungsablauf</summary><p>{lastEvent.durationMs.toFixed(1)} ms gemessene Beratungsdauer · {lastEvent.counters.modelCalls} Adapteraufrufe · {lastEvent.counters.hostSteps} Hostschritte</p><p>Keine Aussage über reale Modelllatenz oder Geräteleistung. Dieser begrenzte Verlauf wird nicht gespeichert.</p><p>{lastEvent.producer?`${lastEvent.producer.mode} · ${lastEvent.producer.bindingId}`:'Noch kein validierter Produzent'}</p></details>}
   </article>
  </div>
  {snapshot&&<section className="assistant-tuning"><div><span className="assistant-step-tag">DEINE DARSTELLUNG</span><h3>Wie viel Kontext hilft dir?</h3><p>Aktuell: {detail==='compact'?'kompakte Karte':'ausführliche Karte mit Belegen'}. Die gespeicherte Einstellung wirkt auf die Projektkarte und die aufklappbaren Beratungsquellen.</p></div><button ref={proposalButton} type="button" disabled={!canStart} onClick={()=>void session.preview(detail==='compact'?'detailed':'compact')}>{detail==='compact'?'Ausführliche Karte vorschlagen':'Kompakte Karte vorschlagen'}</button></section>}
  {state.preview&&<AssistantConfigPreview preview={state.preview} review={state.review} checked={awaiting} busy={busy} blocked={blocked} motion={motion} powerSaver={powerSaver} onReview={()=>void session.review()} onCommit={()=>void session.commit()} onCancel={()=>{session.cancel();queueMicrotask(()=>proposalButton.current?.focus())}}/>}
  {state.proof&&<Receipt proof={state.proof}/>}
  {state.phase==='uncertain'?<div className="assistant-actions"><button type="button" onClick={()=>void session.reconcile()}>Nur Commitbeleg erneut lesen</button><p>Operations-ID: {state.operationId}. Nach Verlassen der Ansicht wird keine Übernahme automatisch fortgesetzt.</p></div>:<div className="assistant-actions assistant-secondary-actions"><button type="button" disabled={busy} onClick={()=>void session.load()}>Projektbasis neu laden</button>{busy&&!['committing','reconciling','advising'].includes(state.phase)&&<button type="button" onClick={()=>session.cancel()}>Vorgang abbrechen</button>}</div>}
 </div>;
}
function Receipt({proof}:{proof:AssistantProof}){
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{heading.current?.focus()},[proof]);
 return <section className="assistant-receipt" data-assistant-receipt={proof.verification}><h3 ref={heading} tabIndex={-1}>{proof.verification==='verified'?'Speicherung bestätigt':proof.verification==='superseded'?'Spätere Änderung vorhanden':'Speicherung nicht bestätigt'}</h3><p>{proof.verification==='verified'?'Der separat gelesene Commitbeleg passt zur aktuellen gespeicherten Konfiguration.':proof.verification==='superseded'?'Der Beleg bestätigt die damalige Speicherung. Die aktuelle Konfiguration ist neuer.':'Kein passender Commitbeleg gefunden. Das ist keine Erfolgsbestätigung.'}</p>{proof.receipt&&<details><summary>Lokaler Commitbeleg</summary><dl><dt>Operation</dt><dd>{proof.receipt.operationId}</dd><dt>Revision</dt><dd>{proof.receipt.beforeRevision} → {proof.receipt.afterRevision}</dd><dt>Gespeichert am</dt><dd>{proof.receipt.committedAt}</dd><dt>Feld</dt><dd>{proof.receipt.changedFields.join(', ')}</dd></dl></details>}</section>;
}
