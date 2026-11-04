import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {applyProfileBudgetFix} from './profile-budget-overlay.mjs';
import {applySystemMenu} from './system-menu-overlay.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function transform(file,edit){let s=fs.readFileSync(fs.existsSync(path.join(root,'overlay/level-base/app',file))?path.join(root,'overlay/level-base/app',file):path.join(root,'upstream/app',file),'utf8');const replace=(before,after)=>{const count=s.split(before).length-1;if(count!==1)throw new Error(`UI drift ${file}: expected one anchor (${count}) ${before.slice(0,100)}`);s=s.replace(before,after)};edit(replace,()=>s);if(file==='workspace-panels.tsx')s=applyProfileBudgetFix(s);if(file==='mesh-app.tsx')s=applySystemMenu(s);s=s.replace(/(['"])\.\/([a-z-]+)\1/g,(all,quote,name)=>['mesh-app','workspace-panels','command-center','academy-panel','mesh-space','coordination-panel','help-panel','space-renderer','spatial-levels'].includes(name)?all:quote+'../upstream/app/'+name+quote);fs.writeFileSync(path.join(root,'overlay',file),s)}
const imports="import {saveTextFile,copyWithFeedback,copyPlatformText} from '../src/platform/runtime';\n";
for(const file of ['mesh-app.tsx','workspace-panels.tsx','command-center.tsx','academy-panel.tsx','mesh-space.tsx','coordination-panel.tsx','help-panel.tsx','space-renderer.tsx','spatial-levels.tsx'])transform(file,(r,s)=>{
 r("'use client';","'use client';\n"+imports);
 if(file==="mesh-app.tsx")r("const panels={work,disabled,save:changeWork,data};","const panels={work,disabled,save:changeWork,data,active};");
 if(file==="workspace-panels.tsx")r("type Props={work:WorkState;","type Props={active?:boolean;work:WorkState;");
 if(file==="workspace-panels.tsx")r("MatrixPanel({work,disabled,save,query}:","MatrixPanel({work,disabled,save,query,active:workspaceActive=true}:");
 if(file==="workspace-panels.tsx")r("<Sheet open={!!edit} onOpenChange={o=>{if(!o)setEdit(null)}}>","<Sheet open={workspaceActive&&!!edit} onOpenChange={o=>{if(workspaceActive&&!o)setEdit(null)}}>");
 if(file==="command-center.tsx")r("type Props = {\n","type Props = {\n  active?: boolean;\n");
 if(file==="command-center.tsx")r("MissionCenter({ work, disabled, save, data, query, go, unavailable }:","MissionCenter({ work, disabled, save, data, query, go, unavailable, active = true }:");
 if(file==="command-center.tsx")r("ApprovalCenter({ work, disabled, save, query, unavailable }:","ApprovalCenter({ work, disabled, save, query, unavailable, active = true }:");
 if(file==="command-center.tsx")r("<Sheet open={!!draft} onOpenChange={open => { if (!open) setDraft(null); }}><SheetContent className=\"mesh-sheet command-sheet\"><SheetHeader><SheetTitle>{current","<Sheet open={active && !!draft} onOpenChange={open => { if (active && !open) setDraft(null); }}><SheetContent className=\"mesh-sheet command-sheet\"><SheetHeader><SheetTitle>{current");
 if(file==="command-center.tsx")r("<Sheet open={!!draft} onOpenChange={open => { if (!open) setDraft(null); }}><SheetContent className=\"mesh-sheet command-sheet\"><SheetHeader><SheetTitle>{immutable","<Sheet open={active && !!draft} onOpenChange={open => { if (active && !open) setDraft(null); }}><SheetContent className=\"mesh-sheet command-sheet\"><SheetHeader><SheetTitle>{immutable");
 if(file==="command-center.tsx")r("<Sheet open={!!decision} onOpenChange={open => { if (!open) setDecision(null); }}>","<Sheet open={active && !!decision} onOpenChange={open => { if (active && !open) setDecision(null); }}>");
 if(file==="workspace-panels.tsx")r(" const tasks=work.tasks.filter"," const changeReviewed=(patch:Partial<MeshTask>)=>setEdit(current=>current?{...current,...patch,reviewed:false,status:current.status==='Erledigt'?'Review':current.status}:null);\n const tasks=work.tasks.filter");
 if(file==="workspace-panels.tsx")r("setEdit({...edit,title:e.target.value})","changeReviewed({title:e.target.value})");
 if(file==="workspace-panels.tsx")r("setEdit({...edit,owner:v as any})","changeReviewed({owner:v as any})");
 if(file==="workspace-panels.tsx")r("setEdit({...edit,acceptance:e.target.value})","changeReviewed({acceptance:e.target.value})");
 if(file==="workspace-panels.tsx")r("setEdit({...edit,evidence:e.target.value})","changeReviewed({evidence:e.target.value})");
 if(file==="workspace-panels.tsx")r("setEdit({...edit,dependencies:v?[...edit.dependencies,t.id]:edit.dependencies.filter(id=>id!==t.id)})","changeReviewed({dependencies:v?[...edit.dependencies,t.id]:edit.dependencies.filter(id=>id!==t.id)})");
 if(file==="workspace-panels.tsx")r("Nur aktivieren, wenn die Gegenprüfung tatsächlich stattgefunden hat.","Nach Inhaltsänderungen zuerst ohne Review speichern. Erst danach die gespeicherte Fassung gegenprüfen und bestätigen.");
 if(['mesh-app.tsx','workspace-panels.tsx'].includes(file)){
  r("function download(name:string,text:string,type:string){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}","const download=saveTextFile;");
  const original=s().split('\n').find(line=>line.startsWith('async function copy('));r(original,'const copy=copyWithFeedback;');
 }
 if(file==='mesh-app.tsx'){
  r("'use client';","'use client';\nimport {MobileContextHint} from '../src/mobile/MobileContextHint';\nimport {notifyAppRoute} from '../src/mobile/mobile-navigation';");
  r("history.replaceState({},'',u)},[view,query]);","history.replaceState({},'',u);notifyAppRoute()},[view,query]);");
  r('<p>{descriptions[view]}</p>','<MobileContextHint selectedAction={`view:${view}`}/>');
  r("'use client';","'use client';\nimport {LocalSourceDocument} from '../src/LocalSourceDocument';");
  r('<a className="source-link" href={detail.item.file} target="_blank" rel="noopener noreferrer">Quelldokument öffnen<ExternalLink size={14}/></a>', '<LocalSourceDocument key={detail.item.file} file={detail.item.file}/>');
  r('<Toaster position="bottom-right" richColors/>','');
  r('<MeshSpace {...panels} known={hasLoaded} go={go}/>', '<MeshSpace {...panels} known={hasLoaded} go={go} active={active}/>');
  r('<CoordinationPanel work={work} known={hasLoaded}', '<CoordinationPanel work={work} known={hasLoaded&&work.updatedAt!==null}');
  r("from '@/components/ui/sidebar'","from '../overlay/sidebar'");
  r('<SidebarProvider>','<SidebarProvider active={active}>');
  r('<Sheet open={!!detail}','<Sheet open={active&&!!detail}');
  r('<Popover open={linksOpen}','<Popover open={active&&linksOpen}');

  r("explicitView=false}:{data:any;initialView?:View;initialQuery?:string;explicitView?:boolean}","explicitView=false,active=true}:{data:any;initialView?:View;initialQuery?:string;explicitView?:boolean;active?:boolean}");
  r("useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)","useEffect(()=>{if(!active)return;const key=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)");
  r("removeEventListener('keydown',key)},[]);","removeEventListener('keydown',key)},[active]);");
  r("u.searchParams.delete('q');history.pushState({},'',u);","u.searchParams.delete('q');u.searchParams.delete('studio');history.pushState({},'',u);");
  r("<CommandPalette open={commandOpen}","<CommandPalette open={active&&commandOpen}");

  r("import {useWorkState} from './use-work-state';","import {useWorkState} from '../src/shared-work-state';\nimport {validNavigation} from '../src/system-navigation';");
  r("const [view,setView]=useState<View>(initialView);","const [view,setView]=useState<View>(initialView);\n useEffect(()=>{const receive=(event:Event)=>{const target=(event as CustomEvent).detail;if(validNavigation(target)){go(target.view);if(target.query)setQuery(target.query)}};window.addEventListener('cue:navigate',receive);return()=>window.removeEventListener('cue:navigate',receive)},[]);");
  r(";toast.success(storageError?'Zuletzt geladenen Snapshot exportiert; aktueller Serverstand unbekannt.':'Snapshot exportiert.');",";if(storageError)toast.info('Exportgrundlage ist der zuletzt geladene Stand; der aktuelle Speicherstand ist unbekannt.');");
 }
 if(file==='coordination-panel.tsx'){
  r("from '@/lib/collaboration-model'", "from '../src/local-collaboration'");
  const start=s().indexOf('function download('),end=s().indexOf('\nexport default function',start);r(s().slice(start,end),'const download=saveTextFile;');
  r('await navigator.clipboard.writeText(collaborationMarkdown(personal))','await copyPlatformText(collaborationMarkdown(personal))');
  r('const personal = known ? work : undefined;','const personal = known && work.updatedAt !== null ? work : undefined;');
  r('Ein unterstützter Client kann nach eigener Anmeldung','Dieser MCP-Leseweg gehört zur privaten Website und verwendet deren Cloud-Arbeitsstand; er synchronisiert diese lokale Installation nicht. Ein unterstützter Client kann nach eigener Anmeldung');
  r('Arbeitsbrief vorbereitet. Lows Identität, Verbindung und Annahme sind noch nicht bestätigt. Kopieren oder Exportieren sendet keinen Auftrag.','Lokaler Arbeitsbrief dieser Installation. Kein verifizierter persönlicher Cloudimport liegt vor. Lows Identität, Verbindung und Annahme sind unbestätigt. Kopieren oder Exportieren sendet keinen Auftrag.');
 }
 if(file==='spatial-levels.tsx')r('Erst mit freigegebener immersiver AR-Sitzung und Geräteunterstützung','Erst mit freigegebener WebXR- oder nativer ARCore-Sitzung und Geräteunterstützung');
 if(file==='command-center.tsx'){const original=s().split('\n').find(line=>line.startsWith('async function copy('));r(original,'const copy=copyWithFeedback;');}
 if(file==='academy-panel.tsx')r("const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'mesh-academy-arbeitsbuch.md'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);","void saveTextFile('mesh-academy-arbeitsbuch.md', text, 'text/markdown');");
 if(file==='mesh-space.tsx'){
 r("type Props = { work: WorkState;", "type Props = { active?: boolean; work: WorkState;");
 r("function MeshSpace({ work, known, go, ...props }", "function MeshSpace({ active = true, work, known, go, ...props }");
 r("import { inspectARSupport, arStartError }", "import {NativeARPanel} from '../src/NativeARPanel';\nimport { inspectARSupport, arStartError }");
 r("  const probeGeneration = useRef(0);", "  const probeGeneration = useRef(0);\n  useEffect(() => { if (!active) { ++probeGeneration.current; controls.current?.cancelAR(); } }, [active]);");
 r("  const node = graph.nodes.find", "  const nativeGraph = useMemo(() => visibleSpaceGraph(graph, scope, selected, isolate, graph.nodes.length), [graph, scope, selected, isolate]);\n  const node = graph.nodes.find");
 r("        <div className=\"space-node-list\"", "        <NativeARPanel active={active} graph={nativeGraph} work={work} known={known} scope={scope} disabled={props.disabled || arActive || arBusy} onSelect={select} onOpenDetails={revealInspector} onSettings={() => go('settings')} />\n        <div className=\"space-node-list\"");
 r("  const probeGeneration = useRef(0);", "  const inspector = useRef<HTMLElement>(null);\n  const [detailRequest, setDetailRequest] = useState<{id: string; graph: SpaceGraph; revision: string | null; scope: SpaceScope; isolate: boolean} | null>(null);\n  const revealInspector = useCallback((id: string) => setDetailRequest({id, graph, revision: work.updatedAt, scope, isolate}), [graph, work.updatedAt, scope, isolate]);\n  useEffect(() => {\n    if (!detailRequest) return;\n    setDetailRequest(null);\n    if (!active || !known || props.disabled || work.settings.powerSaver || selected !== detailRequest.id || graph !== detailRequest.graph || work.updatedAt !== detailRequest.revision || scope !== detailRequest.scope || isolate !== detailRequest.isolate) return;\n    inspector.current?.scrollIntoView({behavior: 'instant', block: 'start'});\n    inspector.current?.focus({preventScroll: true});\n  }, [active, known, props.disabled, work.settings.powerSaver, detailRequest, selected, graph, work.updatedAt, scope, isolate]);\n  const probeGeneration = useRef(0);");
 r('<aside className="panel node-inspector"','<aside ref={inspector} tabIndex={-1} className="panel node-inspector"');
 r('await navigator.clipboard.writeText(JSON.stringify({ version: 1, capabilityObservedAt:', 'await copyPlatformText(JSON.stringify({ version: 1, capabilityObservedAt:');
 r('await navigator.clipboard.writeText(url.toString())','await copyPlatformText(url.toString())');
 r('Link zur Auswahl kopiert. Er gewährt keinen zusätzlichen Zugriff.','Lokaler Auswahl-Link kopiert. Er verweist auf diese Installation und gewährt keinen Zugriff.');
 r('Die Zwischenablage ist nicht verfügbar. Die Browseradresszeile enthält jetzt deinen Auswahl-Link.','Kopieren fehlgeschlagen. Der Auswahl-Link bleibt in der aktuellen Ansicht erhalten; erneut versuchen.');
 }
 if(file==="workspace-panels.tsx")r("import {useEffect,useState,type ReactNode} from 'react';","import {useEffect,useRef,useState,type ReactNode} from 'react';\nimport {planTaskChange,taskChangeCandidate,type TaskChangePlan} from '../src/task-change-preview.ts';\nimport {TaskChangePreview} from '../src/TaskChangePreview.tsx';");
 if(file==="workspace-panels.tsx")r("MatrixPanel({work,disabled,save,query,active:workspaceActive=true}:","MatrixPanel({work,disabled,save,query,data,active:workspaceActive=true}:");
 if(file==="workspace-panels.tsx")r("const [edit,setEdit]=useState<MeshTask|null>(null);","const [edit,updateEdit]=useState<MeshTask|null>(null);\n const [preview,setPreview]=useState<TaskChangePlan|null>(null),[previewError,setPreviewError]=useState(''),[previewBusy,setPreviewBusy]=useState(false);\n const editBase=useRef(work),editGeneration=useRef(0),saveGate=useRef(false),mounted=useRef(false);\n const autoReviewRollback=useRef<Pick<MeshTask,'reviewed'|'status'>|null>(null);\n useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;editGeneration.current++}},[]);\n useEffect(()=>{if(!workspaceActive){editGeneration.current++;setPreview(null);setPreviewError('')}},[workspaceActive]);\n function setEdit(value:MeshTask|null|((current:MeshTask|null)=>MeshTask|null),automaticReview=false){\n  if(value===null||typeof value==='object'&&value.id!==edit?.id){editBase.current=structuredClone(work);autoReviewRollback.current=null}\n  else if(!automaticReview&&typeof value==='object'&&(value.reviewed!==edit?.reviewed||value.status!==edit?.status))autoReviewRollback.current=null;\n  editGeneration.current++;setPreview(null);setPreviewError('');updateEdit(value);\n }\n function inspectChange(){\n  if(!edit||disabled||saveGate.current||!workspaceActive)return;\n  if(JSON.stringify(editBase.current)!==JSON.stringify(work)){setPreviewError('Der Arbeitsstand wurde geändert. Dieser Entwurf ist veraltet. Entwurf sichern und Aufgabe neu öffnen.');return}\n  try{setPreview(planTaskChange(editBase.current,edit,data.sources.map((s:{id:string})=>s.id),new Date()));setPreviewError('')}catch{setPreviewError('Änderung konnte nicht geprüft werden. Entwurf bleibt unverändert.')}\n }\n async function confirmChange(){\n  if(!preview||!edit||disabled||!workspaceActive||saveGate.current)return;\n  let next:WorkState;try{next=taskChangeCandidate(preview,work,edit,data.sources.map((s:{id:string})=>s.id),new Date())}catch{setPreviewError('Vorschau veraltet oder nicht übernehmbar. Entwurf sichern und neu prüfen.');return}\n  const generation=editGeneration.current;saveGate.current=true;setPreviewBusy(true);setPreviewError('');\n  try{const saved=await save(next);if(!mounted.current||generation!==editGeneration.current)return;if(saved){setEdit(null);toast.success('Gezeigte Änderung gespeichert. Erforderliche Gegenprüfungen bleiben offen.')}else setPreviewError('Speicherung nicht bestätigt. Sichtbaren Entwurf sichern und aktuellen Arbeitsstand prüfen. Keine automatische Wiederholung.')}\n  catch{if(mounted.current&&generation===editGeneration.current)setPreviewError('Speicherung nicht bestätigt. Aktuellen Arbeitsstand prüfen; keine automatische Wiederholung.')}\n  finally{saveGate.current=false;if(mounted.current)setPreviewBusy(false)}\n }\n");
 if(file==="workspace-panels.tsx")r(" const changeReviewed=(patch:Partial<MeshTask>)=>setEdit(current=>current?{...current,...patch,reviewed:false,status:current.status==='Erledigt'?'Review':current.status}:null);"," const changeReviewed=(patch:Partial<MeshTask>)=>{\n  if(!edit||(Object.keys(patch) as (keyof MeshTask)[]).every(key=>JSON.stringify(edit[key])===JSON.stringify(patch[key])))return;\n  const next={...edit,...patch},original=editBase.current.tasks.find(t=>t.id===edit.id);\n  const contentKeys=['title','owner','acceptance','evidence','dependencies'] as const;\n  if(original&&contentKeys.every(key=>JSON.stringify(original[key])===JSON.stringify(next[key]))){\n   if(autoReviewRollback.current){Object.assign(next,autoReviewRollback.current);autoReviewRollback.current=null}\n  }else{autoReviewRollback.current??={reviewed:edit.reviewed,status:edit.status};next.reviewed=false;if(next.status==='Erledigt')next.status='Review'}\n  setEdit(next,true);\n };");
 if(file==="workspace-panels.tsx")r("async function commit(){if(!edit)return;const next=work.tasks.some(t=>t.id===edit.id)?","async function commit(){if(!edit||disabled||saveGate.current||!workspaceActive)return;if(work.tasks.some(t=>t.id===edit.id)){inspectChange();return}const next=work.tasks.some(t=>t.id===edit.id)?");
 if(file==="workspace-panels.tsx")r("{edit&&<div className=\"sheet-body task-editor\"><Field label=\"Titel\">","{edit&&<div className=\"sheet-body task-editor\">{preview?<><TaskChangePreview plan={preview}/><div className=\"actions-row\"><Button disabled={disabled||previewBusy||!preview.needsConfirmation||preview.blockers.length>0} onClick={confirmChange}>Gezeigte Änderung übernehmen</Button><Button variant=\"outline\" disabled={previewBusy} onClick={()=>{editGeneration.current++;setPreview(null);setPreviewError('')}}>Zurück zum Entwurf</Button></div>{previewBusy&&<p role=\"status\">Speichern läuft. Schließen macht eine bereits gesendete Änderung nicht rückgängig.</p>}</>:<><Field label=\"Titel\">");
 if(file==="workspace-panels.tsx")r("<Save size={16}/>Aufgabe speichern</Button></div>}</SheetContent></Sheet>","<Save size={16}/>{work.tasks.some(t=>t.id===edit.id)?'Änderung prüfen':'Aufgabe speichern'}</Button></>}{previewError&&<p role=\"alert\">{previewError}</p>}</div>}</SheetContent></Sheet>");
 // LowQuantFlow presentation only. Original sources and protocol/data identifiers remain frozen.
 if(file==="mesh-app.tsx"){
  r(">COMMAND MESH<small>",">LowQuantFlow<small>");
  r("<span>Cue Command Mesh</span>","<span>LowQuantFlow</span>");
  r("COMMAND MESH v1.4.2","LowQuantFlow · Basis v1.4.2");
  r("FROM: lowgiga / Command Mesh","FROM: lowgiga / LowQuantFlow");
  r("'cue-mesh-snapshot.json'","'LowQuantFlow-snapshot.json'");
  r("'cue-mesh-handoff.md'","'LowQuantFlow-handoff.md'");
 }
 if(file==="workspace-panels.tsx"){
  r("FROM: lowgiga / Command Mesh","FROM: lowgiga / LowQuantFlow");
 }
 if(file==="command-center.tsx"){
  r("FROM: lowgiga / Command Mesh","FROM: lowgiga / LowQuantFlow");
 }
 if(file==="academy-panel.tsx"){
  r("'mesh-academy-arbeitsbuch.md'","'LowQuantFlow-academy-arbeitsbuch.md'");
 }
});
console.log('Generated nine explicit UI overlays; original sources remain byte-identical.');
