import * as THREE from 'three';
import type { SpatialViewProps } from './render-types.ts';
import { nodeColors } from './render-types.ts';
import { limitsFor } from './view.ts';
export function createGraphScene({ scene: selection, layout, config }: Pick<SpatialViewProps, 'scene' | 'layout' | 'config'>) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#091420');
    const pickables: THREE.Mesh[] = [];
    const resources = new Set<{
        dispose: () => void;
    }>();
    const track = <T extends {
        dispose: () => void;
    }>(resource: T): T => { resources.add(resource); return resource; };
    let disposed = false;
    const dispose = () => { if (disposed)
        return; disposed = true; for (const resource of resources)
        resource.dispose(); resources.clear(); scene.clear(); pickables.length = 0; };
    try {
        const limit = limitsFor(config.quality);
        const geometry = track(new THREE.SphereGeometry(.14, limit.segments, Math.max(6, Math.round(limit.segments * .7))));
        const arrow = track(new THREE.ConeGeometry(.045, .14, 5));
        const materialMap = new Map<string, THREE.MeshBasicMaterial>();
        const related = new Set([config.selectedId, ...selection.edges.flatMap(e => e.from === config.selectedId ? [e.to] : e.to === config.selectedId ? [e.from] : [])]);
        const position = (id: string) => { const p = layout.positions[id]; return p ? new THREE.Vector3(p.x / 100, -p.y / 100, p.z / 100) : null; };
        const positions = new Map<string, THREE.Vector3>();
        for (const node of selection.nodes.slice(0, limit.nodes)) {
            const p = position(node.id);
            if (!p)
                continue;
            positions.set(node.id, p);
            const active = node.id === config.selectedId;
            const muted = config.highlightRelations && !!config.selectedId && !related.has(node.id);
            const color = active ? '#ffffff' : nodeColors[node.kind];
            const key = color + ':' + muted;
            let material = materialMap.get(key);
            if (!material) {
                material = track(new THREE.MeshBasicMaterial({ color, transparent: muted || config.visualStyle === 'hologram', opacity: muted ? .3 : config.visualStyle === 'hologram' ? .78 : 1, wireframe: config.visualStyle === 'hologram' }));
                materialMap.set(key, material);
            }
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(p);
            if (active)
                mesh.scale.setScalar(1.4);
            mesh.userData.nodeId = node.id;
            scene.add(mesh);
            pickables.push(mesh);
        }
        const points: number[] = [], colors: number[] = [];
        const normal = new THREE.Color('#62778e'), highlight = new THREE.Color('#9deaff');
        const arrowMaterial = track(new THREE.MeshBasicMaterial({ color: '#86b7ca', transparent: true, opacity: .65 }));
        for (const edge of selection.edges.slice(0, limit.edges)) {
            const a = positions.get(edge.from), b = positions.get(edge.to);
            if (!a || !b)
                continue;
            const direction = b.clone().sub(a);
            const length = direction.length();
            if (length < .01)
                continue;
            direction.normalize();
            const start = a.clone().addScaledVector(direction, .16), end = b.clone().addScaledVector(direction, -.19);
            points.push(...start.toArray(), ...end.toArray());
            const color = config.highlightRelations && (edge.from === config.selectedId || edge.to === config.selectedId) ? highlight : normal;
            colors.push(...color.toArray(), ...color.toArray());
            const head = new THREE.Mesh(arrow, arrowMaterial);
            head.position.copy(end);
            head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
            scene.add(head);
        }
        const lines = track(new THREE.BufferGeometry());
        lines.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
        lines.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        scene.add(new THREE.LineSegments(lines, track(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .65 }))));
        if (config.visualStyle === 'hologram' && positions.size) {
            const bounds = new THREE.Box3().setFromPoints([...positions.values()]);
            const size = Math.max(4, bounds.getSize(new THREE.Vector3()).length());
            const grid = new THREE.GridHelper(size, 12, '#459aa5', '#214554');
            grid.position.copy(bounds.getCenter(new THREE.Vector3()));
            grid.position.y = bounds.min.y - .5;
            track(grid.geometry);
            for (const m of Array.isArray(grid.material) ? grid.material : [grid.material]) {
                m.transparent = true;
                m.opacity = .25;
                track(m);
            }
            scene.add(grid);
        }
        return { scene, pickables, positions, dispose };
    }
    catch (error) {
        dispose();
        throw error;
    }
}
export type GraphScene = ReturnType<typeof createGraphScene>;
