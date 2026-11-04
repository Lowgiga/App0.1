import React, { useEffect, useRef } from 'react';
import { createSpatialController } from '../overlay/appearance-three-controller.ts';
import type { SpatialViewProps } from '../vendor/mesh-extensions/src/render-types.ts';
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
    return <div className="mesh-three"><div className="mesh-map-controls"><button onClick={() => controller.current?.fit()}>3D einpassen</button><span>Ziehen: drehen · Scrollen: zoomen · Knoten anklicken</span></div><div ref={host} className="mesh-three-stage"/><p className="mesh-muted">Die Knotenliste bietet dieselbe Auswahl per Tastatur. {props.config.labels==='all'&&'Überlappende Namen werden ausgeblendet; alle Knoten bleiben in der Liste auswählbar.'} Kurze Kamerafahrten nur bei Bedarf. Escape stoppt; Ziehen hat Vorrang. Optionales Atmen bewegt nur die Hülle und den Orbit. Bewegungsreduktion und Energiesparen haben Vorrang.</p></div>;
}
