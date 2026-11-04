# Functional transitions · isolated extension candidate

## Behavior and boundaries

Optional `transitions: 'off' | 'brief' | 'smooth'` is one presentation preference shared by SVG and Three. Default is `off`, and reduced motion remains enabled by default. Selecting a transition does not disable the user's or operating system's reduced-motion preference.

- SVG: interpolate positions and viewport when the user changes layout or focus; interpolate selected-node size and unrelated-node opacity when the selection changes. Entity membership, IDs, inspector values, keyboard semantics and selected ID change immediately. Removed/filtered nodes are never kept as animated ghosts. Focus frames the visible, actual one-hop neighborhood. At most the existing visual node budget is interpolated
- Three: node/edge geometry switches immediately. Only camera framing is interpolated for layout, mode, perspective and explicit fit; selection gently translates the current camera and target by no more than 20% of their separation, retaining zoom and orientation. This is not a 3D scene-morphing implementation
- Holographic mode remains a screen visual style. These same transitions can be combined with it. No physical hologram, AR, camera, WebXR or added asset path
- Frames never call save, navigation, preparation or selection callbacks. The inspector and host callbacks remain user-action driven
- No initial entrance animation, simulated data activity, ambient motion, idle animation loop or continuous render loop

## Motion and energy precedence

Immediate mode applies when transitions are off, the user's reduced-motion option is on, the system prefers reduced motion, the document is hidden, or quality is `low` (`Sparsam · ohne Übergänge`). System preference is resolved by GraphExplorer and passed to both renderers. Low quality is the explicit energy-saving presentation mode; this package does not claim to detect OS battery-saving state.

Brief lasts at most 160 ms. Smooth is capped at 240 ms in balanced and 320 ms in high quality. The timeline also enforces an absolute 320 ms bound. These are elapsed-time targets: throttled RAFs finish on the first subsequent frame, and hiding the document settles immediately. They are not an FPS, frame-count, battery-use or latency guarantee. The budget does not establish hardware performance.

Each renderer owns one cancelable timeline. A new transition replaces the previous one from the currently shown state. A generation guard rejects canceled callbacks even if the runtime delivers them late. After completion, cancellation, unmount, context loss or rendering failure there is no scheduled animation frame.

- Escape anywhere inside the explorer settles SVG at the latest target, and holds the current 3D camera position
- SVG pan/zoom/fit buttons settle any active transition before applying the user's action. Pan uses the settled target dimensions synchronously, rather than the previous rendered viewport
- Three fitting retains safe shared distance and clipping bounds during the transition, including the new scene geometry's distance from both camera endpoints. Final bounds apply only at completion; cancellation retains the safe interim bounds without moving the held camera
- Three OrbitControls start events cancel automatic camera motion. While a gesture remains active, configuration changes may replace geometry but do not move the camera, and no delayed fit is queued. This includes a pinch with one pointer canceled. Wheel gestures use the same start/end contract. Picking requires an uninterrupted primary single-pointer tap; pinch, canceled pointers and drag-return do not trigger selection
- Reduced-motion, off and low-quality changes settle the current destination immediately. A cleared or hidden 3D selection cancels its old camera destination
- Visibility loss settles; context loss/error stops without more frames and preserves the existing SVG fallback path. React teardown disposes the timeline and all existing renderer resources/listeners

## V1 compatibility

The domain/config version remains 1. `parseConfig` explicitly defaults a missing `transitions` field to `off`; invalid values and other unknown fields still fail validation. `ViewConfigInput` permits old typed initial configurations, while normalized `ViewConfig` includes the decoded field.

New ordinary exports preserve the transition preference. The original strict V1 reader predates the added field and would reject such exports. Use the UI checkbox “Export für ursprüngliche V1-Ansicht” or `serializeConfig(config, { legacyV1: true })` for those consumers. That export removes only `transitions`, preserving the original fields, selection and filters. Loading it back here restores immediate transitions. Host save callbacks receive the normalized config; an old host storage validator must be updated or deliberately use the legacy export.

## Evidence and limits

See `animation-evidence/` for test-first failures, final Node test output, TypeScript/build and upstream checks. `animation-source.diff` contains the source/test delta against the immediately prior 30-test candidate, and `animation-manifest.json` contains SHA-256 hashes and scope.

Tests use a synthetic monotonic RAF clock, real React on Happy DOM, and real Three objects with an injected renderer. This verifies deterministic lifecycle/control flow and presentation state, not pixels, GPU execution, WebGL device resources, touch hardware, Android/WebView or real energy usage. The original 30 tests remain in place. Browser/GPU/mobile acceptance remains mandatory before adoption; the existing dashboard and apps are unchanged.

## Provenance / licenses

No new dependency, copied template, shader, image, font or other external asset was fetched or installed for this work. Animation code is local to this candidate.

Existing dependencies inspected:
- React 19.2.6: MIT, installed `react/LICENSE`; official effect lifecycle reference: https://react.dev/reference/react/useLayoutEffect
- Three 0.186.1: MIT, installed `three/LICENSE`; installed OrbitControls implementation was inspected for actual start/end, pointer cancellation and disposal behavior. Official references: https://threejs.org/docs/pages/OrbitControls.html and https://threejs.org/docs/pages/WebGLRenderer.html
- Platform request/cancelAnimationFrame and monotonic performance.now are used via an injectable clock; no animation library was added

These are attribution/reference links, not asset-loading URLs. The retained third-party licenses still belong to their owners. No compatibility with future dependency versions is assumed.
