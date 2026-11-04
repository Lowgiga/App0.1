'use client';
import { useEffect, useRef } from 'react';
import type { SpaceGraph } from '@/lib/space-model';
import { openAR, horizontalHit, freshSurface, surfaceOffset, ARStartFailure, AREndFailure, ARStartLock, type ARPlacementMode, type ARState } from '@/lib/ar-runtime';

export type SpaceControls = { reset: () => void; zoom: (factor: number) => void; focus: (id: string) => void; ar: (mode?: ARPlacementMode) => Promise<void>; centerAR: () => void; placeAR: () => boolean };
type Props = { graph: SpaceGraph; selected: string; highlightedEdge: string | null; moving: boolean; powerSaver: boolean; allowMotion: boolean; holographic: boolean; controls: React.RefObject<SpaceControls | null>; onReady: (ready: boolean) => void; onError: (message: string) => void; onSelect: (id: string) => void; onAR: (active: boolean) => void; onARState: (state: ARState) => void; onARBusy: (busy: boolean) => void };

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
        disposers.push(() => { renderer.setAnimationLoop(null); renderer.dispose(); renderer.domElement.remove(); });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, powerSaver ? 1 : 1.5));
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
        const surfaces: { id: string; mesh: InstanceType<typeof T.Mesh>; base: InstanceType<typeof T.MeshBasicMaterial>; focus: InstanceType<typeof T.ShaderMaterial> | null }[] = [];
        const marks = new Map<string, InstanceType<typeof T.Group>>();
        const edgeMarks = new Map<string, InstanceType<typeof T.Line>>();
        for (const n of initialGraph.nodes) {
          const mark = new T.Group(); mark.position.set(...n.position); group.add(mark); marks.set(n.id, mark);
          const geometry = n.kind === 'agent' ? new T.IcosahedronGeometry(.26, 1) : new T.BoxGeometry(.34, .34, .34);
          const material = new T.MeshBasicMaterial({ color: n.color, wireframe: n.origin !== 'own', transparent: true, opacity: .85 });
          const mesh = new T.Mesh(geometry, material); mesh.userData.id = n.id; mark.add(mesh); pickable.push(mesh);
          // This optional shader encodes selection. It is not remote agent activity.
          const focusMaterial = latest.current.holographic ? new T.ShaderMaterial({
            uniforms: { tint: { value: new T.Color(n.color) }, time: { value: 0 } },
            vertexShader: 'varying vec3 point; void main(){point=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
            fragmentShader: 'uniform vec3 tint; uniform float time; varying vec3 point; void main(){float line=0.5+0.5*sin(point.y*36.0-time);gl_FragColor=vec4(tint*(0.8+line*0.3),0.50+line*0.25);}',
            transparent: true, wireframe: n.origin !== 'own', depthWrite: false,
          }) : null;
          surfaces.push({ id: n.id, mesh, base: material, focus: focusMaterial });
          if (focusMaterial) disposers.push(() => focusMaterial.dispose());
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
        const reticleGeometry = new T.RingGeometry(.055, .07, 32).rotateX(-Math.PI / 2), reticleMaterial = new T.MeshBasicMaterial({ color: 0xc7efa0, side: T.DoubleSide });
        const reticle = new T.Mesh(reticleGeometry, reticleMaterial); reticle.matrixAutoUpdate = false; reticle.visible = false; scene.add(reticle);
        disposers.push(() => reticleGeometry.dispose(), () => reticleMaterial.dispose());
        const basePivot = new T.Vector3(center.x, bounds.min.y - .7, center.z);
        let session: XRSession | null = null, hitSource: XRHitTestSource | null = null;
        const startLock = new ARStartLock();
        let arMode: ARPlacementMode = 'surface', centerPending = false, endingUncertain = false, scale = .6 / (radius * 2), visible = true, lastTime = 0;
        let tracking = false, hitAt: number | null = null, hitMatrix: Float32Array | null = null, placedMatrix: InstanceType<typeof T.Matrix4> | null = null, reported = '';
        const reportAR = (phase: ARState['phase'], canPlace = false) => {
          const key = phase + ':' + arMode + ':' + canPlace;
          if (!cancelled && key !== reported) { reported = key; latest.current.onARState({ phase, mode: arMode, canPlace }); }
        };
        const stopHitTest = () => { try { hitSource?.cancel(); } catch { /* Session end also invalidates hit sources. */ } hitSource = null; hitMatrix = null; hitAt = null; tracking = false; reticle.visible = false; };
        const applySurface = (matrix: InstanceType<typeof T.Matrix4>) => {
          matrix.decompose(group.position, group.quaternion, new T.Vector3()); group.scale.setScalar(scale);
          group.position.set(...surfaceOffset(matrix.elements, basePivot.toArray(), scale));
        };
        const placeAR = () => {
          if (!session || endingUncertain || arMode !== 'surface' || placedMatrix || !hitMatrix || !freshSurface(hitAt, performance.now(), tracking)) return false;
          placedMatrix = new T.Matrix4().fromArray(hitMatrix); applySurface(placedMatrix); group.visible = true; reticle.visible = false;
          reportAR('placed'); return true;
        };
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
          if (renderer.xr.isPresenting && frame && !endingUncertain) {
            const space = renderer.xr.getReferenceSpace(), pose = space && frame.getViewerPose(space);
            tracking = !!pose;
            if (!pose) { hitAt = null; hitMatrix = null; reticle.visible = false; group.visible = false; reportAR('tracking-lost'); }
            else if (arMode === 'surface') {
              group.visible = !!placedMatrix;
              if (placedMatrix) { reticle.visible = false; reportAR('placed'); }
              else {
                const hit = hitSource && frame.getHitTestResults(hitSource).map(result => result.getPose(space!)).find(result => result && horizontalHit(result.transform.matrix));
                if (hit) { hitMatrix = new Float32Array(hit.transform.matrix); hitAt = performance.now(); reticle.matrix.fromArray(hitMatrix); reticle.visible = true; reportAR('surface-found', true); }
                else { hitMatrix = null; hitAt = null; reticle.visible = false; reportAR('searching'); }
              }
            } else if (centerPending) {
              const matrix = new T.Matrix4().fromArray(pose.transform.matrix);
              group.position.set(0, 0, -1.25).applyMatrix4(matrix);
              group.quaternion.set(pose.transform.orientation.x, pose.transform.orientation.y, pose.transform.orientation.z, pose.transform.orientation.w);
              group.position.sub(center.clone().multiplyScalar(scale).applyQuaternion(group.quaternion));
              group.visible = true; centerPending = false; reportAR('free-placed');
            } else { group.visible = true; reportAR('free-placed'); }
          }
          const delta = Math.min(.05, Math.max(0, (time - lastTime) / 1000)); lastTime = time;
          if (!renderer.xr.isPresenting && latest.current.moving && !reduced.matches && latest.current.allowMotion) group.rotation.y += delta * .14;
          if (latest.current.allowMotion && !powerSaver && !reduced.matches) for (const surface of surfaces) if (surface.focus && surface.id === latest.current.selected) surface.focus.uniforms.time.value = time / 1000;
          draw();
        };
        const updateLoop = () => {
          const animate = renderer.xr.isPresenting || (visible && !document.hidden && (latest.current.moving || latest.current.holographic) && latest.current.allowMotion && !powerSaver && !reduced.matches);
          renderer.setAnimationLoop(animate ? loop : null); lastTime = 0; draw();
        };
        const restoreInline = () => {
          const savedPose = inlinePose; if (!savedPose) return; inlinePose = null;
          startLock.invalidate(); stopHitTest(); session = null; endingUncertain = false; placedMatrix = null; group.visible = true; group.position.set(0, 0, 0); group.quaternion.identity(); group.scale.setScalar(1); renderer.setClearAlpha(1); orbit.enabled = true;
          if (cancelled) return;
          camera.position.copy(savedPose.position); camera.quaternion.copy(savedPose.quaternion); orbit.target.copy(savedPose.target); group.rotation.copy(savedPose.rotation); orbit.update();
          latest.current.onAR(false); latest.current.onARBusy(startLock.busy); reportAR('inactive'); resize(); updateLoop();
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
          for (const surface of surfaces) surface.mesh.material = surface.id === latest.current.selected && surface.focus ? surface.focus : surface.base;
          for (const [id, line] of edgeMarks) {
            const material = line.material as InstanceType<typeof T.LineBasicMaterial>; material.color.setHex(id === latest.current.highlightedEdge ? 0xc7efa0 : 0x77948a); material.opacity = id === latest.current.highlightedEdge ? 1 : .45;
          }
          updateLoop();
        };
        const recenterAR = () => { if (endingUncertain) return; hitAt = null; hitMatrix = null; placedMatrix = null; reticle.visible = false; group.visible = false; centerPending = arMode === 'free'; reportAR(arMode === 'free' ? 'tracking' : 'searching'); };
        controlsRef.current = {
          reset: () => { if (renderer.xr.isPresenting) { recenterAR(); return; } group.rotation.set(0, 0, 0); orbit.reset(); resize(); },
          focus: id => { if (renderer.xr.isPresenting) return; const mark = marks.get(id); if (!mark) return; const offset = camera.position.clone().sub(orbit.target); offset.setLength(Math.min(offset.length(), 4.5)); orbit.target.copy(mark.getWorldPosition(new T.Vector3())); camera.position.copy(orbit.target).add(offset); orbit.update(); draw(); },
          zoom: factor => { if (endingUncertain) return; if (renderer.xr.isPresenting) { scale = Math.max(.15 / (radius * 2), Math.min(1.2 / (radius * 2), scale / factor)); group.scale.setScalar(scale); if (arMode === 'surface' && placedMatrix) applySurface(placedMatrix); else if (arMode === 'free') centerPending = true; return; } const offset = camera.position.clone().sub(orbit.target); offset.setLength(Math.max(2, Math.min(100, offset.length() * factor))); camera.position.copy(orbit.target).add(offset); orbit.update(); draw(); },
          centerAR: recenterAR, placeAR,
          ar: async (mode = 'surface') => {
            if (cancelled) return; const operation = startLock.begin(); if (operation === null) return; latest.current.onARBusy(true);
            try {
              if (session) { try { await session.end(); } catch (error) { if (session) { endingUncertain = true; stopHitTest(); reportAR('end-unknown'); throw new ARStartFailure('end', error); } } return; }
              if (!navigator.xr || !isSecureContext) throw new ARStartFailure('capability', new DOMException('WebXR benötigt einen sicheren und unterstützten Browser.', 'NotSupportedError'));
              const overlay = container.closest('.space-view')?.querySelector<HTMLElement>('.space-ar-overlay');
              if (!overlay) throw new ARStartFailure('capability', new Error('Die AR-Bedienelemente sind nicht verfügbar.'));
              arMode = mode; reported = '';
              // Show the exit controls synchronously, before the user-gesture request.
              overlay.hidden = false;
              try {
                const opened = await openAR({ xr: navigator.xr, mode, overlay, cancelled: () => cancelled || !startLock.current(operation),
                  phase: phase => { if (startLock.current(operation)) reportAR(phase); }, bind: async next => {
                    if (cancelled || !startLock.current(operation)) throw new DOMException('Der AR-Start ist nicht mehr aktuell.', 'AbortError');
                    session = next;
                    inlinePose = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), target: orbit.target.clone(), rotation: group.rotation.clone() };
                    await renderer.xr.setSession(next);
                    // Three.js may finish an awaited reference-space setup after native end.
                    // Discard this renderer instead of leaving its XR internals presenting a dead session.
                    if (!cancelled && !startLock.current(operation) && renderer.xr.isPresenting) latest.current.onError('AR wurde während der Grafikinitialisierung beendet. Die 2D-Struktur ist verfügbar; lade 3D erneut.');
                    if (cancelled || !startLock.current(operation) || !renderer.xr.isPresenting) throw new DOMException('Die AR-Sitzung wurde während der Grafikbindung beendet.', 'AbortError');
                    orbit.enabled = false; group.scale.setScalar(scale); group.visible = false; renderer.setClearAlpha(0); centerPending = mode === 'free'; latest.current.onAR(true);
                  } });
                if (!opened) { if (!cancelled && startLock.current(operation)) { restoreInline(); reportAR('inactive'); } return; }
                hitSource = opened.hitSource; placedMatrix = null;
                const handleSelect = () => { placeAR(); };
                const ignoreOverlaySelect = (event: Event) => event.preventDefault();
                opened.session.addEventListener('select', handleSelect); overlay.addEventListener('beforexrselect', ignoreOverlaySelect);
                opened.session.addEventListener('end', () => { opened.session.removeEventListener('select', handleSelect); overlay.removeEventListener('beforexrselect', ignoreOverlaySelect); }, { once: true });
                updateLoop();
              } catch (error) {
                if (!cancelled && startLock.current(operation)) {
                  if (error instanceof AREndFailure) { session = error.session; endingUncertain = true; stopHitTest(); latest.current.onAR(true); reportAR('end-unknown'); }
                  else { restoreInline(); reportAR('inactive'); }
                }
                throw error;
              }
            } finally { if (startLock.finish(operation) && !cancelled) latest.current.onARBusy(false); }
          },
        };
        disposers.push(() => { startLock.invalidate(); controlsRef.current = null; refresh.current = null; stopHitTest(); session?.end().catch(() => {}); });
        resize(); refresh.current();
        if (renderer.info.render.calls < 1 || container.clientWidth < 1) throw new Error('No valid first frame');
        if (!cancelled) latest.current.onReady(true);
      } catch {
        dispose(); if (!cancelled) latest.current.onError('3D konnte hier nicht zuverlässig starten. Du kannst die vollständige 2D-Struktur nutzen oder 3D erneut laden.');
      }
    }
    void start();
    return () => { cancelled = true; dispose(); };
  }, [topology, props.powerSaver, props.controls, props.holographic]);
  return <div ref={host} className="mesh-canvas" data-renderer="webgl" />;
}
