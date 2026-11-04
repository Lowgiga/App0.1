import {useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {useWorkTransport} from './work-transport.tsx';
import type {LegacyImportPreview} from './legacy-import.ts';

type Phase='idle'|'reading'|'previewing'|'ready'|'committing'|'refreshing';
interface Props {
 blocked:boolean;active:boolean;revision:string|null;
 onCommitted:()=>unknown|Promise<unknown>;onExport:()=>unknown;
 validateFile?:(file:File)=>void;
}
type Preview={data:LegacyImportPreview;revision:string|null};
const format=(bytes:number)=>bytes.toLocaleString('de-DE');
const uncertain='Der Ausgang des Imports ist unklar. Der aktuelle Stand wird neu geladen. Vor einer Wiederholung den Bestand und Verlauf prüfen; der Import wird nicht automatisch wiederholt.';
const changed='Der lokale Stand hat sich geändert. Die Vorschau wird aktualisiert. Bitte erneut prüfen und bestätigen.';

/** A preview is read-only; the sole write is a separately confirmed, one-use plan. */
export function LegacyImportPanel(props:Props){
 const transport=useWorkTransport(),titleId=useId(),descriptionId=useId();
 const [phase,setPhase]=useState<Phase>('idle'),[preview,setPreview]=useState<Preview|null>(null);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[receipt,setReceipt]=useState<LegacyImportPreview|null>(null);
 const latest=useRef(props);latest.current=props;
 const generation=useRef(0),controller=useRef<AbortController|null>(null),mounted=useRef(true);
 const stage=useRef<Phase>('idle'),plan=useRef<Preview|null>(null),rawText=useRef<string|null>(null);
 const pendingRefresh=useRef<{token:number;raw:string}|null>(null);
 const input=useRef<HTMLInputElement>(null),trigger=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLDialogElement>(null);
 const lastRevision=useRef(props.revision);
 function transition(next:Phase){stage.current=next;setPhase(next)}
 function replacePreview(next:Preview|null){plan.current=next;setPreview(next)}
 function invalidate(){generation.current++;controller.current?.abort();controller.current=null;plan.current=null;stage.current='idle';pendingRefresh.current=null}
 function current(token:number){return mounted.current&&generation.current===token&&latest.current.active&&!latest.current.blocked}
 async function reload(){try{const result=await latest.current.onCommitted();if(result===false)throw Error('Abruf fehlgeschlagen');return true}catch{if(mounted.current)setError(previous=>(previous?previous+' ':'')+'Der aktuelle Stand konnte nicht geladen werden. Vor weiteren Änderungen vollständig neu laden.');return false}}
 function resumeRefresh(){const pending=pendingRefresh.current;if(pending&&current(pending.token)){pendingRefresh.current=null;void inspectText(pending.raw,changed)}}
 function cancel(){
  const pendingCommit=stage.current==='committing';invalidate();rawText.current=null;replacePreview(null);transition('idle');setNotice('');setError(pendingCommit?uncertain:'');
  if(input.current)input.current.value='';
  if(pendingCommit)void reload();
 }
 const actions=useRef({cancel});actions.current={cancel};
 useEffect(()=>{
  mounted.current=true;
  const leave=()=>actions.current.cancel();
  const fileInput=input.current;fileInput?.addEventListener('cancel',leave);
  window.addEventListener('popstate',leave);window.addEventListener('cue:navigate',leave);
  return()=>{
   const pendingCommit=stage.current==='committing';
   mounted.current=false;invalidate();rawText.current=null;
   fileInput?.removeEventListener('cancel',leave);window.removeEventListener('popstate',leave);window.removeEventListener('cue:navigate',leave);
   // The transaction may already have committed before its response was lost.
   // Reconcile a surviving provider, but never update this unmounted surface.
   if(pendingCommit)void reload();
  };
 },[]);
 useLayoutEffect(()=>{
  const revisionChanged=lastRevision.current!==props.revision;lastRevision.current=props.revision;
  if(!props.active){if(stage.current!=='idle')cancel();return}
  // A conflict refresh deliberately reloads shared state; its temporary loading gate
  // must not erase the retained input. Only that owned refresh waits for unblock.
  if(props.blocked){if(stage.current!=='idle'&&stage.current!=='refreshing')cancel();return}
  if(stage.current==='refreshing'){resumeRefresh();return}
  if(!revisionChanged)return;
  if(stage.current==='committing'){cancel();return}
  if(rawText.current!==null)void inspectText(rawText.current,changed);
 },[props.active,props.blocked,props.revision]);
 const open=phase!=='idle';
 useEffect(()=>{
  const element=dialog.current;if(!open||!element)return;
  element.showModal();
  return()=>{if(element.open)element.close();if(latest.current.active)trigger.current?.focus()};
 },[open]);

 async function inspectText(raw:string,message=''){
  invalidate();const token=generation.current,abort=new AbortController();controller.current=abort;
  rawText.current=raw;replacePreview(null);transition('previewing');setError('');setNotice(message);
  const observedRevision=latest.current.revision;
  try{
   const response=await transport.request('/api/imports/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:raw,signal:abort.signal});
   const data=await response.json();if(!current(token))return;
   if(!response.ok)throw Error(data.error||'Import-Vorschau fehlgeschlagen.');
   if(typeof data.planId!=='string'||!data.summary||typeof data.canCommit!=='boolean')throw Error('Die Import-Vorschau ist unvollständig. Bitte Datei erneut wählen.');
   replacePreview({data,revision:observedRevision});transition('ready');
  }catch(reason){if(!current(token))return;rawText.current=null;replacePreview(null);transition('idle');setError(reason instanceof Error?reason.message:'Import-Vorschau fehlgeschlagen.')}
 }
 async function select(file?:File){
  cancel();if(!file||!latest.current.active||latest.current.blocked)return;
  const token=generation.current;
  try{
   if(file.size>3*1024*1024)throw Error('Die Datei darf höchstens 3 MiB (3.145.728 Byte) groß sein.');
   latest.current.validateFile?.(file);
   transition('reading');const raw=await file.text();if(!current(token))return;
   await inspectText(raw);
  }catch(reason){if(!current(token))return;rawText.current=null;replacePreview(null);transition('idle');setError(reason instanceof Error?reason.message:'Datei konnte nicht gelesen werden.')}
  finally{if(generation.current===token&&input.current)input.current.value=''}
 }
 function choose(){cancel();input.current?.click()}
 async function commit(){
  const selected=plan.current;
  if(stage.current!=='ready'||!selected||!selected.data.canCommit||latest.current.blocked||!latest.current.active)return;
  if(selected.revision!==latest.current.revision){if(rawText.current!==null)void inspectText(rawText.current,changed);return}
  // Ref lock closes the same-event-loop double-click gap before React can render disabled.
  transition('committing');const token=generation.current,abort=new AbortController();controller.current=abort;setError('');
  try{
   const response=await transport.request('/api/imports/commit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planId:selected.data.planId}),signal:abort.signal});
   const result=await response.json();if(!current(token))return;
   if(response.status===409){
    const raw=rawText.current;replacePreview(null);transition('refreshing');setNotice(changed);
    const loaded=await reload();if(!mounted.current||generation.current!==token)return;
    if(!loaded){invalidate();rawText.current=null;transition('idle');return}
    if(raw!==null){pendingRefresh.current={token,raw};resumeRefresh()}return;
   }
   if(!response.ok){invalidate();rawText.current=null;replacePreview(null);transition('idle');setError(result.error||'Import fehlgeschlagen. Bitte den vorhandenen Stand prüfen.');return}
   if(!result.receipt||result.receipt.planId!==selected.data.planId)throw Error('Importbeleg fehlt.');
   invalidate();rawText.current=null;replacePreview(null);transition('idle');setNotice('');setReceipt(result.receipt);
   await reload();
  }catch{if(!current(token))return;invalidate();rawText.current=null;replacePreview(null);transition('idle');setError(uncertain);await reload()}
 }
 return <section className="legacy-import" aria-label="Legacy-Arbeitsstand importieren">
  <div className="actions-row"><Button ref={trigger} variant="outline" disabled={props.blocked||!props.active||phase==='committing'} onClick={choose}>Arbeitsstand importieren</Button><Button variant="outline" disabled={phase==='committing'} onClick={()=>props.onExport()}>Bisherigen Stand exportieren</Button><input ref={input} className="hidden-input" type="file" accept="application/json,.json" aria-label="Legacy-JSON-Datei wählen" onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';void select(file)}}/></div>
  {error&&<p className="danger-muted" role="alert">{error}</p>}
  {receipt&&<section className="panel backup-preview" aria-label="Importbeleg"><h3>Import lokal gespeichert</h3><p role="status">Dieser Beleg bestätigt die abgeschlossene Zusammenführung.</p><ImportSummary value={receipt} committed/></section>}
  {open&&<dialog ref={dialog} className="mesh-sheet panel" aria-labelledby={titleId} aria-describedby={descriptionId} aria-modal="true" style={{position:'fixed',inset:0,margin:'auto',maxHeight:'calc(100dvh - 2rem)',color:'inherit'}} onCancel={event=>{event.preventDefault();cancel()}}>
   <div className="sheet-body"><h2 id={titleId}>Legacy-Import prüfen</h2><p id={descriptionId}>Vorhandene Räume samt Beiträgen bleiben vollständig erhalten. Neue importierte Missionen und Freigaben müssen neu geprüft werden. Dies ist kein Vollrestore; Einstellungen und Arbeitsprofile bleiben erhalten.</p>
    {notice&&<p role="status" className="danger-muted">{notice}</p>}
    {(phase==='reading'||phase==='previewing'||phase==='refreshing')&&<p role="status">{phase==='reading'?'Datei wird gelesen …':'Unverbindliche Vorschau wird geprüft …'}</p>}
    {preview&&<><ImportSummary value={preview.data}/>{!preview.data.canCommit&&<p role="alert" className="danger-muted">Der Zielbestand überschreitet das Speicherbudget. Es wurde nichts gespeichert. Sichere und verkleinere zuerst den Bestand oder die Importdatei.</p>}</>}
    {phase==='committing'&&<p role="status">Bestätigter Import wird lokal gespeichert …</p>}
    <div className="actions-row"><Button variant="outline" autoFocus onClick={cancel}>Abbrechen</Button>{preview&&<Button disabled={props.blocked||phase!=='ready'||!preview.data.canCommit} onClick={()=>void commit()}>Verbindlich zusammenführen</Button>}<Button variant="outline" disabled={phase==='committing'} onClick={choose}>Andere Datei wählen</Button></div>
   </div>
  </dialog>}
 </section>;
}

function ImportSummary({value,committed=false}:{value:LegacyImportPreview;committed?:boolean}){
 const s=value.summary;
 return <div className="backup-preview">
  <h3>{committed?'Ergebnis':'Geplante Zusammenführung'}</h3>
  <p>Raum-ID gewinnt: {s.newRooms} neue Räume · {s.retainedRooms} vorhandene Räume vollständig behalten. {s.importedPosts} Beiträge {committed?'übernommen':'werden übernommen'} · {s.skippedPosts} Beiträge aus vorhandenen Räumen übersprungen, davon {s.duplicatePosts} mit bereits vorhandener Beitrags-ID.</p>
  <ul><li>{s.importedNotes} Notizen · {s.importedTasks} Aufgaben ergänzt</li><li>{s.resetMissions} Missionen auf „Erstellt“ zurückgesetzt · {s.resetApprovals} Freigaben als neue offene Anfragen, einen Tag gültig; neu prüfen</li><li>{s.importedMarkers} Planmarker ergänzt · {s.retainedMarkers} vorhandene Marker behalten</li><li>{s.importedLearning} Lernfortschritte ergänzt · {s.retainedLearning} vorhandene Lernfortschritte behalten</li><li>{s.duplicateRecords} Datensätze mit vorhandener ID übersprungen · {s.rejectedRecords} ungültige Datensätze in diesem geprüften Plan</li><li>{s.ignoredEvents} importierte Ereignisse und {s.ignoredInteractions} importierte Interaktionen ignoriert</li></ul>
  {s.defaultedTasks>0&&<p>Vom Legacy-Format ergänzte Aufgabenvorlagen: {s.defaultedTasks} (keine Datensätze der Datei)</p>}
  {s.evictedEvents>0&&<p className="danger-muted" role={committed?'status':'alert'}>{s.evictedEvents} älteste bestehende Ereignisse {committed?'wurden':'werden'} wegen der unveränderten Ereignisgrenze von 200 Einträgen entfernt. Vor dem Import bei Bedarf den bisherigen Stand exportieren.</p>}
  <p>Datei: {format(value.inputBytes)} UTF-8-Byte · Zielbestand einschließlich neuer Ereignisse: {format(value.targetBytes)} UTF-8-Byte · Budget: {format(value.budgetBytes)} UTF-8-Byte · {value.remainingBytes<0?'Überschreitung':'Verbleibend'}: {format(Math.abs(value.remainingBytes))} Byte.</p>
 </div>;
}
