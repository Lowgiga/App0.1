import { buildLearningLevels, learningStatusNames } from './learning-levels.ts';
import type { WorkState } from './work-contract.ts';
import { buildMissionGraph, type GraphNode, type MapSource } from './intelligence.ts';

export type SpaceKind = GraphNode['kind'] | 'system' | 'lesson';
export type SpaceOrigin = 'own' | 'snapshot' | 'plan' | 'template';
export type SpaceNode = Omit<GraphNode, 'kind' | 'origin'> & { kind: SpaceKind; origin: SpaceOrigin; color: number; position: [number, number, number] };
export type SpaceEdge = { id: string; from: string; to: string; relation: string; origin: 'own' | 'plan' | 'template' };
export type SpaceGraph = { nodes: SpaceNode[]; edges: SpaceEdge[] };
export type SpaceScope = 'team' | 'missions' | 'learning' | 'all';
export const kindNames: Record<SpaceKind, string> = { agent: 'Agent', mission: 'Mission', task: 'Aufgabe', room: 'Missionraum', source: 'Quelle', system: 'System', lesson: 'Lernlevel' };
export const originNames: Record<SpaceOrigin, string> = { own: 'Eigener App-Stand', snapshot: 'Quellen-Snapshot', plan: 'Geplant / ungeprüft', template: 'Vorlage / Stand unbekannt' };
export const relationNames: Record<string, string> = { owns: 'verantwortet', reviews: 'prüft', 'requests-review': 'gibt zur Gegenprüfung', 'depends-on': 'benötigt', reads: 'liest', 'supplies-context': 'liefert Kontext', delegates: 'übergibt an', integrates: 'Anschluss geplant', 'recommended-before': 'empfohlen vor' };
const colors: Record<SpaceKind, number> = { agent: 0xc7efa0, mission: 0x8bddd0, task: 0xffd092, room: 0xb8c7ff, source: 0xb3e8ff, system: 0xcab8f4, lesson: 0xf3b4cf };

/** The spatial and 2D views share the existing semantic graph, never remote telemetry. */
export function buildSpaceGraph(work: WorkState, sources: MapSource[], known: boolean): SpaceGraph {
  const semantic = buildMissionGraph(work, sources);
  const counts = new Map<string, number>();
  const nodes: SpaceNode[] = semantic.nodes.map(n => {
    const i = counts.get(n.kind) || 0; counts.set(n.kind, i + 1);
    const lane = ['agent', 'mission', 'task', 'room', 'source'].indexOf(n.kind);
    return { ...n, origin: n.origin === 'external' ? 'snapshot' : known ? 'own' : 'template', color: colors[n.kind], position: [(i % 4 - 1.5) * 1.7, 2 - lane * 1.35, Math.floor(i / 4) * 1.4] };
  });
  nodes.push(...[
    ['github', 'GitHub', 'Code und Baseline · eigener Live-Adapter nicht verbunden'],
    ['make', 'Make', 'Automation · kein Lauf dieser App nachgewiesen'],
    ['hermes', 'Hermes', 'Geräte-Operator · kein Gerät dieser App verbunden'],
  ].map(([id, title, detail], i): SpaceNode => ({ id: 'system:' + id, entityId: id, title, detail, kind: 'system', origin: 'plan', color: colors.system, position: [(i - 1) * 2.2, -1, 1.4] })));
  const edges: SpaceEdge[] = semantic.edges.map(e => ({ ...e, origin: known ? 'own' : 'template' }));
  const plans = [['agent:zimt', 'agent:manus', 'delegates'], ['agent:manus', 'agent:junior', 'requests-review'], ['agent:junior', 'agent:zimt', 'supplies-context'], ['agent:codex', 'system:github', 'integrates'], ['agent:manus', 'system:make', 'integrates'], ['agent:zimt', 'system:hermes', 'integrates']];
  for (const [from, to, relation] of plans) edges.push({ id: `${from}/${relation}/${to}`, from, to, relation, origin: 'plan' });
  const levels = buildLearningLevels(work, known);
  for (const level of levels) {
    const i = level.number - 1;
    nodes.push({ id: 'lesson:' + level.id, entityId: level.id, title: `Level ${level.number} · ${level.title}`, kind: 'lesson', origin: known ? 'own' : 'template', color: colors.lesson, position: [(i % 3 - 1) * 2.6, 3.6 - Math.floor(i / 3) * 2, (i % 2) * 1.8 - .9], detail: `${learningStatusNames[level.status]}. Quiz: ${!known ? 'unbekannt' : level.quizSaved ? 'gespeichert' : 'offen'} · Übung: ${!known ? 'unbekannt' : level.practiceSaved ? 'dokumentiert' : 'offen'} · Transfer: ${!known ? 'unbekannt' : level.transferComplete ? 'in der App belegt' : 'offen'}. Nächster Schritt: ${level.nextAction.label}. Empfohlene Lernreihenfolge, keine Zugangssperre oder Zertifizierung.` });
    for (const before of level.recommended) edges.push({ id: `lesson:${before}/recommended-before/lesson:${level.id}`, from: 'lesson:' + before, to: 'lesson:' + level.id, relation: 'recommended-before', origin: 'plan' });
  }
  return { nodes, edges };
}

