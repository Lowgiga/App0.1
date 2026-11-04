import type { ViewConfig } from './view.ts';
import type { LayoutResult } from './layouts.ts';

export type FrameClock = {
    now: () => number;
    request: (callback: (time: number) => void) => number;
    cancel: (id: number) => void;
};
export function browserFrameClock(win: Window): FrameClock {
    return { now: () => win.performance.now(), request: callback => win.requestAnimationFrame(callback), cancel: id => win.cancelAnimationFrame(id) };
}

/** One bounded visual transition. No completion action, recurring timer or idle RAF. */
export function createDemandTimeline(clock: FrameClock) {
    let pending: number | null = null;
    let generation = 0;
    let disposed = false;
    const cancel = () => { generation++; if (pending !== null) clock.cancel(pending); pending = null; };
    const run = (requestedDuration: number, frame: (progress: number) => void) => {
        cancel();
        if (disposed) return;
        const duration = Number.isFinite(requestedDuration) ? Math.max(0, Math.min(320, requestedDuration)) : 0;
        const token = generation;
        const start = clock.now();
        if (!duration) { frame(1); return; }
        frame(0);
        const step = (time: number) => {
            if (disposed || token !== generation) return;
            pending = null;
            const linear = Math.max(0, Math.min(1, (time - start) / duration));
            // Symmetric ease-in/out; deterministic endpoints and no overshoot.
            frame(linear * linear * (3 - 2 * linear));
            if (linear < 1 && !disposed && token === generation) pending = clock.request(step);
        };
        if (!disposed && token === generation) pending = clock.request(step);
    };
    return { run, cancel, dispose: () => { cancel(); disposed = true; } };
}

export function transitionDuration(config: ViewConfig, environment: { hidden?: boolean; systemReduced?: boolean } = {}): number {
    if (config.reducedMotion || environment.systemReduced || environment.hidden || config.quality === 'low' || config.transitions === 'off') return 0;
    return config.transitions === 'brief' ? 160 : config.quality === 'high' ? 320 : 240;
}
const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress;
export function interpolateLayout(from: LayoutResult, to: LayoutResult, progress: number): LayoutResult {
    if (progress >= 1) return to;
    const positions = Object.fromEntries(Object.entries(to.positions).map(([id, point]) => {
        const start = from.positions[id] ?? point;
        return [id, { x: lerp(start.x, point.x, progress), y: lerp(start.y, point.y, progress), z: lerp(start.z, point.z, progress) }];
    }));
    return { positions, lanes: to.lanes, bounds: {
        x: lerp(from.bounds.x, to.bounds.x, progress), y: lerp(from.bounds.y, to.bounds.y, progress),
        width: lerp(from.bounds.width, to.bounds.width, progress), height: lerp(from.bounds.height, to.bounds.height, progress),
    } };
}
