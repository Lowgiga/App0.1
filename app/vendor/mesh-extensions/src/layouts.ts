import type { ExplorerGraph, ExplorerNode } from './model.ts';
import type { LayoutName } from './view.ts';
export type Point3 = {
    x: number;
    y: number;
    z: number;
};
export type LayoutResult = {
    positions: Record<string, Point3>;
    lanes: {
        label: string;
        x: number;
        y: number;
    }[];
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
};
const KIND_ORDER = { agent: 0, room: 1, source: 2, mission: 3, task: 4 };
const STAGES = ['Created', 'Planned', 'Assigned', 'Working', 'Waiting', 'Blocked', 'Review', 'Approved', 'Done', 'Error'];
const NAMES = ['Erstellt', 'Geplant', 'Zugeordnet', 'In Arbeit', 'Wartet', 'Blockiert', 'Gegenprüfung', 'Abgenommen', 'Abgeschlossen', 'Fehler'];
export function layoutGraph(graph: Pick<ExplorerGraph, 'nodes' | 'edges'>, name: LayoutName): LayoutResult {
    const nodes = [...graph.nodes].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const positions: Record<string, Point3> = {};
    const lanes: LayoutResult['lanes'] = [];
    if (name === 'network') {
        const grouped = [...nodes].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        const radius = Math.max(220, grouped.length * 14);
        grouped.forEach((n, i) => { const theta = i / Math.max(1, grouped.length) * Math.PI * 2 - Math.PI / 2; positions[n.id] = { x: Math.round(Math.cos(theta) * radius), y: Math.round(Math.sin(theta) * radius), z: KIND_ORDER[n.kind] * 65 - 130 }; });
    }
    else {
        const dependencyMap = new Map(nodes.filter(n => n.kind === 'task').map(n => [n.id, graph.edges.filter(e => e.from === n.id && e.relation === 'depends-on' && e.to.startsWith('task:')).map(e => e.to)]));
        // Iterative relaxation bounded by graph size: cycles cannot recurse forever.
        const depth = new Map([...dependencyMap.keys()].map(id => [id, 0]));
        for (let i = 0; i < Math.min(nodes.length, 60); i++) {
            let changed = false;
            for (const [id, deps] of dependencyMap) {
                const next = Math.min(12, deps.length ? 1 + Math.max(...deps.map(d => depth.get(d) ?? 0)) : 0);
                if (next !== (depth.get(id) ?? 0)) {
                    depth.set(id, next);
                    changed = true;
                }
            }
            if (!changed)
                break;
        }
        const buckets = new Map<number, {
            label: string;
            nodes: ExplorerNode[];
        }>();
        for (const node of nodes) {
            let column: number;
            let label: string;
            if (name === 'evidence') {
                column = KIND_ORDER[node.kind] + (node.kind === 'task' ? (depth.get(node.id) ?? 0) : 0);
                label = node.kind === 'task' ? 'Abhängigkeitsebene ' + (depth.get(node.id) ?? 0) : { agent: 'Arbeitsprofile', room: 'Räume', source: 'Quellen', mission: 'Missionen' }[node.kind];
            }
            else if (node.kind === 'task' || node.kind === 'mission') {
                const mapped = node.kind === 'task' ? ({ 'Offen': 'Created', 'In Arbeit': 'Working', 'Blockiert': 'Blocked', 'Review': 'Review', 'Erledigt': 'Done' }[node.status ?? '']) : node.status;
                const stage = STAGES.indexOf(mapped ?? '');
                column = stage < 0 ? 0 : stage + 1;
                label = stage < 0 ? 'Status unbekannt' : NAMES[stage];
            }
            else {
                column = 11 + KIND_ORDER[node.kind];
                label = { agent: 'Arbeitsprofile', room: 'Räume', source: 'Quellen', mission: 'Missionen', task: 'Aufgaben' }[node.kind];
            }
            if (!buckets.has(column))
                buckets.set(column, { label, nodes: [] });
            buckets.get(column)!.nodes.push(node);
        }
        [...buckets].sort(([a], [b]) => a - b).forEach(([column, bucket], index) => { const x = index * 240; lanes.push({ label: bucket.label, x, y: -65 }); bucket.nodes.forEach((n, row) => { positions[n.id] = { x, y: row * 85, z: name === 'evidence' ? column * 40 : KIND_ORDER[n.kind] * 55 }; }); });
    }
    const pts = Object.values(positions);
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const x = Math.min(0, ...xs) - 110, y = Math.min(-65, ...ys) - 75;
    return { positions, lanes, bounds: { x, y, width: Math.max(1, ...xs) - x + 170, height: Math.max(1, ...ys) - y + 100 } };
}
