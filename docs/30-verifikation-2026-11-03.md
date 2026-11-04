# 30 · Nachprüfung des 0.5.4-Quellstands am 3. November 2026

Ergebnis: Der Quellstand von PR #9 (`16ef6a1`) besteht die projekteigene Gesamtverifikation mit dem unabhängig geprüften Vertrags-Pin, alle 1.542 Web-Tests und alle 71 JVM-Tests. Der Webbuild ist zwischen Node 22 und 24 byte-identisch. Gefunden wurden ein kalenderabhängiger Lint-Fehler und mehrere Doku-Abweichungen; APK, Signatur und Gerät sind weiterhin nicht geprüft.

Quell-Hash (`quality-source-v1`): `96464ab1bf3e43e2c9fd3f611605d54e104062447262858ccb4df3113366ed03`, identisch mit dem [K3-Nachweis](29-k3-quality-adoption.md) – vor und nach der Verifikation.

## Umgebung

Linux x86_64, 4 vCPU, 15 GB RAM. Node.js 22.23.4 (Hauptlauf) und 24.22.1 (Build-Vergleich), npm 10.9.9, OpenJDK 21.0.12.1, Gradle 8.14.3, Android SDK Platform 36 (r02), Build-Tools 35.0.0, Platform-Tools 37.0.1. Für die PR-Prüfung zusätzlich PowerShell 7.4.6 mit PSScriptAnalyzer 1.25.0, actionlint 1.7.7, ShellCheck und yamllint.

## Ergebnisse

| Prüfung | Befehl | Ergebnis |
| --- | --- | --- |
| Gesamtverifikation | `node scripts/verify-quality.mjs --contract-sha256 e044726f…` | PASS in 255 s: Preflight, 50 Quality-Tests, `verify:serial`, Postflight, Quellstabilität |
| Einzelsuiten | `npm run test:base` … `test:quality` | 246 + 970 + 19 + 220 + 30 + 7 + 50 = 1.542 PASS, 0 FAIL |
| Abdeckung | `node --experimental-test-coverage` (1.304 Tests) | 85,94 % Zeilen, 89,18 % Branches, 81,77 % Funktionen |
| TypeScript | `npm run typecheck` | 0 Diagnosen |
| Webbuild | `npm run build` | 61 Dateien, `distContentSha256` `4ce54dee7020585a…`, unter Node 22.23.4 und 24.22.1 identisch |
| Abgleich mit K3 | gegen `docs/reference/k3-routing/build-manifest.json` | 57 von 61 Dateien identisch |
| Android JVM-Tests | `:app:testDebugUnitTest :cue-native-ar:testDebugUnitTest` | 4/4 und 67/67 PASS |
| Android Lint | `:app:lintDebug :cue-native-ar:lintDebug` | ohne Init-Skript: AR-Modul FAIL; mit Init-Skript: App 0 Fehler/13 Warnungen, AR-Modul 0 Befunde |
| AR-Modul-Pins | `node scripts/verify-native-ar.mjs` | 30 von 30 Dateien byte-identisch (Revision 10) |
| Gradle-Wrapper | SHA-256 gegen services.gradle.org | `7d3a4ac4…` = offizielle Prüfsumme 8.14.3 |
| Qlty (GitHub-Status) | auf `16ef6a1` | „No blocking issues“ |

Die Zeilenabdeckung ist nach oben verzerrt, weil viele Dateien sehr lange Zeilen haben; die Branch-Abdeckung ist der belastbarere Wert.

## Befunde und Status

| # | Befund | Status |
| --- | --- | --- |
| 1 | `cue-native-ar` setzt `warningsAsErrors`; die Prüfung `GradleDependency` meldet seit ARCore 1.57.0 und appcompat 1.8.0 Fehler, ohne dass sich Code geändert hat | Entschärft durch [`tools/gradle/android-lint-stable.init.gradle`](../tools/gradle/android-lint-stable.init.gradle); dauerhafte Quellkorrektur siehe unten |
| 2 | Maven Central antwortete in einer Proxy-Sandbox mit HTTP 429 | [`tools/gradle/maven-central-mirror.init.gradle`](../tools/gradle/maven-central-mirror.init.gradle) |
| 3 | `check:portability` bricht ab, solange `android/local.properties` existiert | Absicht des Projekts; Android-SDK über `ANDROID_HOME` setzen, nicht über `local.properties` |
| 4 | `app/docs/build-manifest.json` stammte vom 4. Oktober (54 Dateien) | Neu erzeugt (61 Dateien); die Datei liegt außerhalb des Quality-Scopes |
| 5 | `app/README.md` nennt 18 gepinnte AR-Moduldateien, das Prüfskript verifiziert 30 | Korrekturbedarf für den nächsten Adoptionszyklus; `app/` wurde nicht verändert |
| 6 | Doku-Index ohne 22–24 und ohne das zweite Dokument 25; Präfix 25 doppelt vergeben | Index ergänzt, Dateien nicht umbenannt (bestehende Links bleiben gültig) |
| 7 | Zwei tote Links in gepinnten Zonen: absoluter Entwicklerpfad in `app/upstream/public/documents/cue-team-initialisierung.md`, `reports/` in `app/vendor/local-workflows/README.md` | Dokumentiert; Korrektur nur über Overlay oder neue Vendor-Version |
| 8 | Die deklarierte Mindestversion Node 22.18.0 war nie ausgeführt | Neue CI prüft 22.18.0 und 24 und vergleicht die Build-Fingerabdrücke |
| 9 | Vier Build-Dateien weichen vom K3-Nachweis ab: `assets/Studio-BLwMykJp.js`, `assets/index-BiKX18Tc.js`, `assets/mesh-space-BJtWmuzr.js`, `index.html` | Offen. Quell-Hash und Lockfile sind identisch, Node 22 und 24 liefern dieselben Bytes; nächster Schritt: K3-Artefakte mit `diffoscope` vergleichen |

## Dauerhafte Quellkorrektur für Befund 1 (zur Adoption)

`app/android/` ist ein review-geschützter Pfad des Quality-Gates. Die folgende Ergänzung in `app/android/build.gradle` wirkt wie das Init-Skript, braucht aber eine bewusste Baseline-Adoption mit neu geprüftem Vertrags-Pin:

```groovy
subprojects {
    ['com.android.application', 'com.android.library'].each { pluginId ->
        plugins.withId(pluginId) {
            android.lint.disable.addAll(['GradleDependency', 'NewerVersionAvailable', 'AndroidGradlePluginVersion'])
        }
    }
}
```

## Nicht ausgeführt

APK-Build, Signierung, parallele Installation und Geräteabnahme (REL-03, REL-04, QA-01) sowie jede Hermes- oder Ollama-Installation. Die Befunde zu PR #14 und #15 stehen in [32](32-pr-triage-2026-11-03.md).
