'use client';
import { useEffect, useRef } from 'react';
import type { SpaceGraph } from '@/lib/space-model';
import { surfaceSessionInit } from '@/lib/ar-support';
import { acquireHitTestSource, createPlacementState, withAbort, type PlacementStatus } from '@/lib/ar-placement';

export type SpaceControls = { reset: () => void; zoom: (factor: number) => void; focus: (id: string) => void; ar: () => Promise<void>; centerAR: () => void; placeAR: () => void; cancelAR: () => void };
type Props = { graph: SpaceGraph; selected: string; highlightedEdge: string | null; moving: boolean; powerSaver: boolean; allowMotion: boolean; controls: React.RefObject<SpaceControls | null>; onReady: (ready: boolean) => void; onError: (message: string) => void; onSelect: (id: string) => void; onAR: (active: boolean) => void; onARBusy: (busy: boolean) => void; onPlacement: (status: PlacementStatus) => void };

/** One renderer, one resource owner. XR teardown is complete before an inline redraw. */
export default function SpaceRenderer(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props); latest.current = props;
  const refresh = useRef<(() => void) | null>(null);
  useEffect(() => { refresh.current?.(); }, [props.selected, props.highlightedEdge, props.moving, props.allowMotion]);
  const topology = JSON.stringify({ nodes: props.graph.nodes.map(n => [n.id, n.title, n.kind, n.origin, n.color, n.position]), edges: props.graph.edges.map(e => [e.id, e.from, e.to, e.origin]) });
  useEffect(() => {
    const initialGraph = latest.current.graph, powerSaver = latest.current.powerSaver, controlsRef = latest.current.controls;
    let cancelled = false;
    const disposers: (() => void)[] = [];
    const dispose = () => { while (disposers.length) { try { disposers.pop()!(); } catch { /* Continue releasing the remaining resources. */ } } };
    latest.current.onReady(false);
    async function start() {
      try {
        const [T, { OrbitControls }] = await Promise.all([import('three'), import('three/addons/controls/OrbitControls.js')]);
        if (cancelled || !host.current) return;
        const container = host.current;
        const renderer = new T.WebGLRenderer({ antialias: !powerSaver, alpha: true });
        let xrBinding: Promise<void> | null = null, sessionEnding: Promise<void> | null = null;
        disposers.push(() => {
          renderer.setAnimationLoop(null); renderer.domElement.remove();
          const finish = () => { renderer.setAnimationLoop(null); if (renderer.xr.getSession() === null) renderer.xr.isPresenting = false; renderer.dispose(); };
          const pending = [xrBinding, sessionEnding].filter((p): p is Promise<void> => !!p);
          if (pending.length) void Promise.allSettled(pending).then(finish); else finish();
        });
        const inlinePixelRatio = Math.min(window.devicePixelRatio || 1, powerSaver ? 1 : 1.5);
        renderer.setPixelRatio(inlinePixelRatio);
        renderer.setClearColor(0x101c1d, 1);
        renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local');
        renderer.domElement.setAttribute('aria-label', 'Räumliches Netz. Die gleichwertige Knotenliste bietet Tastaturbedienung.');
        container.appendChild(renderer.domElement);
        const scene = new T.Scene(), group = new T.Group(); scene.add(group);
        const camera = new T.PerspectiveCamera(45, 1, .01, 150);
        const bounds = new T.Box3().setFromPoints(initialGraph.nodes.map(n => new T.Vector3(...n.position)));
        const center = bounds.getCenter(new T.Vector3());
        const radius = Math.max(3, bounds.getSize(new T.Vector3()).length() / 2);
        const orbit = new OrbitControls(camera, renderer.domElement);
        disposers.push(() => orbit.dispose());
        orbit.enableDamping = false; orbit.minDistance = 2; orbit.maxDistance = 100; orbit.target.copy(center);
        camera.position.copy(center).add(new T.Vector3(0, radius * .3, radius * 3.4));
        orbit.update(); orbit.saveState();
        const pickable: InstanceType<typeof T.Mesh>[] = [];
        const marks = new Map<string, InstanceType<typeof T.Group>>();
        const edgeMarks = new Map<string, InstanceType<typeof T.Line>>();
        for (const n of initialGraph.nodes) {
          const mark = new T.Group(); mark.position.set(...n.position); group.add(mark); marks.set(n.id, mark);
          const geometry = n.kind === 'agent' ? new T.IcosahedronGeometry(.26, 1) : new T.BoxGeometry(.34, .34, .34);
          const material = new T.MeshBasicMaterial({ color: n.color, wireframe: n.origin !== 'own', transparent: true, opacity: .85 });
          const mesh = new T.Mesh(geometry, material); mesh.userData.id = n.id; mark.add(mesh); pickable.push(mesh);
          disposers.push(() => geometry.dispose(), () => material.dispose());
          const textureCanvas = document.createElement('canvas'); textureCanvas.width = 512; textureCanvas.height = 160;
          const ctx = textureCanvas.getContext('2d');
          if (ctx) {
            ctx.font = '500 52px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#e9f4ee';
            let text = n.title; while (text.length > 1 && ctx.measureText(text).width > 470) text = text.slice(0, -1);
            ctx.fillText(text + (text !== n.title ? '…' : ''), 256, 61);
            ctx.font = '28px system-ui'; ctx.fillStyle = '#b2cabb';
            ctx.fillText(n.origin === 'own' ? 'APP-STAND' : n.origin === 'template' ? 'VORLAGE' : n.origin === 'plan' ? 'GEPLANT' : 'SNAPSHOT', 256, 110);
            const texture = new T.CanvasTexture(textureCanvas), labelMaterial = new T.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
            const label = new T.Sprite(labelMaterial); label.position.y = .6; label.scale.set(1.9, .594, 1); mark.add(label);
            disposers.push(() => texture.dispose(), () => labelMaterial.dispose());
          }
        }
        for (const edge of initialGraph.edges) {
          const a = marks.get(edge.from), b = marks.get(edge.to); if (!a || !b) continue;
          const geometry = new T.BufferGeometry().setFromPoints([a.position, b.position]);
          const material = edge.origin !== 'own' ? new T.LineDashedMaterial({ color: 0x77948a, transparent: true, opacity: .35, dashSize: .1, gapSize: .08 }) : new T.LineBasicMaterial({ color: 0x9dbfb0, transparent: true, opacity: .55 });
          const line = new T.Line(geometry, material); if (edge.origin !== 'own') line.computeLineDistances(); group.add(line); edgeMarks.set(edge.id, line);
          disposers.push(() => geometry.dispose(), () => material.dispose());
        }
        const grid = new T.GridHelper(Math.max(8, radius * 2), 16, 0x36564b, 0x21372f); grid.position.y = bounds.min.y - .7; group.add(grid);
        disposers.push(() => { grid.geometry.dispose(); for (const m of Array.isArray(grid.material) ? grid.material : [grid.material]) m.dispose(); });
        let session: XRSession | null = null, xrBusy = false, scale = .17, visible = true, lastTime = 0;
        let startup: AbortController | null = null;
        const endSession = (target: XRSession) => { sessionEnding = Promise.resolve().then(() => target.end()).catch(() => {}); return sessionEnding; };
        const placement = createPlacementState();
        let placementStatus: PlacementStatus = 'scanning';
        let hitResource: Awaited<ReturnType<typeof acquireHitTestSource>> | null = null;
        const reticleGeometry = new T.RingGeometry(.07, .095, 32).rotateX(-Math.PI / 2);
        const reticleMaterial = new T.MeshBasicMaterial({ color: 0xc7efa0, side: T.DoubleSide });
        const reticle = new T.Mesh(reticleGeometry, reticleMaterial); reticle.matrixAutoUpdate = false; reticle.visible = false; scene.add(reticle);
        disposers.push(() => { reticleGeometry.dispose(); reticleMaterial.dispose(); scene.remove(reticle); });
        const reportPlacement = () => { if (placement.status !== placementStatus) { placementStatus = placement.status; if (!cancelled) latest.current.onPlacement(placementStatus); } };
        const clearPlacement = () => { hitResource?.dispose(); hitResource = null; placement.reset(); reticle.visible = false; reportPlacement(); };
        const applyPlacement = (matrix: number[]) => {
          const surface = new T.Matrix4().fromArray(matrix);
          group.quaternion.setFromRotationMatrix(surface);
          group.scale.setScalar(scale);
          group.position.setFromMatrixPosition(surface).sub(new T.Vector3(center.x, grid.position.y, center.z).multiplyScalar(scale).applyQuaternion(group.quaternion));
          group.visible = true;
        };
        const reposition = () => { if (!renderer.xr.isPresenting) return; placement.reset(); group.visible = false; reticle.visible = false; reportPlacement(); };
        let inlinePose: { position: InstanceType<typeof T.Vector3>; quaternion: InstanceType<typeof T.Quaternion>; target: InstanceType<typeof T.Vector3>; rotation: InstanceType<typeof T.Euler> } | null = null;
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        const draw = () => { if (!cancelled && !renderer.getContext().isContextLost()) renderer.render(scene, camera); };
        const resize = () => {
          if (cancelled || renderer.xr.isPresenting) return;
          const width = container.clientWidth, height = container.clientHeight; if (width < 1 || height < 1) return;
          camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false); draw();
        };
        const loop = (time: number, frame?: XRFrame) => {
          if (cancelled || (!renderer.xr.isPresenting && (document.hidden || !visible))) return;
          if (renderer.xr.isPresenting && frame && placement.status !== 'placed') {
            const space = renderer.xr.getReferenceSpace(), source = hitResource?.source;
            const hit = space && source ? frame.getHitTestResults(source)[0] : null;
            const pose = hit && space ? hit.getPose(space) : null;
            placement.update(pose?.transform.matrix ?? null);
            const candidate = placement.candidate; reticle.visible = !!candidate;
            if (candidate) reticle.matrix.fromArray(candidate);
            reportPlacement();
          }
          const delta = Math.min(.05, Math.max(0, (time - lastTime) / 1000)); lastTime = time;
          if (!renderer.xr.isPresenting && latest.current.moving && !reduced.matches && latest.current.allowMotion) group.rotation.y += delta * .14;
          draw();
        };
        const updateLoop = () => {
          const animate = renderer.xr.isPresenting || (visible && !document.hidden && latest.current.moving && latest.current.allowMotion && !powerSaver && !reduced.matches);
          renderer.setAnimationLoop(animate ? loop : null); lastTime = 0; draw();
        };
        const restoreInline = () => {
          // Three 0.186 can set isPresenting after its awaited reference-space promise resolves,
          // even if onSessionEnd already cleared getSession(). Repair only that terminal state.
          if (renderer.xr.getSession() !== null) return;
          renderer.setAnimationLoop(null); renderer.xr.isPresenting = false; renderer.setPixelRatio(inlinePixelRatio);
          const savedPose = inlinePose; inlinePose = null;
          clearPlacement(); session = null; xrBusy = false; group.visible = true; group.position.set(0, 0, 0); group.scale.setScalar(1); renderer.setClearAlpha(1); orbit.enabled = true;
          if (cancelled) return;
          if (savedPose) { camera.position.copy(savedPose.position); camera.quaternion.copy(savedPose.quaternion); orbit.target.copy(savedPose.target); group.rotation.copy(savedPose.rotation); orbit.update(); }
          latest.current.onAR(false); latest.current.onARBusy(false); resize(); updateLoop();
        };
        // This event fires after Three.js restores its render target and canvas size.
        renderer.xr.addEventListener('sessionend', restoreInline);
        disposers.push(() => renderer.xr.removeEventListener('sessionend', restoreInline));
        const contextLost = (e: Event) => { e.preventDefault(); renderer.setAnimationLoop(null); if (!cancelled) latest.current.onError('Der Grafikkontext wurde unterbrochen. Die 2D-Struktur bleibt verfügbar; 3D lässt sich erneut laden.'); };
        renderer.domElement.addEventListener('webglcontextlost', contextLost);
        disposers.push(() => renderer.domElement.removeEventListener('webglcontextlost', contextLost));
        const observer = new ResizeObserver(resize); observer.observe(container); disposers.push(() => observer.disconnect());
        const intersection = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; updateLoop(); }); intersection.observe(container); disposers.push(() => intersection.disconnect());
        const visibility = () => { resize(); updateLoop(); }; document.addEventListener('visibilitychange', visibility); reduced.addEventListener('change', updateLoop);
        disposers.push(() => { document.removeEventListener('visibilitychange', visibility); reduced.removeEventListener('change', updateLoop); });
        orbit.addEventListener('change', draw);
        const ray = new T.Raycaster(), pointer = new T.Vector2(); let down = { x: 0, y: 0 };
        const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
        const onUp = (e: PointerEvent) => {
          if (renderer.xr.isPresenting || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
          const rect = renderer.domElement.getBoundingClientRect(); pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1); ray.setFromCamera(pointer, camera);
          const hit = ray.intersectObjects(pickable)[0]; if (hit) latest.current.onSelect(hit.object.userData.id);
        };
        renderer.domElement.addEventListener('pointerdown', onDown); renderer.domElement.addEventListener('pointerup', onUp);
        disposers.push(() => { renderer.domElement.removeEventListener('pointerdown', onDown); renderer.domElement.removeEventListener('pointerup', onUp); });
        refresh.current = () => {
          for (const [id, mark] of marks) mark.scale.setScalar(id === latest.current.selected ? 1.22 : 1);
          for (const [id, line] of edgeMarks) {
            const material = line.material as InstanceType<typeof T.LineBasicMaterial>; material.color.setHex(id === latest.current.highlightedEdge ? 0xc7efa0 : 0x77948a); material.opacity = id === latest.current.highlightedEdge ? 1 : .45;
          }
          updateLoop();
        };
        controlsRef.current = {
          reset: () => { if (renderer.xr.isPresenting) { reposition(); return; } group.rotation.set(0, 0, 0); orbit.reset(); resize(); },
          focus: id => { if (renderer.xr.isPresenting) return; const mark = marks.get(id); if (!mark) return; const offset = camera.position.clone().sub(orbit.target); offset.setLength(Math.min(offset.length(), 4.5)); orbit.target.copy(mark.getWorldPosition(new T.Vector3())); camera.position.copy(orbit.target).add(offset); orbit.update(); draw(); },
          zoom: factor => { if (renderer.xr.isPresenting) { scale = Math.max(.08, Math.min(.35, scale / factor)); const matrix = placement.placed; if (matrix) applyPlacement(matrix); return; } const offset = camera.position.clone().sub(orbit.target); offset.setLength(Math.max(2, Math.min(100, offset.length() * factor))); camera.position.copy(orbit.target).add(offset); orbit.update(); draw(); },
          centerAR: reposition,
          placeAR: () => { if (!renderer.xr.isPresenting) return; const matrix = placement.place(); if (!matrix) return; applyPlacement(matrix); reticle.visible = false; reportPlacement(); },
          cancelAR: () => { startup?.abort(); clearPlacement(); if (session) void endSession(session); },
          ar: async () => {
            if (cancelled) return;
            if (xrBinding) throw new DOMException('A previous XR binding is still ending.', 'InvalidStateError');
            if (xrBusy) return;
            xrBusy = true; latest.current.onARBusy(true);
            const attempt = new AbortController(); startup = attempt;
            try {
              if (session) { await endSession(session); return; }
              if (!isSecureContext) throw new DOMException('A secure context is required.', 'SecurityError');
              if (!navigator.xr) throw new DOMException('WebXR is unavailable.', 'NotSupportedError');
              const overlay = container.closest('.space-view')?.querySelector<HTMLElement>('.space-ar-overlay');
              if (!overlay) throw new DOMException('AR controls are unavailable.', 'NotSupportedError');
              const requested = navigator.xr.requestSession('immersive-ar', surfaceSessionInit(overlay)).then(next => {
                if (cancelled || attempt.signal.aborted) { void next.end().catch(() => {}); throw new DOMException('AR startup ended.', 'AbortError'); }
                return next;
              });
              const next = await withAbort(requested, attempt.signal);
              session = next;
              let ended = false;
              const endPlacement = () => { ended = true; attempt.abort(); clearPlacement(); next.removeEventListener('end', endPlacement); };
              next.addEventListener('end', endPlacement);
              inlinePose = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), target: orbit.target.clone(), rotation: group.rotation.clone() };
              try {
                hitResource = await acquireHitTestSource(next, () => cancelled || ended || session !== next, attempt.signal);
                if (cancelled || ended || attempt.signal.aborted) throw new DOMException('AR startup ended.', 'AbortError');
                const binding = renderer.xr.setSession(next).finally(() => {
                  if (cancelled || ended || attempt.signal.aborted) restoreInline();
                  if (xrBinding === binding) xrBinding = null;
                });
                xrBinding = binding;
                await withAbort(binding, attempt.signal);
                if (cancelled || ended || attempt.signal.aborted || !renderer.xr.isPresenting) throw new DOMException('AR startup ended.', 'AbortError');
                orbit.enabled = false; group.visible = false; group.scale.setScalar(scale); renderer.setClearAlpha(0); placement.reset(); placementStatus = 'scanning'; latest.current.onPlacement('scanning'); latest.current.onAR(true); updateLoop();
              } catch (error) { clearPlacement(); next.removeEventListener('end', endPlacement); await endSession(next); restoreInline(); throw error; }
            } finally {
              if (startup === attempt) { startup = null; xrBusy = false; if (!cancelled) latest.current.onARBusy(false); }
            }
          },
        };
        disposers.push(() => { startup?.abort(); controlsRef.current = null; refresh.current = null; clearPlacement(); if (session) void endSession(session); });
        resize(); refresh.current();
        if (renderer.info.render.calls < 1 || container.clientWidth < 1) throw new Error('No valid first frame');
        if (!cancelled) latest.current.onReady(true);
      } catch {
        dispose(); if (!cancelled) latest.current.onError('3D konnte hier nicht zuverlässig starten. Du kannst die vollständige 2D-Struktur nutzen oder 3D erneut laden.');
      }
    }
    void start();
    return () => { cancelled = true; latest.current.onAR(false); latest.current.onARBusy(false); latest.current.onPlacement('scanning'); latest.current.onReady(false); dispose(); };
  }, [topology, props.powerSaver, props.controls]);
  return <div ref={host} className="mesh-canvas" data-renderer="webgl" />;
}
