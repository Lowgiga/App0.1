# Bestehende Architektur

## Überblick

Der Android-first-Port besteht aus einem lokal ausgeführten React-/Vite-Webkern und einer Capacitor-Hülle. Der ursprüngliche V7-Webquellstand bleibt unter `upstream/` nach Herkunftshashes geschützt. Kleine, explizite Generatoren erzeugen Integrationsänderungen unter `overlay/`. `src/` enthält den lokalen Transport, gemeinsame Zustandsanbindung, Studio und Plattformadapter.

Die Android-App lädt gebündelte Webdateien. Die im Upstream vorhandenen Next-/API-/D1-Dateien werden dadurch nicht zu einem aktiven lokalen Backend.

## Zusammensetzung

| Schicht | Konkrete Quelle | Verantwortung |
| --- | --- | --- |
| Einstieg | `src/main.tsx` | React StrictMode, statischer Katalog, lokaler Transport, gemeinsame Provider |
| App-Hülle | `src/system-app.tsx` | Arbeitsbereiche/Studio, Lade-/Speicherzustand, Navigation |
| Bestehende Oberfläche | `upstream/app/`, generierte `overlay/*.tsx` | 17 Bereiche und vorhandene Fachoberflächen |
| Geteilter Zustand | `src/shared-work-state.tsx`, `src/work-transport.tsx` | Ein gemeinsamer WorkState statt voneinander abweichender Kopien |
| Lokale Daten | `src/local-adapter.ts`, `src/local-domain.ts` | Explizites Requestprotokoll, Validierung, IndexedDB-Transaktionen |
| Studiozustand | `src/preferences-store.ts`, `src/system-state.ts` | Graph/Layout/Workflowoptionen und historischer Verlauf mit CAS |
| Graph/Flächen | `vendor/mesh-extensions/`, `vendor/adaptive-surfaces/` | Gemeinsame Projektion, 2D/3D/Inspector und kombinierte Flächen |
| Skillkern/Runner | `vendor/skill-core/`, `vendor/local-workflows/` | Geprüfte Pakete und begrenzte lokale Handler |
| Recovery-Nachtrag | `src/studio/workflow-journal.ts`, `durable-workflow-host.ts`, `workflow-runtime.ts` | Kandidatenpfade; persistente ausdrückliche Wiederaufnahme |
| Plattform | `src/platform/`, `android/app/` | Dateidialog, Clipboard, Navigation und native Adapter |
| AR | `android/cue-native-ar/`, `extensions/native-ar/` | Optionales experimentelles ARCore-Modul |
| Nachweise | `provenance.json`, `integration-manifest.json`, `docs/`, `tests/` | Quellenbindung, Integrationsgrenzen, Regressionen |

## Boot- und Zustandsgrenze

`main.tsx` liest `upstream/lib/mesh-data.json`, erzeugt `LocalWorkStore` mit bekannten Quellen-IDs und verbindet `WorkTransportProvider → SharedWorkStateProvider → SystemApp`. Arbeitsbereiche und Studio lesen denselben WorkState. Studioeinstellungen werden separat versioniert gespeichert.

Der lokale Transport ist **kein globaler fetch-Ersatz**. Er akzeptiert ausdrücklich nur lokale Protokollpfade und erlaubte Header. Er verwaltet keine Remoteidentität. Ein gespeicherter Katalogeintrag oder eine URL wird nicht automatisch abgerufen.

## Overlayprinzip

`scripts/build-overlay.mjs` und die spezialisierten Generatoren verwenden bekannte Originalanker. Unerwartete Anker oder Drift müssen den Aufbau abbrechen. Die Vite-Konfiguration löst bestimmte vorhandene Appmodule auf `overlay/` um; andere Module kommen weiter aus `upstream/`.

Korrekturen gehören gemeinsam in Generator, erzeugtes Modul, passende Pins und Regressionen. Eine manuelle Änderung nur am erzeugten Output geht beim nächsten Generieren verloren. Quality R1/R2 schließen deshalb Generator- und Laufzeitseite zusammen ein.

## Tatsächlicher Technikstand

| Komponente | Lesbare Importbasis | Neuer Kandidat |
| --- | --- | --- |
| React / React DOM | 19.2.6 | unverändert vorgesehen |
| TypeScript | 5.9.3 | unverändert |
| Three | 0.186.1 | unverändert |
| Capacitor | 8.5.2 | unverändert |
| Vite | 8.0.13 | Quality-Paket-/Lockfile-Kandidat 8.0.16; frische Installation offen |
| Android | min SDK 24, compile/target 36 | keine hier behauptete neue Geräteabnahme |
| ARCore | gepinntes 1.54.0-Modul | unverändert, Hardwareabnahme offen |
| Node-Unterstützung | alte Deklaration in Importbasis | Quality: ^22.18.0 oder ^24.0.0; ausgeführt unter 24.19.0 |

Die Versionsangaben stammen aus den bezeichneten Projektdateien und Kandidatennachweisen; sie sind keine Empfehlung, ungeprüft auf eine andere aktuelle Version umzusteigen.

## Nicht Bestandteil einer aktiven lokalen Architektur

`upstream/db/schema.ts` beschreibt eine frühere/serverseitige `mesh_work`-Tabelle mit userId, payload und updatedAt. `upstream/app/api/` sowie Connector-/MCP-Dateien dokumentieren den ursprünglichen Webkontext. Ihre Existenz beweist keinen laufenden Server, Cloud-Sync, Login oder Zugriff in der Android-App.

[Quellbaum](03-source-tree.md) · [Datenflüsse](05-data-flows.md) · [Entscheidungen](18-decisions.md)
