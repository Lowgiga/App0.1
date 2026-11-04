# Cue Offline Skill Core Implementation Plan

Goal: a locally testable skill catalog, deterministic router, trusted evidence gate and four honest offline functions.
Architecture: manifest data and lazy content loader; private host evidence authority; router/readiness projection; fixed builtin dispatch; prompt serialization and event history are separate modules.
Tech: Node >=22, native node:test, no dependencies.
Spec: docs/SPEC.md

1. [x] Write contract, path/hash, schema and progressive-loading tests in tests/loader.test.mjs. Run them red with stub exports; implement src/contract.mjs and src/loader.mjs; rerun green.
2. [x] Write exact routing, negative trigger, unknown-tool, fake-evidence, expired-evidence, denied-permission and version-pinned tests in tests/kernel.test.mjs. Run red; implement src/host.mjs and src/kernel.mjs; rerun green.
3. [x] Write deterministic handler/output validation and prompt role-boundary/size tests in tests/kernel.test.mjs. Run red; implement src/handlers.mjs and src/prompt.mjs; rerun green.
4. [x] Create four original packages under skills/ with standard SKILL.md and custom manifest; run actual full validation; add runnable examples/demo.mjs.
5. [x] Run all tests and demo, capture real outputs under reports/, document sources, license boundaries and integration limits in README.md. Request independent review; fix any findings using regression tests.

No files outside skill-core are modified. No commit, network/tool/model execution from packages, install, deployment, or integration is part of this plan.
