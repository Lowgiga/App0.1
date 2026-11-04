import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let source=fs.readFileSync(path.join(root,'vendor/mesh-extensions/src/GraphExplorer.tsx'),'utf8');
function replace(before,after){const count=source.split(before).length-1;if(count!==1)throw new Error(`Graph overlay drift (${count}): ${before}`);source=source.replace(before,after)}
replace("import { SvgView } from './SvgView.tsx';", "import { SvgView } from '../overlay/appearance-svg-view.tsx';");
replace("const ThreeView = lazy(() => import('./ThreeView.tsx'));", "const ThreeView = lazy(() => import('../overlay/appearance-three-view.tsx'));");
replace("import { Inspector } from './Inspector.tsx';","import { Inspector } from './Inspector.tsx';\nimport {applyGraphPolicy,type GraphHostPolicy} from '../src/graph/view-policy.ts';");
replace('    initialConfig?: ViewConfigInput;','    initialConfig?: ViewConfigInput;\n    policy?: GraphHostPolicy;');
replace('export function GraphExplorer({ graph, initialConfig, onConfigChange,','export function GraphExplorer({ graph, initialConfig, policy, onConfigChange,');
replace('const [config, setConfig] = useState(() => parseConfig(initialConfig ?? defaultConfig()));','const [preferredConfig, setConfig] = useState(() => parseConfig(initialConfig ?? defaultConfig()));\n    const config=useMemo(()=>applyGraphPolicy(preferredConfig,policy),[preferredConfig,policy?.reduceMotion,policy?.powerSaver]);');
replace('const next = updateConfig(config, patch);','const next = updateConfig(preferredConfig, patch);');
replace('onSaveView(parseConfig(config))','onSaveView(parseConfig(preferredConfig))');
replace('serializeConfig(config, { legacyV1: legacyExport })','serializeConfig(preferredConfig, { legacyV1: legacyExport })');
replace('aria-label="Qualität" value={config.quality}','aria-label="Qualität" disabled={policy?.powerSaver} value={config.quality}');
replace('aria-label="Übergänge" value={config.transitions}','aria-label="Übergänge" disabled={policy?.reduceMotion || policy?.powerSaver} value={config.transitions}');
replace('type="checkbox" checked={config.reducedMotion}','type="checkbox" disabled={policy?.reduceMotion || policy?.powerSaver} checked={config.reducedMotion}');
replace('<div className="mesh-summary" role="status">','{(policy?.reduceMotion||policy?.powerSaver)&&<p role="status" className="mesh-muted">Globale Vorgabe: {policy.powerSaver ? "Energiesparen erzwingt sparsame Qualität und ausgeschaltete Übergänge." : "Bewegung ist global ausgeschaltet."} Persönliche Ansichtsoptionen bleiben gespeichert.</p>}\n <div className="mesh-summary" role="status">');
replace("    render3D?: (props: SpatialViewProps) => React.ReactNode;","    render3D?: (props: SpatialViewProps) => React.ReactNode;\n    renderSelectionContext?: (selectedId: string | null, focus: 'graph' | 'inspector') => React.ReactNode;");
replace("onPrepare, render3D }: GraphExplorerProps)","onPrepare, render3D, renderSelectionContext }: GraphExplorerProps)");
replace("    const [exportOpen, setExportOpen]","    const [confirmedSelection, setConfirmedSelection] = useState<{id:string;focus:'graph'|'inspector'}|null>(null);\n    const [exportOpen, setExportOpen]");
replace("    const select = (id: string) => change({ selectedId: id });","    const select = (id: string, focus:'graph'|'inspector'='graph') => {setConfirmedSelection({id,focus});change({ selectedId: id });};");
replace("</main><Inspector graph=","</main><div className=\"mesh-inspector-stack\">{renderSelectionContext?.(confirmedSelection?.id===config.selectedId?config.selectedId:null,confirmedSelection?.focus??'graph')}<Inspector graph=");
replace("selectedId={config.selectedId} onSelect={select}","selectedId={config.selectedId} onSelect={id=>select(id,'inspector')}");
replace("pending={pending}/></div>","pending={pending}/></div></div>");
source=source.replaceAll("'./","'../vendor/mesh-extensions/src/");
fs.writeFileSync(path.join(root,'overlay/graph-explorer.tsx'),source);
console.log('Generated graph overlay with render-time host policy; vendor source remains pinned.');

