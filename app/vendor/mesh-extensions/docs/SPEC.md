# Graph Explorer Extension Candidate

Status: authorized first vertical slice, isolated from the V4 application. Baseline: cue-audit 8bb56544677a7433a2566da3885ada6cd31b1b0d. This is an architectural subsystem, not a modification of the existing app.

## Decision and alternatives
Use the real `buildMissionGraph` and WorkState schemas as an explicit adapter boundary. Preserve all existing graph IDs and relations, add inspected attributes and explicit source provenance, and retain the original domain model. This makes both renderers share one selection/filter/config state. A replacement graph engine would duplicate truth; integrating directly into the unfinished app would cause ownership/conflict risk. Both are rejected for this slice.

## Data and honesty
A nullable WorkState means unknown/unavailable, not an empty or invented workspace. Supplied WorkState is schema-validated. Snapshot time and source snapshot time are nullable and visibly unknown when missing. Existing builder deliberately excludes archived entities; report their count and unresolved references rather than pretending the graph is complete. Evidence is a real text field on mission/task, never inferred completion. Limited command.events are displayed as retained event records only, not time travel, replay, live activity or a complete audit ledger. No fabricated records in the demonstration; it starts unknown until a real user file is supplied.

## Shared explorer contract
One immutable graph with stable IDs, typed provenance, real entity attributes, and typed relations. One serializable versioned view config includes layout, renderer, selected ID, kind/origin/search filters, label density, quality, reduced motion and optional relationship highlight. Three deterministic layouts: network (kind rings), workflow (actual stage/status lanes), evidence/dependencies (source, mission, prerequisite-depth task, room/profile columns). These are viewpoints, not semantic changes. Selection survives filters/layouts; hidden/missing selection is explained and never silently transferred. Renderer budgets are explicit and omitted counts shown. Full filtered node list remains accessible outside visual budget.

## Surface
Dark neutral canvas and bright readable labels, restrained existing-style controls, German UI. Toolbar: layout, 2D/3D, query and inspectable advanced settings. Main SVG map and keyboard-accessible node list; inspector with real attributes, incident relations, provenance and optional host-owned navigation/preparation callbacks. Typed prepare intent opens preparation only and never executes a domain write. Responsive stacked inspector on narrow screens. All primary controls are labelled; SVG nodes support Enter/Space selection. No marketing images, fake telemetry, new AR/camera path, publication or external connection.

3D uses a dynamically imported React/Three module with OrbitControls, on-demand renders (no perpetual animation), selectable node meshes, camera presets, shared scene budget and renderer error fallback to 2D. Geometry/material/control/renderer disposal and listener/observer cleanup are mandatory. Reduced motion is the default; system preference is respected. Optional static relationship emphasis can be disabled. No lights/post-processing/text textures are necessary.

## Persistence and integration
Config export is a serializable value and JSON; restoring validates bounds and version. Persistence only via an explicit callback invoked by the save button; no global localStorage. Host callbacks own all navigation and any later persistence/write confirmation. V4 adapter imports a checksummed, exact, minimal copy of current V4 schema/graph modules so this candidate can be tested independently. Final integration rebinds that explicit adapter to final V4 modules after drift/compatibility review. Nothing in android-port or cue-audit is modified.

## Acceptance and limits
Test-first model/config/layout/DOM interaction tests, static typecheck, separate main and optional 3D bundles. Exercise unknown state, dangling references, deterministic reordering, bounds, filters/selection, save callback rejection, unavailable WebGL and cleanup using a documented test seam. Browser screenshots, GPU rendering, touch-device/Android/AR behavior remain unverified if the supplied environment blocks local browser access. No claim of app integration or final device acceptance.

## Approved scope refinements during implementation

The requested optional holographic visual style is implemented on the same SVG/Three model, without a new AR stack or physical-hologram claim. A genuine one-hop focus mode and larger presentation mode share the same serializable state. Primary text and controls respect the host root font scaling. Planned later specialist views remain extension points rather than unimplemented controls.
