# Verifizierte Ordnerstruktur

## Bezugsstand und Leseregel

Dieser Baum beschreibt das **separat verwahrte App-Quellpaket**. Im vorliegenden GitHub-Repository stehen nur Dokumentationsdateien. Die lesbare rekonstruierte Importbasis heißt `0.5.1-v7-import-preview-reconstructed`; spätere Recovery-, Next-, Quality-, Diagnose- und Brandingänderungen liegen als genaue Nachträge vor.

Ein vollständiges, nach Pfad sortiertes [Inventar mit 859 Dateieinträgen](reference/source-inventory.md) hält die exakt rekonstruierte finale Kandidatenkette fest. Es wurde im RAM aus allen sieben gesicherten Eingaben geprüft. Die nachstehende Hauptstruktur wurde zusätzlich direkt an der lesbaren Importbasis geprüft; spätere Kandidatenpfade werden ausdrücklich ergänzt. Eine vollständige materialisierte Buildkopie wird nicht behauptet.

## Tatsächlicher Hauptbaum

```text
cue-system/
├── README.md
├── package.json / package-lock.json
├── capacitor.config.json
├── vite.config.ts / tsconfig.json / postcss.config.mjs
├── index.html
├── provenance.json / integration-manifest.json
├── src/                         lokaler App- und Integrationscode
│   ├── main.tsx / system-app.tsx
│   ├── shared-work-state.tsx / work-transport.tsx
│   ├── local-adapter.ts / local-domain.ts / local-errors.ts
│   ├── conflict-gate.ts / legacy-import.ts / LegacyImportPanel.tsx
│   ├── backup-adapter.ts / BackupPanel.tsx
│   ├── preferences-store.ts / system-state.ts / system-preferences.tsx
│   ├── local-documents.ts / LocalSourceDocument.tsx
│   ├── local-collaboration.ts / system-navigation.ts
│   ├── NativeARPanel.tsx
│   ├── graph/view-policy.ts
│   ├── platform/
│   │   ├── files.ts / runtime.ts
│   │   └── native-ar.ts / native-ar-runtime.ts
│   └── studio/
│       ├── Studio.tsx / AdaptivePanel.tsx / WorkflowPanel.tsx
│       └── surface-contract.ts / workflow-host.ts
├── upstream/                    gepinnte V7-Webbasis
│   ├── app/                     17 Bereiche, Panels, Renderer, ursprüngliche API
│   ├── lib/                     WorkState, Missionen, Aktionen, Lernen, Quellen
│   ├── components/ui/           bestehende UI-Bausteine
│   ├── hooks/ / public/ / tests/
│   ├── db/ / drizzle/           ursprünglicher serverseitiger Datenkontext
│   └── build/ / scripts/ / docs/ / examples/ / vendor/
├── overlay/                     erzeugte Integrationsmodule
│   ├── lib/
│   └── level-base/
├── vendor/
│   ├── mesh-extensions/         Graph, SVG, Three, Inspector, Layouts
│   ├── adaptive-surfaces/       typisierte kombinierte Arbeitsflächen
│   ├── skill-core/              Paketverträge, Loader, Host, Kernel
│   ├── local-workflows/         Katalog, Runner, Grenzen, Ereignisse
│   └── portable-kit/            Backup-Hülle, Integrität, Vorschau
├── extensions/
│   ├── level-ar/                eingefrorene Rev3-Erweiterung
│   ├── v7-integration/          V7-Zusammenführung und Renderer-Lifecycle
│   ├── domain-fixes/            begrenzte Domainkorrekturen mit Pins
│   └── native-ar/               Vertrag, Quellenmanifest, Lizenzhinweise
├── android/
│   ├── app/                    Capacitor-Host und CueFiles-Plugin
│   ├── cue-native-ar/          experimentelles natives AR-Modul
│   ├── capacitor-cordova-android-plugins/
│   ├── gradle/ / gradlew / gradlew.bat
│   └── build.gradle / settings.gradle / variables.gradle
├── scripts/                    Generatoren, Drift-/Pinprüfer, Paketierung
├── tests/                      Basis-, System-, Reviewer-, Level-, V7-Tests
├── reports/                    abgegrenzte technische Prüfberichte
├── docs/                       historische und versionsbezogene Projektnachweise
├── provenance/ / licenses/
├── archive/v4-8bb5654/          historische Referenz, nicht neue aktive App
├── dist/                       vorhandene ältere Webausgabe, kein neuer Buildbeleg
└── node_modules/               lokale Abhängigkeiten, kein Sourceartefakt
```

