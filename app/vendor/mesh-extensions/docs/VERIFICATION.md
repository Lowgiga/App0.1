# Verification report · 2026-09-30

## Latest supplement: functional transitions

The bounded transition extension is author-verified with **55/55 tests**, TypeScript, library/demo builds and upstream drift checks passing. The original 30 tests remain unchanged in intent and present. Independent final review passed the 55-test suite, 11 additional reviewer tests, full build and upstream check. Full behavior, V1 compatibility and device limitations: [ANIMATION.md](ANIMATION.md).

New evidence is under `animation-evidence/`; source/test delta is `animation-source.diff`; current hashes and changed-file list are `animation-manifest.json`. The historical `build-manifest.json` below records the earlier 30-test candidate, not the current animation build.

Added coverage: compatible default/legacy serialization and legacy typed initial configuration; five synthetic-clock timeline/interpolation tests; eleven additional Three lifecycle/framing tests; seven additional React DOM tests. Cases include exact ends, cancellation, rapid switches, stale frames, unmount, context loss, frame render failure, reduced/system motion, low-quality energy mode, hidden documents, Escape, SVG pan, retained multi-pointer gesture priority, bounded camera translation and no animation-originated host callbacks.

Current bundles: library main 53.06 kB, shared motion/domain/config chunk 76.53 kB, optional Three 667.87 kB (151.47 kB gzip); demo eager JS 294.79 kB (88.41 kB gzip), optional Three 564.44 kB (141.61 kB gzip). CSS remains 7.59 kB library / 7.58 kB demo. Vite's optional Three >500 kB warning remains, and npm reports an existing http-proxy configuration warning. No new dependency was installed.

Independent review reproduced three control-flow issues, each added as a failing regression and corrected:
1. A 300-node → single-node focus clamped the camera at frame zero. Transition distance/clip envelopes now retain the start view and cover translated target geometry; tests cover both directions, exact final bounds and cancellation
2. SVG pan used pre-settlement dimensions within the same click. The handler now receives the target viewport synchronously
3. Existing picking could select a node while one finger of a pinch was released. Only a primary single-pointer tap can pick; pinch/cancel/drag-return are excluded

The author and independent reviewer both passed the reviewer's 11 separate adversarial/StrictMode tests on the frozen fix. Evidence: `animation-evidence/review-suite-green.txt`. The reviewer independently confirmed all three reported issues and the translated-target clipping case are fixed; final manifest integrity is checked separately.

These are Node/DOM/injected-renderer checks, not browser/GPU/Android acceptance. No real frame-rate or energy measurements were performed.

## Original 30-test candidate outcome (historical baseline)

Isolated Graph Explorer extension candidate completed in `mesh-extensions`. It has not been integrated into any existing app or published. Baseline V4 commit: `8bb56544677a7433a2566da3885ada6cd31b1b0d`, still an unfinished upstream baseline.

30 tests pass, TypeScript checks pass, library/demo static builds pass, and all eight reused upstream module checksums match. Source/test/build hashes are in `build-manifest.json`.

## Executed checks

- `npm run setup`: verified exact dependency versions and linked individual existing runtime/build packages from android-port without writing there
- Test-only happy-dom 20.14.5 installed from the official npm registry under this module; pinned transitive lock is preserved in tooling/dom
- `npm run check:upstream`: exact vendored bytes and adjacent current V4 modules match the recorded commit
- `npm test`: 30/30 passing, Node 24.19.0
- `npm run build`: TypeScript noEmit, Vite library build, Vite static demo build, declaration emission all passing
- Parent independent read-only review ran the earlier 26-test suite successfully, then identified two concrete issues. Both were reproduced with failing tests and fixed. Final independent parent rerun passed 30/30 tests, check:upstream and the full build (Exit 0)

Evidence logs: `model-red.txt`, `model-green.txt`, `view-red.txt`, `view-green.txt`, `ui-red.txt`, `ui-green.txt`, `three-red.txt`, `three-green.txt`, `regression-red.txt`, `parent-review-red.txt`, `source-date-red.txt`, final `all-tests.txt`, `build.txt`, `upstream-check.txt`.

## Coverage

### Actual V4 model · 6 tests

- Canonical IDs/relationships exactly match buildMissionGraph; no input mutation
- Unknown WorkState and unknown external timestamp are explicit
- Retained event records preserve sequence/current entity semantics without reconstructing history
- Archived omissions and unresolved references are counted, not fabricated
- Invalid state/source IDs/source dates rejected
- Missing source dates are not described as dated snapshots