// Host adapters preserve immutable vendor modules and their demand-camera behavior.
function hostOverlay(input,output,edits){let text=fs.readFileSync(path.join(root,'vendor/mesh-extensions/src',input),'utf8');const r=(before,after)=>{if(text.split(before).length!==2)throw new Error('Appearance overlay drift: '+input+' '+before);text=text.replace(before,after)};edits(r);text=text.replaceAll("'./","'../vendor/mesh-extensions/src/");fs.writeFileSync(path.join(root,'overlay',output),text)}
hostOverlay('three-controller.ts','appearance-three-controller.ts',r=>{
 r("import { limitsFor } from './view.ts';", "import { limitsFor } from './view.ts';\nimport {createLabelLayout} from '../src/appearance/label-visibility.ts';");
 r('    const labelNodes = new Map<string, HTMLButtonElement>();','    const labelNodes = new Map<string, HTMLButtonElement>();\n    const labelLayout=createLabelLayout(labels,labelNodes);');
 r(`            for (const [id, button] of labelNodes) {
                const p = built.positions.get(id)?.clone().project(camera);
                const visible = !!p && p.z >= -1 && p.z <= 1 && Math.abs(p.x) <= 1.05 && Math.abs(p.y) <= 1.05;
                button.hidden = !visible;
                if (p && visible) { button.style.left = ((p.x + 1) / 2 * 100) + '%'; button.style.top = ((-p.y + 1) / 2 * 100) + '%'; }
            }`, `            labelLayout.draw([...labelNodes.keys()].map(id=>{const p=built!.positions.get(id)?.clone().project(camera);return{id,x:p?.x??NaN,y:p?.y??NaN,visible:!!p&&p.z>=-1&&p.z<=1&&Math.abs(p.x)<=1.05&&Math.abs(p.y)<=1.05}}),props.config.selectedId);`);
 r('            renderer.setSize(width, height); draw();','            renderer.setSize(width, height); labelLayout.resize(width,height); draw();');
 r(`        labels.replaceChildren(); labelNodes.clear();
        for (const node of props.scene.nodes) {
            if (props.config.labels === 'none' || props.config.labels === 'selected' && node.id !== props.config.selectedId) continue;
            const button = owner.createElement('button'); button.className = 'mesh-three-label';
            button.textContent = node.title.length > 36 ? node.title.slice(0, 35) + '…' : node.title;
            button.title = node.title; button.setAttribute('aria-label', node.title); button.setAttribute('aria-pressed', String(node.id === props.config.selectedId));
            button.onclick = () => props.onSelect(node.id); labels.append(button); labelNodes.set(node.id, button);
        }`, '        labelLayout.sync(props.scene.nodes,props.config.labels,props.config.selectedId,props.onSelect);');
 r('        update(initial);',"        const fontOrViewportChanged=()=>{labelLayout.invalidate();resize();};\n        owner.fonts?.addEventListener('loadingdone',fontOrViewportChanged);win.addEventListener('resize',fontOrViewportChanged);\n        cleanup.push(()=>{owner.fonts?.removeEventListener('loadingdone',fontOrViewportChanged);win.removeEventListener('resize',fontOrViewportChanged);});\n        update(initial);");
 r('const gestureEnd = () => { interacting = false; };', 'const gestureEnd = () => { interacting = false; syncBreathe(); };');
 r("import { limitsFor } from './view.ts';", "import { limitsFor } from './view.ts';\nimport {renderedAppearance} from '../src/appearance/web-three.ts';");
 r('    const timeline = createDemandTimeline(runtime.frameClock ?? browserFrameClock(win));', '    const frameClock = runtime.frameClock ?? browserFrameClock(win);\n    const timeline = createDemandTimeline(frameClock);\n    const motionMedia = win.matchMedia?.(\'(prefers-reduced-motion: reduce)\');\n    let breathingFrame: number | null = null, breathingGeneration = 0, visible = true;');
 r('    const cancelMotion = () => { timeline.cancel(); destination = null; };', '    const stopBreathe = () => { breathingGeneration++; if (breathingFrame !== null) frameClock.cancel(breathingFrame); breathingFrame = null; built?.animate(0, false); };\n    const cancelMotion = () => { timeline.cancel(); destination = null; stopBreathe(); };');
 r('        disposed = true; timeline.dispose(); destination = null;', '        disposed = true; timeline.dispose(); destination = null; stopBreathe();');
 r('    const resize = () => {', `    const syncBreathe = () => {
        stopBreathe();
        const allowed = () => !disposed && !lost && visible && !owner.hidden && !motionMedia?.matches && !props.config.reducedMotion && props.config.quality !== 'low' && props.scene.nodes.some(node => renderedAppearance(node).motion === 'breathe');
        if (!allowed()) { draw(); return; }
        const generation = breathingGeneration;
        const step = (time: number) => { if (generation !== breathingGeneration || !allowed()) return; breathingFrame = null; built?.animate(time / 1000, true); draw(); if (generation === breathingGeneration && allowed()) breathingFrame = frameClock.request(step); };
        breathingFrame = frameClock.request(step);
    };
    const resize = () => {`);
 r('        else draw();\n    };', '        else draw();\n        syncBreathe();\n    };');
 r('const visibility = () => { if (owner.hidden) settleMotion(); };', 'const visibility = () => { if (owner.hidden) settleMotion(); syncBreathe(); };\n        motionMedia?.addEventListener(\'change\', syncBreathe);\n        const intersection = win.IntersectionObserver ? new win.IntersectionObserver(entries => {visible = entries[0]?.isIntersecting ?? false; syncBreathe();}) : null; intersection?.observe(host);\n        cleanup.push(() => {motionMedia?.removeEventListener(\'change\', syncBreathe); intersection?.disconnect();});');

 r("import { createGraphScene, type GraphScene } from './three-scene.ts';","import {createAppearanceGraphScene as createGraphScene, appearanceSceneKey, type AppearanceGraphScene as GraphScene} from '../src/appearance/web-studio-scene.ts';");
 r('props.layout !== next.layout','JSON.stringify(props.layout) !== JSON.stringify(next.layout)');
 r('        const replacement = createGraphScene(next);\n        props = next; built?.dispose(); built = replacement;','        const reuse = built && appearanceSceneKey(props) === appearanceSceneKey(next);\n        const replacement = reuse ? built! : createGraphScene(next);\n        if(reuse)replacement.update(next);\n        props = next; if(!reuse)built?.dispose(); built = replacement;');
});
hostOverlay('ThreeView.tsx','appearance-three-view.tsx',r=>{
 r('Keine Daueranimation.', 'Optionales Atmen bewegt nur die Hülle und den Orbit. Bewegungsreduktion und Energiesparen haben Vorrang.');
 r('Die Knotenliste bietet dieselbe Auswahl per Tastatur.', "Die Knotenliste bietet dieselbe Auswahl per Tastatur. {props.config.labels==='all'&&'Überlappende Namen werden ausgeblendet; alle Knoten bleiben in der Liste auswählbar.'}");
 r("import { createSpatialController } from './three-controller.ts';","import { createSpatialController } from '../overlay/appearance-three-controller.ts';");
});

