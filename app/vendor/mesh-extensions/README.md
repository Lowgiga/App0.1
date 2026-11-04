# Shared Graph Explorer · extension candidate

An isolated, testable V4 extension. It is **not installed in the dashboard, Android app or AR module**. No publication, background activity, new backend, camera permission or automatic domain write occurs.

## What works

- Real V4 `buildMissionGraph` and schema validation; existing namespaced IDs and typed edges remain intact
- Shared selection, query/kind/origin filters and inspector across network, workflow and evidence/dependency viewpoints
- Accessible SVG plus optional dynamically loaded Three/WebGL 2 renderer; front, top and spatial camera presets
- A direct-neighbor focus mode and larger presentation mode; full matching node list remains available
- Optional clearly-labelled holographic **visual** style, toggleable relationship emphasis, reduced motion, label density and quality budgets
- Opt-in bounded layout/selection transitions, cancelable camera framing and an immediate low-power alternative; old V1 views remain immediate
- Actual entity attributes, typed navigation and preparation intents, no domain mutations
- Retained actual events only, with explicit incomplete-history / no-reconstruction notice
- Versioned, validated, exportable view config; explicit host-owned save callback and clear error feedback
- Unknown state/source time, omitted archived data, dangling references and visual-budget omissions are disclosed

## Set up without changing another project

The candidate intentionally reuses exact React/Three/build-tool installations from `../android-port/node_modules` through individually verified symlinks. `scripts/setup.mjs` does not install anything there and does not write its lockfile.

Node 24 was used; this candidate's test loader uses `module.registerHooks` and therefore requires **Node 22.15+ or 24+**. The package engine matches this lower bound; Node 24 is recommended for these commands.

```sh
cd /workspace/scratch/40c5c5523452/mesh-extensions
mkdir -p .test-tools
cp tooling/dom/package.json tooling/dom/package-lock.json .test-tools/
npm ci --prefix .test-tools --registry=https://registry.npmjs.org
npm run setup
npm run check:upstream
npm test
npm run build
npm run dev
```

`happy-dom@20.14.5` is the only newly installed dependency and is test-only, isolated in `.test-tools`. A pinned transitive lockfile is in `tooling/dom`. Runtime dependencies and all build tools come from the existing port installation.

The local demonstration is on port 4175. It begins with **unknown data**. Choose a real WorkState JSON file or `{ "work": <WorkState>, "sources": <SourceRecord[]> }`. `sources` is optional and omission means unknown, not a connected feed. Reading a chosen file stays in browser memory. Existing exports with a `work` object are accepted; source metadata must be supplied explicitly if the export does not have `sources` at the top level. Exported view JSON can be reloaded separately.

## Outputs

- `dist/library/graph-explorer.js` plus CSS and a separate optional Three chunk
- `dist/types/src/index.d.ts` and supporting declarations
- `dist/demo/` static local demonstration
- `docs/INTEGRATION.md`: final V4 integration contract and boundaries
- `docs/VERIFICATION.md`: exact checks, limits and outstanding acceptance
- `docs/ANIMATION.md`: functional transition semantics, V1 compatibility, resource limits and provenance

`upstream/` contains only eight checksum-pinned V4 modules from commit `8bb56544677a7433a2566da3885ada6cd31b1b0d`. The adapter is explicit; this does not silently replace the application's domain model. Final V4 is still pending and drift must be reviewed before integration.
