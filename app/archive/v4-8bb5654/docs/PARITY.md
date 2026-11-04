# Required parity matrix — NOT a completion certificate

Source: V4 commit `8bb56544677a7433a2566da3885ada6cd31b1b0d`. The final dashboard revision is still outstanding. Every view below is included byte-identically in `upstream/app`; code inclusion is not runtime verification. Browser QA is blocked and no Android runtime has been tested.

Definitions: **preserved** = source/UI logic copied unchanged; **adapted** = explicit local platform substitution; **missing** = capability not implemented in this candidate; **unverified** = needs browser/device or final-source evidence.

| View (all 17) | Included UI/functions | Candidate status | Required remaining evidence |
|---|---|---|---|
| overview / Übersicht | Widgets, notes, quick links, summaries | Preserved; persistence adapted | Render, create/save/reopen, responsive layout, current source |
| agents / Agenten | Four agent workspaces, profiles, local assignments | Preserved; persistence adapted | Every profile form, saved budgets, navigation; actual agent execution is missing |
| missions / Missionszentrale | Create/update, stage gates, reviewer/evidence, checkpoints | Preserved; domain/action adapter tested in Node | Full form paths, stale-draft conflict, activity verification in runtime |
| approvals / Freigaben | Bounded request/decision cards, immutable decisions | Preserved; local decision recording adapted | Runtime decision guards; approval records do not execute remote actions |
| activity / Aktivität | Causal event stream, sequence and profile projections | Preserved; event generation adapted and Node-tested | Runtime event render/filter/navigation; no remote audit stream |
| intelligence / Fokus & Intelligence | Risk/focus selectors, local risk acceptance/planning, focus action | Preserved; action adapter Node-tested | All graph controls, condition changes, on-device performance |
| help / Hilfe | Searchable baseline help and boundary statements | Preserved | Final-source help plus review of source wording about server/device storage |
| connections / Verbindungen | Baseline connection evidence/status UI | Preserved snapshot; live transport missing | Actual MCP/OAuth/connector transport, credential and identity architecture, live read evidence |
| pilot / PAZ-Pilot | Existing plan/review/context/handoff UI | Preserved snapshot | Runtime interaction; live GitHub/PAZ access and execution not provided |
| make / Automationen | Existing scenario review and planning UI | Preserved snapshot | Runtime interaction; live Make actions/reads not provided |
| lab / Funktionslabor | Existing planning simulations/calculations and handoffs | Preserved | All controls and outputs in Android; no remote execution claim |
| addons / Add-on-Katalog | Bundled tool/skill catalog | Preserved snapshot | Final catalog synchronization and every detail/link; runtime app integrations missing |
| evidence / Evidenz | Bundled sources, private images/documents | Preserved files | All asset paths/loaders and native open/download behavior |
| chats / Missionräume | Local rooms, selected context, contributions, handoff | Preserved; persistence adapted | Every create/edit/message/import path; live chat-agent transport missing |
| matrix / Aufgabenmatrix | Tasks, dependencies, completion evidence/review validation | Preserved; production contract Node-tested | Every edit/dependency/archive path and usability on small screens |
| space / 3D & Lernen | Lazy Three.js scene, flat list, fallback, baseline learning | Preserved | WebGL/WebXR/gesture/lifecycle tests; new upstream learning work not yet synchronized |
| settings / Einstellungen | Theme, density, fonts, widgets, motion, power saver, profiles | Preserved; persistence adapted | Saved settings after app update/restart, accessibility, large fonts/keyboard/insets |

## Cross-cutting functionality

| Capability | Status | Proof / blocker / next gate |
|---|---|---|
| Existing 17-view navigation, search, command palette, URL query/back state | Preserved / unverified runtime | Source preserved; native hardware Back and app resume not validated |
| Exact latest source | Missing | V4 is only a provisional baseline; final commit must be synchronized |
| Domain state, matrix, approvals, missions, neuro and intelligence rules | Preserved | Original code used; production regression tests and local adapter tests |
| State/actions transport | Adapted | Injected local protocol through hook provider; same validation functions, no global fetch patch |
| Device-local persistence/CAS | Adapted / simulated tests only | Atomic IDB contract tested with fake-indexeddb, real browser/device proof missing |
| Conflict handling/reconciliation | Adapted / simulated tests | Explicit write latch after conflict or unclear response, original reconciliation; multi-tab and full-form runtime QA outstanding |
| Versions/migrations/corruption | Adapted / simulated tests | Envelope/database versioning, v3 normalization, explicit failures; upgrade-on-device test outstanding |
| APK update preserving data | Unverified | Fixed app ID + origin/database + signing continuity required; actual install-over-update comparison missing |
| Live MCP / remote connectors | Missing | Server context cannot be copied into browser; no fake identity or simulated result. Requires separate authorized native/backend architecture |
| Sites owner authentication | Missing by design of candidate | Candidate is an independent device-local app, not a logged-in Sites client. Must not be called full service parity |
| Cloud/multi-device sync and remote D1 data | Missing | Local database separate; no sync or implicit migration claim |
| JSON snapshot export/import and handoff downloads | Preserved browser source / native unverified | Blob download, MIME/file picker/share destination and import transaction need Android verification and potentially native file adapter |
| Clipboard | Preserved browser source / native unverified | Secure WebView Clipboard API and denial UX need device test |
| Private images and document files | Preserved | Copied into private local bundle; Android asset paths/open behavior unverified; no upload |
| External links | Preserved browser source / native unverified | Controlled native external-browser opening needs review; URLs are not auto-invoked by adapter |
| Learning progress incl. incoming learning changes | Baseline preserved; final update missing | Old booleans baseline only; upstream changes and migrations must be synchronized |
| WebGL/Three.js | Preserved / unverified | Lazy chunk, power-save/reduced-motion code retained; Android render/resource/lifecycle tests needed |
| Immersive AR | Unverified; cannot promise support | Original `navigator.xr` + `isSessionSupported` runtime checks retained. WebView ≠ Chrome WebXR. Fallback is not AR parity |
| Android permissions/hardware Back/keyboard/system bars | Missing or unverified | Native container not in this task; no 32-bit AR workaround; no permission grants |
| Smoothness, startup, memory, large data | Unverified device | Build reports chunk sizes; Node selector benchmark is not FPS/input-latency/memory evidence |
| Offline cold start | Static bundle included; runtime unverified | Browser preview needs server; eventual packaged app can bundle assets but requires airplane-mode startup test |
| Release signing/installable APK | Missing in this task | Native build is parent-owned; no keys created or signing performed |
| Windows/iOS | Deferred | No platform work attempted |

## Release-blocking validation sequence

1. Synchronize the accepted final source commit and rerun provenance, domain/adapter tests, typecheck and production build.
2. Independent correctness/security review of overlay, storage and all source deltas.
3. Run browser tests through an authorized reachable preview. Do not work around the observed browser block.
4. Implement/verify required native file handling, external links, Back/navigation and safe-area/keyboard behavior.
5. Resolve live MCP/auth/sync requirements explicitly; a static connection screen is not connectivity.
6. Device/emulator walkthrough of every view and cross-cutting feature, including corrupt/quota/conflict failures, import/export roundtrip, suspend/resume, offline restart and install-over-update data retention.
7. Real AR-capability result and honest platform limitation; do not claim unsupported AR is preserved.
8. Only then assess full functional equivalence; current candidate must not be delivered as complete.
