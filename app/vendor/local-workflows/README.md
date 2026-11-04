# Local workflows

A small, dependency-free ES-module adapter for the existing `../skill-core`. It runs the **four real local handlers**, with verified package data, bounded ordered steps, pause/abort and host-owned checkpoint storage. It does not add an LLM, connector execution, network access, shell, package scripts, installation or backup restore.

## Run verified checks

Requires Node 22+ for this repository's test/CLI harness:

```sh
cd local-workflows
npm test
npm run demo
```

No install is needed. `examples/demo.mjs` is browser-compatible and exports `runDemo()`; the CLI wrapper only prints its returned data. The demo performs four actual small host self-tests, executes two steps, pauses, then resumes the other two. Its events can feed a later graph integration. Activity is never simulated. Tests run in Node with WebCrypto; **no real browser, Android device, background execution or crash-durability claim** is made.

## Runtime API

```js
import {
  createBrowserCatalog, createHostAuthority,
  createTrustedMemoryStore, createLocalPipelineRunner
} from './src/index.mjs';

const catalog = await createBrowserCatalog();
const authority = createHostAuthority();
const store = createTrustedMemoryStore();
const runner = createLocalPipelineRunner({
  catalog, authority, store,
  getFreshHostEvidence(context) {
    // Trusted application code must perform fresh local checks, then return
    // a new authority.issue(...) handle. See examples/demo.mjs.
    return issueEvidenceFromRealHostChecks(context);
  }
});
const paused = await runner.run(spec, {pauseAfterSteps: 2});
const done = await runner.run(spec, {resume: paused.checkpoint});
```

The symbol `issueEvidenceFromRealHostChecks` above denotes application-owned code, not a shipped API. Use the runnable demo for a complete host implementation. The authority and store writer must remain private to trusted application code.

A pipeline has namespace `cue.local-pipeline/v1`, a unique `pipelineId`, `limits: {maxSteps, maxElapsedMs}`, and `steps`. Each step contains exactly `stepId`, `kind`, `skillId`, `version`, `versionHash`, `input`. `kind` is `inspect-mission` (mission handler only), `validate-local-result`, or `run-offline-skill`. All kinds run the selected built-in handler with its declared input and output schemas; none evaluates an instruction string. Inputs are independent declared values: this version has no expression language or arbitrary result-to-input wiring.

Limits: 1–8 steps, at most 1000 ms active time per invocation, 128 KiB input and output per step, 1 MiB pipeline/checkpoint JSON, bounded JSON complexity. Every step must pin the current concrete version and SHA-256 package hash. Pipeline IDs are lower-case alphanumeric, dot or hyphen, at most 100 characters. Version/input/limit drift requires a new pipeline ID.

`run(spec, {signal?, pauseAfterSteps?, resume?})` is asynchronous. `pause()` and `abort()` return whether a run is active. Pause is cooperative at step boundaries; `pauseAfterSteps` counts new successful steps in this invocation. At the final step, completion takes precedence over a pause request, while abort and time limits still apply. A native `AbortSignal` is supported. Only one invocation may run on a runner at once. A persisted `running` reservation also prevents a second runner sharing that store from executing the same pipeline.

Results contain `state`, `completedCount`, `outputs: [{stepId, output}]`, and a checkpoint reference `{pipelineId, revision}`. A store failure during reserved execution returns a typed failure with a null checkpoint reference; it does not claim to have persisted the terminal outcome. Validation/start/resume-precondition errors, including an initial store read or initial reservation failure, reject the promise before execution. Runtime stops resolve with state and a bounded machine `code`; raw exception text is not logged.

## Browser catalog

`await createBrowserCatalog({bundles?})` verifies all bytes with WebCrypto before publishing a synchronous catalog. Bundle entries are `{directory, manifest, files}`, where `manifest` is the complete raw JSON string and `files` maps the exact declared paths to UTF-8 strings. Strict duplicate-key parsing, hashes, package frontmatter, undeclared/missing resources and traversal checks apply. Maximum inventory: 64 packages, 64 KiB metadata, 128 KiB per file, 8 MiB aggregate JSON and the core JSON complexity limit.

`list`, `loadInstructions`, `loadResource`, `verify`, `events`, `historyInfo` follow `skill-core/docs/API.md`. Content is untrusted data. All resource content is privately snapshotted and verified during initialization; subsequent synchronous `verify` reports that sealed inventory. It does not fetch or hash mutable files at access time. Editing the source bundle after initialization cannot edit the catalog. A changed package requires a new catalog and runner.

