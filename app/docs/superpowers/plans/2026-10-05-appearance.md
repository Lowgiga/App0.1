# Appearance A1-Holo Implementation Plan

> For agentic workers: execute task-by-task with TDD and review checkpoints.

**Goal:** Persist safe individual hologram styles consistently across existing views.
**Architecture:** Independent CAS store and preview provider feed one projection, consumed by host renderer adapters and a versioned native bridge.
**Tech Stack:** Existing React, TypeScript, Zod, Three, Android Java/OpenGL.
**Spec:** docs/superpowers/specs/2026-10-05-appearance.md

## Global Constraints
No upstream/vendor changes, new dependencies, domain writes, external publishing or changes to FINAL984. Preserve current native geometry, camera state and motion policy. Appearance excluded from current backups with explicit notice.

## Task 1: Store, contracts, bindings and editor
Files: src/appearance/{contracts,projection,store}.ts, AppearanceProvider.tsx, AppearancePanel.tsx, appearance.css; tests/system/appearance-{contracts,store,projection,ui}.test.ts[x].
- [ ] Write tests before production implementation: parse invalid colors/unknown fields; absent load causes no write; two saves at revision 0 yield one winner; aborted put has no commit; preview/cancel/reset do not save; mutation preserves WorkState; replaced createdAt receives defaults.
- [ ] Run `node --import ./scripts/register.mjs --test tests/system/appearance-*.test.ts tests/system/appearance-*.test.tsx` and record missing-feature assertions.
- [ ] Implement exact shared API in spec. Use readonly get for load and readwrite get/CAS/put for save; resolve only on transaction complete.
- [ ] Verify tests and `npm run typecheck`; preserve draft after error.

## Task 2: Host Web render adapters
Files: new src/appearance web adapters, scripts/build-ui-overlays.mjs, scripts/build-graph-overlay.mjs, src/studio/Studio.tsx, src/system-app.tsx; tests/system/appearance-web*.test.*.
- [ ] Test shared style in room/Studio; renderer instance and camera retained when colors change; reduced motion and source/status labels survive styling.
- [ ] Run focused tests to demonstrate missing style support.
- [ ] Consume provider/projection API. Generate imports and integration reproducibly. Keep semantic topology separate from appearance; update materials/geometry and selection scaling without renderer recreation. Add 2D swatches; panel remains compact.
- [ ] Rebuild overlays and run focused Web/render lifecycle tests and typecheck.

## Task 3: Native style bridge and rendering
Files: src/platform/native-ar.ts, src/NativeARPanel.tsx if needed; android/cue-native-ar Java geometry/snapshot/renderer/motion and tests; TS native appearance tests. Coordinator owns source manifest/pins.
- [ ] Write tests: v1 defaults, v2 appearance preserves all channels/enums; invalid enum/color/size/motion rejected; digest invalidates return; shape extents and size factors bounded; motion leaves centers fixed.
- [ ] Run TS/JUnit fixture tests red.
- [ ] Implement v2 with v1 reader, per-layer colors and bounded shape/scale/decorative breathe. Preserve GL depth ordering, detail limit, picker and app/OS motion gates.
- [ ] Run TS tests and available native unit checks. Report any unavailable toolchain truthfully.

## Task 4: Integration and independent review
- [ ] Inspect each worker diff and actual test logs. Regenerate native manifest and pins only from reviewed module inventory. Extend quality contract with appearance tests without weakening protected behaviors.
- [ ] Run `npm run verify:serial`, `npm run verify:quality -- --contract-sha256 <computed-current-contract-sha256>` using actual CLI format inspected in check-quality.mjs, native tests/build through existing authorized toolchain.
- [ ] Independent review addresses identity, transaction, renderer lifetime, bridge compatibility and cancellation. Fix findings with failing regressions first.
- [ ] Freeze source, compute full hash manifest and baseline-relative patch, prove unchanged FINAL984, record tests and unperformed S25 checks. Hand build-ready freeze to parent; no external push.