export function visibleSpaceGraph(graph: SpaceGraph, scope: SpaceScope, selectedId: string, isolate: boolean, limit = 32): SpaceGraph & { total: number } {
  const allowed = graph.nodes.filter(n => scope === 'learning' ? n.kind === 'lesson' : scope === 'all' || n.kind === 'agent' || (scope === 'team' ? n.kind === 'system' : n.kind === 'mission'));
  const neighbours = new Set(graph.edges.filter(e => e.from === selectedId || e.to === selectedId).flatMap(e => [e.from, e.to]));
  const pool = isolate ? allowed.filter(n => n.id === selectedId || neighbours.has(n.id)) : allowed;
  const selected = pool.find(n => n.id === selectedId);
  const ordered = selected ? [selected, ...pool.filter(n => n.id !== selectedId)] : pool;
  const ids = new Set(ordered.slice(0, Math.max(1, limit)).map(n => n.id));
  // Preserve semantic ordering and camera coordinates when selection changes.
  const nodes = pool.filter(n => ids.has(n.id));
  return { nodes, edges: graph.edges.filter(e => ids.has(e.from) && ids.has(e.to)), total: pool.length };
}

export const guidedSteps = [
  { node: 'agent:zimt', title: '1 · Auftrag klären', text: 'Zimt legt Ziel, Scope, Input und prüfbaren Abschluss fest. Noch ist nichts ausgeführt.', output: 'Mission + Akzeptanzkriterien', edge: null },
  { node: 'agent:manus', title: '2 · Gezielt übergeben', text: 'Manus erhält relevanten Kontext und einen konkreten Ergebnisauftrag. Der ganze Chat ist kein Ersatz für einen Hand-off.', output: 'Artefakt + Quellen + tatsächlich ausgeführte Prüfungen', edge: 'agent:zimt/delegates/agent:manus' },
  { node: 'agent:junior', title: '3 · Unabhängig prüfen', text: 'Junior prüft Behauptungen, Quellen, Randfälle und Akzeptanzkriterien. Grün ohne Beleg reicht nicht.', output: 'Priorisierte Findings + verbleibende Unsicherheit', edge: 'agent:manus/requests-review/agent:junior' },
  { node: 'agent:zimt', title: '4 · Ergebnis zusammenführen', text: 'Zimt führt Ergebnis und Review zusammen. Externe Ausführung braucht einen konkret geprüften Auftrag und den passenden Zugriff.', output: 'Ergebnis + Entscheidung + sicherer Fortsetzungspunkt', edge: 'agent:junior/supplies-context/agent:zimt' },
] as const;
