import {useEffect,useMemo,useRef,useState} from 'react';
import type {ExplorerGraph} from '../../vendor/mesh-extensions/src/model.ts';
import {HintController,buildLocalHint,contextKey,defaultHintPreferences,hintRules,selectionContext,type HintPreferences,type LocalHint,type SelectionContext} from './core.ts';
import '../studio/assistant.css';
import './context-hints.css';

type Props={graph:ExplorerGraph;selectedId:string|null;rooms:readonly {id:string;createdAt:string}[];focus?:SelectionContext['focus'];active:boolean;preferences?:HintPreferences;onSave:(next:HintPreferences)=>Promise<void>};
export function ContextHints({graph,selectedId,rooms,focus='graph',active,preferences,onSave}:Props){
 const [value,setValue]=useState(preferences??defaultHintPreferences),[hint,setHint]=useState<LocalHint|null>(null),[visible,setVisible]=useState(()=>typeof document!=='undefined'&&document.visibilityState!=='hidden');
 const [manual,setManual]=useState<LocalHint|null>(null);
 const [pending,setPending]=useState(false),[error,setError]=useState('');
 const mounted=useRef(false),busy=useRef(false),engine=useRef<HintController|null>(null);
 if(!engine.current)engine.current=new HintController({publish:setHint});
 const context=useMemo(()=>selectionContext(graph,selectedId,rooms,focus),[graph,selectedId,rooms,focus]);
 const key=context?contextKey(context):'';
 useEffect(()=>setManual(null),[key,active,visible]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;engine.current?.pause()}},[]);
 useEffect(()=>{const update=()=>setVisible(document.visibilityState!=='hidden');document.addEventListener('visibilitychange',update);update();return()=>document.removeEventListener('visibilitychange',update)},[]);
 useEffect(()=>{setValue(preferences??defaultHintPreferences())},[preferences?.enabled,preferences?.frequency,preferences?.detail]);
 useEffect(()=>{engine.current!.update(context,graph,value,active&&visible);return()=>engine.current!.pause()},[key,graph,value.enabled,value.frequency,active,visible]);
 // A render-time identity guard hides an old answer before effects get a turn.
 const currentManual=manual&&contextKey(manual.context)===key?manual:null;
 const candidate=currentManual??(value.enabled?hint:null);
 const shown=active&&visible&&context&&candidate&&contextKey(candidate.context)===key?buildLocalHint(candidate.context,graph,value.detail):null;
 const save=async(next:HintPreferences)=>{if(busy.current)return;busy.current=true;setPending(true);setError('');setValue(next);if(!next.enabled){engine.current!.pause();setManual(null);}try{await onSave(next)}catch(cause){if(mounted.current){setValue(current=>({...current,enabled:false}));setError('Einstellungen nicht gespeichert. Hinweise bleiben für diese Ansicht stumm. '+(cause instanceof Error?cause.message:''))}}finally{busy.current=false;if(mounted.current)setPending(false)}};
 const rules=hintRules[value.frequency];
 return <aside className="assistant-card context-hints" aria-label="Hinweise zur aktuellen Auswahl">
  <header><h2>Auswahl verstehen</h2><span className="assistant-mode">Offline-Regeln</span></header>
  <p>Lokale Hinweise aus dem ausgewählten Objekt. Kein KI-Modell verbunden.</p>
  <div className="context-hint-controls">
   <label><input type="checkbox" aria-label="Hinweise zur Auswahl" checked={value.enabled} disabled={pending} onChange={event=>void save({...value,enabled:event.target.checked})}/>Hinweise zur Auswahl</label>
   <label>Häufigkeit<select aria-label="Häufigkeit der Hinweise" value={value.frequency} disabled={pending} onChange={event=>void save({...value,frequency:event.target.value as HintPreferences['frequency']})}><option value="rare">Selten</option><option value="balanced">Ausgewogen</option><option value="frequent">Häufig</option></select></label>
   <label>Detailtiefe<select aria-label="Detailtiefe der Hinweise" value={value.detail} disabled={pending} onChange={event=>void save({...value,detail:event.target.value as HintPreferences['detail']})}><option value="compact">Kurz</option><option value="detailed">Ausführlich</option></select></label>
  </div>
  {error&&<p role="alert">{error}</p>}
  <div className="context-hint-actions"><button type="button" disabled={!context||!active||!visible} onClick={()=>{if(context){engine.current!.pause();setManual(buildLocalHint(context,graph,value.detail))}}}>Auswahl erklären</button></div>
  <div role="status" aria-live="polite" aria-atomic="true">
   {shown?<article data-context-hint>{currentManual&&<p className="assistant-evidence-label">Auf Anfrage · lokal erklärt</p>}<h3>{shown.explanation}</h3><p>{shown.tip}</p><p>{shown.idea}</p><p className="assistant-evidence-label">{shown.context.project?'Belegter Raumbezug vorhanden':'Arbeitsbereich: kein belegter Raumbezug'}</p><details open={value.detail==='detailed'}><summary>Grundlage ansehen</summary><ul>{shown.evidence.map(evidence=><li key={evidence}>{evidence}</li>)}</ul></details></article>:<p>{!value.enabled?'Hinweise sind stumm.':!active||!visible?'Hinweise pausieren, solange diese Ansicht nicht sichtbar ist.':graph.availability!=='available'||!graph.updatedAt?'Ein bestätigter Arbeitsstand fehlt. Hinweise starten nach dem Laden eines gespeicherten Standes.':!selectedId?'Wähle ein Objekt in der Karte, Liste oder im Inspector.':!context?'Dieses Objekt ist im aktuellen Stand nicht mehr vorhanden.':'Auswahl erfasst. Hinweise erscheinen nach einer kurzen Pause; Wiederholungen und häufige Wechsel bleiben ruhig.'}</p>}
  </div>
  {shown&&<div className="context-hint-actions"><button type="button" onClick={()=>{engine.current!.dismiss(shown.context);setManual(null)}}>Verwerfen</button><button type="button" disabled={pending} onClick={()=>void save({...value,enabled:false})}>Stumm schalten</button></div>}
  <details><summary>So werden Hinweise ausgelöst</summary><p>„Auswahl erklären“ funktioniert auch bei stummen Hinweisen. Es verändert die automatische Häufigkeit nicht.</p><p>Nur eine bestätigte Objektauswahl in dieser App zählt. Maus, Tastatur und Touch verwenden dieselbe Auswahl. Darüberfahren oder Texte markieren startet nichts.</p><ul><li>{rules.debounce} ms Ruhe nach der Auswahl</li><li>Mindestens {rules.cooldown/1000} Sekunden zwischen Hinweisen</li><li>Höchstens {rules.budget} Hinweise in 10 Minuten</li><li>Dieselbe Quelle mit gleichem Quellen- und Arbeitsstand wird 10 Minuten nicht wiederholt</li></ul><p>Auswahl und Hinweise ändern keine Projekte, Entwürfe oder Rechte. Einstellungen werden nur durch diese Schalter lokal gespeichert. Zähler gelten für diese geöffnete Ansicht.</p></details>
 </aside>;
}
