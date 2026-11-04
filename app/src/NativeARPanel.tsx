import {useEffect,useMemo,useRef,useState} from 'react';
import {Button} from '../upstream/components/ui/button';
import type {WorkState} from '../upstream/lib/work-contract';
import type {SpaceGraph} from '../overlay/lib/space-model';
import {acceptNativeSelection,availabilityLabels,buildNativeSnapshot,type NativeARService} from './platform/native-ar';
import {nativeARService} from './platform/native-ar-runtime';
type Props={active?:boolean;graph:SpaceGraph;work:WorkState;known:boolean;scope:string;disabled:boolean;onSelect:(id:string)=>void;onOpenDetails?:(id:string)=>void;onSettings:()=>void;service?:NativeARService};
export function NativeARPanel({active=true,graph,work,known,scope,disabled,onSelect,onOpenDetails,onSettings,service=nativeARService}:Props){
 const [reducedMotion,setReducedMotion]=useState(true);
 useEffect(()=>{if(typeof matchMedia!=='function')return;const media=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReducedMotion(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[]);
 const motionAllowed=active&&work.settings.motion!=='off'&&!work.settings.powerSaver&&!reducedMotion;
 const projection=useMemo(()=>{try{return{value:buildNativeSnapshot(graph,{stateRevision:work.updatedAt,scope,known,motionAllowed}),error:''}}catch(error){return{value:null,error:error instanceof Error?error.message:'AR-Snapshot konnte nicht erzeugt werden.'}}},[graph,work.updatedAt,scope,known,motionAllowed]);
 const [busy,setBusy]=useState(false),[status,setStatus]=useState('Noch keine native Kompatibilitätsabfrage ausgeführt.');
 const mounted=useRef(false),lock=useRef(false),intent=useRef(0);const current=useRef({active,projection,disabled,powerSaver:work.settings.powerSaver,onSelect,onOpenDetails});current.current={active,projection,disabled,powerSaver:work.settings.powerSaver,onSelect,onOpenDetails};
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;intent.current++}},[]);
 useEffect(()=>{intent.current++;if(!active)setStatus('AR-Ansicht verlassen; eine noch laufende Rückgabe wird nicht übernommen.')},[active]);
 const blocked=!active||disabled||!known||work.settings.powerSaver||!service.native||!projection.value;
 async function run(checkOnly:boolean){
  if(lock.current||blocked)return;lock.current=true;setBusy(true);
  const snapshot=projection.value!.snapshot,token=intent.current;
  setStatus(checkOnly?'Native Kompatibilität wird geprüft …':'Native Hinweise angefordert; noch keine Kamerasitzung bestätigt.');
  try{
   if(checkOnly){const result=await service.availability();if(mounted.current&&intent.current===token)setStatus(availabilityLabels[result.status]+'. Dies bestätigt weder Kamerafreigabe noch Tracking oder Platzierung.');}
   else{const result=await service.open(snapshot);if(!mounted.current||intent.current!==token)return;
    const fresh=current.current;
    if(!fresh.active||!fresh.projection.value||fresh.projection.value.snapshot.snapshotRevision!==snapshot.snapshotRevision||fresh.disabled||fresh.powerSaver){setStatus('AR beendet. Der Arbeitsstand oder Bereich ist inzwischen veraltet; eine zurückgegebene Auswahl wurde verworfen.');return;}
    const id=acceptNativeSelection(result,fresh.projection.value.snapshot);if(id){fresh.onSelect(id);if(result.openDetails)fresh.onOpenDetails?.(id);}
    const labels={closed:'AR-Fenster geschlossen',unavailable:'Native AR nicht verfügbar','permission-denied':'Kamerazugriff abgelehnt',error:'Native AR meldet einen Fehler'};
    setStatus(`${labels[result.status]}. ${result.placed?'Die native Sitzung meldet eine Platzierung; das ist kein Arbeitsergebnis.':'Keine Platzierung gemeldet.'}${result.message?' '+result.message:''}${id?' Auswahl in der App übernommen.':''}`);
   }
  }catch(error){if(mounted.current&&intent.current===token)setStatus('Native AR nicht bestätigt gestartet: '+(error instanceof Error?error.message:'Unbekannter Fehler'))}
  finally{lock.current=false;if(mounted.current)setBusy(false)}
 }
 const p=projection.value;
 return <section className="panel native-ar-panel" aria-label="Native Kamera-AR" aria-busy={busy}>
  <h3>Kamera-AR</h3>
  <details><summary>Hinweise und Graphdetails</summary>
  <p>Optionaler ARCore-Adapter als Testprototyp; keine vollständige Abnahme auf echter Hardware. Keine präzise Vermessung und keine physische Hologramm-Projektion. 2D und Bildschirm-3D bleiben verfügbar.</p>
  <p>Eine bewusste Kompatibilitätsprüfung kann Google über das Netz nach Geräteunterstützung fragen. „AR-Hinweise öffnen“ zeigt zuerst die native Datenschutzerklärung. Kamera und eine mögliche Installation/Aktualisierung von Google Play-Diensten für AR werden erst über den dortigen separaten Startknopf angefragt. Der Graph bleibt lokal.</p>
  <p>Knotenbewegung startet standardmäßig ausgeschaltet. Nur Knoten mit der Darstellung „Atmen“ können pulsieren; zusätzlich muss Bewegung in den nativen AR-Einstellungen für diese Sitzung bewusst aktiviert werden. {work.settings.motion==='off'?'Die globale Einstellung „Bewegung aus“ bleibt für Animationen wirksam. ':''}Das notwendige Kamerabild und räumliche Tracking reagieren auf deine eigene Gerätebewegung.</p>
  {!service.native&&<p>Dieser Einstieg ist nur in der Android-App verfügbar. Browser-WebXR bleibt als eigener Weg erhalten.</p>}

  {p?<p>Vollständiger gewählter Bereich „{scope}“: {p.snapshot.nodes.length} Knoten und {p.snapshot.edges.length} Beziehungen. Keine zusätzliche 32-Knoten-Kürzung. {p.compactedLabels} Beschriftungen und {p.compactedDetails} Detailtexte für AR verdichtet; vollständige Texte bleiben in der App. Linien sind schematisch und ohne Richtungs-/Beziehungsbeschriftung; {p.overlappingEdges} Verbindungen überlagern andere Linien. Alle Kanten bleiben im Snapshot.</p>:<p role="status">{projection.error}</p>}
  </details>
  {work.settings.powerSaver&&<div role="status"><p>Im Energiesparmodus ist Kamera-AR gesperrt. Für einen bewussten Versuch kannst du den Energiesparmodus in den App-Einstellungen ausschalten.</p><Button variant="outline" onClick={onSettings}>Einstellungen öffnen</Button></div>}
  <div className="actions-row"><Button variant="outline" disabled={blocked||busy} onClick={()=>void run(true)}>Kompatibilität prüfen</Button><Button variant="outline" disabled={blocked||busy} onClick={()=>void run(false)}>AR-Hinweise öffnen</Button></div>
  <p role="status">{status}</p>
 </section>;
}