## Zuständigkeiten innerhalb von src

| Gruppe | Quellpfade | Änderungsregel |
| --- | --- | --- |
| Boot und Host | main, system-app, system-navigation | Gemeinsamen Provider-/Navigationsvertrag erhalten |
| Datentransport | local-adapter, local-domain, work-transport, shared-work-state | Mutationen nur validiert und atomar; Fehler erhalten Daten |
| Import | legacy-import, LegacyImportPanel, conflict-gate | Plan und genau bestätigtes Ziel nicht auseinanderlaufen lassen |
| Backup | backup-adapter, BackupPanel | Integrität, Schema und Wahrheit der Daten unterscheiden |
| Optionen | preferences-store, system-state, system-preferences | Revisionen/CAS erhalten, unklaren Save nicht wiederholen |
| Dokumente | local-documents, LocalSourceDocument | Gebündelte Texte anzeigen, nicht als Code ausführen |
| Studio | Studio, AdaptivePanel, WorkflowPanel, workflow-host | Bestehenden Zustand/Runner verwenden |
| Native Grenze | platform, NativeARPanel | Strikte Ein-/Ausgabeverträge und bewusstes Starten |

Die Kurzformen in der Tabelle beziehen sich auf die im Baum vollständig bezeichneten Dateien.

## Zusätzliche Kandidatenpfade

Diese Pfade sind **in Nachträgen belegt**, aber nicht Teil der direkt gelesenen Importbasis. Im verlinkten finalen 859-Dateien-Inventar sind sie enthalten:

- Recovery: `src/studio/workflow-journal.ts`, `src/studio/durable-workflow-host.ts`, `src/studio/workflow-runtime.ts`
- Recoverytests: `tests/system/workflow-journal.test.ts`, `tests/system/durable-workflow-host.test.ts`, `tests/system/workflow-recovery-ui.test.tsx`
- Qualitytests: `tests/system/quality-data-regressions.test.ts`, `tests/system/quality-ui-regressions.test.tsx`
- Diagnose: `src/diagnostics.ts`, `src/studio/DiagnosticsPanel.tsx`, `tests/system/diagnostics-projection.test.ts`, `tests/system/diagnostics-ui.test.tsx`
- Branding: zusätzliche Regressionen und begrenzte Anpassungen bestehender Sicht-/Exportnamen; exakter Umfang im [Statusnachweis](17-status-evidence.md)

## Generatoren und Prüfer

`scripts/build-overlay.mjs` orchestriert die erzeugte Integration. Spezialisierte Skripte betreffen UI, Sidebar, Dokumente, Graph, Level, Domain und Legacy-Import. `provenance.mjs`, `verify-vendors.mjs`, `verify-native-ar.mjs` und `verify-domain-fixes.mjs` prüfen die jeweiligen Herkunftsgrenzen. `build-manifest.mjs` erfasst erst nach einem echten Webbuild dessen Ausgabe. `package-source.py` und `source-manifest.mjs` unterstützen nachvollziehbare Sourceartefakte.

Ein bereits vorhandenes `dist/` oder `docs/build-manifest.json` darf bei einem neueren Kandidaten nicht als frisch erzeugt ausgegeben werden.

[Geplante Struktur](14-target-structure.md) · [Entwicklung](11-development-testing.md)
