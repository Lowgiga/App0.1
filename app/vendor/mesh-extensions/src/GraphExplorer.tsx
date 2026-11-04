import React, { Component, Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import type { ExplorerGraph, NavigateTarget, PrepareIntent } from './model.ts';
import { kinds, kindNames } from './model.ts';
import { defaultConfig, parseConfig, selectScene, serializeConfig, updateConfig, type ViewConfig, type ViewConfigInput } from './view.ts';
import { layoutGraph } from './layouts.ts';
import { SvgView } from './SvgView.tsx';
import { Inspector } from './Inspector.tsx';
import type { SpatialViewProps } from './render-types.ts';
const ThreeView = lazy(() => import('./ThreeView.tsx'));
class SpatialBoundary extends Component<{
    children: React.ReactNode;
    onError: (message: string) => void;
}, {
    failed: boolean;
}> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch() { this.props.onError('3D-Modul konnte nicht geladen werden.'); }
    render() { return this.state.failed ? null : this.props.children; }
}
export type GraphExplorerProps = {
    graph: ExplorerGraph;
    initialConfig?: ViewConfigInput;
    onConfigChange?: (config: ViewConfig) => void;
    onSaveView?: (config: ViewConfig) => void | Promise<void>;
    onNavigate?: (target: NavigateTarget) => void | Promise<void>;
    onPrepare?: (intent: PrepareIntent) => void | Promise<void>;
    render3D?: (props: SpatialViewProps) => React.ReactNode;
};
export function GraphExplorer({ graph, initialConfig, onConfigChange, onSaveView, onNavigate, onPrepare, render3D }: GraphExplorerProps) {
    const [config, setConfig] = useState(() => parseConfig(initialConfig ?? defaultConfig()));
    const [exportOpen, setExportOpen] = useState(false);
    const [legacyExport, setLegacyExport] = useState(false);
    const [message, setMessage] = useState('');
    const [pending, setPending] = useState(false);
    const pendingRef = useRef(false);
    const mounted = useRef(true);
    const [threeError, setThreeError] = useState<string | null>(null);
    const [systemReduced, setSystemReduced] = useState(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    useEffect(() => { const media = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)'); if (!media)
        return; const update = () => setSystemReduced(media.matches); update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
    const change = (patch: Partial<ViewConfig>) => { const next = updateConfig(config, patch); setConfig(next); onConfigChange?.(parseConfig(next)); if (patch.renderer)
        setThreeError(null); };
    const scene = useMemo(() => selectScene(graph, config), [graph, config]);
    const layout = useMemo(() => layoutGraph(graph, config.layout), [graph, config.layout]);
    const select = (id: string) => change({ selectedId: id });
    const spatial: SpatialViewProps = { scene, layout, config: { ...config, reducedMotion: config.reducedMotion || systemReduced }, onSelect: select, onUnavailable: setThreeError };
    const run = async (action: () => void | Promise<void>, label = 'Aktion') => { if (pendingRef.current)
        return; pendingRef.current = true; setPending(true); setMessage(''); try {
        await action();
        if (mounted.current)
            setMessage(label === 'Speichern' ? 'Ansichtskonfiguration an Speicher-Callback übergeben.' : 'An die App übergeben.');
    }
    catch (error) {
        if (mounted.current)
            setMessage(label + ' fehlgeschlagen: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'));
    }
    finally {
        pendingRef.current = false;
        if (mounted.current)
            setPending(false);
    } };
    return <section className={`mesh-explorer mesh-mode-${config.mode} mesh-style-${config.visualStyle} mesh-quality-${config.quality}`} data-reduced-motion={config.reducedMotion || systemReduced || config.quality === 'low' || config.transitions === 'off'} aria-label="Gemeinsamer Graph Explorer">
 <header className="mesh-heading"><div><h1>Gemeinsame Arbeitsansicht</h1><p>{graph.availability === 'unknown' ? 'Datenstand unbekannt' : `App-Stand: ${graph.updatedAt ?? 'unbekannt'}`} · Quellenstand wird pro Quelle ausgewiesen</p></div><span className="mesh-muted">Extension-Kandidat</span></header>
 <div className="mesh-toolbar"><label>Perspektive<select aria-label="Layout" value={config.layout} onChange={e => change({ layout: e.target.value as ViewConfig['layout'] })}><option value="network">Netzwerk</option><option value="workflow">Arbeitsablauf</option><option value="evidence">Belege & Abhängigkeiten</option></select></label><label>Darstellung<select aria-label="Darstellung" value={config.renderer} onChange={e => change({ renderer: e.target.value as ViewConfig['renderer'] })}><option value="svg">2D · SVG</option><option value="three">3D · bei Bedarf laden</option></select></label><label className="mesh-search">Suchen<input aria-label="Knoten suchen" type="search" maxLength={200} value={config.filters.query} onChange={e => change({ filters: { ...config.filters, query: e.target.value } })} placeholder="Titel, Status oder ID"/></label><label>Arbeitsmodus<select aria-label="Arbeitsmodus" value={config.mode} onChange={e => change({ mode: e.target.value as ViewConfig['mode'] })}><option value="work">Arbeit</option><option value="focus">Fokus</option><option value="presentation">Präsentation</option></select></label></div>
 <details className="mesh-options"><summary>Filter und Ansichtsoptionen</summary><div className="mesh-option-grid"><fieldset><legend>Knotenarten</legend>{kinds.map(kind => <label key={kind}><input type="checkbox" aria-label={kindNames[kind] + ' anzeigen'} checked={config.filters.kinds.includes(kind)} onChange={() => change({ filters: { ...config.filters, kinds: config.filters.kinds.includes(kind) ? config.filters.kinds.filter(k => k !== kind) : [...config.filters.kinds, kind] } })}/>{kindNames[kind]}</label>)}</fieldset><fieldset><legend>Herkunft</legend>{(['own', 'external'] as const).map(origin => <label key={origin}><input type="checkbox" checked={config.filters.origins.includes(origin)} onChange={() => change({ filters: { ...config.filters, origins: config.filters.origins.includes(origin) ? config.filters.origins.filter(o => o !== origin) : [...config.filters.origins, origin] } })}/>{origin === 'own' ? 'Eigene App-Daten' : 'Externe Quellen'}</label>)}</fieldset><fieldset><legend>Darstellungsoptionen</legend><label>Visueller Stil<select aria-label="Visueller Stil" value={config.visualStyle} onChange={e => change({ visualStyle: e.target.value as ViewConfig['visualStyle'] })}><option value="solid">Klar</option><option value="hologram">Holografisch · visueller Stil</option></select></label><label>Beschriftung<select aria-label="Beschriftungsdichte" value={config.labels} onChange={e => change({ labels: e.target.value as ViewConfig['labels'] })}><option value="none">Keine</option><option value="selected">Auswahl</option><option value="all">Alle sichtbaren</option></select></label><label>Qualität<select aria-label="Qualität" value={config.quality} onChange={e => change({ quality: e.target.value as ViewConfig['quality'] })}><option value="low">Sparsam · ohne Übergänge</option><option value="balanced">Ausgewogen</option><option value="high">Detailreich</option></select></label><label>Übergänge<select aria-label="Übergänge" value={config.transitions} onChange={e => change({ transitions: e.target.value as ViewConfig['transitions'] })}><option value="off">Sofort</option><option value="brief">Kurz · bis 160 ms</option><option value="smooth">Sanft · bis 320 ms</option></select></label><p className="mesh-muted">Nur bei Layout, Fokus oder Auswahl. Bewegungsreduktion und Sparsam haben Vorrang. Escape beendet den Übergang.</p><label><input type="checkbox" checked={config.reducedMotion} onChange={e => change({ reducedMotion: e.target.checked })}/>Bewegung reduzieren</label><label><input type="checkbox" checked={config.highlightRelations} onChange={e => change({ highlightRelations: e.target.checked })}/>Beziehungen hervorheben</label><label>3D-Blick<select aria-label="3D-Blick" value={config.perspective} onChange={e => change({ perspective: e.target.value as ViewConfig['perspective'] })}><option value="isometric">Räumlich</option><option value="front">Frontal</option><option value="top">Von oben</option></select></label></fieldset></div></details>
 <div className="mesh-summary" role="status">{scene.filtered.length} passende Knoten · {scene.nodes.length} in der Szene · {scene.edges.length} Beziehungen{scene.focusedOutNodes > 0 && <span> · Fokus: {scene.focusedOutNodes} Knoten außerhalb der direkten Nachbarschaft nicht gezeichnet</span>}{scene.omittedNodes + scene.omittedEdges > 0 && <span> · Szenengrenze: {scene.omittedNodes} Knoten und {scene.omittedEdges} Beziehungen nicht gezeichnet; Liste und Inspector bleiben verfügbar</span>}{graph.sourcesAvailability === 'unknown' && <span> · Quellenliste unbekannt</span>}{graph.omittedArchived > 0 && <span> · {graph.omittedArchived} archivierte Einträge nicht im Graphen</span>}{graph.unresolved.length > 0 && <span> · {graph.unresolved.length} nicht auflösbare Beziehungen</span>}</div>
 <div className="mesh-workspace"><main className="mesh-visual-region">{threeError && <p role="alert">{threeError} Die 2D-Ansicht bleibt verfügbar. <button onClick={() => change({ renderer: 'svg' })}>Zu 2D wechseln</button></p>}
 {graph.availability === 'unknown' ? <div className="mesh-empty">Datenstand unbekannt. Einen gespeicherten App-Datenstand übergeben.</div> : scene.nodes.length === 0 ? <div className="mesh-empty">Keine Knoten passen zu den Filtern.</div> : config.renderer === 'three' && !threeError ? <SpatialBoundary onError={setThreeError}><Suspense fallback={<p role="status">3D-Modul wird geladen …</p>}>{render3D ? render3D(spatial) : <ThreeView {...spatial}/>}</Suspense></SpatialBoundary> : <SvgView {...spatial}/>}
 <details open className="mesh-node-list"><summary>Alle passenden Knoten ({scene.filtered.length})</summary><ul>{scene.filtered.map(n => <li key={n.id}><button aria-pressed={config.selectedId === n.id} onClick={() => select(n.id)}><span>{n.title}</span><small>{kindNames[n.kind]} · {n.status ?? 'Status unbekannt'}</small></button></li>)}</ul></details></main><Inspector graph={graph} scene={scene} selectedId={config.selectedId} onSelect={select} onNavigate={onNavigate} onPrepare={onPrepare} run={action => { void run(action); }} pending={pending}/></div>
 <footer className="mesh-footer"><button data-action="save" disabled={!onSaveView || pending} onClick={() => onSaveView && void run(() => onSaveView(parseConfig(config)), 'Speichern')}>{pending ? 'Wird übergeben …' : 'Ansicht speichern'}</button><button data-action="export" onClick={() => setExportOpen(v => !v)}>Konfiguration exportieren</button><button onClick={() => change({ filters: defaultConfig().filters })}>Filter zurücksetzen</button><button onClick={() => change({ selectedId: null })}>Auswahl aufheben</button>{message && <p role="status">{message}</p>}{!onSaveView && <span className="mesh-muted">Speicherung ist noch nicht an die App angebunden.</span>}{exportOpen && <div className="mesh-export"><label><input type="checkbox" aria-label="Export für ursprüngliche V1-Ansicht" checked={legacyExport} onChange={e => setLegacyExport(e.target.checked)}/>Export für ursprüngliche V1-Ansicht (ohne Übergangseinstellung)</label><label>Serialisierbare Ansichtskonfiguration<textarea aria-label="Ansichtskonfiguration JSON" readOnly value={serializeConfig(config, { legacyV1: legacyExport })}/></label></div>}</footer>
 <details className="mesh-activity"><summary>Erhaltene App-Ereignisse ({graph.activity.events.length}, höchstens 200)</summary><p>Unvollständiger Ereignisausschnitt. Keine Zustandsrekonstruktion. Die Karte zeigt immer den übergebenen aktuellen Datenstand.</p>{graph.activity.events.length === 0 ? <p>Keine Ereignisse im übergebenen Ausschnitt. Frühere Aktivität ist unbekannt.</p> : <ol>{graph.activity.events.map(e => <li key={e.id}><time dateTime={e.at}>{e.at}</time> · #{e.sequence} · {e.title} {e.nodeId && <button onClick={() => select(e.nodeId!)}>Aktuellen Knoten auswählen</button>}</li>)}</ol>}</details>
 </section>;
}
