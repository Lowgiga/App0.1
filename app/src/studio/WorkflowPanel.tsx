import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {NativeSelect,NativeSelectOption} from '@/components/ui/native-select';
import {useWorkState} from '../shared-work-state.tsx';
import {useSystemPreferences} from '../system-preferences.tsx';
import {appendRunHistory,type RunHistory} from '../system-state.ts';
import {saveTextFile} from '../platform/runtime.ts';
import {workflowInputs,type Handler,type CatalogSource} from './workflow-host.ts';
import {createDurableWorkflowHost,type RecoveryView} from './durable-workflow-host.ts';
type WorkflowHost=Awaited<ReturnType<typeof createDurableWorkflowHost>>;
type Result=Pick<RecoveryView,'id'|'state'|'sourceUpdatedAt'|'completedCount'|'outputs'|'code'>;
const labels:Record<Handler|'all',string>={all:'Alle vier lokalen Prüfungen','mission-check':'Aufgaben prüfen','graph-explain':'Graph erklären','backup-plan':'Backup-Prüfplan','source-status':'Quellenstatus einordnen'};
const stateLabels:Record<string,string>={completed:'Abgeschlossen',paused:'Pausiert',interrupted:'Unterbrochen',aborted:'Gestoppt',failed:'Fehlgeschlagen','budget-exhausted':'Zeitbudget erreicht',running:'Wird ausgeführt'};
const unfinished=(view:RecoveryView|null)=>!!view&&(view.recoverable||['interrupted','running','paused','budget-exhausted'].includes(view.state));
function message(error:unknown){
 const code=error instanceof Error?error.message:typeof error==='string'?error:'';
 const explanations:Array<[RegExp,string]>=[
  [/LOCKS_UNAVAILABLE/,'Web Locks fehlen. Eine sichere exklusive Ausführung ist hier nicht möglich. Die App in einer unterstützten sicheren Umgebung öffnen.'],
  [/LOCK_BUSY|CONCURRENT_RUN/,'Eine andere Sitzung führt gerade einen Lauf aus. Dort pausieren oder den Abschluss abwarten, dann das Laufjournal erneut prüfen.'],
  [/STALE_VIEW|STORE_CONFLICT|JOURNAL_CONFLICT/,'Eine andere Sitzung hat den gespeicherten Lauf verändert. Das Laufjournal erneut prüfen, bevor eine weitere Aktion gewählt wird.'],
  [/SNAPSHOT_CHANGED|SNAPSHOT_UNAVAILABLE/,'Der Arbeitsstand oder die Quellen haben sich während der Prüfung geändert. Den gespeicherten Status prüfen und einen neuen Lauf mit den aktuellen Daten starten.'],
  [/VERSION_DRIFT|INTEGRITY|LOCAL_TOOL_BINDING|LOCAL_SELF_TEST|EVIDENCE/,'Die Skillversion oder ihre Sicherheitsprüfung passt nicht mehr. Es werden keine weiteren Schritte ausgeführt. Gespeicherten Lauf stoppen und die App-Pakete prüfen.'],
  [/JOURNAL_SCHEMA|JOURNAL_VERSION/,'Diese Laufjournal-Version wird von dieser App nicht unterstützt. Daten bleiben unverändert; mit einer passenden App-Version erneut öffnen.'],
  [/JOURNAL_CORRUPT|CHECKPOINT_INVALID|CHECKPOINT_CORRUPT|CHECKPOINT_DRIFT|STORE_CORRUPT/,'Das Laufjournal ist beschädigt oder widersprüchlich. Es wird nicht ersetzt. Vorhandene Ergebnisdateien sichern und die App erneut prüfen.'],
  [/JOURNAL_QUOTA/,'Der lokale Speicher ist voll. Speicherplatz außerhalb dieser App freigeben und anschließend das Laufjournal erneut prüfen.'],
  [/JOURNAL_LIMIT/,'Der gespeicherte Lauf überschreitet das erlaubte Datenlimit. Vorhandene Ergebnisse sichern; es wird nichts überschrieben.'],
  [/JOURNAL_|INDEXEDDB/,'Der lokale Lauf-Speicher ist momentan nicht verlässlich erreichbar. Andere App-Sitzungen schließen und das Laufjournal erneut prüfen.'],
  [/RECOVERY_REQUIRED/,'Ein gespeicherter Lauf wartet. Zuerst ausdrücklich fortsetzen oder stoppen, bevor ein neuer Lauf beginnt.'],
  [/CHECKPOINT_TERMINAL/,'Der gespeicherte Lauf ist bereits beendet. Das Laufjournal erneut prüfen; bei Bedarf einen neuen Lauf starten.'],
  [/CHECKPOINT_MISSING/,'Es wurde kein gespeicherter Lauf gefunden. Das Laufjournal erneut prüfen, bevor ein neuer Lauf gestartet wird.'],
  [/TIME_BUDGET/,'Das gemessene Zeitbudget ist erreicht. Bereits bestätigte Schritte sind gespeichert; die übrigen Schritte können ausdrücklich fortgesetzt werden.'],
  [/CLOCK_INVALID/,'Die Zeitmessung war nicht verlässlich. Der Lauf wurde angehalten. App neu laden und den gespeicherten Status prüfen.'],
  [/HOST_CLOSED/,'Diese Ansicht wurde geschlossen. Den gespeicherten Lauf in einer neu geöffneten Ansicht prüfen.'],
  [/HANDLER_FAILED|HOST_FAILURE/,'Die lokale Prüfung ist fehlgeschlagen. Bestätigte Ergebnisse bleiben gespeichert. Die Ursache prüfen und bei Bedarf einen neuen Lauf starten.']
 ];
 const explanation=explanations.find(([pattern])=>pattern.test(code))?.[1];
 return explanation?explanation+' ('+code+')':code||'Lokale Prüfung fehlgeschlagen. Bitte den gespeicherten Status erneut prüfen.';
}
export function WorkflowPanel({sources}:{sources:CatalogSource[]}){
 const shared=useWorkState(),preferences=useSystemPreferences();
 const [host,setHost]=useState<WorkflowHost|null>(null),[initError,setInitError]=useState(''),[attempt,setAttempt]=useState(0);
 const [running,setRunning]=useState(false),[controllable,setControllable]=useState(false),[loadingRecovery,setLoadingRecovery]=useState(true),[storageBlocked,setStorageBlocked]=useState(false);
 const [recovery,setRecovery]=useState<RecoveryView|null>(null),[status,setStatus]=useState(''),[result,setResult]=useState<Result|null>(null),[error,setError]=useState(''),[tick,setTick]=useState(0),[requested,setRequested]=useState<'pause'|'abort'|null>(null),[resultIsPrevious,setResultIsPrevious]=useState(false);
 const gate=useRef(false),requestGate=useRef<'pause'|'abort'|null>(null),mounted=useRef(true),hostRef=useRef<WorkflowHost|null>(null),loadGeneration=useRef(0);
 const snapshot=useRef({work:shared.work,sources});snapshot.current={work:shared.work,sources};
 const current=(value:WorkflowHost)=>mounted.current&&hostRef.current===value;
 useEffect(()=>{
  mounted.current=true;let cancelled=false;let value:WorkflowHost|undefined;let unsubscribe:(()=>unknown)|undefined;
  setInitError('');setHost(null);setLoadingRecovery(true);setStorageBlocked(false);
  void createDurableWorkflowHost().then(created=>{if(cancelled){created.dispose();return}value=created;hostRef.current=created;setHost(created);unsubscribe=created.subscribe(()=>{if(current(created))setTick(v=>v+1)})}).catch(e=>{if(!cancelled)setInitError('Skillkatalog konnte nicht vollständig geprüft werden. Ausführung ist gesperrt. '+message(e))});
  return()=>{cancelled=true;mounted.current=false;loadGeneration.current++;unsubscribe?.();value?.dispose();if(hostRef.current===value)hostRef.current=null};
 },[attempt]);
 function show(view:RecoveryView|null){setResultIsPrevious(false);setRecovery(view);setResult(view);setStatus(view?.state??'')}
 async function reload(value:WorkflowHost,clearBlock=false){
  const generation=++loadGeneration.current;setLoadingRecovery(true);
  try{
   let input:typeof snapshot.current,view:RecoveryView|null;
   // A UI snapshot may change while IndexedDB/package verification is pending.
   // Re-read against the current inputs before enabling any recovery action.
   do{input=snapshot.current;view=await value.load(input.work,input.sources)}
   while(current(value)&&loadGeneration.current===generation&&(input.work!==snapshot.current.work||input.sources!==snapshot.current.sources));
   if(current(value)&&loadGeneration.current===generation){show(view);if(clearBlock){setStorageBlocked(false);setError('')}}return view;
  }
  catch(e){if(current(value)&&loadGeneration.current===generation){setStorageBlocked(true);setError('Laufjournal konnte nicht sicher gelesen werden. Vorhandene Ergebnisse bleiben erhalten; Ausführung ist bis zur erneuten Prüfung gesperrt. '+message(e))}throw e}
  finally{if(current(value)&&loadGeneration.current===generation)setLoadingRecovery(false)}
 }
 useEffect(()=>{if(!host||!shared.hasLoaded||shared.loadingWork||gate.current||storageBlocked)return;void reload(host).catch(()=>{})},[host,shared.work,sources,shared.hasLoaded,shared.loadingWork,running]);
 const config=preferences.value.workflow;
 const disabled=!preferences.ready||!host||!host.available||!shared.hasLoaded||shared.loadingWork||shared.storageError||shared.busy||!!preferences.error||running||loadingRecovery||storageBlocked;
 const saveConfig=async(patch:Partial<typeof config>)=>{try{await preferences.save(current=>({...current,workflow:{...current.workflow,...patch}}))}catch{}};
 const saveHistory=async(value:Result)=>{const record:RunHistory={id:value.id,at:new Date().toISOString(),state:value.state,sourceUpdatedAt:value.sourceUpdatedAt,completedCount:value.completedCount,outputs:value.outputs,...(value.code?{code:value.code}:{})};await preferences.save(current=>appendRunHistory(current,record))};
 async function execute(action:'start'|'resume'|'stop'){
  if(disabled||gate.current||!host||action==='start'&&unfinished(recovery)||action==='resume'&&(!recovery?.recoverable||recovery.stale)||action==='stop'&&!unfinished(recovery))return;
  const value=host;gate.current=true;loadGeneration.current++;requestGate.current=null;setRequested(null);setControllable(false);setRunning(true);setResultIsPrevious(action==='start'&&!!result);setStatus(action==='stop'?'Stop angefordert · wartet auf dauerhafte Bestätigung':action==='start'?'Start wird vorbereitet · Laufjournal wird geprüft':'running');setError('');
  try{
   if(action==='start'){
    // Archive the journal before replacing it, including a terminal run left by another session.
    const saved=await value.load(snapshot.current.work,snapshot.current.sources);
    if(!current(value))return;
    if(unfinished(saved))throw new Error('Ein gespeicherter Lauf wartet. Bitte zuerst fortsetzen oder stoppen.');
    if(saved)await saveHistory(saved);
    if(!current(value))return;
   }
   const options={pauseAfterStep:config.pauseAfterStep,getSnapshot:()=>snapshot.current};
   const execution=action==='start'?value.start(snapshot.current.work,snapshot.current.sources,config.skill,options):action==='resume'?value.resume(snapshot.current.work,snapshot.current.sources,options):value.stopSaved();
   setControllable(action!=='stop');if(action!=='stop')setStatus('running');
   const outcome=await execution;
   if(current(value))setControllable(false);
   if(!current(value))return;
   if(!outcome.persisted)throw new Error('Der Ausgang wurde nicht dauerhaft im Laufjournal bestätigt.');
   setResultIsPrevious(false);setResult(outcome);setStatus(outcome.state);
   try{await saveHistory(outcome)}catch(e){if(current(value))setError('Das Laufjournal wurde gespeichert, der Studio-Verlauf jedoch nicht. Der gespeicherte Lauf bleibt erhalten. '+message(e))}
   if(current(value))await reload(value);
  }catch(e){
   if(current(value)){setStatus('Ausgang nicht bestätigt');setStorageBlocked(true);setError('Der Lauf wurde nicht als erfolgreich gespeichert bestätigt. Vor weiterer Ausführung das Laufjournal erneut prüfen. '+message(e));try{await reload(value)}catch{}}
  }finally{gate.current=false;requestGate.current=null;if(current(value)){setRunning(false);setControllable(false);setRequested(null);setLoadingRecovery(false)}}
 }
 function requestControl(kind:'pause'|'abort'){
  if(!running||!controllable||!host||requestGate.current==='abort'||requestGate.current===kind)return;
  if(host[kind]()){requestGate.current=kind;setRequested(kind);setStatus(kind==='pause'?'Pause angefordert · wartet auf dauerhafte Bestätigung':'Stop angefordert · wartet auf dauerhafte Bestätigung')}
 }
 const canResume=recovery?.recoverable&&!recovery.stale,events=host?.events()??[],historyInfo=host?.historyInfo();void tick;
 return <section className="panel system-workflows" aria-label="Offline-Skills und lokale Prüfprozesse"><span className="eyebrow">VERIFIZIERTE LOKALE FUNKTIONEN</span><h2>Skills und begrenzte Prüfprozesse</h2><p>Vier fest eingebaute Funktionen prüfen den geladenen Zustand. Kein Modellaufruf, keine Netzwerkverbindung, kein Agentenstart und keine externe Aktion. Ein Lauf umfasst höchstens acht Schritte und 1.000 ms gemessene Laufzeit einschließlich Speicherprüfung pro Fortsetzung.</p><p>Aufgabenprüfung betrachtet aktive Aufgaben; Graph und Quellen verwenden den geladenen Snapshot. Titel werden für Skill-Eingaben auf 200 Zeichen begrenzt, Graphbeschriftungen auf 80. Große Graphen werden vollständig in Teilschritten mit höchstens 500 Kanten erklärt; die Teilnummern stehen im Ergebnis. Der Backup-Skill erstellt nur einen Prüfplan und liest keine Datei.</p>
 {initError?<div role="alert">{initError}<Button variant="outline" onClick={()=>setAttempt(v=>v+1)}>Katalog erneut prüfen</Button></div>:!host?<p role="status">Paketintegrität wird geprüft …</p>:<p role="status">{host.catalog().length} gebündelte Skillpakete integritätsgeprüft. {host.selfTestsRun()} tatsächlich ausgeführte lokale Selbsttests in dieser Sitzung. Jeder Arbeitsschritt erfordert eine frische interne Prüfung.</p>}
 {host&&!host.available&&<p role="alert">Web Locks sind in dieser Umgebung nicht verfügbar. Eine sichere exklusive Ausführung ist nicht möglich; Start, Fortsetzen und Stoppen sind gesperrt. Gespeicherte Ergebnisse bleiben lesbar.</p>}
 {host&&loadingRecovery&&<p role="status">Gespeichertes Laufjournal wird geprüft …</p>}
 <div className="system-controls"><label>Prüfumfang<NativeSelect value={config.skill} disabled={!preferences.ready||running||!!preferences.error} onChange={e=>saveConfig({skill:e.target.value as Handler|'all'})}>{Object.entries(labels).map(([id,label])=><NativeSelectOption key={id} value={id}>{label}</NativeSelectOption>)}</NativeSelect></label><label><input type="checkbox" checked={config.pauseAfterStep} disabled={!preferences.ready||running||!!preferences.error} onChange={e=>saveConfig({pauseAfterStep:e.target.checked})}/>Nach jedem Schritt pausieren</label></div>
 <div className="actions-row"><Button disabled={disabled||unfinished(recovery)} onClick={()=>void execute('start')}>Lokale Prüfung starten</Button><Button variant="outline" disabled={disabled||!canResume} onClick={()=>void execute('resume')}>Gespeicherten Lauf fortsetzen</Button><Button variant="outline" disabled={disabled||!unfinished(recovery)} onClick={()=>void execute('stop')}>Gespeicherten Lauf stoppen</Button><Button variant="outline" disabled={!running||!controllable||!!requested} onClick={()=>requestControl('pause')}>Pausieren</Button><Button variant="outline" disabled={!running||!controllable||requested==='abort'} onClick={()=>requestControl('abort')}>Stoppen</Button></div>
 {unfinished(recovery)&&<p className="short-note">Ein gespeicherter Lauf wartet. Bitte zuerst ausdrücklich fortsetzen oder stoppen, bevor ein neuer Lauf beginnt.</p>}
 {recovery?.state==='interrupted'&&<p role="status">Dieser Lauf wurde unterbrochen oder ist noch in einer anderen Sitzung aktiv. Es erfolgt keine automatische Wiederaufnahme; die exklusive Sperre wird vor einer Aktion erneut geprüft.</p>}
 {recovery?.stale&&<p role="alert">Prüfgrundlage oder Skillversion hat sich geändert. Dieser gespeicherte Lauf kann nicht fortgesetzt werden. {unfinished(recovery)?'Ergebnisse bleiben sichtbar; erst stoppen, dann mit dem aktuellen Stand neu starten.':'Das Ergebnis gehört zum vorherigen Stand. Ein neuer Lauf prüft die aktuellen Daten.'}</p>}
 {recovery?.reason&&<p className="short-note">{recovery.reason}</p>}{result?.code&&['failed','budget-exhausted'].includes(result.state)&&<p role="alert">{message(result.code)}</p>}
 <p role="status" aria-live="polite">{stateLabels[status]??status}{result&&!resultIsPrevious?` · ${result.completedCount} bestätigte Schritte`:''}</p>
 {result&&!running&&<p className="short-note">Lokal gespeichert im Laufjournal.</p>}{error&&<p role="alert">{error}</p>}{preferences.error&&<p role="alert">Studio-Speicherung gesperrt: {preferences.error}</p>}
 {storageBlocked&&host&&<Button variant="outline" disabled={running||loadingRecovery} onClick={()=>{if(gate.current)return;gate.current=true;void reload(host,true).catch(()=>{}).finally(()=>{gate.current=false})}}>Laufjournal erneut prüfen</Button>}
 {result&&<p className="short-note">Prüfgrundlage: {result.sourceUpdatedAt??'Mitgelieferter Beispiel-/Anfangsstand, noch nicht lokal geändert'}{result.sourceUpdatedAt!==shared.work.updatedAt?' · Der App-Arbeitsstand hat sich inzwischen geändert; das Ergebnis gehört zum vorherigen Snapshot.':''}</p>}
 {result&&<details open><summary>{resultIsPrevious?'Vorherige gespeicherte Ergebnisse':'Berechnete Ergebnisse'}</summary><pre>{JSON.stringify(result.outputs,null,2)}</pre><Button variant="outline" onClick={()=>void saveTextFile('LowQuantFlow-local-results.json',JSON.stringify({sourceUpdatedAt:result.sourceUpdatedAt,historyOnly:true,result:{state:result.state,completedCount:result.completedCount,code:result.code,outputs:result.outputs}},null,2),'application/json')}>Ergebnisdatei sichern</Button></details>}
 <details><summary>Schritte und übergebene Eingabedaten vorab prüfen</summary><pre>{JSON.stringify(shared.hasLoaded?workflowInputs(shared.work,sources):{state:'unknown'},null,2)}</pre></details>
 <details><summary>Skillkatalog und Paketherkunft</summary>{host?.catalog().map((skill:any)=><div className="system-skill" key={skill.id}><h3>{labels[skill.handler as Handler]}</h3><p>{skill.description}</p><small>{skill.id} · {skill.version} · Integrität: {skill.integrity.status}</small><details><summary>Versionhash und Toolvertrag</summary><pre>{JSON.stringify({versionHash:skill.versionHash,tools:skill.tools,inspector:host.inspect(skill.handler)},null,2)}</pre></details></div>)}</details>
 <details><summary>Echte Ereignisse dieser Sitzung ({events.length})</summary><p>Retiniert: {historyInfo?.retainedCount??0} · verworfen: {historyInfo?.droppedCount??0}. Ein begrenzter Sitzungsausschnitt, kein vollständiges Auditprotokoll.</p><ol>{events.map((event:any)=><li key={event.sequence}>#{event.sequence} · {event.type}{event.stepId?' · '+event.stepId:''}{event.state?' · '+(stateLabels[event.state]??event.state):''}</li>)}</ol></details>
 <details><summary>Lokal gespeicherte Ergebnisverläufe ({preferences.value.history.length}, höchstens 20)</summary><p>Historische Ergebnisse sind keine Ausführungsfreigaben. Nur das separate lokale Laufjournal ermöglicht eine ausdrücklich gewählte Fortsetzung nach erneutem Laden. Verlauf und Backup verleihen keine Ausführungsrechte.</p>{preferences.value.history.map(item=><details key={item.id}><summary>{item.at} · {stateLabels[item.state]??item.state} · {item.completedCount} Schritte</summary><pre>{JSON.stringify(item,null,2)}</pre></details>)}</details><p className="short-note">Pause und Stop werden an Kontrollstellen wirksam; eine gerade laufende synchrone Funktion kann nicht hart unterbrochen werden. Keine Android-Hintergrundausführung oder automatische Wiederaufnahme nach App-Neustart.</p>
 </section>
}
