# CUE experimental native AR kit

A small, read-only Android ARCore1.54.0 library and Capacitor8.5.2 plugin. It uses a live camera texture, horizontal Plane hit-testing and one local Anchor. The supplied graph is schematically rendered as green nodes/silver edges; explicit placement, reset, scale, screen picking and a text-based node selector are provided.

This is experimental source with compile/unit/lint evidence, not a hardware-verified AR app. No real Android device, camera, sensor tracking or GPU was available. The compile-only fixture has no launcher and must not be distributed as a finished APK.

Read `docs/BRIDGE.md` for exact schema, integration and required hardware checks. `docs/design.md` records the approved scope. `licenses/THIRD-PARTY-NOTICES.md` records SDK terms and official artifact hashes. The normal app remains usable without AR.

## Reproduce local checks

Source the already provisioned `../android-toolchain/env.sh`, then run `scripts/verify.sh`. The fixture pins AGP8.13.0, Gradle8.14.3 (wrapper checksum), SDK36/min24 and carries an unmodified Capacitor8.5.2 source copy with its MIT license. The Android SDK and JDK are external build prerequisites, not packaged. Official Google Maven and Maven Central resolve dependencies; no credentials, Cloud APIs or paid services.

Library lint treats warnings as errors. Only the advisory `NewerVersionAvailable` and `GradleDependency` warnings on the specifically pinned JSON-java test dependency and AndroidX Activity dependency are suppressed inline because the reviewed fixture intentionally matches Capacitor8.5.2; runtime/security/UI lint checks remain active. Build-tool metric-path, SDK-XML and Gradle-deprecation warnings are recorded separately; they are not app lint passes/failures.

Snapshots are bounded to256 nodes/4096 indexed edges/512KiB and stay process-local. Parallel relationship entries are retained in order and included in the displayed counts; identical endpoints overlap in the schematic drawing, as the viewer explains. No graph upload, recordings, task writes or automatic workflow execution. Before camera/install requests, the native window displays the Google AR privacy notice and requires a separate Start press. Google Play Services for AR can collect/process its own data; the feature is not marketed as wholly offline or Google-free.

## Review status

Revision5 passed independent source-integration review; final host integration and physical-device checks remain separate required gates. This directory does not modify cue-system, cue-v6 or cue-final.
