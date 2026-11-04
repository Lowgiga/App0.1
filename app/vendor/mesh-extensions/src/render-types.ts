import type { SceneSelection, ViewConfig } from './view.ts';
import type { LayoutResult } from './layouts.ts';
export type SpatialViewProps = {
    scene: SceneSelection;
    layout: LayoutResult;
    config: ViewConfig;
    onSelect: (id: string) => void;
    onUnavailable: (reason: string) => void;
};
export const nodeColors = { agent: '#72b7ff', mission: '#c4a6ff', task: '#71e6cd', room: '#fac78d', source: '#a7c6d8' };
