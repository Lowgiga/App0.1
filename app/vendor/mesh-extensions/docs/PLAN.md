# Shared Graph Explorer Implementation Plan

> Use test-driven, independently reviewed implementation. Scope is only mesh-extensions.

Goal: testable isolated V4 graph explorer with shared 2D/3D selection and three truthful viewpoints.
Architecture: pinned upstream adapter → normalized model/config/layout selectors → accessible React shell/SVG → lazy Three renderer.
Tech stack: React 19, Three 0.186, TypeScript, Vite, Node test; existing android-port runtime tooling reused read-only; test-only DOM environment isolated here.
Spec: SPEC.md

1. [x] Bootstrap an explicit dependency-link setup, pinned minimal V4 module snapshot and drift report. Record upstream file hashes and independent package manifest.
2. [x] Write failing model tests for actual V4 IDs/edges, provenance, unknown state, bounded historical event records, unresolved references, frozen inputs and evidence attributes. Implement adapter/model.
3. [x] Write failing config/layout tests for all three deterministic layouts, finite/cycle-safe coordinates, bounds, persistent selection/filters, config roundtrip and rejection of malformed settings. Implement pure selectors.
4. [x] Write failing React DOM tests for filters, keyboard/SVG/list selection, layout retention, inspector actions, unknown state and explicit save failure. Implement responsive shell, SVG and inspector.
5. [x] Write failing resource/scene tests for bounded geometry and complete disposal, and unavailable WebGL fallback. Implement on-demand lazy Three renderer with camera presets and no background loop.
6. [x] Build candidate and declarations, verify code splitting, run full tests/typecheck; request independent review, fix findings test-first, rerun all checks.
7. [x] Write integration guide and exact verification report. No publication or existing-app modifications.

Final independent parent rerun passed all 30 tests, drift check and full build; review findings were reproduced and corrected. Real browser/device/GPU acceptance remains outside the verified scope.
