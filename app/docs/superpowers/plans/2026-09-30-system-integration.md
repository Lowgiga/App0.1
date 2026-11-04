# Android-first Command Mesh Integration Plan

> Execute this plan incrementally, retaining passing tests and checking each integration boundary.

**Goal:** A portable, independently buildable Android-first source tree combining the final V5 application and reviewed local extension modules without changing the published website or original workspaces.

**Architecture:** Preserve the exact upstream V5 files under `upstream/`, generate narrowly anchored overlays, and resolve them explicitly at build time. Load WorkState once through a provider; original views and Studio consume the same loaded state and mutation functions. Vendor reviewed packages with hashed provenance and rebind domain imports to the canonical upstream domain, not copied domain versions.

**Tech Stack:** React 19.2.6, TypeScript 5.9.3, Vite 8.0.13, Three 0.186.1, Capacitor 8.5.2; Android Storage Access Framework.

**Spec:** Parent integration request, final upstream commit `2b838b4f574acfaff72013c270a1fa637eb995c6`, Sites V5 / App 1.4 / stateVersion 4.

## Global constraints

- Edit only `cue-system/`; no publication, signing, APK production, uploads, changes to original source folders, credentials, grants, external network integrations or paid services
- No URL-only WebView, global fetch/download patch, broad storage permission, fabricated user data, or unearned execution/readiness claim
- Original 17 views, Academy tasks, 3D/AR, settings, sources and screenshots remain available
- Full backup restore is disabled until separately implemented with explicit confirmation, atomic prior-state backup, compare-and-swap, rollback and verification
- New read-only workflows run only the reviewed fixed local handlers; historical permissions do not authorize them
- Portable source must not need sibling checkouts or absolute workspace paths
- Node/DOM/static tests cannot establish actual Android, WebGL, GPU, AR, touch or end-to-end behavior

## Ownership and acceptance matrix

| Area | Producer | Integration owner | Required acceptance |
|---|---|---|---|
| V5 source and local transport | android-port | cue-system | Upstream hashes, original 115 tests plus reviewer regressions, build |
| Capacitor shell | android-shell | cue-system | Security assertions, pinned 8.5.2, no stale bundled assets |
| Platform files and clipboard | cue-system | cue-system; independent parent review | Native SAF write/result/cancel/error/busy/size/lifecycle code, TS adapter tests; device checks explicitly pending |
| Portable backup | portable-kit | cue-system | Real schema validation, full preview, roundtrip of extension state, no restore action |
| Skills | skill-core | cue-system | Verified browser catalog, true readiness evidence, no fabricated host checks |
| Graph and motion | mesh-extensions after freeze | cue-system | Canonical WorkState adapter, selection navigation, persisted options, off/reduced motion, graph tests |
| Local pipelines | local-workflows after freeze | cue-system | Actual fixed handlers, fresh evidence, truthful error/stop, in-memory-only checkpoint disclosure |
| Adaptive Studio | adaptive-surfaces after freeze | cue-system | Closed schema and data refs, host-owned slots, typed intents, no compatibility claim |
| Android device acceptance | later native phase | parent/device owner | File chooser save/cancel/error, lifecycle, clipboard, touch/root font, WebGL/AR |

## 1. Freeze, copy and verify source

Files: `upstream/`, `src/local-*`, `overlay/`, `scripts/`, `package*.json`, `vendor/`, `integration-manifest.json`.

- [ ] Copy android-port excluding dependencies, dist and temporary caches; keep exact pinned upstream snapshot and original provenance
- [ ] Copy reviewed shell source excluding assets/public, build, Gradle caches and machine-local settings
- [ ] Add tests asserting upstream commit, all original views, no absolute workspace paths and no duplicated domain imports
- [ ] Pin each reviewed vendor snapshot only after producer freeze; copy source/tests/docs and record byte hashes
- [ ] Generate aliases and anchored overlays without rewriting upstream; fail on unknown anchors or hash drift
- [ ] Run original tests before integration changes and after every major boundary

## 2. Shared state and navigation

Files: `src/shared-work-state.tsx`, `src/system-app.tsx`, `src/system-navigation.ts`, generated `overlay/mesh-app.tsx`, `scripts/build-overlay.mjs`, `tests/shared-state.test.tsx`.

