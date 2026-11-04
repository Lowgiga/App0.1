import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {createAppearanceGraphScene as createGraphScene, appearanceSceneKey, type AppearanceGraphScene as GraphScene} from '../src/appearance/web-studio-scene.ts';
import type { SpatialViewProps } from '../vendor/mesh-extensions/src/render-types.ts';
import { limitsFor } from '../vendor/mesh-extensions/src/view.ts';
import {renderedAppearance} from '../src/appearance/web-three.ts';
import {createLabelLayout} from '../src/appearance/label-visibility.ts';
import { browserFrameClock, createDemandTimeline, transitionDuration, type FrameClock } from '../vendor/mesh-extensions/src/motion.ts';
export type RendererAdapter = {
    domElement: HTMLCanvasElement;
    setPixelRatio: (ratio: number) => void;
    setSize: (width: number, height: number) => void;
    render: (scene: THREE.Scene, camera: THREE.Camera) => void;
    dispose: () => void;
    forceContextLoss: () => void;
};
export type SpatialRuntime = { createRenderer?: () => RendererAdapter; frameClock?: FrameClock };
type CameraFraming = { near: number; far: number; minDistance: number; maxDistance: number };
type CameraTarget = { position: THREE.Vector3; center: THREE.Vector3; up: THREE.Vector3; framing?: CameraFraming };
/** On-demand rendering, with optional bounded camera transitions. No ambient loop. */
export function createSpatialController(host: HTMLElement, initial: SpatialViewProps, runtime: SpatialRuntime = {}) {
    const owner = host.ownerDocument, win = owner.defaultView;
    if (!win) throw Error('Kein Browser-Dokument verfügbar.');
    const renderer = runtime.createRenderer?.() ?? new THREE.WebGLRenderer({ antialias: initial.config.quality !== 'low', alpha: false, powerPreference: 'low-power' });
    const frameClock = runtime.frameClock ?? browserFrameClock(win);
    const timeline = createDemandTimeline(frameClock);
    const motionMedia = win.matchMedia?.('(prefers-reduced-motion: reduce)');
    let breathingFrame: number | null = null, breathingGeneration = 0, visible = true;
    let props = initial, built: GraphScene | null = null, controls: OrbitControls | null = null;
    let observer: ResizeObserver | null = null;
    let disposed = false, lost = false, interacting = false;
    let destination: CameraTarget | null = null;
    const canvas = renderer.domElement, labels = owner.createElement('div');
    labels.className = 'mesh-three-labels';
    canvas.setAttribute('aria-label', 'Interaktiver 3D-Beziehungsgraph');
    canvas.setAttribute('role', 'img'); canvas.tabIndex = 0;
    const camera = new THREE.PerspectiveCamera(45, 1, .01, 10000);
    const labelNodes = new Map<string, HTMLButtonElement>();
    const labelLayout=createLabelLayout(labels,labelNodes);
    const cleanup: (() => void)[] = [];
    const stopBreathe = () => { breathingGeneration++; if (breathingFrame !== null) frameClock.cancel(breathingFrame); breathingFrame = null; built?.animate(0, false); };
    const cancelMotion = () => { timeline.cancel(); destination = null; stopBreathe(); };
    const dispose = () => {
        if (disposed) return;
        disposed = true; timeline.dispose(); destination = null; stopBreathe();
        for (const fn of cleanup.splice(0)) fn();
        observer?.disconnect(); controls?.dispose(); built?.dispose();
        renderer.dispose(); renderer.forceContextLoss(); canvas.remove(); labels.remove(); labelNodes.clear();
    };
    const unavailable = (message: string) => {
        if (lost || disposed) return;
        lost = true; cancelMotion(); props.onUnavailable(message);
    };
    const draw = () => {
        if (disposed || lost || !built) return;
        try {
            renderer.render(built.scene, camera);
            labelLayout.draw([...labelNodes.keys()].map(id=>{const p=built!.positions.get(id)?.clone().project(camera);return{id,x:p?.x??NaN,y:p?.y??NaN,visible:!!p&&p.z>=-1&&p.z<=1&&Math.abs(p.x)<=1.05&&Math.abs(p.y)<=1.05}}),props.config.selectedId);
        } catch { unavailable('3D-Rendering ist auf diesem Gerät nicht verfügbar.'); }
    };
    const syncBreathe = () => {
        stopBreathe();
        const allowed = () => !disposed && !lost && visible && !owner.hidden && !motionMedia?.matches && !props.config.reducedMotion && props.config.quality !== 'low' && props.scene.nodes.some(node => renderedAppearance(node).motion === 'breathe');
        if (!allowed()) { draw(); return; }
        const generation = breathingGeneration;
        const step = (time: number) => { if (generation !== breathingGeneration || !allowed()) return; breathingFrame = null; built?.animate(time / 1000, true); draw(); if (generation === breathingGeneration && allowed()) breathingFrame = frameClock.request(step); };
        breathingFrame = frameClock.request(step);
    };
    const resize = () => {
        if (disposed || lost) return;
        try {
            const width = Math.max(1, host.clientWidth || 640), height = Math.max(1, host.clientHeight || 440);
            camera.aspect = width / height; camera.updateProjectionMatrix();
            renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, limitsFor(props.config.quality).pixelRatio));
            renderer.setSize(width, height); labelLayout.resize(width,height); draw();
        } catch { unavailable('Die 3D-Größe konnte nicht an das Fenster angepasst werden.'); }
    };
    const applyTarget = (target: CameraTarget) => {
        if (!controls || disposed || lost) return;
        try {
            if (target.framing) {
                camera.near = target.framing.near; camera.far = target.framing.far; camera.updateProjectionMatrix();
                controls.minDistance = target.framing.minDistance; controls.maxDistance = target.framing.maxDistance;
            }
            camera.position.copy(target.position); camera.up.copy(target.up); controls.target.copy(target.center); controls.update(); draw();
        }
        catch { unavailable('Der 3D-Kamerablick konnte nicht angepasst werden.'); }
    };
    const settleMotion = () => { const target = destination; cancelMotion(); if (target) applyTarget(target); };
    const moveCamera = (target: CameraTarget, duration: number) => {
        if (!controls || disposed || lost || interacting) return;
        const from = { position: camera.position.clone(), center: controls.target.clone(), up: camera.up.clone() };
        const sceneReach = Math.max(0, ...[...(built?.positions.values() ?? [])].map(point => Math.max(from.position.distanceTo(point), target.position.distanceTo(point)) + .5));
        // A smaller target must not clamp or clip the still-distant starting camera.
        // Retain an envelope of both views until completion; cancellation keeps that safe envelope.
        const envelope = target.framing ? {
            near: Math.min(camera.near, target.framing.near), far: Math.max(camera.far, target.framing.far, sceneReach),
            minDistance: Math.min(controls.minDistance, target.framing.minDistance, from.position.distanceTo(from.center)),
            maxDistance: Math.max(controls.maxDistance, target.framing.maxDistance, from.position.distanceTo(from.center)),
        } : undefined;
        destination = target;
        timeline.run(duration, progress => {
            if (disposed || lost || interacting) return;
            applyTarget({ position: from.position.clone().lerp(target.position, progress), center: from.center.clone().lerp(target.center, progress), up: from.up.clone().lerp(target.up, progress).normalize(), framing: progress === 1 ? target.framing : envelope });
            if (progress === 1) destination = null;
        });
    };
    const duration = () => transitionDuration(props.config, { hidden: owner.hidden });
    const fit = (animate = true) => {
        if (!built || !controls || disposed || lost || interacting) return;
        const points = [...built.positions.values()];
        const bounds = points.length ? new THREE.Box3().setFromPoints(points) : new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
        const center = bounds.getCenter(new THREE.Vector3());
        const radius = Math.max(2, bounds.getSize(new THREE.Vector3()).length() / 2 + .4);
        const dist = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.2 / Math.min(1, camera.aspect);
        const up = new THREE.Vector3(0, 1, 0);
        const offset = props.config.perspective === 'front' ? new THREE.Vector3(0, 0, dist) : props.config.perspective === 'top' ? new THREE.Vector3(0, dist, 0) : new THREE.Vector3(.7, .55, 1).normalize().multiplyScalar(dist);
        if (props.config.perspective === 'top') up.set(0, 0, -1);
        const framing = { near: Math.max(.01, dist / 1000), far: Math.max(100, dist * 10), minDistance: radius * .15, maxDistance: dist * 5 };
        moveCamera({ position: center.clone().add(offset), center, up, framing }, animate ? duration() : 0);
    };
    const focusSelection = () => {
        cancelMotion();
        if (!controls || !built || !props.config.selectedId || interacting) return;
        const selected = built.positions.get(props.config.selectedId);
        if (!selected) return;
        // Gentle framing only: retain zoom/orientation and cap the translation to 20% of viewing distance.
        const delta = selected.clone().sub(controls.target).clampLength(0, camera.position.distanceTo(controls.target) * .2);
        moveCamera({ position: camera.position.clone().add(delta), center: controls.target.clone().add(delta), up: camera.up.clone() }, duration());
    };
    const update = (next: SpatialViewProps) => {
        if (disposed || lost) return;
        const first = !built;
        const shouldFit = first || JSON.stringify(props.layout) !== JSON.stringify(next.layout) || props.config.perspective !== next.config.perspective || props.config.mode !== next.config.mode;
        const selectedChanged = props.config.selectedId !== next.config.selectedId;
        const reuse = built && appearanceSceneKey(props) === appearanceSceneKey(next);
        const replacement = reuse ? built! : createGraphScene(next);
        if(reuse)replacement.update(next);
        props = next; if(!reuse)built?.dispose(); built = replacement;
        labelLayout.sync(props.scene.nodes,props.config.labels,props.config.selectedId,props.onSelect);
        resize();
        if (shouldFit) fit(!first);
        else if (selectedChanged) focusSelection();
        else if (props.config.selectedId && !built.positions.has(props.config.selectedId)) cancelMotion();
        else if (!duration()) settleMotion();
        else draw();
        syncBreathe();
    };
    try {
        host.append(canvas, labels); controls = new OrbitControls(camera, canvas);
        controls.enableDamping = false; controls.autoRotate = false;
        const gestureStart = () => { interacting = true; cancelMotion(); };
        const gestureEnd = () => { interacting = false; syncBreathe(); };
        controls.addEventListener('change', draw); controls.addEventListener('start', gestureStart); controls.addEventListener('end', gestureEnd);
        cleanup.push(() => { controls?.removeEventListener('change', draw); controls?.removeEventListener('start', gestureStart); controls?.removeEventListener('end', gestureEnd); });
        const contextLost = (event: Event) => { event.preventDefault(); unavailable('WebGL-Kontext verloren.'); };
        canvas.addEventListener('webglcontextlost', contextLost); cleanup.push(() => canvas.removeEventListener('webglcontextlost', contextLost));
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') cancelMotion(); };
        const visibility = () => { if (owner.hidden) settleMotion(); syncBreathe(); };
        motionMedia?.addEventListener('change', syncBreathe);
        const intersection = win.IntersectionObserver ? new win.IntersectionObserver(entries => {visible = entries[0]?.isIntersecting ?? false; syncBreathe();}) : null; intersection?.observe(host);
        cleanup.push(() => {motionMedia?.removeEventListener('change', syncBreathe); intersection?.disconnect();});
        const scope = host.closest('.mesh-explorer') ?? host;
        scope.addEventListener('keydown', escape as EventListener); owner.addEventListener('visibilitychange', visibility);
        cleanup.push(() => { scope.removeEventListener('keydown', escape as EventListener); owner.removeEventListener('visibilitychange', visibility); });
        let start: { id: number; x: number; y: number } | null = null;
        const pointers = new Set<number>();
        let multiPointer = false;
        const release = (event: PointerEvent) => {
            pointers.delete(event.pointerId);
            if (start?.id === event.pointerId) start = null;
            if (!pointers.size) multiPointer = false;
        };
        const down = (event: PointerEvent) => {
            pointers.add(event.pointerId);
            if (pointers.size > 1) multiPointer = true;
            start = !multiPointer && event.button === 0 ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
            gestureStart();
        };
        const moved = (event: PointerEvent) => {
            if (start?.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) start = null;
        };
        const up = (event: PointerEvent) => {
            const tap = start;
            const eligible = tap?.id === event.pointerId && !multiPointer && pointers.size === 1;
            release(event);
            if (!eligible || !tap || !built || disposed || lost) return;
            const travel = Math.hypot(event.clientX - tap.x, event.clientY - tap.y);
            if (travel > 5) return;
            const r = canvas.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) return;
            const pointer = new THREE.Vector2((event.clientX - r.left) / r.width * 2 - 1, -(event.clientY - r.top) / r.height * 2 + 1);
            const ray = new THREE.Raycaster(); ray.setFromCamera(pointer, camera);
            const hit = ray.intersectObjects(built.pickables, false)[0]; if (hit) props.onSelect(String(hit.object.userData.nodeId));
        };
        // OrbitControls owns gesture completion, including the remaining pointer of a pinch.
        const cancel = (event: PointerEvent) => { start = null; release(event); };
        canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', cancel);
        owner.addEventListener('pointermove', moved); owner.addEventListener('pointerup', release);
        cleanup.push(() => { canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', cancel); owner.removeEventListener('pointermove', moved); owner.removeEventListener('pointerup', release); pointers.clear(); start = null; });
        const Resize = win.ResizeObserver;
        if (Resize) { observer = new Resize(resize); observer.observe(host); }
        else { win.addEventListener('resize', resize); cleanup.push(() => win.removeEventListener('resize', resize)); }
        const fontOrViewportChanged=()=>{labelLayout.invalidate();resize();};
        owner.fonts?.addEventListener('loadingdone',fontOrViewportChanged);win.addEventListener('resize',fontOrViewportChanged);
        cleanup.push(()=>{owner.fonts?.removeEventListener('loadingdone',fontOrViewportChanged);win.removeEventListener('resize',fontOrViewportChanged);});
        update(initial);
        return { update, dispose, fit, cancelMotion };
    } catch (error) { dispose(); throw error; }
}
