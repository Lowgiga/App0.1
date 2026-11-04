# Independent review remediation · 2026-09-30

## R1 · Pending callback replay after remount

Confirmed with the independent reproduction: a permitted structural reparent remounted the Action component, discarded its local pending ref, and allowed a new callback under the newer revision. Removal/readdition had the same cause.

Fix: lifecycle ownership is now in `SurfaceSession`. `dispatchIntent` establishes an immutable pending record before calling the host receiver. `getIntent` and repeated delivery both refuse that stable component while pending. New snapshots retain pending records; settled old-revision records are discarded. The pending callback itself releases only its exact record. Renderer remounts subscribe to the same session state rather than recreating a lock.

Permanent regressions: reparent, remove/readd, whole-renderer remount, settlement while unmounted, and re-enabling only after the previous callback settles. Current same-revision consumption remains once-only; no auto-retry was added.

## R2 · Lost busy/status indication on newer revision

Confirmed: old code hid state when the result revision differed, while a separate ref still disabled the button.

Fix: the renderer reads the session's pending record regardless of its originating revision. The button, `aria-busy` and pending message derive from the same record. Old settled results are never attributed to a newer revision.

Permanent regression: admit a newer revision during delivery; confirm visible pending text and aria-busy, then settle and confirm that the newer revision unlocks without showing a stale success message.

## R3 · Sticky hostslot error fallback

Confirmed: the error boundary only reset on a changed slot component identity, ignoring corrected host projections and new surface revisions.

Fix: the error boundary compares explicit slot inputs (slot identity, projection object, surface revision, reduced-motion setting and component ID). A changed input resets the fallback; unrelated parent renders with identical inputs do not retry. Hosts replace immutable projection objects when correcting their data.

Permanent regression: the same slot function recovers after a replacement projection, can fail on a later revision, then recovers on the next admitted revision. The independent suite additionally guards against unrelated-render retry loops.

## Evidence and frozen scope

- Before fixes: independent suite reproduced all three findings (five failing paths)
- First fix stage: R1/R2 pass; only R3 paths remain red
- Final package suite: 45 pass, 0 fail
- Implementer rerun of independent suite: 14 pass, 0 fail
- Typecheck, production library/demo and declarations pass

`review-red.txt`, `review-regression-red.txt`, `review-r1r2-tests.txt`, `review-r1r2-external.txt`, `review-retest.txt`, `test-results.txt`, `build-results.txt` preserve the checks. Independent reviewer retest is still required on the new manifest. No feature or external integration was added; the changes repair the existing session/renderer error and delivery contracts.
