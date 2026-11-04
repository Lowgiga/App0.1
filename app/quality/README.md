# Local quality gate, version 1

This gate was developed on the preserved 949-file tree. The current adoption candidate combines independently verified 977-file source tree `b705bb8ca9572387aca50dca5262e69ab9af31944f61e78df62773fb25d5fb89`, the explicitly approved versionCode11 / `0.5.3-prototype-20261005` metadata and regression, and the reviewed gate. Its new baseline and external pin require independent acceptance; computing a digest does not approve it. Supplier-tree digests use a different scope/encoding from `quality-source-v1`.

## Run

After independent review, supply the accepted contract SHA256 from a trusted host/review record:

    npm run check:quality -- --contract-sha256 <accepted-contract-sha256>
    npm run verify:quality -- --contract-sha256 <accepted-contract-sha256>

`--root <candidate-project>` optionally selects a candidate. No pin, malformed pin, changed contract, missing baseline, or invalid baseline hash blocks. Do not substitute a digest calculated automatically from the unreviewed candidate into these commands. No environment, CI, GitHub, permission, APK, or network setup is added.

`check:quality` is read-only and writes its JSON result to stdout. It does not execute tests. `verify:quality` runs fixed host-side stages: preflight, all `tests/quality/*.test.mjs`, the **unchanged** `npm run verify:serial`, postflight, and source-stability comparison. Existing test/build commands are unchanged; nothing is removed or replaced. Failed focused tests prevent the main verification; postflight still checks source changes. Child exit codes, including signal exits, are retained. No command comes from JSON and no shell is passed to `spawnSync`.

The wrapper attempts `artifacts/quality-report.json` even after failure. If that cannot be written safely, it emits the report on stderr and fails without replacing an earlier nonzero verification exit. SIGKILL, machine loss, failure before Node starts, or an unwritable filesystem can prevent an on-disk report; the host must treat an absent report as failure. A reported `not-run`, `blocked`, missing stage, or nonzero exit never means pass.

## Trust boundary

The external contract pin binds contract bytes to baseline bytes and the baseline's protected-file hashes. It prevents unnoticed baseline replacement when **trusted checker code** performs the check. A locally modified checker or wrapper cannot independently attest itself. An adversarial author with write access can change executable code, dependencies, host tools, or the invoked npm command. A trusted host must start the checker/wrapper from an independently accepted checkout, or verify their hashes against that checkout before execution, and use trusted Node/npm/TypeScript. The current local wrapper is not a tamper-proof required CI check, signature verifier, or security sandbox.

The baseline excludes its own file and the contract to avoid circular hashes; the external pin and contract's baseline digest bind these two files instead. Before/after source snapshots include both metadata files, so a generator changing either is blocked.

## Fixed source scope and inventory

`quality-source-v1` hashes every regular project file with SHA256, sorts relative paths by code-unit order, builds an object from `path` to `sha256`, and hashes the UTF-8 bytes of `JSON.stringify(object)`. It is distinct from the existing `source-manifest.mjs`, build manifest, and delivery manifest algorithms. No source symlink is followed, even to an in-root file; traversal, invalid relative paths, and nonregular source files fail closed. The root `node_modules` boundary is deliberately outside this source gate, including the existing local dependency symlink.

Only these fixed generated/dependency paths are excluded: root `node_modules/`, `.git/`, `dist/`, `artifacts/`; `android/.gradle/`, `android/.test-signing/`, `android/build/`, `android/app/build/`, `android/cue-native-ar/build/`, `android/capacitor-cordova-android-plugins/build/`, `android/local.properties`; `docs/build-manifest.json` and `docs/integration-source-manifest.json`. Unknown module outputs are not silently excluded. `upstream/build/` remains source. Build `dist/` files, when present after successful verification, receive a separate size/hash inventory. No unmeasured bundle/FPS/energy budget is invented.

All paths containing `test/`, `tests/`, `androidTest/`, `__tests__/`, a `.test.*`/`.spec.*` filename or Java/Kotlin `*Test(s)` file enter the test inventory. This includes upstream, vendors, extensions, overlay test sources, reports, Android JVM, and instrumentation files. An inventory entry is not proof that a test ran; source fixtures and native tests outside `verify:serial` remain `execution: not-run`. Dynamic parameterized cases are not expanded into invented execution counts.