- [ ] Write a test with two consumers: after one mutation both see the same new WorkState and one initial load only
- [ ] Keep the existing tested loading/conflict/reconciliation hook; rename its generated implementation to `useLocalWorkState`
- [ ] Mount it exactly once in `SharedWorkStateProvider`; export a context `useWorkState` for original MeshApp and Studio
- [ ] Expose a typed local navigation event from Studio to preserved original views; reject unknown destinations
- [ ] Add a Studio entry using existing style tokens/components, keeping original 17 views intact
- [ ] Test loading/error gates, unmount, shared mutation identity, and URL view handling

## 3. Explicit platform file/clipboard adapter

Files: `src/platform/files.ts`, `src/platform/runtime.ts`, `android/app/src/main/java/de/lowgiga/cuecommandmesh/preview/CueFilesPlugin.java`, generated overlays for export callers, `tests/platform-files.test.ts`.

- [ ] Write tests for successful native save, cancellation, native error, repeated requests, MIME/name limits and no fallback on native error
- [ ] Native plugin uses ACTION_CREATE_DOCUMENT, a bounded UTF-8 payload, one pending request, and scoped URI write; returns saved only after close/flush
- [ ] Handle cancel distinctly; reject failed write and lifecycle loss, release pending call; never request broad filesystem access
- [ ] Browser adapter uses the file-system picker when available, otherwise an explicitly labeled browser-download handoff; do not claim disk success
- [ ] Clipboard adapter calls native ClipboardManager or browser clipboard and surfaces rejection; never silently exports as fallback
- [ ] Overlay every legacy JSON/Markdown export and selection-link clipboard call explicitly; remove false toast success claims
- [ ] Run static scan to prove no executable legacy Blob export path remains; native device behavior stays pending

## 4. Extension state and backup preview

Files: `src/system-preferences.ts`, `src/backup-adapter.ts`, `src/BackupPanel.tsx`, `tests/backup-roundtrip.test.ts`.

- [ ] Validate a versioned extension-state object containing view options, workflow configurations and ephemeral-history disclosure
- [ ] Store preferences separately with a strict schema and bounded local storage; never fork WorkState
- [ ] Backups supply `{work, data: {sourceCatalog, system}}` to the codec so new configuration is included
- [ ] Use actual `savedWorkContract` and reference validation; validate extension state and source catalog at the app boundary
- [ ] Render envelope provenance, integrity, incoming/current counts, normalization, conflicts, truncation and complete JSON inspection
- [ ] Keep no apply/restore control; state clearly that the preview does not change storage or authorize external actions
- [ ] Test roundtrip and malformed/missing extensions, stale target/loading state and zero writes

## 5. Studio: graph, skills, workflows and adaptive surface

Files: `src/studio/`, `vendor/`, `tests/system-integration.test.tsx`.

- [ ] Integrate frozen graph against actual loaded WorkState, existing source catalog and event data
- [ ] Map selections/intents into allowed original review views; graph never becomes a second editable store
- [ ] Persist graph/render/motion options; defaults respect reduced motion and allow disabling animation
- [ ] Initialize verified browser skill catalog; run actual self-tests before issuing bounded local evidence
- [ ] Provide run/stop/pause feedback from real workflow runner, preserving failures and no background execution claim
- [ ] Use adaptive schema with trusted host data references and fixed host slots; disclose its internal schema identity
- [ ] Cover golden fixture across modules, state changes, bounded events, UI invalid-schema rejection and root-font/mobile target rules

## 6. Portable build and acceptance report

Files: `README.md`, `docs/PARITY.md`, `docs/INTEGRATION-RESULTS.md`, `scripts/verify-integration.mjs`.

- [ ] Run provenance, all original and vendor suites, TypeScript, integrated build, and source portability assertions
- [ ] Check dependencies pinned and lockfile complete; build without adjacent source checkouts
- [ ] Describe real parity gaps: no Sites identity, MCP server, cloud sync or live provider execution; preserve their original source and adapters as later integration routes
- [ ] Document native SAF/clipboard and GPU/AR device acceptance as pending even when compilation passes
- [ ] Return final source snapshot and web build facts to parent for independent review; no APK build or release yet
