# Verification matrix · 2026-09-30

## Executed locally

Node 24.19.0, TypeScript 5.9.3, React 19.2.6, HappyDOM 20.14.5. Final exact test names and timings are in `test-results.txt`. HappyDOM is a DOM simulation, not a browser/WebView/device measurement.

- Versions/catalog/unknown props/types and host registrations: rejected
- Script/HTML/JS/CSS/approval fields: rejected; hostile text remains escaped, labelled data
- JSON duplicate decoded keys, prototype keys, traversal/path/URL refs: rejected
- Duplicated IDs, cycles, missing children, multiple parents, unreachable nodes: rejected
- Raw UTF-8/text/node/depth budgets, nonfinite numbers, malformed JSON/Unicode: rejected
- Namespace/revision validation, immutable registry/snapshot, atomic last-good update retention: passed
- Typed navigation vs suggestion, no fabricated approval/write, replay/pending deduplication including reparenting, removal/readdition and whole-renderer remount: passed
- Rate limiting and repeated-rejection notification coalescing: passed
- Unknown/stale/zero/empty data distinctions and whole-list rejection: passed
- Native button semantics, host-owned labels, explicit activation, callback error containment: passed
- Stack/Split update focus, structural reparent focus, removal fallback, external-focus preservation: passed
- Trusted graph slot data, missing-slot message, render-error containment and recovery after corrected data/new revision: passed
- Relative primary font scaling in simulated CSS, responsive/reduced-motion stylesheet contract: passed
- Clean offline `npm ci --ignore-scripts` using this package's registry lock: passed
- Typecheck, production library, production demo and declarations: passed

The first 30 tests were run against an intentionally unimplemented API before production implementation (all red). Additional regression evidence caught repeated notification floods, primary font scaling and pending-callback activation after revision change before their fixes. See `red-tests.txt`, `regression-red.txt`, `pending-red.txt`.

## Mapping to the reference review

UI-01–06: covered at the internal payload/data/intent boundary. No runtime executes source text or receives authentication/approval handles.
UI-07: stale surface revisions are denied; real downstream approval binding is the existing host's responsibility and is not implemented here.
UI-08–10: local replay/session/update/resource and no automatic data transmission paths covered; transport replay/durable effects remain host concerns.
UI-11–12: unknown/stale projections and slot boundaries covered; actual skill readiness and graph history semantics remain in existing modules.
UI-13: no graph renderer modification; real 2D/3D, WebGL recovery, lifecycle and rotation remain module/device gates.
UI-14: DOM focus, native button structure and CSS contracts covered. Real browser keyboard activation, TalkBack, large-font touch/reflow and Android WebView remain unexecuted.
TASK-01–05 and APP-01–07: not implemented or claimed. No corresponding external host/adapters are present.

## Remaining release gates

1. Integrate this candidate into the approved current upstream shell; resolve source parity independently
2. Bind real minimized WorkState/skill projections and the existing graph/skill modules
3. Real-browser keyboard/focus, responsive viewport and zoom inspection
4. Android S25/WebView/TalkBack/rotation/background and system-font checks on actual device
5. Existing graph GPU/listener lifecycle and user-preference persistence after host integration
6. Independent security/code review and remediation before any release

The demo uses static, clearly marked fixtures and hostslot placeholders. It does not establish a live connection, a real graph integration, a passing Android test, protocol conformance or production readiness.

## Review remediation verification

45 package tests pass after R1–R3 fixes. The unchanged independently supplied reviewer suite currently has 14 tests; all 14 also pass in the implementer rerun (`review-retest.txt`). That rerun is evidence for the fix, not a substitute for the reviewer’s independent retest. See `REVIEW-FIXES.md`.
