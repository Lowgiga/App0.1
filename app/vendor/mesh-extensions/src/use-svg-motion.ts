import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { LayoutResult } from './layouts.ts';
import type { SceneSelection, ViewConfig } from './view.ts';
import { browserFrameClock, createDemandTimeline, interpolateLayout, transitionDuration } from './motion.ts';
type SvgFrame = { layout: LayoutResult; emphasis: Record<string, { radius: number; opacity: number }> };

export function useSvgMotion(layout: LayoutResult, scene: SceneSelection, config: ViewConfig, host: RefObject<HTMLDivElement | null>) {
    const target = useMemo<SvgFrame>(() => {
        const related = new Set([config.selectedId, ...scene.edges.flatMap(edge => edge.from === config.selectedId ? [edge.to] : edge.to === config.selectedId ? [edge.from] : [])]);
        // Only interpolate the budgeted visible nodes, never the entire input graph.
        const positions = Object.fromEntries(scene.nodes.flatMap(node => layout.positions[node.id] ? [[node.id, layout.positions[node.id]]] : []));
        let bounds = layout.bounds;
        if (config.mode === 'focus' && Object.keys(positions).length) {
            const points = Object.values(positions), xs = points.map(point => point.x), ys = points.map(point => point.y);
            const x = Math.min(...xs) - 110, y = Math.min(...ys) - 75;
            bounds = { x, y, width: Math.max(...xs) - x + 170, height: Math.max(...ys) - y + 100 };
        }
        return { layout: { ...layout, positions, bounds }, emphasis: Object.fromEntries(scene.nodes.map(node => [node.id, { radius: config.selectedId === node.id ? 19 : 14, opacity: config.highlightRelations && config.selectedId && !related.has(node.id) ? .4 : 1 }])) };
    }, [layout, scene, config.selectedId, config.highlightRelations, config.mode]);
    const [frame, setFrame] = useState(target);
    const current = useRef(frame), latest = useRef(target);
    latest.current = target;
    const timeline = useRef<ReturnType<typeof createDemandTimeline> | null>(null);
    const previous = useRef({ layout: config.layout, mode: config.mode, selectedId: config.selectedId });
    const show = (value: SvgFrame) => { current.current = value; setFrame(value); };
    const stop = () => { timeline.current?.cancel(); const settled = latest.current; show(settled); return settled; };
    useLayoutEffect(() => {
        const element = host.current, owner = element?.ownerDocument, win = owner?.defaultView;
        if (!element || !owner || !win) return;
        timeline.current = createDemandTimeline(browserFrameClock(win));
        const scope = element.closest('.mesh-explorer') ?? element;
        const key = (event: Event) => { if ((event as KeyboardEvent).key === 'Escape') stop(); };
        const visibility = () => { if (owner.hidden) stop(); };
        scope.addEventListener('keydown', key); owner.addEventListener('visibilitychange', visibility);
        return () => { timeline.current?.dispose(); timeline.current = null; scope.removeEventListener('keydown', key); owner.removeEventListener('visibilitychange', visibility); };
    }, []);
    useLayoutEffect(() => {
        const before = previous.current;
        const changed = before.layout !== config.layout || before.mode !== config.mode || before.selectedId !== config.selectedId;
        previous.current = { layout: config.layout, mode: config.mode, selectedId: config.selectedId };
        const from = current.current;
        const duration = changed ? transitionDuration(config, { hidden: host.current?.ownerDocument.hidden }) : 0;
        if (!timeline.current) { show(target); return; }
        timeline.current.run(duration, progress => {
            if (progress === 1) { show(target); return; }
            const emphasis = Object.fromEntries(Object.entries(target.emphasis).map(([id, value]) => {
                const start = from.emphasis[id] ?? value;
                return [id, { radius: start.radius + (value.radius - start.radius) * progress, opacity: start.opacity + (value.opacity - start.opacity) * progress }];
            }));
            show({ layout: interpolateLayout(from.layout, target.layout, progress), emphasis });
        });
    }, [target, config.layout, config.mode, config.selectedId, config.transitions, config.reducedMotion, config.quality]);
    return { frame, stop };
}