Every removed baseline source blocks. Every changed existing test/fixture blocks for independent review, regardless of total test count. New tests are inventoried and marker-checked. Scripts, contract/baseline data, package metadata/lockfiles, native sources, platform and assistant code, provenance, vendors, policy/permission/CSP/manifest/adapter files require deliberate baseline adoption after review. AST checks cover direct/member/computed-literal test APIs, standard imports/aliases, test-context markers and literal option objects. Strings, comments, regex literals and fixture text do not count as executed markers. Java/Kotlin/Python disable decorators receive a lexical check. This is **not** whole-program analysis: arbitrary aliases, computed/dynamic options, runtime evaluation, unfamiliar test frameworks and malicious code require human review. Test hashes preserve the accepted tests; they cannot prove new tests are sufficient or assertions semantically equivalent.

The nine behavior IDs bind to literal test-case declarations in existing files; their entire files are hash protected. Their names describe intended coverage, not a semantic proof. For example, `motion.stop` includes protected parameterized reduced-motion/power-saver tests via its entire controller test file; only its literal cases are individually named. `backup.honesty` binds existing archive-coverage, separate draft-export and limited-validation tests, not a new claim of complete restore/draft coverage. Any stronger product guarantee needs additional reviewed tests.

## Honest release levels

Preflight alone has no release claim. Successful focused tests plus `verify:serial` plus unchanged source/postflight can claim `source-tested`; a resulting `dist/index.html` adds `web-built`. Native JVM tests, Android lint, permission dialogs, device behavior, visual comparison, touch accessibility, GPU/performance and battery are separate `not-run` fields. Existing external native evidence may be referenced by the integrator, but this wrapper does not run Gradle or grant native/device status. There is no 100% safety, semantic-equivalence, performance or device-readiness guarantee.

## Deliberate baseline adoption

1. Preserve the currently accepted contract, manifest and external pin in the independent review record. Keep the original source tree unchanged. Complete the integration in an isolated candidate.
2. Independently review every protected diff, all removed paths and replacement tests. Verify why a rename/assertion change preserves or strengthens behavior. There are no active exceptions, wildcard approvals, expiry waivers or `approvalRef` self-approval in v1.
3. Review checker/wrapper and the fixed scopes/commands themselves. Run the focused fixtures. Run the unchanged existing verification separately against the intended candidate, preserving its exit code; run any required native/device checks separately.
4. After that review, intentionally create the candidate manifest from `snapshotSources(candidate).files`, excluding only `quality/contract.json` and `quality/baselines/accepted.json`. Store `{schema: "lowquantflow.quality-baseline/v1", sourceScope: "quality-source-v1", files}` as UTF-8 JSON plus newline at the fixed baseline path. Hash those exact bytes and update `contract.baseline.sha256`. Retain or deliberately strengthen all nine concrete behavior bindings. There is no automatic rebaseline command.
5. Independently verify the new baseline contents and the contract's exact SHA256; record the accepted pin outside the writable candidate. Re-run `verify:quality` with that explicit pin. Source drift after generation must be fixed; do not rebaseline the generated drift automatically. If generation genuinely changes intended source, repeat review and verification.
6. Preserve the report with its source hash and actual execution scope. For a later Motion/Header/AR integration, adopt the final combined accepted candidate, not this 949-source seed. Never copy this seed baseline over a different integration and call it accepted.

## API and file boundaries

`scripts/check-quality.mjs`: `checkQuality({root, contractSha256})`, `snapshotSources(root)`, deterministic `diffFiles`, safe path checks and static test inspection. Returns a structured blocked result on read/hash/schema/policy errors. `scripts/verify-quality.mjs`: fixed CLI orchestration and report writer; no product runtime import. `quality/contract.json`: nine reviewed behavior bindings and exact baseline digest. `quality/baselines/accepted.json`: reviewed content hashes. `tests/quality/quality-contract.test.mjs`: isolated temporary-file and real subprocess fixtures; no original test changes. `package.json`: only three additive scripts. Node standard library plus the already pinned TypeScript 5.9.3; no new dependency or lockfile edit.
