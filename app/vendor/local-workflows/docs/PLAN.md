# Local workflows implementation plan

**Goal:** Execute the existing four offline checks through a verified browser catalog and a bounded resumable host runner.
**Architecture:** Initialize a sealed static catalog with WebCrypto. Use the unchanged kernel behind an ordered runner and a trusted CAS store. No additional runtime dependency.
**Spec:** SPEC.md

## Global constraints
- Own only local-workflows; do not edit skill-core or other lockfiles
- At most eight steps and 1000 ms active time per invocation
- No arbitrary handlers, external effects, evidence persistence or checkpoint import
- Node tests are not browser/device verification

## Task 1: Browser catalog
- [x] Write catalog contract tests using the four real packages; run RED
- [x] Implement static bundle generation and verified browser initialization
- [x] Run GREEN, verify inventory, hashes, path boundaries and copied snapshots

## Task 2: Trusted store and runner
- [x] Write tests of real in-memory CAS and execution ordering; run RED
- [x] Implement strict spec/checkpoint validation, real kernel execution and state transitions
- [x] Add RED/GREEN regression tests for forged/stale checkpoints, drift, evidence, abort, clock, budget and conflicts

## Task 3: Deliverable and verification
- [x] Add an actual four-handler demo with pause/resume and graph-consumable events
- [x] Document trust boundaries, host API, limits and retention
- [x] Run all tests and demo; inventory runtime imports and source hashes
- [ ] Independent review and any resulting regression fixes (parent gate)
