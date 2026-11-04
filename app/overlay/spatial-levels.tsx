'use client';
import {saveTextFile,copyWithFeedback,copyPlatformText} from '../src/platform/runtime';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Focus, Layers, Box, Save, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { createId } from '@/lib/ids';
import type { MeshTask, WorkState } from '@/lib/work-contract';
import { learningMissionCandidates } from '@/lib/academy';
import { originNames, relationNames, type SpaceGraph, type SpaceOrigin } from '@/lib/space-model';
import { completeSpatialLevel, spatialGraphDigest, spatialLevels, spatialProgress, type SpatialAttempt } from '@/lib/spatial-learning';

type Props = { work: WorkState; graph: SpaceGraph; selected: string; mode: '2d' | '3d'; ready: boolean; known: boolean; disabled: boolean; save: (w: WorkState) => Promise<boolean>; onExplore: (node: string, edge?: string) => void; onView: (mode: '2d' | '3d') => void; onFocus: (node: string) => boolean; go: (view: 'matrix') => void };
export default function SpatialLevels(p: Props) {
  const progress = useMemo(() => spatialProgress(p.work), [p.work]);
  const [index, setIndex] = useState(Math.min(progress.completed, 3)), [origin, setOrigin] = useState<SpaceOrigin | ''>('');
  const [edgeId, setEdgeId] = useState(p.graph.edges[0]?.id || ''), [fromVisited, setFromVisited] = useState(''), [meaning, setMeaning] = useState('');
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null), [cameraAnswer, setCameraAnswer] = useState(''), [reflection, setReflection] = useState('');
  const [owner, setOwner] = useState<MeshTask['owner']>('codex'), [missionId, setMissionId] = useState('');
  const [checked, setChecked] = useState<{ signature: string; noteId: string; taskId: string } | null>(null), [feedback, setFeedback] = useState('');
  const level = spatialLevels[index], node = p.graph.nodes.find(n => n.id === p.selected), edge = p.graph.edges.find(e => e.id === edgeId);
  const missionCandidates = learningMissionCandidates(p.work), invalidMission = !!missionId && !missionCandidates.some(m => m.id === missionId);
  const attempt: SpatialAttempt = level.id === 'orientation' ? { level: level.id, nodeId: p.selected, origin: origin as SpaceOrigin, mode: p.mode }
    : level.id === 'relationship' ? { level: level.id, nodeId: p.selected, edgeId, fromVisited, meaning, mode: p.mode }
      : level.id === 'perspective' ? { level: level.id, nodeId: p.selected, mode: p.mode, realFrame: p.ready, focusedNodeId, cameraAnswer, reflection }
        : { level: level.id, nodeId: p.selected, reflection, owner, missionId };
  const signature = JSON.stringify([attempt, spatialGraphDigest(p.graph)]), done = index < progress.completed, unlocked = index <= progress.completed;
  useEffect(() => { setChecked(null); setFeedback(''); }, [signature]);
  useEffect(() => { setFocusedNodeId(null); }, [p.selected, p.mode, p.ready]);
  const verify = () => {
    const noteId = createId(), taskId = createId();
    try { completeSpatialLevel(p.work, p.graph, attempt, noteId, taskId); setChecked({ signature, noteId, taskId }); setFeedback('Übung korrekt eingeordnet. Speichere jetzt bewusst den persönlichen Levelstand.'); }
    catch (error) { setChecked(null); setFeedback(error instanceof Error ? error.message : 'Übung ist noch nicht vollständig.'); }
  };
  const persist = async () => {
    if (!checked || checked.signature !== signature || !p.known || p.disabled) return;
    try { const next = completeSpatialLevel(p.work, p.graph, attempt, checked.noteId, checked.taskId); if (await p.save(next)) { setChecked(null); toast.success(level.id === 'transfer' ? 'Level und offener Prüfauftrag gemeinsam gespeichert.' : 'Persönlicher Levelstand gespeichert · 25 XP.'); } }
    catch (error) { setFeedback(error instanceof Error ? error.message : 'Speicherung fehlgeschlagen. Dein Entwurf bleibt erhalten.'); }
  };
  const displayName = (id: string) => p.graph.nodes.find(n => n.id === id)?.title || id;
  return <section className="panel spatial-levels" aria-labelledby="spatial-level-title">
    <span className="eyebrow">PRAXISLEVEL · 2D → BEZIEHUNG → TIEFE → TRANSFER</span><h2 id="spatial-level-title">Dein Netzwerk verstehen und anwenden.</h2>
    <div className="spatial-level-progress"><strong>{p.known ? progress.totalXP + ' XP · ' + progress.rank : 'Stand unbekannt'}</strong><p>{p.known ? `${progress.quizXP} Quiz-XP + ${progress.spatialXP} Praxis-XP · ${progress.completed}/4 Praxislevel gespeichert` : 'Du kannst üben. Persönliches Speichern braucht einen geladenen Arbeitsstand.'}</p><Progress value={p.known ? progress.completed * 25 : 0} aria-label="Gespeicherte räumliche Praxislevel" /></div>
    <nav className="academy-phase-nav" aria-label="Räumliche Lernlevels">{spatialLevels.map((l, i) => <button key={l.id} disabled={i > progress.completed || !p.known} aria-pressed={i === index} onClick={() => { setIndex(i); setReflection(''); setChecked(null); setFeedback(''); }}>{i < progress.completed && <CheckCircle2 size={17} aria-hidden="true" />}{l.title}</button>)}</nav>
    <h3>{level.title}</h3><p>{level.goal}</p>
    {done ? <div className="academy-saved"><strong>Persönliche Übung gespeichert · 25 Praxis-XP</strong><p>{progress.records.get(level.id)?.detail}</p><p className="short-note">{progress.records.get(level.id)?.observedAt} · Lernpfad {progress.records.get(level.id)?.path}. Eine gespeicherte Übung bestätigt keine externe Agenten- oder Kamerafunktion.</p>{index < 3 ? <Button onClick={() => setIndex(index + 1)}>Nächstes Praxislevel<ArrowRight size={16} /></Button> : <Button onClick={() => p.go('matrix')}>Prüfauftrag in der Matrix öffnen<Target size={16} /></Button>}</div> : <>
      <label className="tuning-field"><span>Aktuelle Übungsauswahl</span><NativeSelect value={p.selected} aria-label="Übungsknoten" disabled={!unlocked} onChange={e => p.onExplore(e.target.value)}>{p.graph.nodes.map(n => <NativeSelectOption key={n.id} value={n.id}>{n.title}</NativeSelectOption>)}</NativeSelect><small>{node?.title} · {p.mode === '3d' ? p.ready ? '3D-Frame bereit' : '3D wird geladen' : '2D-Struktur'}</small></label>
      {level.id === 'orientation' && <><Button variant="outline" onClick={() => p.onView('2d')}><Layers size={16} />2D-Übung öffnen</Button><label className="tuning-field"><span>Welchen Herkunftsstatus hat deine Auswahl?</span><NativeSelect value={origin} aria-label="Herkunft einordnen" onChange={e => setOrigin(e.target.value as SpaceOrigin)}><NativeSelectOption value="">Bewusst einordnen</NativeSelectOption>{Object.entries(originNames).map(([id, title]) => <NativeSelectOption value={id} key={id}>{title}</NativeSelectOption>)}</NativeSelect></label></>}
      {level.id === 'relationship' && <><label className="tuning-field"><span>Beziehung für die Übung</span><NativeSelect value={edgeId} aria-label="Übungsbeziehung" onChange={e => { setEdgeId(e.target.value); setFromVisited(''); setMeaning(''); }}><NativeSelectOption value="">Beziehung wählen</NativeSelectOption>{p.graph.edges.map(e => <NativeSelectOption value={e.id} key={e.id}>{displayName(e.from)} → {displayName(e.to)}</NativeSelectOption>)}</NativeSelect></label><div className="actions-row"><Button variant="outline" disabled={!edge} onClick={() => { if (edge) { p.onView('2d'); p.onExplore(edge.from, edge.id); setFromVisited(''); } }}>Start ansehen</Button><Button variant="outline" disabled={!edge || p.mode !== '2d' || p.selected !== edge.from} onClick={() => { if (edge) { setFromVisited(edge.from); p.onExplore(edge.to, edge.id); } }}>Verbindung zum Ziel folgen<ArrowRight size={16} /></Button></div><p className="short-note">{fromVisited ? 'Start besucht: ' + displayName(fromVisited) : 'Besuche zuerst den Start.'} · {edge?.origin === 'plan' ? 'Geplante Beziehung; kein Live-Verkehr.' : 'Beziehung aus dem eigenen App-Stand.'}</p><label className="tuning-field"><span>Was bedeutet diese gerichtete Beziehung?</span><NativeSelect value={meaning} aria-label="Beziehung einordnen" onChange={e => setMeaning(e.target.value)}><NativeSelectOption value="">Bedeutung wählen</NativeSelectOption>{Object.entries(relationNames).map(([id, title]) => <NativeSelectOption value={id} key={id}>{title}</NativeSelectOption>)}</NativeSelect></label></>}
      {level.id === 'perspective' && <><div className="actions-row"><Button variant="outline" onClick={() => p.onView('3d')}><Box size={16} />3D-Übung öffnen</Button><Button variant="outline" onClick={() => p.onView('2d')}><Layers size={16} />2D-Alternative verwenden</Button><Button variant="outline" disabled={p.mode !== '3d' || !p.ready} onClick={() => { if (p.onFocus(p.selected)) setFocusedNodeId(p.selected); }}><Focus size={16} />Übungsauswahl in 3D fokussieren</Button></div><p className="short-note">{p.mode === '3d' ? focusedNodeId === p.selected ? 'Aktuelle Auswahl in der bereitgestellten 3D-Szene fokussiert.' : 'Warte auf den gültigen 3D-Frame und fokussiere die Auswahl.' : '2D-Alternative: gleiche Beziehung und Herkunft ohne Grafik- oder Kamerapflicht.'}</p><label className="tuning-field"><span>Wann entsteht eine Kamera-AR-Darstellung?</span><NativeSelect value={cameraAnswer} aria-label="Kamera-AR einordnen" onChange={e => setCameraAnswer(e.target.value)}><NativeSelectOption value="">Antwort wählen</NativeSelectOption><NativeSelectOption value="browser-3d">Sobald ein 3D-Modell im Browser erscheint</NativeSelectOption><NativeSelectOption value="hologram">Wenn der Hologramm-Shader eingeschaltet wird</NativeSelectOption><NativeSelectOption value="immersive-ar">Erst mit freigegebener WebXR- oder nativer ARCore-Sitzung und Geräteunterstützung</NativeSelectOption></NativeSelect></label></>}
      {['perspective', 'transfer'].includes(level.id) && <label className="tuning-field"><span>{level.id === 'transfer' ? 'Was soll im echten Prüfauftrag untersucht werden?' : 'Deine Begründung zum Unterschied zwischen 3D und AR'} · mindestens 20 Zeichen</span><Textarea aria-label="Praxisbegründung" value={reflection} maxLength={level.id === 'transfer' ? 900 : 1200} onChange={e => setReflection(e.target.value)} /></label>}
      {level.id === 'transfer' && <div className="form-grid"><label className="tuning-field"><span>Verantwortliches App-Profil</span><NativeSelect value={owner} aria-label="Praxisauftrag Owner" onChange={e => setOwner(e.target.value as MeshTask['owner'])}>{p.work.profiles.map(a => <NativeSelectOption value={a.id} key={a.id}>{a.id} · {a.role}</NativeSelectOption>)}</NativeSelect></label><label className="tuning-field"><span>Optional als Missionsvoraussetzung</span><NativeSelect value={missionId} aria-label="Praxisauftrag Mission" onChange={e => setMissionId(e.target.value)}><NativeSelectOption value="">Nur Aufgabenmatrix</NativeSelectOption>{invalidMission && <NativeSelectOption value={missionId}>Veralteter Missionskontext</NativeSelectOption>}{missionCandidates.map(m => <NativeSelectOption value={m.id} key={m.id}>{m.title}</NativeSelectOption>)}</NativeSelect></label>{invalidMission && <div role="status"><p>Die gewählte Mission ist nicht mehr für neue Voraussetzungen verfügbar. Deine Begründung bleibt erhalten.</p><Button variant="outline" onClick={() => setMissionId('')}>Missionskontext entfernen</Button></div>}<p className="short-note">Es entsteht ein offener App-Auftrag. Kein Agent startet automatisch und kein Review wird als bestanden markiert.</p></div>}
      {feedback && <p role="status" className="lesson-feedback">{feedback}</p>}
      <div className="actions-row"><Button variant="outline" disabled={!p.known || p.disabled || !unlocked} onClick={verify}>Praxis prüfen</Button><Button disabled={!p.known || p.disabled || !checked || checked.signature !== signature || !unlocked} onClick={persist}><Save size={16} />{level.id === 'transfer' ? 'Level & Prüfauftrag speichern' : 'Praxislevel speichern'}</Button></div>
    </>}
    {!!progress.invalidRecords && <p role="status">{progress.invalidRecords} ältere oder ungültige Levelnotizen werden nicht als Abschluss gezählt. Der ursprüngliche Notiztext bleibt erhalten.</p>}
    <p className="short-note">25 Praxis-XP je einmalig gespeichertem Level, maximal 100. Deine bisherigen fünf Quizstände bleiben getrennt erhalten. 2D kann jedes Lernziel erreichen; AR und zusätzliche Rechte werden niemals durch XP freigeschaltet.</p>
  </section>;
}
