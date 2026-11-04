import React, { useEffect, useRef } from 'react';
import { createSpatialController } from './three-controller.ts';
import type { SpatialViewProps } from './render-types.ts';
export default function ThreeView(props: SpatialViewProps) {
    const host = useRef<HTMLDivElement>(null);
    const controller = useRef<ReturnType<typeof createSpatialController> | null>(null);
    const current = useRef(props);
    current.current = props;
    useEffect(() => { try {
        if (host.current)
            controller.current = createSpatialController(host.current, current.current);
    }
    catch {
        current.current.onUnavailable('WebGL 2 konnte nicht gestartet werden.');
    } return () => { controller.current?.dispose(); controller.current = null; }; }, []);
    useEffect(() => { try {
        controller.current?.update(props);
    }
    catch {
        props.onUnavailable('Die 3D-Szene konnte nicht aufgebaut werden.');
    } }, [props.scene, props.layout, props.config]);
    return <div className="mesh-three"><div className="mesh-map-controls"><button onClick={() => controller.current?.fit()}>3D einpassen</button><span>Ziehen: drehen · Scrollen: zoomen · Knoten anklicken</span></div><div ref={host} className="mesh-three-stage"/><p className="mesh-muted">Die Knotenliste bietet dieselbe Auswahl per Tastatur. Kurze Kamerafahrten nur bei Bedarf. Escape stoppt; Ziehen hat Vorrang. Keine Daueranimation.</p></div>;
}
