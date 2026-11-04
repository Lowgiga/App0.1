# Historischer V5-Integrationsnachweis

Die folgenden Angaben betreffen frühere Zwischenstände. Maßgeblich sind README, PARITY und INTEGRATION-RESULTS des aktuellen Pakets.

# Integrierter Prüfnachweis vor Gesamtreview

Stand 30.09.2026, nach Übernahme des final geprüften Adaptive-Moduls, noch ohne den gesondert zu prüfenden Level-/AR-Patch.

## Ausgeführt und bestanden

- 115 ursprüngliche V5-/Local-Transport-Tests, unveränderte Quelle
- 19 bereits vorhandene unabhängige Adapter-Reviewerregressionen, für dieses portable Sourcepaket nur relative Importpfade angepasst
- 220 gebündelte Modultests: Graph/Motion 55, Skill-Core 43, lokale Workflows 50, Backupcodec 27, Adaptive 45
- Zusätzliche Integrationstests: ein echter gemeinsamer React-Kontext mit einem einzigen Load, Zustandsmutation über zwei Consumer, Dateiplattformfälle, Navigation-Allowlist, Sourceguards für native Exporte, vollständiger Backup-Roundtrip, Workflow-Hostausführung mit echten Handlern/Pause/Resume/Abort, Goldenfixture über Graph/Backup/Workflow/Adaptive, DOM-Interaktion durch Studio/Skills/Backups/Academy, Root-Font-/Touchtarget-CSS
- TypeScript strict, verifizierte Original-/Vendorhashes, Vite-Produktionsbuild
- Keine externe fetch-Anfrage im integrierten DOM-Prüfpfad; keine unerwarteten React-Fehler

Ein DOM-Test führte tatsächlich alle vier lokalen Handler aus und sicherte echte Ergebnisse in der simulierten Webspeicherung. Das ist kein Browser-/Android-End-to-End-Nachweis.

## Native unabhängige Prüfung

Vom Parent in isolierter Kopie durchgeführt: `compileDebugJavaWithJavac`, `testDebugUnitTest`, `lintDebug` bestanden, 4 JUnit-Tests, 0 Lintfehler und 13 Warnungen zu ursprünglichen Scaffoldressourcen. Geprüfter CueFilesPlugin.java SHA-256:

`6fe4ac595d0f46f8c783263dedde082e188fb35f2fa4df89f7774505d238720a`

Der Android-Dateidialog, Providerfehler, Clipboard und Lifecycle wurden nicht auf einem echten Gerät ausgeführt. Der Java-Lifecycle-Regressionstest im Sourcepaket ist ein statischer Sourceguard, keine Gerätesimulation.

## Beobachtete und behobene Integrationsfehler

- Gemeinsamer Kontext zunächst absichtlich getrennte Hooks: Cross-Component-Test zeigte zwei Abrufe; Provider vereinigt sie und testet identischen Zustand
- Native Exportkontrakt zuerst nicht implementiert: Save/Cancel/Fehler-/Parallelitätsfälle schlugen fehl; tatsächlicher Adapter besteht alle Fälle
- Nativer Clipboarddispatch hatte vor Dispatch keine Activityvalidierung; ergänzter Sourceguard erst rot, nach kontrollierter Lifecyclebehandlung grün
- Sourcekopie hatte den V5-Quellordner `upstream/build/` versehentlich als Buildcache ausgelassen. Driftprüfung schlug fehl; vollständige Originaldateien wiederhergestellt
- Adaptive Allowlist wies punktgetrennte Daten-/Actionrefs korrekt zurück. Adapter nutzt nun erlaubte Unterstrich-Refs; alle Layoutvorlagen und Navigationstests grün
- Erste DOM-Harness-Runde fehlte `isSecureContext`; Testumgebung korrigiert, Abschluss prüft tatsächliche Academy-Node und fehlende Reactfehler statt nur Beschriftung

## Noch offen

Unabhängiger Gesamtreview, separater Level-/AR-Patchreview, echter Android-/Samsung-Datei-/Clipboard-/Touch-/GPU-/WebXR-Test, vollständiger persönlicher Cloudexport, Cloudsync/Provider/MCP-Anbindungen, vollständige Backupwiederherstellung. Kein APK-Release, keine Signierung und keine Veröffentlichung in dieser Integrationsphase.

## Logs

`verification-before-review.txt` enthält die letzte vollständige eigene Test-/Buildserie. Weitere gezielte Rot/Grün- und Portabilitätslogs liegen daneben. `build-manifest.json` identifiziert Webbuildbytes, `integration-source-manifest.json` die eingefrorenen aktiven Quellbytes. Historische Logs haben ihre damaligen Testzahlen; der Gesamtreport behauptet daraus keine zusätzlichen Geräteprüfungen.

## Reparatur der unabhängigen Integrationsbefunde

Eigener neuer Prüfstand vor Retest: 396 Tests (115 Basis, 42 Integration, 19 frühere Reviewerregressionen, 220 Module), strikter TypeScript-/Webbuild grün. Die ursprünglichen Modulquellen bleiben unverändert; die Graph-Hostpolicy ist ein zusätzlich generierter Overlay.

- Studio-History wird vor Zielnavigation nicht mehr ersetzt; der neue Original-Zieleintrag entfernt `studio` erst im eigenen pushState
- Energiesparen und globale Bewegungsreduktion wirken in beiden Graphperspektiven bei jedem Render und auf die tatsächlichen 3D-Props; inaktive UI-Regler sind gesperrt. Präferenzen bleiben separat erhalten
- Versteckte Originalansicht reagiert nicht auf Cmd/Ctrl+K und öffnet dort kein Portal
- Studio bleibt innerhalb derselben App-Sitzung gemountet; pausierte private Fortsetzungspunkte überleben den Wechsel zu den ursprünglichen Arbeitsbereichen
- Studio-/Graph-/Workflowoptionen und Historie liegen nun in einer eigenen revisionsgeprüften IndexedDB-Readwrite-Transaktion. Veraltete oder parallele Schreiber erhalten einen sichtbaren Konflikt; kein stilles Löschen bestätigter Historie. Bestätigung erst nach oncomplete; Abort nach put-Erfolg bleibt Fehler
- Dichte gültige Graphen werden vollständig in höchstens 500 Kanten pro Graph-Teilschritt aufgeteilt. Das geprüfte Beispiel mit 106 Knoten und 1.722 Kanten endet erfolgreich mit sieben tatsächlichen Schritten für vier Funktionen; Kanten werden nicht gekürzt
- Zurückgestellte Uhren blockieren den Backup-Export nicht. Die tatsächliche beobachtete Zeit bleibt in exportContext.observedWallTime erhalten; der logisch angehobene Metadatenzeitpunkt ist als logicalExportTime/clockAdjusted klar ausgewiesen. Die Arbeitsrevision bleibt unverändert
- Unvollständige reservierte Systembackup-Hüllen werden abgewiesen und nicht als Legacydatei angenommen

Gezielte Rot-/Grün-Nachweise liegen unter review-fixes-*, preferences-atomic-*, data-boundaries-* und review-dom-final.txt. Der unabhängige Retest dieser Reparaturen steht bei Erstellung dieses Abschnitts noch aus. Hardwaregrenzen bleiben unverändert.
