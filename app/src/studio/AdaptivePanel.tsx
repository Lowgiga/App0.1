import {GraphExplorer} from '../../overlay/graph-explorer.tsx';
import {useEffect,useMemo,useState} from 'react';
import {Button} from '@/components/ui/button';
import {NativeSelect,NativeSelectOption} from '@/components/ui/native-select';
import {SurfaceRenderer,type HostSlotProps} from '../../vendor/adaptive-surfaces/src/index.ts';
import {type ExplorerGraph} from '../../vendor/mesh-extensions/src/index.ts';
import '../../vendor/adaptive-surfaces/src/styles.css';
import {useWorkState} from '../shared-work-state.tsx';
import {useSystemPreferences} from '../system-preferences.tsx';
import {navigateOriginal} from '../system-navigation.ts';
import {createStudioSurface,surfaceProjections,studioProposal,actionDestination} from './surface-contract.ts';
import type {RunHistory} from '../system-state.ts';
function GraphSlot({value,reducedMotion}:HostSlotProps){const preferences=useSystemPreferences(),shared=useWorkState();return <GraphExplorer graph={value as ExplorerGraph} initialConfig={preferences.value.graph} policy={{reduceMotion:shared.work.settings.motion==='off',powerSaver:shared.work.settings.powerSaver}} onSaveView={next=>preferences.save(current=>({...current,graph:next}))} onNavigate={target=>navigateOriginal({view:target.view,query:target.query.slice(0,200)})} onPrepare={intent=>navigateOriginal({view:intent.entity==='mission'?'missions':'matrix'})}/>}

function SkillsSlot({value}:HostSlotProps){const history=(value as {history:RunHistory[]}).history;return <div><p>Vier feste Offline-Funktionen: Aufgabenprüfung, Graph-Erklärung, Backup-Prüfplan und Quellenstatus. Neue Ausführung wird im Prüfbereich gestartet.</p><p>{history.length} lokal gespeicherte historische Ergebnisse; kein Freigabenachweis.</p>{history.slice(0,3).map(item=><p key={item.id}>{item.at} · {item.state} · {item.completedCount} bestätigte Schritte</p>)}</div>}
export function AdaptivePanel({data,onOpen}:{data:any;onOpen:(tab:'graph'|'skills')=>void}){
 const work=useWorkState(),prefs=useSystemPreferences(),[session]=useState(()=>createStudioSurface(prefs.value.surfaceLayout));
 useEffect(()=>{const root=session.getSnapshot().proposal?.components.find(c=>c.id==='root');if(root?.type==='Group'&&root.props.layout!==prefs.value.surfaceLayout)session.submit(JSON.stringify(studioProposal(prefs.value.surfaceLayout,session.getSnapshot().revision)))},[session,prefs.value.surfaceLayout]);
 const projections=useMemo(()=>surfaceProjections(work.hasLoaded?work.work:null,data.sources,prefs.value,work.storageError),[work.work,work.hasLoaded,work.storageError,data.sources,prefs.value]);
 return <section aria-label="Adaptive Studio-Fläche"><div className="panel"><span className="eyebrow">KOMBINIERBARE ARBEITSFLÄCHE</span><h2>Deine Daten, verschiedene Anordnungen</h2><p>Interne, streng geprüfte Darstellungsvorlage mit Hostdaten und erlaubten Navigationsaktionen. Keine Behauptung einer A2UI- oder MCP-Apps-Kompatibilität. Quellenliste maximal 200 und Ereignisausschnitt maximal 200 Einträge.</p><label>Anordnung<NativeSelect value={prefs.value.surfaceLayout} onChange={async e=>{const nextLayout=e.target.value as 'stack'|'split'|'focus';try{await prefs.save(current=>({...current,surfaceLayout:nextLayout}))}catch{}}} disabled={!!prefs.error}><NativeSelectOption value="stack">Untereinander</NativeSelectOption><NativeSelectOption value="split">Nebeneinander</NativeSelectOption><NativeSelectOption value="focus">Graph im Fokus</NativeSelectOption></NativeSelect></label><p>Die eingebettete Graphfläche nutzt deine gespeicherten Explorer-Optionen. Mit „Ansicht speichern“ übernimmst du Änderungen für beide Perspektiven.</p><Button variant="outline" onClick={()=>onOpen('graph')}>Persönlichen Graph Explorer öffnen</Button></div><SurfaceRenderer session={session} data={projections} slots={{Graph:GraphSlot,Skills:SkillsSlot}} reducedMotion={work.work.settings.motion==='off'||work.work.settings.powerSaver||prefs.value.graph.reducedMotion} onIntent={intent=>{const target=actionDestination(intent);if(target==='graph'||target==='skills')onOpen(target);else navigateOriginal({view:target})}}/></section>
}
