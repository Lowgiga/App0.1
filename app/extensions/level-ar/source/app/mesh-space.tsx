'use client';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Pause, Play, RotateCcw, Box, Scan, ArrowUpRight, Plus, Minus, Layers, Focus, Route, Link2, ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import type { WorkState } from '@/lib/work-contract';
import { buildSpaceGraph, visibleSpaceGraph, guidedSteps, kindNames, originNames, relationNames, type SpaceGraph, type SpaceScope } from '@/lib/space-model';
import type { MapSource } from '@/lib/intelligence';
import type { SpaceControls } from './space-renderer';
import AcademyPanel, { type AcademyControls } from './academy-panel';
import { inspectARSupport, arStartError } from '@/lib/ar-support';
import { placementStatusNames, type PlacementStatus } from '@/lib/ar-placement';
const SpaceRenderer = lazy(() => import('./space-renderer'));
type Props = { work: WorkState; disabled: boolean; known: boolean; save: (w: WorkState) => Promise<boolean>; data: { sources: MapSource[] }; go: (view: any) => void };

export default function MeshSpace({ work, known, go, ...props }: Props) {
  const graph = useMemo(() => buildSpaceGraph(work, props.data.sources, known), [work, props.data.sources, known]);
  const [selected, setSelected] = useState('agent:zimt'), [scope, setScope] = useState<SpaceScope>('team');
  const [mode, setMode] = useState<'2d' | '3d'>('2d'), [isolate, setIsolate] = useState(false), [moving, setMoving] = useState(false);
  const [ready, setReady] = useState(false), [error, setError] = useState(''), [arSupported, setARSupported] = useState(false), [arActive, setARActive] = useState(false), [arBusy, setARBusy] = useState(false);
  const [arStatus, setARStatus] = useState('AR-Unterstützung wird geprüft.'), [guide, setGuide] = useState<number | null>(null);
  const [placement, setPlacement] = useState<PlacementStatus>('scanning');
  const academyControls = useRef<AcademyControls | null>(null);
  const [edge, setEdge] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const controls = useRef<SpaceControls | null>(null), explorer = useRef<HTMLElement>(null), academy = useRef<HTMLDivElement>(null), initialSelection = useRef(false);
  const visible = useMemo(() => visibleSpaceGraph(graph, scope, selected, isolate), [graph, scope, selected, isolate]);
  const node = graph.nodes.find(n => n.id === selected) || graph.nodes[0];
  const relations = graph.edges.filter(e => e.from === node.id || e.to === node.id);
  const onError = useCallback((message: string) => { setError(message); setReady(false); setARActive(false); setARBusy(false); setMode('2d'); }, []);
  const select = useCallback((id: string) => { setSelected(id); setGuide(null); setEdge(null); }, []);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches); update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    let current = true;
    const policyDocument = document as Document & { permissionsPolicy?: { allowsFeature: (name: string) => boolean }; featurePolicy?: { allowsFeature: (name: string) => boolean } };
    const policy = policyDocument.permissionsPolicy || policyDocument.featurePolicy;
    const nativeWindow = window as Window & { Capacitor?: { isNativePlatform?: () => boolean } };
    void inspectARSupport({ secureContext: window.isSecureContext, xr: navigator.xr, policyAllowsXR: policy?.allowsFeature('xr-spatial-tracking'), nativeApp: nativeWindow.Capacitor?.isNativePlatform?.() }).then(result => { if (current) { setARSupported(result.supported); setARStatus(result.message); } });
    return () => { current = false; };
  }, []);
  useEffect(() => {
    if (!known || initialSelection.current) return; initialSelection.current = true;
    const p = new URLSearchParams(location.search), id = p.get('spaceNode'), s = p.get('spaceScope');
    if (id && graph.nodes.some(n => n.id === id)) { setSelected(id); setScope('all'); }
    if (s && ['team', 'missions', 'learning', 'all'].includes(s)) setScope(s as SpaceScope);
  }, [graph, known]);
  useEffect(() => { if (!visible.nodes.some(n => n.id === selected) && visible.nodes[0]) setSelected(visible.nodes[0].id); }, [selected, visible.nodes]);
  const chooseGuide = (index: number) => { const step = guidedSteps[index]; setGuide(index); setSelected(step.node); setScope('team'); setIsolate(false); setEdge(step.edge); };
  const openNode = () => { if (node.kind === 'lesson') { academyControls.current?.openLesson(node.entityId); academy.current?.scrollIntoView({ behavior: 'instant', block: 'start' }); return; } go(node.kind === 'agent' ? 'agents' : node.kind === 'mission' ? 'missions' : node.kind === 'task' ? 'matrix' : node.kind === 'room' ? 'chats' : node.kind === 'source' ? 'evidence' : node.entityId === 'github' ? 'pilot' : node.entityId === 'make' ? 'make' : 'connections'); };
  const exploreLesson = (id: string) => { setSelected(id); setScope(id.startsWith('lesson:') ? 'learning' : 'all'); setIsolate(false); setGuide(null); setEdge(null); explorer.current?.scrollIntoView({ behavior: 'instant', block: 'start' }); };
  const share = async () => { const url = new URL(location.href); url.searchParams.set('spaceNode', node.id); url.searchParams.set('spaceScope', scope); history.replaceState({}, '', url); try { await navigator.clipboard.writeText(url.toString()); toast.success('Link zur Auswahl kopiert. Er gewährt keinen zusätzlichen Zugriff.'); } catch { toast.error('Die Zwischenablage ist nicht verfügbar. Die Browseradresszeile enthält jetzt deinen Auswahl-Link.'); } };
  const startAR = async () => { try { await controls.current?.ar(); } catch (error) { const message = arStartError(error); setARStatus(message); toast.error(message); } };
  const allowMotion = work.settings.motion !== 'off' && !work.settings.powerSaver && !reducedMotion;
  return <div className="spatial-workspace">
    <section className="space-hero"><div><span className="eyebrow">MESH EXPLORER · VERSTEHEN UND ANWENDEN</span><h2>Aus Beziehungen wird ein nächster Schritt.</h2><p>Eigene Arbeit erkunden, Übergaben verstehen und mit einem konkreten Lernauftrag weiterarbeiten.</p></div><Button variant="outline" onClick={() => academy.current?.scrollIntoView({ behavior: 'instant', block: 'start' })}><BookOpen size={17} />Zur Academy</Button></section>
    <section ref={explorer} className="space-layout" aria-label="Interaktiver Mesh Explorer">
      <section className="space-view" aria-label="Netzwerk und Darstellung">
        <div className="space-toolbar"><div className="actions-row">
          <Button variant="outline" aria-pressed={mode === '2d'} disabled={arActive || arBusy} onClick={() => setMode('2d')}><Layers size={16} />2D-Struktur</Button>
          <Button variant="outline" aria-pressed={mode === '3d'} disabled={arActive || arBusy} onClick={() => { setError(''); setMode('3d'); }}><Box size={16} />{error ? '3D erneut laden' : 'Räumliches 3D'}</Button>
          <NativeSelect aria-label="Netzwerkbereich" value={scope} disabled={arActive || arBusy} onChange={e => { setScope(e.target.value as SpaceScope); setIsolate(false); setGuide(null); setEdge(null); }}><NativeSelectOption value="team">Team & Systeme</NativeSelectOption><NativeSelectOption value="missions">Agenten & Missionen</NativeSelectOption><NativeSelectOption value="learning">Lernlevel & Voraussetzungen</NativeSelectOption><NativeSelectOption value="all">Gesamter App-Kontext</NativeSelectOption></NativeSelect>
          <Button variant="outline" aria-pressed={isolate} disabled={arActive || arBusy} onClick={() => setIsolate(v => !v)}><Focus size={16} />{isolate ? 'Alle im Bereich' : 'Nachbarschaft'}</Button>
        </div></div>
        <div className="space-legend"><span>{known ? '● App-Profil / eigene Arbeit' : '○ Vorlage / Stand unbekannt'}</span><span>□ Quellen-Snapshot</span><span>┄ Geplanter Anschluss</span><span>{visible.nodes.length} / {visible.total} Knoten{visible.total > 32 ? ' · Auswahl auf 32 begrenzt' : ''}</span></div>
        {mode === '2d' ? <StructuralMap graph={visible} selected={node.id} highlighted={edge} onSelect={select} /> : <div className="space-stage" aria-busy={!ready}>
          <Suspense fallback={<div className="space-loading" role="status">3D-Modul wird geladen …</div>}><SpaceRenderer graph={visible} selected={node.id} highlightedEdge={edge} moving={moving} powerSaver={work.settings.powerSaver} allowMotion={allowMotion} controls={controls} onReady={setReady} onError={onError} onSelect={select} onAR={setARActive} onARBusy={setARBusy} onPlacement={setPlacement} /></Suspense>
          {!ready && <div className="space-stage-loading" role="status">Szene wird aufgebaut. Die 2D-Struktur bleibt jederzeit erreichbar.</div>}
        </div>}
        {error && <p className="space-error" role="status">{error}</p>}
        {mode === '3d' && <div className="space-toolbar space-camera-controls"><Button variant="outline" disabled={!ready || arActive || arBusy || !allowMotion} aria-pressed={moving && allowMotion} onClick={() => setMoving(v => !v)}>{moving && allowMotion ? <Pause size={16} /> : <Play size={16} />}{moving && allowMotion ? 'Drehung pausieren' : 'Ansicht drehen'}</Button><Button variant="outline" disabled={!ready || arBusy} onClick={() => controls.current?.reset()}><RotateCcw size={16} />Zentrieren</Button><Button variant="outline" size="icon" aria-label="Heranzoomen" disabled={!ready || arBusy} onClick={() => controls.current?.zoom(.85)}><Plus size={16} /></Button><Button variant="outline" size="icon" aria-label="Herauszoomen" disabled={!ready || arBusy} onClick={() => controls.current?.zoom(1.15)}><Minus size={16} /></Button><Button variant="outline" disabled={!ready || arActive || arBusy} onClick={() => { setMoving(false); controls.current?.focus(node.id); }}><Focus size={16} />Auswahl fokussieren</Button><Button className="ar-button" disabled={!arSupported || !ready || arBusy} onClick={startAR}><Scan size={16} />{arBusy ? 'AR wird umgestellt …' : arActive ? 'AR beenden' : 'Kamera-AR platzieren'}</Button></div>}
        {arBusy && <Button variant="outline" onClick={() => { controls.current?.cancelAR(); setARStatus('AR-Abbruch angefordert. Ein noch offener Browserdialog kann geschlossen werden.'); }}>AR-Start abbrechen</Button>}
        <p className="ar-status" role="status">{mode === '3d' ? 'Ziehen dreht, zwei Finger zoomen. Die Drehung ist eine Ansichtsbewegung, keine Agentenaktivität. ' : 'Knoten auswählen; Pfeile, Pos1 und Ende navigieren. Beziehungen stehen mit ihrer Bedeutung im Detailbereich. '}{arStatus}</p>
        <div className="space-node-list" aria-label="Gleichwertige Knotenliste">{visible.nodes.map(n => <button key={n.id} aria-pressed={n.id === node.id} onClick={() => select(n.id)}>{n.title}<small>{kindNames[n.kind]}</small></button>)}</div>
        <div className="space-ar-overlay" hidden={!arActive && !arBusy}><strong>{node.title}</strong>{arBusy ? <><p role="status">Kamera-AR wird vorbereitet. Du kannst den Start abbrechen.</p><div className="actions-row"><Button onClick={() => controls.current?.cancelAR()}>Start abbrechen</Button></div></> : <><p role="status">{placementStatusNames[placement]}</p><div className="actions-row"><Button disabled={placement !== 'surface-found' || arBusy} onClick={() => controls.current?.placeAR()}><Focus size={16} />Hier platzieren</Button><Button variant="outline" disabled={arBusy} onClick={() => controls.current?.centerAR()}>Neu platzieren</Button><Button variant="outline" onClick={() => controls.current?.zoom(.85)}>Größer</Button><Button variant="outline" onClick={() => controls.current?.zoom(1.15)}>Kleiner</Button><Button disabled={arBusy} onClick={startAR}>AR beenden</Button></div></>}</div>
      </section>
      <aside className="panel node-inspector" aria-label="Knotendetails"><span className="eyebrow">AUSGEWÄHLTER KNOTEN · {kindNames[node.kind]}</span><div className="node-mark" style={{ color: '#' + node.color.toString(16) }}><Box size={36} /></div><h2>{node.title}</h2><span className="pill neutral">{originNames[node.origin]}</span><p>{node.detail}</p><Button onClick={openNode}>{node.kind === 'lesson' ? 'Nächste Lernaktion öffnen' : 'Passenden Arbeitsbereich öffnen'}<ArrowUpRight size={16} /></Button><Button variant="outline" onClick={share}><Link2 size={16} />Auswahl-Link kopieren</Button>
        <div className="space-relations"><h3>{relations.length} Beziehungen</h3>{relations.map(e => { const other = graph.nodes.find(n => n.id === (e.from === node.id ? e.to : e.from)); return other && <button key={e.id} onClick={() => { setSelected(other.id); setScope('all'); setEdge(e.id); setGuide(null); }}><strong>{e.from === node.id ? '→' : '←'} {other.title}</strong><span>{relationNames[e.relation] || e.relation} · {e.origin === 'plan' ? 'Planungsmodell' : known ? 'App-Zuordnung' : 'Vorlage'}</span></button>; })}{!relations.length && <p>Für diesen Knoten ist keine Beziehung gespeichert.</p>}</div>
        <p className="short-note">App-Zuordnungen belegen Verantwortung im gespeicherten Stand. Geplante Kanten belegen keine Verbindung oder laufende Kommunikation. Quellen behalten ihren Snapshot-Status.</p>
      </aside>
    </section>
    <section className="panel space-guide" aria-label="Geführter Agentenablauf"><div className="panel-title"><div><span className="eyebrow">GEFÜHRTE ERKLÄRUNG · KEINE AUSFÜHRUNG</span><h2>Wie ein Auftrag durchs Team läuft</h2></div><Route size={24} /></div><div className="space-guide-steps">{guidedSteps.map((s, i) => <button key={s.title} aria-current={guide === i ? 'step' : undefined} onClick={() => chooseGuide(i)}>{s.title}</button>)}</div>{guide === null ? <p>Wähle einen Schritt. Die Karte zeigt die passende Zuständigkeit und geplante Übergabe.</p> : <div className="space-guide-detail" role="status"><h3>{guidedSteps[guide].title}</h3><p>{guidedSteps[guide].text}</p><strong>Erwartetes Ergebnis: {guidedSteps[guide].output}</strong><div className="actions-row"><Button variant="outline" disabled={guide === 0} onClick={() => chooseGuide(guide - 1)}><ArrowLeft size={16} />Zurück</Button><Button disabled={guide === guidedSteps.length - 1} onClick={() => chooseGuide(guide + 1)}>Nächster Schritt<ArrowRight size={16} /></Button><Button variant="outline" onClick={() => academy.current?.scrollIntoView({ behavior: 'instant', block: 'start' })}>Mit einem Fall üben</Button></div></div>}</section>
    <div ref={academy}><AcademyPanel controls={academyControls} {...props} work={work} known={known} go={go} onExplore={exploreLesson} /></div>
  </div>;
}