### Config and layouts · 8 tests

- Versioned JSON roundtrip, preserved selected ID/filters across layout change
- Invalid versions/settings/overlong queries rejected
- Filter-hidden and missing selection distinguished
- Scene limits, selected-node priority, endpoint integrity and omitted counts
- Three deterministic finite layouts, independent of input ordering
- Prerequisite ordering and cycle-safe bounded layout computation
- Safe empty bounds
- Functional immediate-neighbor focus without clearing the full matching list

### Real React DOM against Happy DOM · 9 tests

- Unknown-state surface
- Keyboard selection, layout/filter retention, real inspector evidence
- Typed navigation/preparation callbacks only after clicks, no domain mutation
- Explicit save callback, rejected-save feedback, serializable config export
- Honest incomplete activity copy and actual event text
- Host removal preserves a clear missing-selection notice
- Unavailable spatial renderer falls back to SVG with selection intact
- Holographic visual style toggles without changing entity selection
- Root-font change 16px→20px scales primary controls by 1.25; no font-size declarations in fixed px

Happy DOM is an actual DOM implementation for React tests. It is not Chrome, a WebView, a pixel renderer, a touch device or GPU validation.

### Actual Three object model, injected renderer · 7 tests

- Real bounded meshes and shared geometry/material resources, disposed exactly once
- Controller updates, context loss, cleanup and no subsequent window-resize rendering after disposal
- Renderer-construction failure with no leftover owned DOM
- Failed scene update leaves old resources disposable
- Holographic style retains IDs and uses bounded translucent wireframe geometry
- Late ResizeObserver setPixelRatio/setSize failures caught and reported exactly once
- Late window-resize failure follows the same controlled fallback

Three scene objects are real. WebGLRenderer is injected in lifecycle tests. These tests do not create or prove a functioning GPU context.

## Review fixes

1. Async resize calls had escaped the draw error handler. A separate resize guard now catches size/DPR/update errors, reports the unavailability once, and stops further rendering until the fallback unmount disposes resources
2. Fixed-pixel text ignored the host root-font setting. Text uses rem/inherit, primary controls default to 1rem and mobile controls remain readable in the CSS model. Actual visual layout remains to be checked
3. Self-review found the test loader needed Node >=22.15; the package engine and README now match
4. Self-review found a source-detail phrase inherited from buildMissionGraph implied a date even when no observedAt existed. The adapter now displays the actual date or explicit unknown, without changing canonical IDs/relations

## Static bundle evidence

Library: approximately 49.25 kB main plus 74.80 kB shared domain/config chunk and 7.59 kB CSS. Optional Three chunk is 664.69 kB raw / 150.58 kB gzip. React is external to the library.

Standalone demo: 290.64 kB raw / 86.99 kB gzip eager JS, 7.58 kB CSS; optional Three chunk 561.91 kB raw / 140.78 kB gzip. The optional chunk is referenced by dynamic import and is not part of the eager entry.

Vite emits a >500 kB warning for the optional Three chunk. This is recorded, not hidden. No additional runtime libraries, shader/postprocessing packages or template assets were installed.

## Explicitly not validated

- Real browser screenshots, CSS pixel layout or faithful match to the existing app's visuals
- Browser navigation, actual lazy-request network behavior and physical GPU rendering
- Mobile touch, Android/WebView, Windows or AR/WebXR
- Device-memory/resource plateau or real battery/performance measurements
- Existing dashboard integration, final upstream compatibility, production persistence, server authorization or external connectors

The parent reported that cloud-browser localhost navigation is blocked. That limitation was not circumvented. No local-browser/GPU/AR success is claimed.

## Remaining adoption gate

Finish/freeze V4, integrate via the explicit adapter and host callbacks, then validate actual browser/device appearance, interaction and GPU lifecycle. Existing app animation remains untouched. More specialized production/video/development/learning views and synchronization remain explicitly future scope.

## Final independent review confirmation

The parent completed a separate final run on the frozen source: 30/30 tests, exact upstream drift check and full build all passed with exit 0. Both requested fixes and explicit unknown source dates were checked. Independent logs are in the surrounding workspace reports/graph-parent-tests-final.log, reports/graph-parent-drift.log and reports/graph-parent-build.log. This closes code-level candidate review, not browser/GPU/Android/AR acceptance.
