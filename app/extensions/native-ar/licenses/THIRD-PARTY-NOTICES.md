# Dependencies and terms

The adapter source is newly written for this project, using documented ARCore APIs and GLES2. It does not copy Google hello_ar rendering source/assets. Its ARCore disclosure reproduces Google's required/recommended notice.

- ARCore `com.google.ar:core:1.54.0` from official Google Maven, https://dl.google.com/dl/android/maven2/com/google/ar/core/1.54.0/core-1.54.0.aar
- ARCore AAR SHA-256: b4f7ed551521c067ea62ea7a05b9d1783125f0f2ecd2687cce296592a9a8bb2c
- ARCore POM SHA-256: 93f73c916994313cd9053edb57ff322b39f34949383c2695d3ae02e216ba1d9d
- ARCore binaries: https://developers.google.com/ar/develop/terms and https://developers.google.com/terms, NOT Apache-2.0. See included official versioned ARCORE-SDK-LICENSE.txt (https://raw.githubusercontent.com/google-ar/arcore-android-sdk/1.54.0/LICENSE).
- The official Gradle Maven download required no separate acceptance click. Use implicates the linked terms. No explicit agreement confirmation was bypassed. There is no purchase, cloud API key, subscription, Cloud Anchor, Geospatial use or graph upload.
- Google Play Services for AR has its own data collection/processing. Required visible app disclosure and links follow https://developers.google.com/ar/develop/privacy-requirements and https://policies.google.com/privacy. This is not a promise of wholly offline/Google-free operation.
- Capacitor Android 8.5.2 (MIT) is copied unmodified into fixture/capacitor solely for isolated compile validation; its original LICENSE is retained there. Host should use its existing same-version dependency.
- AndroidX Activity1.11.0/AppCompat1.7.1 and transitive AndroidX artifacts: Apache-2.0 via official Maven metadata.
- JVM test only: JUnit4.13.2 (EPL1.0), Hamcrest1.3 (BSD), JSON-java20250517 (public-domain notice from Maven artifact metadata). These test dependencies are not packaged into the app.
- AGP8.13.0 / Gradle8.14.3 / JDK21 are local build tools, not app runtime APIs.

Do not describe the entire SDK as Apache-2.0 or relicense its binaries. Public app/store release needs its own final privacy/notice/legal review. This isolated fixture is not a store-ready app.
