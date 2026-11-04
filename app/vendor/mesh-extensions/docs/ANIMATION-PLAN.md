# Bounded functional transition plan

Approved scope: isolated mesh-extensions only. Existing data, IDs, selection, layout semantics and host callback boundaries remain unchanged.

1. [x] Capture the 30-test baseline and write failing tests for compatible V1 decoding, a cancelable synthetic-clock timeline, motion/energy budgets and interruption.
2. [x] Add opt-in, bounded transitions (off / brief / smooth), with reduced motion and low-quality power saving taking precedence. Keep default and legacy views immediate.
3. [x] Apply short 2D layout/selection presentation interpolation; use bounded 3D camera framing/focus only. Cancel on gestures, Escape, hidden document, context loss and teardown. Do not animate domain state or invoke host actions.
4. [x] Run all existing/new tests, typecheck, library/demo build and upstream drift check. Document exact coverage and limits, source diff and hashes; request independent parent review.

No ambient loop, new animation library, template, fetched asset, AR/camera permission or app integration. No FPS/battery/GPU/Android claim. Duration caps are scheduling bounds, not frame-rate guarantees.

Implementation, author verification and independent review passed. Final scope remains isolated; device acceptance is still separate.
