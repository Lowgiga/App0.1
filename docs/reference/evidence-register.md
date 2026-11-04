# Quellen- und Evidenzregister

## Geltungsbereich

Die folgenden technischen Projektartefakte liegen **separat gesichert**, nicht als Source-ZIP, APK oder vollständige Patchdatei in diesem Repository. Hier werden ihre Identität, Rolle und Prüfaussage dokumentiert. Keine privaten Daten oder Signierschlüssel werden übernommen.

Hashes sind Integritätsbezüge, keine Freigabe und keine Behauptung aktueller Gerätefunktion.

## Primäre Quellkette

| Stufe / Projektartefakt | Größe | SHA-256 des Artefakts |
| --- | ---: | --- |
| Cue-Command-Mesh-0.5.0-Quellcode.zip | 6.668.060 Byte | 8cde274e63cf4bd0aebb097e156d389a2a52e3419cf1c266bc01fd050e21c3bb |
| Cue-Command-Mesh-0.5.1-Reconstructed-Import-Wiederherstellung.md, Version 2 | 151.398 Byte | f0fe695398d6ebf0ee8b9219d8a369fa5d580f1253b0c65a072cacc57915c13a |
| Cue-Command-Mesh-0.5.2-Reconstructed-Recovery-Wiederherstellung.md | 224.863 Byte | 2c6ab9885e60c27330f7b06d88edaceb3a4eb8e1c59ad5fbdc3c81f59465eec9 |
| Cue-Command-Mesh-0.5.2-Reconstructed-Next-Konfigurationsnachtrag.md | 50.877 Byte | c1a5e93aac3111c2e429839636982f742d55bf7c2260457c5d945a511643eda7 |
| LowQuantFlow-0.5.2-Quality-Korrektur-2026-10-04.md | 206.918 Byte | c352e88af6925fa7da425cf6252898660233dc808ec7e36e9868b895536aa876 |
| LowQuantFlow-Lokale-Diagnose-Quellcode-Checkpoint.md | 55.786 Byte | b544b51e4086aee1518e4845b9afbdb09306484d134235e26dd6582118074c53 |
| LowQuantFlow-0.5.2-Branding-Kombinationsnachtrag.md | 180.851 Byte | 1367032a6af0b596487d8f3a35960de4dcb810b77d541350f56ca96a8b45f8a3 |

Das Planungsartefakt „LowQuantFlow-Entwicklungsplan-und-Abnahmematrix.md“ bildet die 27 Anforderungen und sieben Gates ab. Statusangaben wurden für diese Repositorydokumentation mit den späteren finalen Quality-/Diagnose-/Brandingnachweisen abgeglichen.

## Herkunft des unveränderten Upstreams

`provenance.json` bezeichnet den V7-Webstand/App 1.4.2/WorkState 4 mit Quellcommit **3e921804b13e0d7c70d1ff15474f0387e84d70b6** und Hashes von 226 Upstreamdateien. Dies ist eine historische Herkunfts-ID, kein Commit dieses Repositories und deshalb kein erfundener GitHublink.

## Aussage → konkrete Codequelle

| Aussage | Quelle innerhalb des gesicherten Apppakets |
| --- | --- |
| 17 Bereiche und IDs | upstream/app/mesh-app.tsx; upstream/lib/work-constants.ts |
| WorkState und Profile | upstream/lib/work-contract.ts |
| Missionen/Freigaben | upstream/lib/command-contract.ts |
| Lokaler Store und Protokoll | src/local-adapter.ts; src/local-domain.ts |
| Gemeinsame React-Anbindung | src/main.tsx; src/shared-work-state.tsx; src/work-transport.tsx |
| Importplan und Bestätigung | src/legacy-import.ts; src/LegacyImportPanel.tsx |
| Backuphülle und Vorschau | src/backup-adapter.ts; vendor/portable-kit/backup.mjs |
| Revisionsgeschützte Preferences | src/preferences-store.ts; src/system-state.ts |
| Graph und Inspector | vendor/mesh-extensions/src/GraphExplorer.tsx; Inspector.tsx; SvgView.tsx; ThreeView.tsx |
| Skill-/Workflowgrenzen | vendor/skill-core/src/contract.mjs; vendor/local-workflows/src/contracts.mjs; runner.mjs |
| Recovery | Kandidat src/studio/workflow-journal.ts; durable-workflow-host.ts; workflow-runtime.ts |
| Diagnose | Kandidat src/diagnostics.ts; src/studio/DiagnosticsPanel.tsx |
| Native Dateiausgabe | src/platform/files.ts; android/app/src/main/java/de/lowgiga/cuecommandmesh/preview/CueFilesPlugin.java |
| AR-Bridge | src/platform/native-ar.ts; extensions/native-ar/docs/BRIDGE.md |
| Overlayintegration | scripts/build-overlay.mjs; scripts/build-ui-overlays.mjs; vite.config.ts |
| Versions-/Paketgrenzen | package.json; package-lock.json; capacitor.config.json; android/app/build.gradle |

## Wichtige Nicht-Belege

Vorhandene alte dist-Dateien, historische Testlogs, ein Appname, READMEbadge, GitHubcommit oder ein vollständiger Dateibaum belegen keinen frischen nativen Build. DOM-/IndexedDB-/Renderer-Simulationen sind keine reale Geräteabnahme. Die finalen Grenzen stehen im [Statusnachweis](../17-status-evidence.md).

[Dateiinventar](source-inventory.md) · [Dokumentationsindex](../README.md)
