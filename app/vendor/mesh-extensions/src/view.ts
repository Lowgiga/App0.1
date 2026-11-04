import { z } from 'zod';
import type { ExplorerGraph } from './model.ts';
const unique = <T,>(a: T[]) => new Set(a).size === a.length;
export const configSchema = z.object({
    version: z.literal(1), layout: z.enum(['network', 'workflow', 'evidence']), renderer: z.enum(['svg', 'three']), selectedId: z.string().min(1).max(180).nullable(),
    filters: z.object({ query: z.string().max(200), kinds: z.array(z.enum(['agent', 'mission', 'task', 'room', 'source'])).max(5).refine(unique), origins: z.array(z.enum(['own', 'external'])).max(2).refine(unique) }).strict(),
    visualStyle: z.enum(['solid', 'hologram']), labels: z.enum(['none', 'selected', 'all']), quality: z.enum(['low', 'balanced', 'high']), reducedMotion: z.boolean(), highlightRelations: z.boolean(),
    perspective: z.enum(['front', 'isometric', 'top']), mode: z.enum(['work', 'focus', 'presentation']),
    // Additive V1 field: previously saved views remain immediate on restore.
    transitions: z.enum(['off', 'brief', 'smooth']).default('off'),
}).strict();
export type ViewConfig = z.infer<typeof configSchema>;
export type ViewConfigInput = z.input<typeof configSchema>;
export type LayoutName = ViewConfig['layout'];
export function defaultConfig(): ViewConfig { return { version: 1, layout: 'network', renderer: 'svg', selectedId: null, filters: { query: '', kinds: ['agent', 'mission', 'task', 'room', 'source'], origins: ['own', 'external'] }, visualStyle: 'solid', labels: 'selected', quality: 'balanced', reducedMotion: true, highlightRelations: true, perspective: 'isometric', mode: 'work', transitions: 'off' }; }
export function parseConfig(value: unknown): ViewConfig { return configSchema.parse(typeof value === 'string' ? JSON.parse(value) : value); }
export function serializeConfig(value: ViewConfig, options: { legacyV1?: boolean } = {}): string {
    const parsed = parseConfig(value);
    if (options.legacyV1) { const { transitions: _transitions, ...legacy } = parsed; return JSON.stringify(legacy, null, 2); }
    return JSON.stringify(parsed, null, 2);
}
export function updateConfig(current: ViewConfig, patch: Partial<ViewConfig>): ViewConfig { return parseConfig({ ...current, ...patch }); }
export function limitsFor(quality: ViewConfig['quality']) { return { low: { nodes: 60, edges: 120, pixelRatio: 1, segments: 8 }, balanced: { nodes: 160, edges: 360, pixelRatio: 1.5, segments: 12 }, high: { nodes: 320, edges: 700, pixelRatio: 2, segments: 16 } }[quality]; }
export function selectScene(graph: ExplorerGraph, config: ViewConfig) {
    const query = config.filters.query.trim().toLocaleLowerCase('de');
    const filtered = graph.nodes.filter(n => config.filters.kinds.includes(n.kind) && config.filters.origins.includes(n.origin) && (!query || [n.title, n.detail, n.entityId, n.status ?? ''].join(' ').toLocaleLowerCase('de').includes(query)));
    const selected = graph.nodes.find(n => n.id === config.selectedId) ?? null;
    const filteredIds = new Set(filtered.map(n => n.id));
    const selectionState = !config.selectedId ? 'none' : !selected ? 'missing' : filteredIds.has(selected.id) ? 'visible' : 'filtered';
    const limits = limitsFor(config.quality);
    const neighbors = new Set([config.selectedId, ...graph.edges.flatMap(e => e.from === config.selectedId ? [e.to] : e.to === config.selectedId ? [e.from] : [])]);
    const focused = config.mode === 'focus' && selected && filteredIds.has(selected.id) ? filtered.filter(n => neighbors.has(n.id)) : filtered;
    const focusedIds = new Set(focused.map(n => n.id));
    const ordered = [...focused].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    if (selected && filteredIds.has(selected.id)) {
        const index = ordered.findIndex(n => n.id === selected.id);
        ordered.splice(index, 1);
        ordered.unshift(selected);
    }
    const nodes = ordered.slice(0, limits.nodes);
    const ids = new Set(nodes.map(n => n.id));
    const allFilteredEdges = graph.edges.filter(e => focusedIds.has(e.from) && focusedIds.has(e.to));
    const candidates = allFilteredEdges.filter(e => ids.has(e.from) && ids.has(e.to)).sort((a, b) => { const aa = a.from === config.selectedId || a.to === config.selectedId; const bb = b.from === config.selectedId || b.to === config.selectedId; return Number(bb) - Number(aa) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
    const edges = candidates.slice(0, limits.edges);
    return { nodes, edges, filtered, selected, selectionState, focusedOutNodes: filtered.length - focused.length, omittedNodes: focused.length - nodes.length, omittedEdges: allFilteredEdges.length - edges.length };
}
export type SceneSelection = ReturnType<typeof selectScene>;
