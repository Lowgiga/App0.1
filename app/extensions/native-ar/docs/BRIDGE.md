# CueNativeAR bridge contract, v1

Experimental native ARCore adapter; no supported-device, camera or GPU runtime test has occurred. Do not label the feature hardware-verified or measurement-grade.

## Registration and Android integration

1. Copy the complete `android/` source module (excluding `build/`) into the host, e.g. `android/cue-native-ar/`.
2. In Android settings.gradle: `include ':cue-native-ar'`, then set `project(':cue-native-ar').projectDir = new File('cue-native-ar')`.
3. App dependencies: `implementation project(':cue-native-ar')`. The module expects host project `:capacitor-android` pinned to 8.5.2.
4. In host BridgeActivity.onCreate before super: `registerPlugin(de.lowgiga.cuear.CueNativeARPlugin.class);`.
5. Keep library manifest AR Optional and private Activity; inspect merged application manifest.
6. Include licenses and README in the source delivery. ARCore Maven AAR contains SDK resources/JNI; do not strip third-party notices. No publishing/uploading is part of this integration.

## getAvailability()

Use only on explicit AR entry/diagnosis, never automatically at ordinary app startup. Returns `{available:boolean,status:Status}`. available means Google reports a supported device, not camera permission, install success, active tracking or placement. Status is exactly one of:

- supported-installed
- supported-not-installed
- supported-outdated
- unsupported
- checking
- unknown

No permission or installation dialog is triggered. ARCore compatibility lookup itself may access network resources. Retry checking only after a deliberate user action; do not create background polling.

## open({snapshot})

Requires explicit user AR entry. Only the snapshot key is accepted. Native notice is displayed first, and a separate native `Kamera-AR starten` button is required before permission requests or Google Play Services for AR installation/update flow. Declining affects only AR.

Snapshot fields (all required unless marked optional):

- version: integer 1
- snapshotRevision: nonblank string, <=128 UTF-16 code units
- title: nonblank string, <=120 code units
- nodes: array length 1..256
  - id: unique nonblank string <=128 code units
  - label: nonblank string <=120 code units
  - detail: optional string <=1000 code units; newline/tab allowed
  - x, y, z: finite JSON numbers in [-1,1]; numeric strings rejected
- edges: array length 0..4096
  - from, to: integer indices into nodes, distinct and in bounds
  - parallel directed index pairs and reverse-directed pairs are allowed; every entry and the original array order are preserved without deduplication
- Total encoded JSON <=524288 UTF-8 bytes, max nesting depth8
- Unknown fields, control characters and unpaired Unicode surrogates are rejected

Integrator must make any reduction/omission visible and never silently truncate. Normalize 3D coordinates before sending. Native renderer maps the normalized graph schematically into a box above the anchor (default 0.9m wide/deep, heights0.05..0.65m), with user scale0.25..2.0. Physical dimensions are approximate display choices, not measurements. This is a bounded multigraph: distinct semantic relationships can share endpoints. Such edges are drawn on top of each other, not as spatially separate measurable connections. The native view shows the actual node/edge entry counts including all parallel relationships and explains this overlap.

Snapshot transport is process-local, one-shot, UUID-only Intent. No disk, WorkState, backup or external communication. Capacitor call options are emptied before launch to avoid saved-state/Binder payloads. Recreation/process loss aborts and asks for a new open. A pending native window rejects a second open with AR_BUSY.

Result resolves once with:

- status: closed | unavailable | permission-denied | error
- placed: boolean, whether a real plane-hit anchor was ever successfully created during this session
- snapshotRevision: exactly the input revision
- selectedNodeId: optional, only a member of the input snapshot
- message: optional brief explanatory message (not guaranteed)

An ID selection is informational only. Caller must check snapshotRevision against the still-current graph, verify membership again, and never trigger task completion/workflow writes from this result. Invalid payload/duplicate launch/activity-loss errors may reject with AR_INVALID_SNAPSHOT / AR_BUSY / AR_ACTIVITY_LOST / AR_INTERRUPTED.

## Required hardware gate

On a specifically named ARCore-supported Android device: test disclosure before camera; deny and permanently deny permission; missing/outdated/declined Google AR service; real camera image; scan and confirmed plane placement; stable anchor while moving; tracked-node tap and accessible picker; maximum graph; scale/reset; tracking loss; camera busy; rotation including180°; small landscape view; Home/lock/task switching; repeated open/close and Back; process recreation; camera release after close. Inspect native/UI errors and application state preservation. This has NOT run here.
