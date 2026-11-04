import { z } from 'zod';
import { buildMissionGraph, type GraphNode, type GraphEdge, type MapSource } from '../../../upstream/lib/intelligence.ts';
import { savedWorkContract, type WorkState } from '../../../upstream/lib/work-contract.ts';
import type { AppEvent } from '../../../upstream/lib/command-contract.ts';
export type NodeKind = GraphNode['kind'];
export type Origin = GraphNode['origin'];
export type Relation = GraphEdge['relation'];
export type JsonValue = string | number | boolean | null | JsonValue[] | {
    [key: string]: JsonValue;
};
export type SourceRecord = MapSource & {
    observedAt?: string | null;
};
export type ExplorerNode = GraphNode & {
    status: string | null;
    attributes: Readonly<Record<string, JsonValue>>;
    provenance: {
        kind: 'workspace-snapshot' | 'external-snapshot';
        observedAt: string | null;
        reference: string;
    };
};
export type ExplorerEvent = Pick<AppEvent, 'id' | 'sequence' | 'at' | 'kind' | 'title' | 'entityId' | 'origin'> & {
    nodeId: string | null;
};
export type ExplorerGraph = {
    availability: 'available' | 'unknown';
    sourcesAvailability: 'available' | 'unknown';
    updatedAt: string | null;
    nodes: readonly ExplorerNode[];
    edges: readonly GraphEdge[];
    unresolved: readonly GraphEdge[];
    omittedArchived: number;
    activity: {
        completeness: 'unknown';
        reconstructable: false;
        events: readonly ExplorerEvent[];
    };
};
const sourceSchema = z.object({ id: z.string().min(1).max(80), title: z.string().min(1).max(500), status: z.string().max(300), file: z.string().max(1000), observedAt: z.string().datetime().nullable().optional() });
const sourcesSchema = z.array(sourceSchema).max(500).refine(s => new Set(s.map(x => x.id)).size === s.length, 'Source IDs must be unique');
const sorted = <T extends {
    id: string;
}>(items: T[]) => items.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
/** Read-only projection. No event replay, writes, defaults for unavailable state, or new domain entities. */
export function adaptWorkState(input: WorkState | null, sources: readonly SourceRecord[] | null): ExplorerGraph {
    if (input === null)
        return { availability: 'unknown', sourcesAvailability: sources === null ? 'unknown' : 'available', updatedAt: null, nodes: [], edges: [], unresolved: [], omittedArchived: 0, activity: { completeness: 'unknown', reconstructable: false, events: [] } };
    const work = savedWorkContract.parse(input);
    const checkedSources = sourcesSchema.parse(sources ?? []);
    const base = buildMissionGraph(work, checkedSources);
    const records = new Map<string, Record<string, JsonValue>>();
    for (const [kind, values] of [['agent', work.profiles], ['task', work.tasks], ['room', work.rooms], ['mission', work.command.missions], ['source', checkedSources]] as const) {
        for (const value of values)
            records.set(kind + ':' + value.id, JSON.parse(JSON.stringify(value)) as Record<string, JsonValue>);
    }
    const nodes = sorted(base.nodes.map(n => { const attrs = records.get(n.id)!; return { ...n, detail: n.kind === 'source' ? String(attrs.status) + ' · ' + (typeof attrs.observedAt === 'string' ? 'Quellenstand: ' + attrs.observedAt : 'Quellenstand unbekannt') + ' · ' + String(attrs.file) : n.detail, status: typeof (attrs.stage ?? attrs.status) === 'string' ? String(attrs.stage ?? attrs.status) : null, attributes: attrs, provenance: { kind: n.origin === 'external' ? 'external-snapshot' as const : 'workspace-snapshot' as const, observedAt: n.origin === 'external' ? (typeof attrs.observedAt === 'string' ? attrs.observedAt : null) : work.updatedAt, reference: n.origin === 'external' ? String(attrs.file) : n.kind + ':' + n.entityId } }; }));
    const ids = new Set(nodes.map(n => n.id));
    const unresolved: GraphEdge[] = [];
    const check = (from: string, to: string, relation: Relation) => { if (!ids.has(from) || !ids.has(to))
        unresolved.push({ id: from + '/' + relation + '/' + to, from, to, relation }); };
    for (const t of work.tasks.filter(t => !t.archived)) {
        check('agent:' + t.owner, 'task:' + t.id, 'owns');
        for (const d of t.dependencies)
            check('task:' + t.id, 'task:' + d, 'depends-on');
    }
    for (const r of work.rooms.filter(r => r.status !== 'Archiviert')) {
        check('agent:' + r.agent, 'room:' + r.id, 'owns');
        for (const s of r.sources)
            check('source:' + s, 'room:' + r.id, 'supplies-context');
    }
    for (const m of work.command.missions.filter(m => !m.archived)) {
        check('agent:' + m.owner, 'mission:' + m.id, 'owns');
        check('agent:' + m.reviewer, 'mission:' + m.id, 'reviews');
        for (const t of m.taskIds)
            check('mission:' + m.id, 'task:' + t, 'depends-on');
        for (const s of m.sourceIds)
            check('mission:' + m.id, 'source:' + s, 'reads');
        if (m.roomId)
            check('room:' + m.roomId, 'mission:' + m.id, 'supplies-context');
    }
    const events = work.command.events.map(e => { const prefix = e.kind.startsWith('mission-') ? 'mission' : e.kind === 'task-updated' ? 'task' : null; const id = prefix && e.entityId ? prefix + ':' + e.entityId : null; return { id: e.id, sequence: e.sequence, at: e.at, kind: e.kind, title: e.title, entityId: e.entityId, origin: e.origin, nodeId: id && ids.has(id) ? id : null }; }).sort((a, b) => b.sequence - a.sequence);
    return { availability: 'available', sourcesAvailability: sources === null ? 'unknown' : 'available', updatedAt: work.updatedAt, nodes, edges: sorted(base.edges), unresolved: sorted(unresolved), omittedArchived: work.tasks.filter(t => t.archived).length + work.rooms.filter(r => r.status === 'Archiviert').length + work.command.missions.filter(m => m.archived).length, activity: { completeness: 'unknown', reconstructable: false, events } };
}
export const kinds: readonly NodeKind[] = ['agent', 'mission', 'task', 'room', 'source'];
export const kindNames: Record<NodeKind, string> = { agent: 'Arbeitsprofile', mission: 'Missionen', task: 'Aufgaben', room: 'Räume', source: 'Quellen' };
export const relationNames: Record<Relation, string> = { owns: 'verantwortet', reviews: 'prüft', 'depends-on': 'benötigt', reads: 'liest', 'supplies-context': 'liefert Kontext für' };
export type NavigateTarget = {
    view: 'agents' | 'missions' | 'matrix' | 'chats' | 'evidence';
    entityId: string;
    nodeId: string;
    query: string;
};
export type PrepareIntent = {
    kind: 'review-evidence';
    entity: 'mission' | 'task';
    entityId: string;
    nodeId: string;
    expectedUpdatedAt: string | null;
};
export function navigationFor(node: ExplorerNode): NavigateTarget { const view = { agent: 'agents', mission: 'missions', task: 'matrix', room: 'chats', source: 'evidence' } as const; return { view: view[node.kind], entityId: node.entityId, nodeId: node.id, query: node.title }; }
export function preparationFor(node: ExplorerNode, updatedAt: string | null): PrepareIntent | null { return node.kind === 'mission' || node.kind === 'task' ? { kind: 'review-evidence', entity: node.kind, entityId: node.entityId, nodeId: node.id, expectedUpdatedAt: updatedAt } : null; }
