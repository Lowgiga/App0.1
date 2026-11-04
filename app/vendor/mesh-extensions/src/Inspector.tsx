import React from 'react';
import type { ExplorerGraph, JsonValue, NavigateTarget, PrepareIntent } from './model.ts';
import { navigationFor, preparationFor, relationNames } from './model.ts';
import type { SceneSelection } from './view.ts';
const names: Record<string, string> = { id: 'ID', title: 'Titel', goal: 'Ziel', scope: 'Umfang', owner: 'Verantwortung', reviewer: 'Gegenprüfung', stage: 'Phase', status: 'Status', evidence: 'Beleg', reviewed: 'Review dokumentiert', priority: 'Priorität', acceptance: 'Abnahmekriterium', checkpoint: 'Checkpoint', output: 'Ergebnis', createdAt: 'Erstellt', deadlineAt: 'Termin', file: 'Quellendatei', observedAt: 'Quellenstand', dependencies: 'Abhängigkeiten', taskIds: 'Aufgaben', sourceIds: 'Quellen', roomId: 'Raum', neuro_profile: 'Berechnete UI-Gewichte' };
const readable = (value: JsonValue): string => value === null ? 'Unbekannt' : value === '' ? 'Nicht dokumentiert' : typeof value === 'boolean' ? (value ? 'Ja' : 'Nein') : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
export type InspectorProps = {
    graph: ExplorerGraph;
    scene: SceneSelection;
    selectedId: string | null;
    onSelect: (id: string) => void;
    onNavigate?: (target: NavigateTarget) => void | Promise<void>;
    onPrepare?: (intent: PrepareIntent) => void | Promise<void>;
    run: (action: () => void | Promise<void>) => void;
    pending: boolean;
};
export function Inspector({ graph, scene, selectedId, onSelect, onNavigate, onPrepare, run, pending }: InspectorProps) {
    const node = scene.selected;
    const incident = node ? graph.edges.filter(e => e.from === node.id || e.to === node.id) : [];
    const prepare = node ? preparationFor(node, graph.updatedAt) : null;
    const missing = node ? graph.unresolved.filter(e => e.from === node.id || e.to === node.id) : [];
    return <aside className="mesh-inspector" data-inspector data-selected-id={selectedId ?? ''} aria-label="Knoten-Inspector"><h2>Inspector</h2>{!node ? <p>{selectedId ? 'Auswahl ist nicht im aktuellen Datenstand vorhanden.' : 'Knoten auf der Karte oder in der Liste auswählen.'}</p> : <>
 <h3>{node.title}</h3>{scene.selectionState === 'filtered' && <p role="status">Auswahl durch Filter ausgeblendet. Details bleiben erhalten.</p>}
 <p>{node.detail}</p><dl className="mesh-provenance"><dt>Herkunft</dt><dd>{node.provenance.kind === 'external-snapshot' ? 'Externer Quellenstand' : 'Eigener App-Datenstand'}</dd><dt>Stand</dt><dd>{node.provenance.observedAt ?? 'Unbekannt'}</dd><dt>Referenz</dt><dd>{node.provenance.reference}</dd></dl>
 <div className="mesh-actions"><button data-action="navigate" disabled={!onNavigate || pending} onClick={() => onNavigate && run(() => onNavigate(navigationFor(node)))}>Im Fachbereich öffnen</button>{prepare && <button data-action="prepare" disabled={!onPrepare || pending} onClick={() => onPrepare && run(() => onPrepare(prepare))}>Belegprüfung vorbereiten</button>}</div><p className="mesh-muted">Vorbereiten übergibt einen Entwurf an die App. Kein automatischer Schreibzugriff.</p>
 <h3>Beziehungen ({incident.length})</h3>{incident.length === 0 ? <p>Keine erfassten Beziehungen</p> : <ul className="mesh-relations">{incident.map(e => { const out = e.from === node.id; const other = graph.nodes.find(n => n.id === (out ? e.to : e.from)); return <li key={e.id}><span>{out ? '→' : '←'} {relationNames[e.relation]}</span> <button onClick={() => other && onSelect(other.id)}>{other?.title ?? 'Unbekannte Referenz'}</button></li>; })}</ul>}
 {missing.length > 0 && <p role="status">{missing.length} Beziehungen verweisen auf ausgeblendete oder fehlende Daten.</p>}
 <details open><summary>Erfasste Attribute</summary><dl className="mesh-attributes">{Object.entries(node.attributes).map(([key, value]) => <React.Fragment key={key}><dt>{names[key] ?? key}</dt><dd>{readable(value)}</dd></React.Fragment>)}</dl></details>
 </>}</aside>;
}
