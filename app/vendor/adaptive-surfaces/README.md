# Cue adaptive surfaces · isolated candidate

A small internal declarative React surface layer for the existing Android-first shell. This package is **not** an A2UI, AG-UI, MCP Apps or MCP Tasks implementation. It has no auth, connection, remote tool, write executor, external HTML or network binding.

## Run

Node 22.15+ (verified here: Node 24.19). Dependencies are pinned in this package's own registry-based lockfile.

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run dev
```

`npm run dev` binds 127.0.0.1:4176. The production demo has a deny-network CSP. Development HMR can be blocked by that policy; use a static server for `dist/demo` to inspect the production bundle. No deployment was performed.

For the original shared workspace only, `node scripts/setup.mjs` can reuse **version-checked installed dependencies** by local symlinks. The final validation was performed after a separate clean offline `npm ci --ignore-scripts`, not against those symlinks.

## Deliverables

- `schema/surface-v1.schema.json`: exact closed internal JSON Schema (2020-12)
- `src/json.ts`, `src/validate.ts`, `src/session.ts`: bounded parsing, admission and host intent gateway
- `src/SurfaceRenderer.tsx`, `src/styles.css`: React catalog and mobile layouts
- `dist/library`: ESM library, scoped stylesheet and source map
- `dist/types`: declarations
- `dist/demo`: static offline demo with independent host shell
- `docs/INTEGRATION.md`: trusted/untrusted contract and integration examples
- `docs/TEST-MATRIX.md`: exercised cases and remaining real-device gates
- `docs/SPEC.md`, `docs/superpowers/plans/2026-09-30-adaptive-surfaces.md`: spec and implementation plan
- `docs/red-tests.txt`, `docs/regression-red.txt`, `docs/pending-red.txt`: test-first evidence
- `docs/test-results.txt`, `docs/build-results.txt`: final checks
- `docs/REVIEW-FIXES.md`: independent finding remediation and new lifecycle guarantees
- `docs/build-manifest.json`: SHA-256 fingerprints

## Essentials

Only complete atomically validated snapshots are admitted. Invalid updates retain the previous snapshot with a visible rejection. DataRefs are exact keys into a **host-supplied, surface-scoped Map**. Intents resolve only registered navigation/suggestion definitions and require explicit activation. A callback is an intent handoff, not approval or a tool call.

Graph and skill content are host slots. Their existing modules were neither copied nor edited. The demo contains clearly labelled slot placeholders, not a new graph or skill runtime.

Node/HappyDOM tests and a production build do not prove real browser layout, Android, TalkBack, GPU or native-bridge isolation. The existing Android shell has not been integrated or modified by this package.
