# Integration against the real V4 app

## Baseline and dependency boundary

The only domain entry points are `src/model.ts` imports of `buildMissionGraph` from the exact upstream `intelligence.ts`, the real `savedWorkContract`/WorkState, and AppEvent types. All eight transitive schema dependencies are unmodified and hashed in `upstream/provenance.json`. The fixture uses those schemas; no alternate production WorkState was invented.

Current baseline: 8bb56544677a7433a2566da3885ada6cd31b1b0d. `npm run check:upstream` verifies the bundled bytes and compares the current adjacent cue-audit files when present. Final integration waits for the final application source. Rebind these explicit imports to the final application's canonical modules (or regenerate and review the pinned copy), then rerun all tests and the real application regression suite. Do not copy this preview snapshot over the final application domain model.

## Minimal host composition

Build this private local package first and link it through the host workspace or a local file dependency. It has not been published to npm; the package name below is a local workspace import.

```tsx
import { GraphExplorer, adaptWorkState, parseConfig } from 'cue-mesh-graph-explorer-extension';
import 'cue-mesh-graph-explorer-extension/styles.css';

// work is the host's current validated WorkState or null while unknown.
// sources is its actual source metadata or null while unavailable.
const graph = useMemo(() => adaptWorkState(work, sources), [work, sources]);

<GraphExplorer
  graph={graph}
  initialConfig={savedView ? parseConfig(savedView) : undefined}
  onConfigChange={next => setPreviewView(next)}
  onSaveView={next => saveRequestedViewConfiguration(next)}
  onNavigate={target => navigateToExistingView(target.view, target.entityId, target.query)}
  onPrepare={intent => openExistingEvidenceReviewForm(intent)}
/>
```

`initialConfig` is read on mount. To restore a saved view later, validate with `parseConfig` and remount the explorer with a changed React key. `onConfigChange` only describes local UI changes; it does not request persistence. `onSaveView` is invoked only by the explicit save action and receives a validated independent value. The UI says that this value was handed to the callback, not that later edits were saved. A rejected callback is reported. View preferences are not WorkState writes.

`onNavigate` receives `{view, entityId, nodeId, query}` with view in agents, missions, matrix, chats or evidence. No routes are guessed inside the module. `onPrepare` receives `{kind:'review-evidence', entity:'mission'|'task', entityId, nodeId, expectedUpdatedAt}`. It is a request to prepare/open the host review form, not permission to accept, execute, approve or write a result. The host must retain existing freshness, authorization and confirmation controls. A missing callback leaves the corresponding button disabled.

## Renderer extension seam

Both renderers receive the same `SpatialViewProps`: bounded scene selection, deterministic layout, validated config, `onSelect(id)` and `onUnavailable(message)`. The optional `render3D` prop can provide the final existing 3D/AR module later. Its implementation must honor shared IDs, selection, limits, provenance and cleanup, and report capability failures through the callback. Keep AR acceptance separate. The default implementation never calls getUserMedia, WebXR sessions or camera permissions.

Future production/video/development/learning views should be explicit model projections with real sources and typed layout functions. They must not infer unsupported production states or invent media/progress. The current implementation supplies shared primitives, not completed niche workflows or live integrations. Existing dashboard animation and design are untouched because no existing app files were edited.

## Semantics

- Network is an ID-stable kind-ordered ring, not a simulation of activity
- Workflow uses actual mission stage/task status lanes; profile, room and source context has separate lanes
- Evidence uses source/mission/prerequisite-depth columns. Column depth is structural and does not prove evidence quality or completion
- All displayed relations are original V4 builder edges. Unresolved/archived references are counted separately; placeholders are not fabricated
- The list and inspector retain entities outside visual-budget limits. Filters can hide a selected node without clearing it; the inspector explains this. A deleted/missing selected ID stays explicit until the user clears it
- Focus shows the selected node and its recorded immediate neighbors under the current filters. The matching list stays available
- Event records are the actual retained command.events (schema maximum 200), descending by sequence. Older activity and completeness remain unknown. Selecting an event goes to the current entity, never an old reconstructed state
- App snapshot timestamp applies to the snapshot, not an inferred per-entity last-modified time. External observedAt is supplied independently and otherwise unknown

## Resource budgets and fallback

Low: 60 nodes / 120 edges / DPR 1 / sphere segments 8. Balanced: 160 / 360 / DPR 1.5 / segments 12. High: 320 / 700 / DPR 2 / segments 16. The adapter caps external source metadata at 500 records. The visual scene caps vertices/edges again. Full real state is not truncated silently.

Rendering is on demand, with no idle loop. Optional bounded transitions use a cancelable RAF timeline only while an explicit layout/focus/selection change is in progress (160–320 ms, disabled by default). OrbitControls damping and auto-rotation are off. Reduced motion defaults on and respects the system setting; low-quality power-saving mode also forces immediate presentation. See ANIMATION.md for gesture/Escape/visibility/error cancellation, V1 compatibility and exact limits. Holographic style uses bounded translucent wireframe geometry, a static grid and restrained SVG glow; low quality disables SVG glow. It is a visual convention, not a physical hologram. No shaders/post-processing, image textures or fetched assets are required.

Scenes own their sphere/cone/line/grid geometry and material resources. Shared resources are disposed once. Controller teardown disconnects ResizeObserver, removes controls and event listeners, disposes the scene and WebGLRenderer, loses its context and removes owned DOM. Context loss or unavailable WebGL falls back to the same functional SVG/inspector. The error boundary also covers lazy-module load failure.

## Acceptance before adoption

1. Freeze final upstream and reconcile exact domain/schema changes
2. Wire existing navigation, review forms and explicit preference storage; test denied/stale/cancelled paths
3. Independent code review and all unit/DOM/static checks
4. Actual desktop/mobile screenshots and visual comparison against the existing app; touch/keyboard/zoom/resize tests
5. Real WebGL 2: repeated view switches, context loss/recovery, resource-count plateau, wide graph and power-saving checks
6. Real Android/WebView and any later Windows/AR acceptance separately
7. Only then consider app integration and publication under its separate authorization

## Official references consulted

- React lazy loading: https://react.dev/reference/react/lazy
- Three WebGLRenderer, disposal and WebGL 2 capability: https://threejs.org/docs/pages/WebGLRenderer.html
- OrbitControls: https://threejs.org/docs/pages/OrbitControls.html
- MeshBasicMaterial and wireframe: https://threejs.org/docs/pages/MeshBasicMaterial.html
- Material transparency/disposal: https://threejs.org/docs/pages/Material.html

The relevant installed Three 0.186.1 implementation/types were also inspected. No third-party template code or additional animation library was installed.
