# Cue Command Mesh: portable JSON backup groundwork

A small **dependency-free ES module**, independently built beside the unchanged V4 checkout. It transports the complete **supplied JSON snapshot** (`work` and `data`) without silently dropping fields and prepares a read-only comparison against a target snapshot.

This is **not an Android or Windows application, installed integration, live synchronization, database migration, or working restore implementation**. It has no network, filesystem, browser-storage, database, download, upload, authorization or external-action API. Its only platform requirement is JavaScript with `TextEncoder` and WebCrypto `crypto.subtle.digest('SHA-256', …)`. Browser integration normally needs a secure context. Android/WebView and Windows runtime behavior has not been tested on physical devices.

## What is included

- `backup.mjs`: canonical JSON export, strict import, SHA-256 integrity check, bounded read-only comparison
- `examples/v4-adapter.mjs`: inject the **actual** V4 `savedWorkContract` plus its existing reference checker
- `test/backup.test.mjs`: 27 standalone Node tests; no dependencies or checkout needed
- `test/v4.integration.mjs`: 6 separate tests using the actual V4 app contracts and synthetic full-field data
- `examples/verify-v4.mjs`: loads the source checkout from an explicit command-line argument; no hardcoded checkout location in the module
- `reports/`: captured initial failing tests, hardening regression tests, and passing verification runs

## Run the checks without installation

From this directory:

```sh
node --check backup.mjs
node --test test/backup.test.mjs
node examples/verify-v4.mjs /absolute/path/to/the/v4-checkout
```

The last command needs a source checkout with its existing Zod dependency available and Node's TypeScript support (the verification run used Node 24.19.0). It only imports application libraries; it does not start the app, install software, open a database or write to that checkout. The unit suite uses only Node built-ins.

The V4 suite exercises all WorkState areas: state version, settings including neuro preferences, profiles, rooms/messages, tasks/dependencies, learning, checks, notes, missions, approvals, events, interactions, timestamps and source JSON. It independently invokes `workReferenceErrors` as well as `savedWorkContract`. No real user snapshot, credential or production database was read for these tests.

## API and application-side integration

The caller must supply a trustworthy application validator. Do not replace it with a permissive callback in production.

```js
import { exportBackup, importBackup, prepareRestore } from './backup.mjs';
import { makeV4Validator } from './examples/v4-adapter.mjs';

// App-side imports, resolved by the app's build, not by the transport module.
import { savedWorkContract } from './lib/work-contract.ts';
import { workReferenceErrors } from './lib/work-updates.ts';

const validateWork = makeV4Validator({
  savedWorkContract,
  workReferenceErrors,
  knownSourceIds: trustedSourceInventory.map(source => source.id),
});
const options = { validateWork, maxBytes: 2_000_000 };

// Use an explicitly selected, successfully loaded, non-secret JSON snapshot.
const jsonText = await exportBackup(
  { work: loadedWork, data: approvedSourceSnapshot },
  {
    exportedAt: new Date().toISOString(),
    producer: { name: 'cue-command-mesh', version: appVersion },
    source: { revision: verifiedSourceRevision, workUpdatedAt: loadedWork.updatedAt },
  },
  options,
);

// File selection and reading belong to a separately authorized platform adapter.
const inspected = await importBackup(selectedFileText, options);
const plan = await prepareRestore(selectedFileText, currentSnapshot, options);
// Display the plan. There is deliberately no apply/restore/execute function.
```

`knownSourceIds` must come from the application's trusted or independently verified source inventory. Merely finding a source ID in an untrusted backup is not proof that the source exists or should be trusted. The supplied source `data` is checked for safe JSON and transported exactly; this module does not invent a schema or validate facts inside that source catalog.

### `exportBackup(snapshot, metadata, options) -> Promise<string>`

- Snapshot has exactly `work` and `data`
- Export metadata has exactly `exportedAt`, `producer: { name, version }` and `source: { revision, workUpdatedAt }`
- Work must identify state version 4 and carry its `updatedAt` value; `source.workUpdatedAt` must match it exactly
- UTC timestamps with seconds and optional fractional seconds are supported; impossible calendar dates are rejected
- Required producer/revision strings cannot be empty; a source update cannot be later than the export timestamp
- The original input is neither mutated nor normalized
- Returns canonical JSON text. The caller chooses whether and where to save it

### `importBackup(text, options) -> Promise<inspection>`

Returns a detached, deeply frozen result with:

- `snapshot`: the exact original JSON values under `work` and `data`
- `metadata`, `integrity`: validated envelope metadata
- `normalizationDetected`: whether the actual validator would derive or default different fields
- `decisionRecords: 'historical-only'`, `externalActionsAuthorized: false`

`options.validateWork(work)` may be synchronous or asynchronous and must return the real schema result `{ success: true, data }` or a failure. It receives a frozen detached object. A rejected or throwing validator stops the operation. Error details from the callback are not copied into transport error messages.

V4's real `savedWorkContract` derives `neuro_profile` and can supply defaults. **Successful validation does not authorize this module to replace the original data.** If the parsed output differs, the original still roundtrips, and inspection/the restore plan reports that normalization requires application-side review. Version-3 migration is deliberately not performed here; use a separately reviewed migration process.

Optional `expectedSourceRevision` pins metadata to a revision already obtained through a trusted channel. Revision metadata is a declaration, not a proof of origin.

### `prepareRestore(text, currentSnapshot, options) -> Promise<plan>`

