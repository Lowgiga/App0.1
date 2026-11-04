# Experimental native AR adapter

Design approved 2026-09-30 for the requested genuine camera AR implementation. Isolated from production source; hardware release gate remains mandatory.

## Design and alternatives
Direct ARCore Java Activity + GLES2 is the smallest viable bridge. Standard Capacitor WebView does not offer WebXR. A separate Unity runtime would add disproportionate size and lifecycle complexity. This adapter is schematic graph visualization, not measurement-grade AR or a physical hologram.

Plugin CueNativeAR supports side-effect-free-with-respect-to-permissions getAvailability and explicit open. Google support lookup itself can query device compatibility online. open validates a read-only snapshot, removes the call payload from Capacitor saved-call data, and transports only an opaque in-memory token. Activity displays disclosure and starts camera permission/service installation only after its own Start button. Process loss aborts; no snapshot persistence or automatic restart.

Schema: version=1; snapshotRevision nonempty <=128 chars; title <=120; nodes 1..256 with unique IDs <=128, labels 1..120, optional details <=1000 and finite x/y/z in [-1,1]; edges <=4096 as integer node indices {from,to}, non-self, bounded parallel directed pairs preserved in input order; UTF-8 JSON <=512KiB. Reject malformed, oversized, unknown fields, dangling edges, coerced numbers/strings. Result status closed/unavailable/permission-denied/error, placed actual placement history, revision, optional validated node ID. No WorkState writes. Endpoint-identical edges overlap geometrically; visible counts include every relationship and the viewer discloses this overlap.

One Session and one graph Anchor. Horizontal upward planes; center reticle + explicit placement; scalable local geometry; reset detaches old anchor; screen tap and accessible native node picker expose plain-text details. Camera image is live OES texture, no recording/video fallback, no cloud/geospatial/depth APIs. Hide virtual graph while camera/anchor tracking is lost.

Lifecycle: pause surface before session; detach anchor only after rendering stopped; pause on main, close session off-main; release GL context by non-preservation on pause and recreate texture/programs on resume; dismiss closes pending call once. Back/close always returns to normal app. Busy calls fail deterministically. Unsupported/denied states retain non-AR app operation.

## Implementation plan
1. Write failing executable JVM tests for strict snapshot boundary, geometry/selection and lifecycle policy, then minimal implementation.
2. Add isolated pinned AGP8.13/Gradle8.14.3/SDK36/min24 fixture and actual Capacitor8.5.2 compile dependency.
3. Implement native plugin handoff and explicit-start Activity with official ARCore1.54.0.
4. Implement OES camera and graph GLES renderer; test projection/selection logic outside Android.
5. Compile Java, run domain tests, lint library + fixture, inspect manifest and archive source/license evidence.
6. Independent review before integration; fix findings and rerun impacted tests. Hardware camera/permission/install/rotation/background/anchor gates remain unverified without physical supported Android device.
