# Approved Appearance A1-Holo design

The user approved continuing implementation of the shared appearance design on 2026-10-05. Work only in this isolated source copy. FINAL984 remains unchanged.

## Outcome
Room 2D, room Three/WebXR, Studio SVG/Three and native AR consume one effective NodeAppearance: core/shell/orbit HEX colors, shape polyhedron|cube, size small|normal|large, motion off|breathe. Fixed size factors 0.8/1/1.25. Defaults use existing per-kind room colors for all three channels, polyhedron, normal, off. Native Core/Shell/Orbit remain. No movement of centers or semantic edges. Global motion gates override preferences.

## Shared API
src/appearance/contracts.ts exports NodeAppearance, AppearanceState, AppearanceBinding, defaultAppearanceState(), parseAppearanceState(raw). NodeAppearance fields: core:string, shell:string, orbit:string, shape, size, motion. AppearanceBinding={kind:'room'|'mission',id:string,createdAt:string}. AppearanceState={schema:'lowquantflow.appearance/v1',global:Partial<NodeAppearance>,overrides:Array<{binding:AppearanceBinding,style:Partial<NodeAppearance>}>}. Store record={revision:number,value:AppearanceState}; revision starts at 0 for absent record and first save becomes 1. Own key appearance-v1 in cue-system-preferences-v2/preferences, no writes on load. Safe integer CAS, max 256 overrides, max 256KiB.

src/appearance/projection.ts exports resolveNodeAppearance(node:{id:string,entityId:string,kind:string,color?:number},work:WorkState,state:AppearanceState):NodeAppearance; appearanceBinding(node,work):AppearanceBinding|null; sizeScale(size):number; projectSpaceAppearance(graph,work,state) returns same topology with each node appearance:NodeAppearance and color=parseInt(appearance.core.slice(1),16). Bind only actual nonarchived room/mission with matching ID; no fake incarnation.

src/appearance/AppearanceProvider.tsx exports AppearanceProvider and useAppearance():{value:AppearanceState,ready:boolean,error:string|null,previewing:boolean,preview(next:AppearanceState):void,cancel():void,save():Promise<void>}. value is effective draft or persisted state. Only one draft. Panel owns target selection but not a second draft. src/appearance/AppearancePanel.tsx exports AppearancePanel props {node?:{id:string,entityId:string,kind:string,color?:number,title?:string},work:WorkState,disabled?:boolean,active?:boolean}. Close/escape/inactive cancels; reset changes draft only; save requires loaded state and valid current binding.

## Integration
Provider wraps system-app once. Panel in room inspector and Studio selected inspector. Host-render adapters keep vendor/upstream bytes unchanged. Edit generators, never rely on hand-edited generated overlays. Appearance updates preserve camera and renderer identity. 2D shape/color swatch must preserve minimum touch area and status text.

Native bridge requires a complete appearance field on every node for v2 snapshots, with strict equivalent TS/Java validation. v1 stays readable with legacy defaults. New build always sends v2 full appearance. Digest includes effective appearance and motion gates; stale selection rejected. Native optics retain depth/Core/Shell/Orbit and 32 detailed node limit. No new camera permissions, APIs, assets, dependencies or remote writes.

## Persistence and backup boundary
Only appearance-v1 changes. WorkState, journal, memory, approvals and system preferences remain untouched. Appearance is local and explicitly excluded from current project backups; no claim of restore support. Corrupt/future schema/CAS/uncertain writes block save while preserving draft.

## Verification
TDD per assigned component, TS/Java contract fixtures, CAS/abort/reload/identity isolation, panel preview/save/cancel/reset, renderer color updates without remount/camera reset, motion gates, native legacy/v2 boundary, existing test suites and quality verification. Static guards do not prove Android visual behavior. Device visual/performance tests remain explicitly pending.
