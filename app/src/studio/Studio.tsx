import {ContextHints} from '../context-assistance/ContextHints.tsx';
import {GraphExplorer} from '../../overlay/graph-explorer.tsx';
import {useMemo} from 'react';
import {navigateStudioTab,useMobileRoute} from '../mobile/mobile-navigation.ts';
import {Button} from '@/components/ui/button';
import {toast} from 'sonner';
import {adaptWorkState} from '../../vendor/mesh-extensions/src/index.ts';
import {useWorkState} from '../shared-work-state.tsx';
import {useSystemPreferences} from '../system-preferences.tsx';
import {navigateOriginal} from '../system-navigation.ts';
import {BackupPanel} from '../BackupPanel.tsx';
import {AdaptivePanel} from './AdaptivePanel.tsx';
import {WorkflowPanel} from './WorkflowPanel.tsx';
import {ProjectMemoryPanel} from './ProjectMemoryPanel.tsx';
import {DiagnosticsPanel} from './DiagnosticsPanel.tsx';
import {AssistantPanel} from './AssistantPanel.tsx';
export default function Studio({data,active=true}:{data:any;active?:boolean}){
 const route=useMobileRoute(),tab=route.studioTab,setTab=navigateStudioTab,shared=useWorkState(),preferences=useSystemPreferences();
 const graph=useMemo(()=>adaptWorkState(shared.hasLoaded?shared.work:null,data.sources),[shared.work,shared.hasLoaded,data.sources]);

 const diagnostics=<DiagnosticsPanel input={{work:shared.work,system:preferences.value,data,hasLoaded:shared.hasLoaded,loadingWork:shared.loadingWork,storageError:shared.storageError,preferencesReady:preferences.ready,preferencesFailed:!!preferences.error}} integrations={data.integrations}/>;
 if(!preferences.ready)return <>{diagnostics}<p role="status">{preferences.error??'Studio-Einstellungen und Ergebnisverlauf werden geladen …'}</p></>;
 return <>{diagnostics}<nav className="system-tabs" aria-label="Studio-Bereiche">{([['surface','Kombinierte Fläche'],['graph','Graph · 2D / 3D'],['skills','Skills & Prüfprozesse'],['backup','Backup & Vorschau'],['memory','Projektgedächtnis'],['assistant','Assistent']] as const).map(([id,label])=><Button key={id} variant={id===tab?'default':'outline'} aria-pressed={id===tab} onClick={()=>setTab(id)}>{label}</Button>)}<Button variant="outline" onClick={()=>navigateOriginal({view:'space'})}>Bestehendes 3D, AR & Academy</Button></nav>
 {preferences.error&&<p role="alert">{preferences.error}</p>}
 {tab==='graph'&&<><p className="short-note">Der Graph liest denselben geladenen Arbeitsstand wie alle Arbeitsbereiche. Ansicht speichern übernimmt die Optionen lokal; Hologramm bezeichnet einen Bildschirmstil. Bewegungsreduktion und Energiesparen aus den Einstellungen haben Vorrang.</p><GraphExplorer graph={graph} renderSelectionContext={(selectedId,focus)=><ContextHints graph={graph} selectedId={selectedId} focus={focus} rooms={shared.work.rooms} active={active&&!shared.loadingWork&&!shared.storageError} preferences={preferences.value.contextAssistance} onSave={async next=>{await preferences.save(current=>({...current,contextAssistance:next}))}}/>} initialConfig={preferences.value.graph} policy={{reduceMotion:shared.work.settings.motion==='off',powerSaver:shared.work.settings.powerSaver}} onSaveView={async next=>{await preferences.save(current=>({...current,graph:next}));toast.success('Graphansicht lokal gespeichert.')}} onNavigate={target=>navigateOriginal({view:target.view,query:target.query.slice(0,200)})} onPrepare={intent=>{if(shared.storageError||!shared.hasLoaded||intent.expectedUpdatedAt!==shared.work.updatedAt)throw new Error('Arbeitsstand nicht aktuell.');navigateOriginal({view:intent.entity==='mission'?'missions':'matrix'});toast.info('Prüfbereich geöffnet. Keine Änderung oder Freigabe ausgeführt.')}}/></>}
 <div hidden={tab!=='skills'} inert={tab!=='skills'}><WorkflowPanel sources={data.sources}/></div>
 {tab==='surface'&&<AdaptivePanel data={data} onOpen={setTab}/>}
 {tab==='backup'&&<BackupPanel data={data}/>}
 <div hidden={tab!=='memory'} inert={tab!=='memory'}><ProjectMemoryPanel active={active&&tab==='memory'}/></div>
 {active&&tab==='assistant'&&<AssistantPanel onOpenMemory={()=>setTab('memory')}/>}
 </>
}
