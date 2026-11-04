import { z } from 'zod';
import { contentDigest } from '../../upstream/lib/content-digest.ts';
import type { MeshTask, WorkState } from '../../upstream/lib/work-contract.ts';
import type { SpaceGraph, SpaceNode } from './space-model.ts';
import { learningMissionCandidates } from '../../upstream/lib/academy.ts';
import { agentIds } from '../../upstream/lib/work-constants.ts';

export const spatialLevels = [
  { id: 'orientation', title: '1 · Herkunft in 2D', goal: 'Einen Knoten auswählen und seinen Belegstatus korrekt einordnen.' },
  { id: 'relationship', title: '2 · Verbindung verfolgen', goal: 'Vom Start zum Ziel navigieren und die Bedeutung einer echten gespeicherten oder geplanten Beziehung benennen.' },
  { id: 'perspective', title: '3 · Tiefe & Kamera', goal: 'Eine Auswahl in echtem 3D fokussieren oder die gleichwertige 2D-Alternative nutzen. Browser-3D und Kamera-AR unterscheiden.' },
  { id: 'transfer', title: '4 · In Arbeit übertragen', goal: 'Aus der Erkundung einen begründeten, offenen Prüfauftrag erzeugen.' },
] as const;
export type SpatialLevelId = typeof spatialLevels[number]['id'];
export const spatialPrefix = '[Mesh Spatial Level · v1]\n';
const recordContract = z.object({
  version: z.literal(1), level: z.enum(['orientation', 'relationship', 'perspective', 'transfer']),
  provenance: z.literal('personal-practice'), observedAt: z.string().datetime(), graphDigest: z.string().regex(/^[0-9a-f]{64}$/),
  path: z.enum(['2d', '3d', 'transfer']), nodeId: z.string().min(1).max(200),
  detail: z.string().min(12).max(2000), taskId: z.string().uuid().nullable(), missionId: z.string().uuid().nullable(),
}).strict().superRefine((r, ctx) => {
  if ((r.level === 'transfer') !== (r.taskId !== null) || (r.level !== 'transfer' && r.missionId !== null)) ctx.addIssue({ code: 'custom', message: 'Lernlevel und Transferreferenzen passen nicht zusammen.' });
  if ((r.level === 'perspective' && !['2d', '3d'].includes(r.path)) || (r.level === 'transfer' && r.path !== 'transfer') || (['orientation', 'relationship'].includes(r.level) && r.path !== '2d')) ctx.addIssue({ code: 'custom', message: 'Lernpfad passt nicht zum Level.' });
});
export type SpatialRecord = z.infer<typeof recordContract>;
export type SpatialAttempt =
  | { level: 'orientation'; nodeId: string; origin: SpaceNode['origin']; mode: '2d' | '3d' }
  | { level: 'relationship'; edgeId: string; fromVisited: string; nodeId: string; meaning: string; mode: '2d' | '3d' }
  | { level: 'perspective'; nodeId: string; mode: '2d' | '3d'; realFrame: boolean; focusedNodeId: string | null; cameraAnswer: string; reflection: string }
  | { level: 'transfer'; nodeId: string; reflection: string; owner: MeshTask['owner']; missionId: string };

export const spatialGraphDigest = (graph: SpaceGraph) => contentDigest(JSON.stringify({ nodes: graph.nodes.map(n => [n.id, n.origin, n.kind]), edges: graph.edges.map(e => [e.id, e.from, e.to, e.relation, e.origin]) })).replace(/^sha256:/, '');
/** These are documented personal exercises, not signed execution/hardware evidence. */
export function spatialProgress(work: WorkState) {
  const records = new Map<SpatialLevelId, SpatialRecord>(); let invalidRecords = 0;
  for (const note of work.notes.filter(n => n.text.startsWith(spatialPrefix))) {
    try {
      if (note.text.length > 4500) throw new Error('Record too large');
      const record = recordContract.parse(JSON.parse(note.text.slice(spatialPrefix.length)));
      if (record.observedAt !== note.createdAt || (record.taskId && !work.tasks.some(t => t.id === record.taskId && t.category === 'Lernen'))) throw new Error('Record reference missing');
      const older = records.get(record.level);
      if (!older || record.observedAt > older.observedAt) records.set(record.level, record);
    } catch { invalidRecords++; }
  }
  // A later level cannot replace a missing prerequisite imported from another state.
  let completed = 0;
  for (const level of spatialLevels) { if (!records.has(level.id)) break; completed++; }
  const spatialXP = completed * 25, quizXP = Object.values(work.learning).filter(Boolean).length * 20;
  const totalXP = spatialXP + quizXP;
  const rank = totalXP >= 200 ? 'Mesh-Praktiker' : totalXP >= 125 ? 'Koordinator' : totalXP >= 50 ? 'Explorer' : 'Starter';
  return { completed, spatialXP, quizXP, totalXP, rank, records, invalidRecords };
}

