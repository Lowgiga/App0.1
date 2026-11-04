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
  r("history.replaceState({},'',u)},[view,query]);","history.replaceState(history.state,'',u);notifyAppRoute()},[view,query]);");
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
 r("import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';", "import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';\nimport {useAppearance} from '../src/appearance/AppearanceProvider.tsx';\nimport {AppearancePanel} from '../src/appearance/AppearancePanel.tsx';\nimport {projectSpaceAppearance} from '../src/appearance/projection.ts';\nimport {NodeAppearanceSwatch} from '../src/appearance/WebNodeGlyph.tsx';\nimport {renderedAppearance} from '../src/appearance/web-three.ts';");
 r('  const graph = useMemo(() => buildSpaceGraph(work, props.data.sources, known), [work, props.data.sources, known]);', '  const appearance = useAppearance();\n  const baseGraph = useMemo(() => buildSpaceGraph(work, props.data.sources, known), [work, props.data.sources, known]);\n  const graph = useMemo(() => projectSpaceAppearance(baseGraph, work, appearance.value), [baseGraph, work, appearance.value]);');
 r("const allowMotion = work.settings.motion !== 'off'", "const allowMotion = active && work.settings.motion !== 'off'");
 r('<StructuralMap graph={visible} selected={node.id} highlighted={edge} onSelect={select} />', '<StructuralMap graph={visible} selected={node.id} highlighted={edge} onSelect={select} allowMotion={allowMotion} />');
 r('function StructuralMap({ graph, selected, highlighted, onSelect }: { graph: SpaceGraph;', 'function StructuralMap({ graph, selected, highlighted, onSelect, allowMotion }: { allowMotion: boolean; graph: SpaceGraph;');
 r("<span>{n.kind === 'agent' ? '●' : '□'} {kindNames[n.kind]}</span>", '<span><NodeAppearanceSwatch appearance={renderedAppearance(n)} motionAllowed={allowMotion}/>{kindNames[n.kind]}</span>');
 r("<div className=\"node-mark\" style={{ color: '#' + node.color.toString(16) }}><Box size={36} /></div>", '<div className="node-mark"><NodeAppearanceSwatch appearance={renderedAppearance(node)} motionAllowed={allowMotion}/></div>');
 r('        <div className="space-relations">', '        <AppearancePanel node={node} work={work} active={active} disabled={!known || props.disabled || !appearance.ready}/>\n        <div className="space-relations">');

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
 if(file==='space-renderer.tsx'){
 r(`        const ray = new T.Raycaster(), pointer = new T.Vector2(); let down = { x: 0, y: 0 };
        const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
        const onUp = (e: PointerEvent) => {
          if (renderer.xr.isPresenting || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
          const rect = renderer.domElement.getBoundingClientRect(); pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1); ray.setFromCamera(pointer, camera);
          const hit = ray.intersectObjects(pickable)[0]; if (hit) latest.current.onSelect(hit.object.userData.id);
        };
        renderer.domElement.addEventListener('pointerdown', onDown); renderer.domElement.addEventListener('pointerup', onUp);
        disposers.push(() => { renderer.domElement.removeEventListener('pointerdown', onDown); renderer.domElement.removeEventListener('pointerup', onUp); });`,
 `        const ray = new T.Raycaster(), pointer = new T.Vector2();
        let down: { id: number; x: number; y: number } | null = null;
        const pointers = new Set<number>(); let multiPointer = false;
        const release = (e: PointerEvent) => {
          pointers.delete(e.pointerId);
          if (down?.id === e.pointerId) down = null;
          if (!pointers.size) multiPointer = false;
        };
        const onDown = (e: PointerEvent) => {
          pointers.add(e.pointerId); if (pointers.size > 1) multiPointer = true;
          down = !multiPointer && e.button === 0 ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null;
        };
        const onMove = (e: PointerEvent) => {
          if (down?.id === e.pointerId && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down = null;
        };
        const onUp = (e: PointerEvent) => {
          const tap = down, eligible = tap?.id === e.pointerId && !multiPointer && pointers.size === 1;
          release(e);
          if (!eligible || !tap || cancelled || renderer.xr.isPresenting || Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 6) return;
          const rect = renderer.domElement.getBoundingClientRect(); if (rect.width <= 0 || rect.height <= 0) return;
          pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1); ray.setFromCamera(pointer, camera);
          const hit = ray.intersectObjects(pickable)[0]; if (hit) latest.current.onSelect(hit.object.userData.id);
        };
        const onCancel = (e: PointerEvent) => { down = null; release(e); };
        renderer.domElement.addEventListener('pointerdown', onDown); renderer.domElement.addEventListener('pointerup', onUp); renderer.domElement.addEventListener('pointercancel', onCancel);
        document.addEventListener('pointermove', onMove); document.addEventListener('pointerup', release);
        disposers.push(() => { renderer.domElement.removeEventListener('pointerdown', onDown); renderer.domElement.removeEventListener('pointerup', onUp); renderer.domElement.removeEventListener('pointercancel', onCancel); document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', release); pointers.clear(); down = null; });`);
 r("import { useEffect, useRef } from 'react';", "import { useEffect, useRef } from 'react';\nimport {createAppearanceVisual,renderedAppearance,type AppearanceVisual} from '../src/appearance/web-three.ts';");
 r('[props.selected, props.highlightedEdge, props.moving, props.allowMotion]', '[props.graph, props.selected, props.highlightedEdge, props.moving, props.allowMotion]');
 r('n.kind, n.origin, n.color, n.position', 'n.kind, n.origin, n.position');
 r('focus: InstanceType<typeof T.ShaderMaterial> | null }[]', 'focus: InstanceType<typeof T.ShaderMaterial> | null; visual: AppearanceVisual }[]');
 r("          const mark = new T.Group(); mark.position.set(...n.position); group.add(mark); marks.set(n.id, mark);\n          const geometry = n.kind === 'agent' ? new T.IcosahedronGeometry(.26, 1) : new T.BoxGeometry(.34, .34, .34);\n          const material = new T.MeshBasicMaterial({ color: n.color, wireframe: n.origin !== 'own', transparent: true, opacity: .85 });\n          const mesh = new T.Mesh(geometry, material); mesh.userData.id = n.id; mark.add(mesh); pickable.push(mesh);", "          const visual = createAppearanceVisual(T, renderedAppearance(n), {radius: .26, wireframe: n.origin !== 'own'});\n          const mark = visual.group; mark.position.set(...n.position); group.add(mark); marks.set(n.id, mark);\n          const mesh = visual.core, material = mesh.material; mesh.userData.id = n.id; visual.picker.userData.id = n.id; pickable.push(visual.picker);");
 r('surfaces.push({ id: n.id, mesh, base: material, focus: focusMaterial });','surfaces.push({ id: n.id, mesh, base: material, focus: focusMaterial, visual });');
 r('disposers.push(() => geometry.dispose(), () => material.dispose());\n          const textureCanvas', 'disposers.push(() => visual.dispose());\n          const textureCanvas');
 r('          draw();\n        };\n        const updateLoop', '          for (const surface of surfaces) surface.visual.animate(time / 1000, latest.current.allowMotion && !powerSaver && !reduced.matches && !document.hidden && visible);\n          draw();\n        };\n        const updateLoop');
 r('(latest.current.moving || latest.current.holographic)', "(latest.current.moving || latest.current.holographic || latest.current.graph.nodes.some(n => renderedAppearance(n).motion === 'breathe'))");
 r('          renderer.setAnimationLoop(animate ? loop : null); lastTime = 0; draw();', '          if (!animate || !latest.current.allowMotion || powerSaver || reduced.matches) for (const surface of surfaces) surface.visual.animate(0, false);\n          renderer.setAnimationLoop(animate ? loop : null); lastTime = 0; draw();');
 r('          for (const [id, mark] of marks) mark.scale.setScalar(id === latest.current.selected ? 1.22 : 1);', '          for (const surface of surfaces) { const node = latest.current.graph.nodes.find(n => n.id === surface.id); if (!node) continue; const appearance = renderedAppearance(node); surface.visual.update(appearance, surface.id === latest.current.selected); if (surface.focus) surface.focus.uniforms.tint.value.set(appearance.core); }');
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
 if(file==="space-renderer.tsx")r("if (renderer.xr.getSession() !== null || unconfirmedEnds.size) return;","if (renderer.xr.getSession() !== null || unconfirmedEnds.size || (renderFault && boundEnds.size)) return;");
 // Quarantine late WebGL faults without dropping an owned XR session.
 if(file==="space-renderer.tsx"){
  r("onError: (message: string) => void","onError: (message: string, context?: { retainAR: boolean }) => void");
  r("    let cancelled = false;","    let cancelled = false, renderFault = '', terminalFaultReported = false;");
  r("if (!session || endingUncertain || arMode","if (renderFault || !session || endingUncertain || arMode");
  r("        const draw = () => { if (!cancelled && !renderer.getContext().isContextLost()) renderer.render(scene, camera); };","        const reportFaultFallback = () => {\n          if (cancelled || terminalFaultReported) return;\n          terminalFaultReported = true; latest.current.onError(renderFault);\n        };\n        const failRenderer = () => {\n          if (cancelled || renderFault) return;\n          renderFault = 'Die Grafikdarstellung wurde unterbrochen. Die 2D-Struktur bleibt erhalten; du kannst 3D erneut laden.';\n          // Latch before reporting: retained callbacks must never rearm this owner.\n          try { renderer.setAnimationLoop(null); } catch { /* The owner stays quarantined even if stopping the GPU loop fails. */ }\n          orbit.enabled = false; stopHitTest(); startup?.abort(); latest.current.onReady(false);\n          if (session || renderer.xr.getSession() !== null || unconfirmedEnds.size) {\n            endingUncertain = true; latest.current.onAR(true); reportAR('end-unknown');\n            latest.current.onError(renderFault + ' Beende zuvor die aktive AR-Sitzung über „AR beenden“ oder die Browserfunktion; das Ende muss bestätigt sein.', { retainAR: true });\n          } else reportFaultFallback();\n        };\n        const guardRender = <Args extends unknown[],>(work: (...args: Args) => void) => (...args: Args) => {\n          if (cancelled || renderFault) return;\n          try { work(...args); } catch { failRenderer(); }\n        };\n        const draw = guardRender(() => { if (renderer.getContext().isContextLost()) failRenderer(); else renderer.render(scene, camera); });");
  r("        const resize = () => {","        const resize = guardRender(() => {");
  r("renderer.setSize(width, height, false); draw();\n        };","renderer.setSize(width, height, false); draw();\n        });");
  r("        const loop = (time: number, frame?: XRFrame) => {","        const loop = guardRender((time: number, frame?: XRFrame) => {");
  r("          draw();\n        };\n        const updateLoop = () => {","          draw();\n        });\n        const updateLoop = guardRender(() => {");
  r("renderer.setAnimationLoop(animate ? loop : null); lastTime = 0; draw();\n        };","renderer.setAnimationLoop(animate ? loop : null); lastTime = 0; draw();\n        });");
  r("          renderer.setAnimationLoop(null); renderer.xr.isPresenting = false; renderer.setPixelRatio(inlinePixelRatio);","          renderer.setAnimationLoop(null); renderer.xr.isPresenting = false;\n          if (renderFault) {\n            stopHitTest(); session = null; endingUncertain = false; inlinePose = null;\n            if (!cancelled) { latest.current.onAR(false); latest.current.onARBusy(startLock.busy); reportAR('inactive'); reportFaultFallback(); }\n            return;\n          }\n          renderer.setPixelRatio(inlinePixelRatio);");
  r("        const contextLost = (e: Event) => { e.preventDefault(); renderer.setAnimationLoop(null); if (!cancelled) latest.current.onError('Der Grafikkontext wurde unterbrochen. Die 2D-Struktur bleibt verfügbar; 3D lässt sich erneut laden.'); };","        const contextLost = (e: Event) => { e.preventDefault(); failRenderer(); };");
  r("if (!eligible || !tap || cancelled || renderer.xr.isPresenting","if (!eligible || !tap || cancelled || renderFault || renderer.xr.isPresenting");
  r("        refresh.current = () => {","        refresh.current = guardRender(() => {");
  r("          updateLoop();\n        };\n        const recenterAR","          updateLoop();\n        });\n        const recenterAR");
  r("const recenterAR = () => { if (endingUncertain)","const recenterAR = () => { if (renderFault || endingUncertain)");
  r("reset: () => { if (renderer.xr.isPresenting)","reset: () => { if (renderFault) return; if (renderer.xr.isPresenting)");
  r("focus: id => { if (renderer.xr.isPresenting)","focus: id => { if (renderFault || renderer.xr.isPresenting)");
  r("zoom: factor => { if (endingUncertain)","zoom: factor => { if (renderFault || endingUncertain)");
  r("            if (cancelled) return;\n            if (xrBinding","            if (cancelled || (renderFault && !session && !unconfirmedEnds.size)) return;\n            if (xrBinding");
  r("        resize(); refresh.current();\n        if (renderer.info","        resize(); refresh.current();\n        if (renderFault) return;\n        if (renderer.info");
  r("        dispose(); if (!cancelled) latest.current.onError('3D","        dispose(); if (!cancelled && !renderFault) latest.current.onError('3D");
 }
 if(file==="mesh-space.tsx"){
  r("const onError = useCallback((message: string) => { setError(message); setReady(false); setARActive(false); setARBusy(false); setMode('2d'); }, []);","const onError = useCallback((message: string, context?: { retainAR: boolean }) => { setError(message); setReady(false); if (context?.retainAR) return; setARActive(false); setARBusy(false); setMode('2d'); }, []);");
  r("{!ready && <div className=\"space-stage-loading\"","{!ready && !error && <div className=\"space-stage-loading\"");
  r("className=\"ar-button\" disabled={!arSupported || !ready || arBusy}","className=\"ar-button\" disabled={arBusy || (!arActive && (!arSupported || !ready))}");
  r("<div className=\"space-ar-overlay\" hidden={!arActive && !arBusy}><strong>{node.title}</strong>","<div className=\"space-ar-overlay\" hidden={!arActive && !arBusy}><strong>{node.title}</strong>{error && <p className=\"space-error\" role=\"alert\">{error}</p>}");
 }
 if(file==='space-renderer.tsx')r('else if (!unconfirmedEnds.size && !session) restoreInline();', 'else if (renderFault || (!unconfirmedEnds.size && !session)) restoreInline();');
 // Fault ownership includes unresolved requests and late unbound sessions.
 if(file==="space-renderer.tsx"){
  r("        const trackedSessions = new WeakSet<XRSession>();","        const trackedSessions = new WeakSet<XRSession>();\n        const liveSessions = new Set<XRSession>(), pendingRequests = new Set<Promise<XRSession>>();");
  r("          orbit.enabled = false; stopHitTest(); startup?.abort(); latest.current.onReady(false);\n          if (session || renderer.xr.getSession() !== null || unconfirmedEnds.size) {\n            endingUncertain = true; latest.current.onAR(true); reportAR('end-unknown');\n            latest.current.onError(renderFault + ' Beende zuvor die aktive AR-Sitzung über „AR beenden“ oder die Browserfunktion; das Ende muss bestätigt sein.', { retainAR: true });","          orbit.enabled = false; stopHitTest(); startup?.abort(); latest.current.onReady(false);\n          if (cancelled || terminalFaultReported) return;\n          if (session || renderer.xr.getSession() !== null || liveSessions.size || pendingRequests.size) {\n            endingUncertain = true; latest.current.onAR(true);\n            if (cancelled || terminalFaultReported) return;\n            reportAR('end-unknown');\n            if (cancelled || terminalFaultReported) return;\n            latest.current.onError(renderFault + ' Eine AR-Anfrage oder Sitzung ist noch offen. Nutze „AR beenden“ oder die Browserfunktion; ein neuer Start bleibt bis zur Klärung gesperrt.', { retainAR: true });");
  r("(renderFault && boundEnds.size)","(renderFault && (boundEnds.size || pendingRequests.size))");
  r("          trackedSessions.add(target);","          trackedSessions.add(target); liveSessions.add(target);");
  r("            endedSessions.add(target); unconfirmedEnds.delete(target);","            endedSessions.add(target); liveSessions.delete(target); unconfirmedEnds.delete(target);");
  r("(renderFault && !session && !unconfirmedEnds.size)","(renderFault && !session && !liveSessions.size)");
  r("              if (session || unconfirmedEnds.size) {","              if (session || unconfirmedEnds.size || (renderFault && liveSessions.size)) {");
  r("                const closing = new Set([...unconfirmedEnds, ...(session ? [session] : [])]);","                const closing = new Set([...unconfirmedEnds, ...(session ? [session] : []), ...(renderFault ? liveSessions : [])]);");
  r("              const next = await withAbort(requested, attempt.signal); target = next; session = next;","              pendingRequests.add(requested);\n              void requested.finally(() => { pendingRequests.delete(requested); if (renderFault) restoreInline(); }).catch(() => {});\n              const next = await withAbort(requested, attempt.signal); target = next; session = next;");
 }
});
console.log('Generated nine explicit UI overlays; original sources remain byte-identical.');