The default bundle is generated from the four reviewed local packages. `npm run bundle` is a **build-time Node tool**; it checks the existing filesystem catalog and regenerates `src/bundled-skills.mjs`. The runtime import graph does not include that tool or the Node loader. Deploy the adapter and `skill-core` together preserving relative imports. WebCrypto requires a compatible host and secure browser context.

## Trusted store and checkpoint provenance

The synchronous trusted-host port is:

```js
store.read(pipelineId); // null, or copied {revision, record}
store.compareAndSwap(pipelineId, expectedRevision, record); // new revision
```

`expectedRevision: null` means create only if absent. Revisions start at 1 and increase by exactly one. An atomic mismatch throws an error with `code: 'STORE_CONFLICT'`. `read` and CAS must be linearizable in the host's storage scope. A successful CAS must store the complete copied record; the runner verifies read-after-write. It stores progress before starting the next step and before publishing that step's success event. The supplied implementation is a real private-map in-memory store (64 pipeline slots by default, configurable 1–1024). It is intentionally not durable and has no JSON import/restore API.

**SHA-256 is integrity, not authenticity.** Resume accepts only an ID and exact revision, never caller-provided completion records or output hashes. The record is loaded from the trusted store and validated against the whole spec, contiguous completed prefix, per-step inputs, versions, output schemas and output hashes. The store's provenance and protected write authority make a completed prefix trusted. An actor allowed to write arbitrary records through the host CAS API is trusted and can forge history: do not expose that API to a package, model, untrusted plugin or JSON import feature. Checksums cannot repair a compromised trust boundary.

Neither capability handles nor authorizations are persisted. Each attempted step calls the synchronous host evidence provider again and requires a new valid handle; repeated handles are refused across runners sharing the same authority object in this runtime. The host is responsible for real fresh local tests and grants. A resolved old checksum or old test ID is not host permission. Async evidence providers are rejected; this API does not schedule external checks.

Only `paused` and `budget-exhausted` checkpoints resume execution. A completed checkpoint returns its verified stored results without rerunning. Failed/aborted states are terminal. A lingering `running` record is blocked and needs an explicit host recovery decision; there is no automatic replay after a crash. Starting with an existing pipeline ID without its current checkpoint reference is refused. In-memory state disappears on reload. Persistent storage, crash recovery, cross-process locking and Android background scheduling need separate host work.

## Time and cancellation limits

Abort/budget/monotonic-clock checks run before and after each handler and around asynchronous hashes and boundary yields. A result that crosses the execution deadline or is aborted before commit is discarded; no successful step event is emitted for it. Stop conditions are rechecked immediately before a result CAS and after its confirmed write/read. If cancellation or the deadline arrives during a successful atomic commit, its already-persisted outputs remain recorded, but the runner saves the observed terminal stop instead of emitting a success event. The same rule applies to the final pipeline commit. Clock rollback permanently invalidates that runner. Paused wall time is excluded, and every resumed invocation receives its own maximum 1000 ms budget.

A synchronous handler, store call, evidence callback, crypto operation or observer is **not preemptively interruptible**. An intentionally slow host callback can exceed the limit before the next check; hard wall-clock enforcement requires isolated terminable workers. The supplied kernels only compute over bounded data. UI observers should be fast; synchronous exceptions and asynchronous rejections from observers are isolated. A host timer yield between steps permits ordinary UI cancellation, but it is not an Android background service.

## Status events and retention

`runner.events({afterSequence: 0, limit: 256})` returns copies, with a page cap of 1024. `subscribe(listener)` observes actual events and returns an unsubscribe function. Events include increasing `sequence`, type and pipeline ID; step events include skill ID, step ID, input/version hashes. Success requires a confirmed store commit. No events contain raw inputs, outputs, grants or raw error text.

Types: `pipeline-started`, `step-started`, `checkpoint-saved`, `step-completed`, `pipeline-paused`, `pipeline-aborted`, `pipeline-failed`, `budget-exhausted`, `pipeline-completed`. Pipeline history defaults to 512 retained events (configurable 1–4096). `historyInfo()` exposes `firstSequence`, `lastSequence`, `retainedCount`, `droppedCount`. Catalog history separately retains at most 4096 events. The UI must show retention gaps; history is not a complete durable audit log.

Checkpoints do contain bounded handler outputs, which may echo supplied names, titles and descriptions. Do not use credentials as input text. This component never serializes host capability objects, and no checkpoint content is sent anywhere by the runtime.

See [SPEC](docs/SPEC.md), [plan](docs/PLAN.md), [package manifest](MANIFEST.json), and [test reports](reports/) for exact boundaries and evidence.