/** One CAS write contains both the transfer task and its note/mission reference. */
export function completeSpatialLevel(work: WorkState, graph: SpaceGraph, attempt: SpatialAttempt, noteId: string, taskId: string, now = new Date()): WorkState {
  const progress = spatialProgress(work), index = spatialLevels.findIndex(l => l.id === attempt.level);
  if (index < 0 || index !== progress.completed) throw new Error('Schließe zuerst die offenen vorherigen Levels ab. Gespeicherte Levels vergeben keine weiteren XP.');
  if (work.notes.length >= 100) throw new Error('Das Notizlimit ist erreicht. Exportiere deinen Stand und verwalte vorhandene Notizen.');
  const uuid = z.string().uuid(); uuid.parse(noteId); if (attempt.level === 'transfer') uuid.parse(taskId);
  const existing = new Set([...work.notes, ...work.tasks, ...work.rooms, ...work.command.missions, ...work.command.approvals].map(v => v.id));
  if (existing.has(noteId) || (attempt.level === 'transfer' && (noteId === taskId || existing.has(taskId)))) throw new Error('Neue Lerndaten brauchen eindeutige IDs.');
  const node = graph.nodes.find(n => n.id === attempt.nodeId);
  if (!node) throw new Error('Die ausgewählte Entität ist nicht mehr im aktuellen Netzwerk.');
  let detail: string, path: SpatialRecord['path'] = '2d', next = work;
  if (attempt.level === 'orientation') {
    if (attempt.mode !== '2d' || attempt.origin !== node.origin) throw new Error('Wähle den Knoten in 2D und ordne seine tatsächliche Herkunft ein.');
    detail = `${node.title}: Herkunft ${node.origin} korrekt eingeordnet. Eine App-Zuordnung oder geplante Verbindung ist kein externer Funktionsnachweis.`;
  } else if (attempt.level === 'relationship') {
    const edge = graph.edges.find(e => e.id === attempt.edgeId);
    if (attempt.mode !== '2d' || !edge || edge.from !== attempt.fromVisited || edge.to !== node.id || edge.relation !== attempt.meaning) throw new Error('Besuche zuerst den Start und anschließend das Ziel der gewählten Beziehung. Prüfe ihre tatsächliche Bedeutung in 2D.');
    detail = `${edge.from} → ${edge.to}: ${edge.relation}, Herkunft ${edge.origin}. Beide Endpunkte bewusst in 2D erkundet; geplante Kanten bleiben Planungsbeziehungen.`;
  } else if (attempt.level === 'perspective') {
    if (attempt.cameraAnswer !== 'immersive-ar') throw new Error('Eine normale 3D-Szene ist kein Kamerabild. Kamera-AR entsteht erst in einer freigegebenen WebXR- oder nativen ARCore-Sitzung.');
    if (attempt.reflection.trim().length < 20 || attempt.reflection.length > 1500) throw new Error('Begründe den Unterschied zwischen 3D-Ansicht und Kamera-AR mit mindestens 20 Zeichen.');
    if (attempt.mode === '3d' && (!attempt.realFrame || attempt.focusedNodeId !== node.id)) throw new Error('Die 3D-Szene muss wirklich bereit sein; fokussiere anschließend die aktuelle Auswahl. Oder nutze bewusst die 2D-Alternative.');
    path = attempt.mode;
    detail = `${node.title}: ${path === '3d' ? '3D-Renderer meldete einen gültigen Frame; Fokusbedienung ausgelöst.' : 'Gleichwertige 2D-Alternative bewusst verwendet; kein 3D- oder AR-Start behauptet.'} Eigene Begründung: ${attempt.reflection.trim()} Kein Kamerabild- oder Hardware-Abnahmenachweis.`;
  } else {
    if (attempt.reflection.trim().length < 20 || attempt.reflection.length > 900) throw new Error('Der konkrete Transferauftrag braucht eine Begründung mit 20–900 Zeichen.');
    if (!agentIds.includes(attempt.owner) || !work.profiles.some(p => p.id === attempt.owner)) throw new Error('Das verantwortliche App-Profil fehlt.');
    if (work.tasks.length >= 60) throw new Error('Das Aufgabenlimit ist erreicht.');
    if (attempt.missionId && !learningMissionCandidates(work).some(m => m.id === attempt.missionId)) throw new Error('Die Mission kann gerade keine neue Voraussetzung aufnehmen.');
    const task: MeshTask = { id: taskId, title: 'Mesh Praxis: 2D/3D und AR prüfen', category: 'Lernen', owner: attempt.owner, priority: 'P2', status: 'Offen', acceptance: `Auswahl ${node.title}: ${attempt.reflection.trim()} Herkunft und Beziehung belegen. Browser-3D, Kamera-AR und physisches Hologramm unterscheiden. Tatsächliche Prüfungen, Browser, Zeitpunkt und offene Grenzen dokumentieren; unabhängiges Review vor Abschluss.`, evidence: '', reviewed: false, dependencies: [], archived: false };
    next = { ...work, tasks: [...work.tasks, task], command: { ...work.command, missions: work.command.missions.map(m => m.id === attempt.missionId ? { ...m, taskIds: [...m.taskIds, taskId] } : m) } };
    path = 'transfer'; detail = `${node.title}: offener Prüfauftrag ${taskId}. ${attempt.reflection.trim()} Die Aufgabe startet keinen Worker und bestätigt keine erledigte Prüfung.`;
  }
  const record = recordContract.parse({ version: 1, level: attempt.level, provenance: 'personal-practice', observedAt: now.toISOString(), graphDigest: spatialGraphDigest(graph), path, nodeId: node.id, detail, taskId: attempt.level === 'transfer' ? taskId : null, missionId: attempt.level === 'transfer' ? attempt.missionId || null : null });
  return { ...next, notes: [{ id: noteId, createdAt: record.observedAt, text: spatialPrefix + JSON.stringify(record, null, 2) }, ...next.notes] };
}
