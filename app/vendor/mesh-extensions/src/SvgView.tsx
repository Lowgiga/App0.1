import React, { useId, useRef, useState } from 'react';
import type { SpatialViewProps } from './render-types.ts';
import { nodeColors } from './render-types.ts';
import { useSvgMotion } from './use-svg-motion.ts';
import { relationNames } from './model.ts';
export function SvgView({ scene, layout, config, onSelect }: Omit<SpatialViewProps, 'onUnavailable'>) {
    const marker = useId().replaceAll(':', '');
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const host = useRef<HTMLDivElement>(null);
    const { frame, stop } = useSvgMotion(layout, scene, config, host);
    const visual = frame.layout;
    const b = visual.bounds;
    const width = b.width / zoom, height = b.height / zoom;
    const x = b.x + (b.width - width) / 2 + pan.x, y = b.y + (b.height - height) / 2 + pan.y;
    const changeZoom = (v: number) => { stop(); setZoom(z => Math.max(.4, Math.min(6, z * v))); };
    const move = (dx: number, dy: number) => {
        const target = stop().layout.bounds;
        setPan(p => ({ x: p.x + target.width / zoom * dx, y: p.y + target.height / zoom * dy }));
    };
    return <div ref={host} className="mesh-map"><div className="mesh-map-controls" aria-label="Kartensteuerung"><button aria-label="Vergrößern" onClick={() => changeZoom(1.3)}>+</button><button aria-label="Verkleinern" onClick={() => changeZoom(1 / 1.3)}>−</button><button aria-label="Karte links" onClick={() => move(-.15, 0)}>Links</button><button aria-label="Karte rechts" onClick={() => move(.15, 0)}>Rechts</button><button aria-label="Karte oben" onClick={() => move(0, -.15)}>Oben</button><button aria-label="Karte unten" onClick={() => move(0, .15)}>Unten</button><button onClick={() => { stop(); setZoom(1); setPan({ x: 0, y: 0 }); }}>Einpassen</button></div>
 <svg role="group" aria-label="2D-Beziehungsgraph" viewBox={`${x} ${y} ${width} ${height}`} className="mesh-svg">
 <defs><marker id={marker} viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/></marker></defs>
 {visual.lanes.map((lane, i) => <text key={i} x={lane.x} y={lane.y} className="mesh-lane" textAnchor="middle">{lane.label}</text>)}
 {scene.edges.map(edge => { const a = visual.positions[edge.from], b = visual.positions[edge.to]; if (!a || !b)
        return null; const active = edge.from === config.selectedId || edge.to === config.selectedId; return <line key={edge.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={active && config.highlightRelations ? '#94dfef' : '#657184'} strokeWidth={active ? 2.4 : 1.3} opacity={config.highlightRelations && config.selectedId && !active ? .3 : .75} markerEnd={`url(#${marker})`}><title>{edge.from} {relationNames[edge.relation]} {edge.to}</title></line>; })}
 {scene.nodes.map(node => {
            const p = visual.positions[node.id];
            if (!p)
                return null;
            const selected = config.selectedId === node.id;
            const label = config.labels === 'all' || config.labels === 'selected' && selected;
            return <g key={node.id} data-node-id={node.id} role="button" aria-label={node.title} aria-pressed={selected} tabIndex={0} transform={`translate(${p.x} ${p.y})`} opacity={frame.emphasis[node.id]?.opacity ?? 1} onClick={() => onSelect(node.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(node.id);
            } }}>
 <title>{node.title} · {node.status ?? 'Status unbekannt'} · {node.detail}</title><circle r={frame.emphasis[node.id]?.radius ?? (selected ? 19 : 14)} fill={nodeColors[node.kind]} stroke={selected ? '#fff' : '#243647'} strokeWidth={selected ? 3 : 1.5}/>{label && <text y={35} textAnchor="middle" className="mesh-node-label">{node.title.length > 32 ? node.title.slice(0, 31) + '…' : node.title}</text>}</g>;
        })}
 </svg></div>;
}
