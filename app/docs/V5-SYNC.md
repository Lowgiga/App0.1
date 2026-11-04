# Final upstream synchronization

- Final source: `../cue-final`, clean commit `2b838b4f574acfaff72013c270a1fa637eb995c6`
- Source product label: Sites V5 / App 1.4; work state version remains 4
- Entire tracked source snapshot: 193 byte-identical files; no source checkout modifications
- Previous V4 archive: `archive/v4-8bb5654/` (provenance, evidence, package information, full source/overlay archive and adapter checksums)
- No new graph/skills/backup modules, native builds, signing, uploads or hosting were added

## Imported changes

The final source supplies `academy-panel.tsx`, `space-renderer.tsx`, `lib/academy.ts`, `lib/space-model.ts`, refactored `mesh-space.tsx`, updated dashboard/workspace/help/CSS, two new private screenshots and the original spatial/Academy domain, API and browser tests. All tracked source files, including its documentation and scripts, are retained for provenance; server-only files are not used by the static entry point.

The source package manifest/lock are unchanged from V4. The port's own package version is labeled V5 preview; dependency pins remain unchanged.

## Preserved adapter fixes

The V5 source hook is byte-identical to V4. The adapter files, transport provider, conflict gate, and overlay generator match the archived pre-sync SHA-256 checksums. Specifically:

1. Unclear write replies and CAS conflicts keep subsequent saves locked until explicit full reload; visible drafts are not silently deleted or rebased
2. Final persisted timestamp is included in the UTF-8 budget
3. Abnormally closed IndexedDB connections invalidate only their own cached generation
4. Canonical event/action IDs reuse the production cryptographic UUID fallback
5. Current domain wall time stays separate from strictly monotonic CAS revision time

Local approval records still have no external execution authority, and device time is not a trusted authorization clock.

## Additional port contract checks

Seven new tests exercise the imported Academy via the local adapter: new module/assets inventory; all four explicit task owners with an atomic mission prerequisite; invalid-owner rollback; stale-CAS rollback with no partial link; preservation of V4 learning booleans through transfer/reopen; duplicate active transfer prevention; and the shared spatial graph reading the persisted mission/task relation.

The old baseline failed these tests at the explicit missing-Academy assertion. The synchronized source passes. The original new source domain tests also run inside the port suite.

The previously reported CSS scan-scope issue is fixed only in the port's PostCSS configuration: Tailwind scans the current `upstream/` tree, excluding V4 archives and port test fixtures. A test-only utility sentinel demonstrated a failing red cycle before this change and exclusion afterward. No upstream CSS was edited and no performance benchmark is inferred from build time.

## Evidence boundaries

Final own suite: 115/115 green (81 unchanged upstream pure-domain tests plus 34 port/adapter/build-scope tests). The existing independent-review regression suite was also rerun against V5: 19/19 green; this is a rerun of its checks, not a new independent browser audit. Typecheck, overlay generation, source drift check and production build pass.

Own test counts and current artifacts are in `all-tests.txt`, `build.txt`, `typecheck.txt`, `build-manifest.json` and `provenance.json`. Node adapter tests use fake-indexeddb and a minimal hook-state simulation. These are not browser IndexedDB, React DOM, Android, APK-update or AR evidence.

The source author's reported 230 domain/API checks and 44 browser checks are upstream claims, not rerun port/browser evidence. Copied HTTP API tests require the original server and were not represented as local adapter runs. Full browser access, Android file/clipboard/external-link handling, immersive AR and real MCP transport remain as shown in `PARITY.md`.

The V5 renderer has its own resource lifecycle, DOM-overlay requirement, XR session teardown/inline restoration and context-loss fallback. No old V4 AR failure is asserted against V5 without a new reproduction.