function StructuralMap({ graph, selected, highlighted, onSelect }: { graph: SpaceGraph; selected: string; highlighted: string | null; onSelect: (id: string) => void }) {
  const board = useRef<HTMLDivElement>(null), buttons = useRef(new Map<string, HTMLButtonElement>());
  const [points, setPoints] = useState<Record<string, { x: number; y: number }>>({});
  useEffect(() => {
    const root = board.current; if (!root) return;
    const measure = () => { const bounds = root.getBoundingClientRect(); const next: Record<string, { x: number; y: number }> = {}; for (const n of graph.nodes) { const rect = buttons.current.get(n.id)?.getBoundingClientRect(); if (rect) next[n.id] = { x: rect.x - bounds.x + rect.width / 2, y: rect.y - bounds.y + rect.height / 2 }; } setPoints(next); };
    const observer = new ResizeObserver(measure); observer.observe(root); for (const b of buttons.current.values()) observer.observe(b); measure(); return () => observer.disconnect();
  }, [graph]);
  const navigate = (e: KeyboardEvent, index: number) => {
    const columns = board.current ? getComputedStyle(board.current).gridTemplateColumns.split(' ').filter(Boolean).length : 1;
    let next = index;
    if (e.key === 'ArrowRight') next = index + 1;
    else if (e.key === 'ArrowDown') next = index + columns;
    else if (e.key === 'ArrowLeft') next = index - 1;
    else if (e.key === 'ArrowUp') next = index - columns;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = graph.nodes.length - 1;
    else return;
    e.preventDefault(); const id = graph.nodes[Math.max(0, Math.min(graph.nodes.length - 1, next))].id;
    buttons.current.get(id)?.focus(); onSelect(id);
  };
  return <div className="space-map-scroll"><div className="space-map-board" ref={board} aria-label="Semantische 2D-Struktur"><svg className="space-map-edges" aria-hidden="true"><defs><marker id="space-edge-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker></defs>{graph.edges.filter(e => e.id === highlighted || e.from === selected || e.to === selected).map(e => { const a = points[e.from], b = points[e.to]; return a && b && <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={e.origin + (e.id === highlighted ? ' highlighted' : '')} markerEnd="url(#space-edge-arrow)" />; })}</svg>{graph.nodes.map((n, i) => <button key={n.id} ref={el => { if (el) buttons.current.set(n.id, el); else buttons.current.delete(n.id); }} className={'space-map-node origin-' + n.origin} aria-pressed={n.id === selected} onClick={() => onSelect(n.id)} onKeyDown={e => navigate(e, i)}><span>{n.kind === 'agent' ? '●' : '□'} {kindNames[n.kind]}</span><strong>{n.title}</strong><small>{originNames[n.origin]}</small></button>)}</div></div>;
}