hostOverlay('SvgView.tsx','appearance-svg-view.tsx',r=>{
 r("<text y={35}", "<text y={Math.max(35, (frame.emphasis[node.id]?.radius ?? (selected ? 19 : 14)) * sizeScale(renderedAppearance(node).size) * 1.6 + 16)}");
 r("<title>{node.title} · {node.status ?? 'Status unbekannt'} · {node.detail}</title>", "<title>{node.title + ' · ' + (node.status ?? 'Status unbekannt') + ' · ' + node.detail}</title>");
 r('<title>{edge.from} {relationNames[edge.relation]} {edge.to}</title>',"<title>{edge.from + ' ' + relationNames[edge.relation] + ' ' + edge.to}</title>");
 r("import { nodeColors } from './render-types.ts';", "import {AppearanceGlyph} from '../src/appearance/WebNodeGlyph.tsx';\nimport {sizeScale} from '../src/appearance/projection.ts';\nimport {renderedAppearance} from '../src/appearance/web-three.ts';");
 r("<circle r={frame.emphasis[node.id]?.radius ?? (selected ? 19 : 14)} fill={nodeColors[node.kind]} stroke={selected ? '#fff' : '#243647'} strokeWidth={selected ? 3 : 1.5}/>", "<AppearanceGlyph appearance={renderedAppearance(node)} radius={frame.emphasis[node.id]?.radius ?? (selected ? 19 : 14)} selected={selected} motionAllowed={!config.reducedMotion && config.quality !== 'low'}/>");
});
