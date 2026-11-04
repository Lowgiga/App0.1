# Cue Android portability candidate

PRIVATE, LOCAL-ONLY PREVIEW. This is not the completed Android app and is not a claim of complete feature parity.

Baseline: `8bb56544677a7433a2566da3885ada6cd31b1b0d` (V4). The original dashboard task is still changing. The final source must be explicitly reviewed, synchronized, rebuilt and rechecked before release.

## Scope and execution

The existing dashboard is copied byte-for-byte into `upstream/`, including all 17 views and private bundled documents/evidence. Production domain contracts, state-change gates, event generation, budgets, intelligence actions, import/export logic and write reconciliation are reused unchanged. Nothing is deployed or uploaded.

The only substituted upstream module is `app/use-work-state.ts`. Vite resolves that import to a generated overlay using an explicit React transport provider. It does not override `fetch`, forge identity headers, contact Sites, impersonate a Sites login, or pretend that remote commands succeeded. Unsupported routes fail explicitly.

```sh
npm ci --ignore-scripts --cache /workspace/scratch/40c5c5523452/.npm-cache
npm test
npm run build
npm run preview
```

Preview normally binds only `127.0.0.1:4173`. This task environment isolates exec network namespaces, and the parent browser reports `ERR_BLOCKED_BY_CLIENT` for that local preview. Browser and Android runtime QA therefore remain unverified. This restriction must not be circumvented.

The final working installation is independent: a clean `npm ci --ignore-scripts` installed all 194 locked packages in the port workspace. The initial bootstrap reused baseline dependency symlinks; those are no longer used. Do not install into the source checkout. All new files are under this directory.

## Storage contract

- IndexedDB database `cue-command-mesh-local`, schema version 1; object store `work`; key `local-default`
- Versioned envelope `{formatVersion: 1, stateVersion: 4, state}`
- Production state/action validation and compare-and-swap run inside the same read-write transaction as the write
- Success is returned only after `transaction.oncomplete`; failed validation or aborted transactions do not commit
- `updatedAt` strictly increases even with an unchanged or backwards device clock. Domain decisions/events/deadlines use current device wall time separately, matching upstream route semantics
- Device wall time is not a trusted authorization clock. All stored approvals are historical local records with `executed: false`; they authorize no later external execution
- Typed errors include conflict, invalid input, corruption, future version, storage unavailable, quota and size-limit failures
- Final write budget is checked after assigning the persisted timestamp
- Unexpected IndexedDB connection closure invalidates only the matching cached connection; the next read can reopen safely
- Canonical events and actions use the production UUID generator, including its cryptographic `getRandomValues` fallback
- Unknown/corrupt/future data is never silently replaced with defaults
- The production v3-to-v4 normalization is reused; reads do not overwrite old records merely by opening them
- After a detected conflict or an unclear write response, further writes are blocked for the session. The user must explicitly reload the entire app, with an unsaved-draft warning. A re-fetch cannot silently rebase old form closures
- Response-loss reconciliation remains the original production implementation. A confirmed own write can be reported as saved, but the unclear-response session remains write-locked because other retained form drafts may be stale

The database is device/origin-local. It is not shared with Sites, another browser, another device, or a different app ID. Clearing app/browser data, uninstalling, device loss, storage eviction, or changing origin can destroy access. Export/import and device update testing remain release gates; there is no cloud backup or sync guarantee.

## Provenance and integration

`provenance.json` records SHA-256 for every copied upstream file and the exact git commit. `npm run check:drift` rejects changed source, changed copied files, or a new upstream commit. `scripts/build-overlay.mjs` verifies each patch anchor occurs exactly once and fails on drift rather than guessing.

After the final upstream revision is reviewed:

```sh
node scripts/provenance.mjs sync ../cue-audit --accept-commit=FULL_REVIEWED_COMMIT
npm run build
npm test
```

The sync step never changes `../cue-audit`. Recheck the transport overlay, state/API parity, UI action semantics, versioned storage migrations, and every item in `docs/PARITY.md`. The manifest remains a preview until the parent explicitly accepts the final source and runtime evidence.

For a future clean upstream patch, the minimal intended seam is: import `useWorkTransport`, call `transport.request` in the two hook request sites, and supply the provider at the app entry point. The offline labels and conflict latch are additional documented overlay changes. Generated full diff: `docs/use-work-state.patch`.

## Verification evidence

See `docs/all-tests.txt`, `docs/build.txt` and red-cycle logs. Node adapter tests use `fake-indexeddb`; they verify API/transaction contracts in a simulated IndexedDB implementation. Hook tests use a minimal Node hook-state harness, not React DOM. They are NOT browser IndexedDB, APK, emulator, device, WebXR, storage-quota, or smoothness evidence. Copied domain tests are separate production domain regression checks.

See `docs/PARITY.md` for exact preserved/adapted/missing/unverified coverage, and `docs/ANDROID-DESIGN.md` for the native handoff. No SDK/JDK/Gradle installation, native project generation, APK signing key, native build, external deployment or browser-control action was performed by this portability task.
