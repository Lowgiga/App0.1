# Entwicklung und Teststrategie

## Voraussetzung

Dieses Repository enthält Dokumentation. Die folgenden Befehle sind für die **vollständig rekonstruierte App-Quelle** gedacht; sie funktionieren nicht durch bloßes Klonen dieses Dokumentationsrepositories.

Zuerst Original → Import V2 → Recovery → Next → Quality → Diagnose → Branding mit exakten Vor-/Nachhashes materialisieren. Unbekannte Abweichungen nicht mit Fuzz oder Force übergehen. Die vorhandene Previewbasis separat erhalten.

## Toolchain

Der Quality-Kandidat deklariert Node **^22.18.0 || ^24.0.0**. Die gezielten Läufe wurden unter **24.19.0** ausgeführt. Die erklärten Minima 22.18.0 und 24.0.0 wurden dabei nicht zusätzlich ausgeführt. Direkte TypeScript-Tests benötigen die entsprechende Node-Unterstützung.

Vite 8.0.16 und seine notwendige feste Abhängigkeitskette sind im Quality-Lockfile vorbereitet. Eine frische Installation dieser Kette ist noch nicht belegt. Kein blindes npm audit fix --force, kein gleichzeitig unbegründetes Upgrade des gesamten Stacks.

## Vorhandene Befehle

```sh
npm ci
npm run check:drift
npm run check:vendors
npm run check:native-ar
npm run check:domain-fixes
npm run typecheck
npm test
npm run verify:serial
npm run preview
bash scripts/check_toolchain.sh
```

## Automatische CI/CD-Pipeline (.github/workflows/ci.yml)

Für die automatisierte Validierung und den Quellcode-Merge ist eine GitHub Actions Workflow-Pipeline integriert:

1. **Toolchain & Prerequisite Verification:** Prüft Node.js (24), Java JDK (21) und Android SDK-Umgebungsvariablen via `scripts/check_toolchain.sh`.
2. **Typecheck & Serial Tests:** Validiert Markdown-Dokumentation sowie TypeScript-Typechecks und serielle Tests (`npm run verify:serial`).
3. **Android APK Build:** Erzeugt bei Releases oder Pull-Requests automatisch Web-Bundles und Android Release-APKs (`./gradlew assembleRelease`).

`verify:serial` führt Portabilitätsprüfung, serielle Standardsuite und Build aus. Ein separat grünes Typecheck oder eine Teiltestsuite ersetzt diesen Gesamtlauf nicht. Die Vorschau ist an 127.0.0.1:4173 gebunden.

## Testschichten

| Gruppe | Bestehender Einstieg | Prüft |
| --- | --- | --- |
| Basis/Domain | test:base | Lokalen Store, Domain, Grenzen und Upstream-Domainregeln |
| Systemintegration | test:integration | React-/Provider-/Studio-/Backup-/Navigationseinbindung |
| Reviewerregressionen | test:reviewer | Frühere konkrete Fehlermuster |
| Vendor | test:vendors | Graph, adaptive Flächen, Skillkern, lokale Workflows, Backupkit |
| Level/Renderer | test:level | Lern-/AR-Domain und Renderer-Simulation |
| V7 | test:v7 | Zusammensetzung der ursprünglichen V7-Funktionen |
| Recovery | gezielte Systemtests | Journal, CAS, ACK, Pause/Stop, Resume |
| Quality | zwei neue Regressionstestdateien plus Bestand | Portal, Review, Speicher, Katalog |
| Diagnose | Projektion und UI | Positivliste, unbekannte Evidenz, Erreichbarkeit bei Speicherfehlern |
| Branding | UI-/Runtime-/Generatorregressionen | Sichtbare Marke bei unveränderten technischen Datenkennungen |

DOM-Tests verwenden happy-dom, Datenbanktests fake-indexeddb. Simulationen sind reale Ausführung der bezeichneten Produktionsfunktionen unter simulierten Plattformteilen, aber keine echte Browser-/Android-/GPU-/Stromverlustprüfung.