- `currentSnapshot` is the caller's explicit, fully read target snapshot (`{ work, data }`)
- `null` means the caller has positively established that no target snapshot exists; an unknown/failed load must **not** be converted to `null`
- Omitting the target raises `TARGET_REQUIRED`
- Both input and target are validated; no merging, saving, overwriting, replaying or schema normalization occurs
- `mode: 'preview-only'`, `writes: []`, `requiresExplicitRestoreAuthorization: true`
- Target is classified as `absent`, `identical` or `different`
- `changes` and `conflicts` use JSON Pointer paths and `added`, `removed`, `changed`; a changed or removed target value is a conflict
- Array comparison is positional, **not an entity-ID-aware merge**. Reordering can produce many changes
- Array inventories describe counts; hashes fingerprint the incoming and current payloads
- Exact totals are retained, while change/conflict detail is capped at 250 entries each and marked `truncated` if needed
- A comparison is a point-in-time observation, not a lock, transaction, authorization, safe-to-apply flag or proof that the target remains unchanged

Any future restore must be a separate implementation. It needs an explicit decision about target identity, historical provenance, review requirements, source catalogs, conflicts, access control, atomic writes, concurrency/version checks, backup/rollback and verification. Passing this plan into the current V4 `mergeSnapshot` does not produce a full restore.

## Envelope version 1

The format is `cue-command-mesh-backup`, with format version 1 and app schema `{ id: 'cue-command-mesh-work', version: 4 }`.

The envelope includes `format`, `formatVersion`, `schema`, `producer`, `source`, `exportedAt`, `policy`, `payload` and `integrity`. `policy` is fixed to historical decisions and no external-action authorization. Integrity uses SHA-256 over the canonical JSON of **all envelope fields except `integrity`**. Digest algorithm and canonicalization are fixed, and the declared `payloadBytes` is independently checked against the actual canonical UTF-8 payload.

`sorted-json-v1` sorts object property names by JavaScript's UTF-16 lexicographic order, preserves array order, and uses ECMAScript JSON representations for finite primitives. It is a specified local format, **not a claim of RFC 8785/JCS conformance**. Object property order and whitespace are not retained; all supported JSON field values are retained. Unicode is not normalized, so composed and decomposed text remain distinct. Timestamps are not generated implicitly inside the module, so identical inputs and metadata produce identical output bytes.

### Limits and rejected input

The default limit is **2,000,000 UTF-8 bytes for the entire backup text**, including metadata and integrity overhead. The exact same configured limit is applied before accepting an export or import. Input-file whitespace counts toward import size. The option must be an integer from 1 to 64,000,000. A comparison also bounds the target's canonical JSON. Nesting is limited to 100 levels.

The existing V4 write budget is separately 1,750,000 bytes. A backup passing its own transport limit does not prove that it fits a future server write. Do not conflate exportability with restorability.

Rejected input includes:

- Unsupported envelope/schema versions; missing, unknown or inconsistent metadata
- Changed content or metadata without the matching digest; inconsistent payload byte count
- Malformed JSON, duplicate object names (including escaped equivalent names), excessive size/depth
- `__proto__`, `prototype` and `constructor` properties anywhere
- Recognizable credential property names such as password, API key, access/refresh token, private key, cookie and authorization
- Non-JSON values, non-plain objects, accessors, hidden/symbol properties, sparse/custom arrays, cycles, NaN/Infinity and negative zero
- Work rejected by the actual injected application contract or source-reference adapter

Failures are `BackupError` instances with stable `code` values: `INVALID_OPTIONS`, `INVALID_JSON`, `INVALID_JSON_VALUE`, `DUPLICATE_KEY`, `UNSAFE_KEY`, `SENSITIVE_KEY`, `DEPTH_LIMIT`, `SIZE_LIMIT`, `INVALID_METADATA`, `UNSUPPORTED_VERSION`, `SOURCE_REVISION_MISMATCH`, `INTEGRITY_MISMATCH`, `VALIDATION_FAILED`, `CRYPTO_UNAVAILABLE` and `TARGET_REQUIRED`.

## Security and completeness boundaries

- **SHA-256 is corruption detection, not authenticity or encryption.** Anyone able to change the file can recompute its digest. There is no signature, trusted signer, password protection or key management
- Imported approvals, completed reviews, risk decisions and interaction records remain **historical data**. Their values are preserved exactly, but import creates no new permission, capability, approval or right to run an external action. The receiving application must preserve that separation; never treat imported history as live execution authorization
- Credential-name blocking is defense in depth, **not a comprehensive secret detector**. A credential pasted into notes or disguised under another key cannot be reliably recognized. The application must select/review non-secret data before export. The module never scans storage, collects credentials or reads environment variables
- The transport is complete for the JSON explicitly supplied to it. Source files referenced by paths, screenshots, binary attachments, source code, packages, D1 metadata/identities and user authentication are **not embedded or migrated**. This is not evidence of a complete application takeover
- No production restore, installed Android/Windows integration, physical-device test, live agent connection or live sync is claimed. Those remain separate integration and acceptance work

## Verified baseline

Test-first unit development began with an API skeleton and 20 failing tests (`reports/unit-red.txt`). A later hardening pass first reproduced ambiguous duplicate keys and overly restrictive timestamp handling (`reports/hardening-red.txt`). An independent review additionally reproduced sub-millisecond timestamp ordering before correction (`reports/submillisecond-red.txt`). Final verification: **27/27 standalone unit tests, 6/6 actual V4 integration tests, and Node syntax check pass**. See the captured green reports. The external V4 checkout was read, not modified.