## Aktuelle Testevidenz

Die finale Brandingkombination ist gezielt mit **264 Tests in 24 Dateien**, TypeScript **0 Diagnosen**, geprüft. Dieser Umfang enthält die Quality-, Diagnose-, Branding- und ausgewählten AR-Bridgefälle. Quality 226, Diagnose 49, kombinierte Quality+Diagnose 76 und wiederholte unabhängige Reviews werden **nicht addiert**.

Der vollständige Status einschließlich Hashes und offener Gates steht in [Status und Evidenz](17-status-evidence.md).

## Verhalten bei einem Fehler

1. Exakten Stand, Befehl, Umgebung und reproduzierbaren Befund erfassen
2. Fehlerklasse trennen: Produkt, Fixture, Toolchain oder Prozessstart
3. Kleinsten reproduzierenden Regressionstest erstellen
4. Vorher rot nachweisen, Ursache begrenzt korrigieren, nachher grün
5. Generatoren und Outputs gemeinsam prüfen, wenn betroffen
6. Unabhängigen Review der finalen Bytes und angrenzende Regressionen ausführen
7. Gesamtlauf/Build wiederholen, bevor eine vollständige Freigabe behauptet wird

Der bwrap-Prozessstartfehler betrifft die ursprüngliche Umgebung. Die neue Cloudumgebung kann schreiben und Prozesse starten. Die frühere pauschale DNS-/Netzblockerdiagnose ist überholt: Reguläre HTTPS-Anfragen über den bereits vorhandenen Proxy lieferten für Google und npm HTTP 200. Netz- oder Sicherheitseinstellungen wurden dafür nicht verändert.

Stand 4. Oktober 2026, 12:30 UTC: Android SDK 36, Build Tools 35.0.0 und Gradle 8.14.3 sind prüfsummenverifiziert installiert; Gradle, aapt2 und apksigner starten. Node 24 ist vorhanden. Das vorhandene Java-Compilermodul startet mit Version 21.0.12.1; eine fehlende javac-Startdatei beweist daher keinen vollständig fehlenden Compiler. Die inzwischen abgeschlossene minimale Offline-JavaCompile-Probe scheitert jedoch an Gradles regulärer Toolchain-Erkennung (Is JDK: false). bin/javac und lib/ct.sym fehlen; --release 21 scheitert, während -source 21 -target 21 über das Modul funktioniert. Für den regulären Gradle-Build wird daher eine vollständige JDK-21-Installation benötigt. Die erfolgreiche direkte Modulkompilierung erzeugte lediglich eine isolierte .class-Datei als Diagnoseartefakt; die Gradle-Probe scheiterte. Keine App wurde kompiliert.

Der offizielle Library-Quelltransfer ist weiterhin blockiert. Sein frischer Downloadversuch meldet nur „download failed“ ohne HTTP-Status. Separate reguläre HTTPS-HEAD-Proben auf beide benötigten Speicherhosts wurden beim Proxy-CONNECT mit 403 Forbidden abgewiesen; dies ist keine Azure-HTTP-Antwort. Eine gezielte Hostfreigabe ist angefordert. Ohne geänderte Voraussetzung werden die Transfers nicht wiederholt oder umgangen. Noch kein Appbuild oder neue APK; startende Werkzeuge und RAM-Kandidatentests ersetzen die ausstehende Appprüfung nicht.

## Echte Abnahme

Frischer Browser-/WebViewlauf mit Datum, Sourcehash, Dataset und Versionsangaben. Prüfen: Reload, konkurrierende Sitzung, beschädigter Speicher, Unicode-/Grenzdateien, Cancel, Berechtigungsablehnung, Dialogfokus, Zurück, Hintergrund/Vordergrund, Context loss, Ressourcenfreigabe und 2D-Fallback.

Performancewerte erst auf dem finalen Bundle und tatsächlichen Plattformen messen. Keine Warnschwellen nachträglich erhöhen, um grün zu werden.

[Build](12-build-signing-release.md) · [Power-User-Methodik](20-power-user-method.md)
