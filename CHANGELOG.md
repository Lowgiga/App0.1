# Änderungsprotokoll

## 2026-11-04 · OMEGA-Runtime: Abgleich mit Plan und App, Härtung, Knotendienst

- Verträge an Plan 31 und App-Typen angeglichen: E4 nie autonom (Eigentümer-Signatur `omega.owner-approval/v1`), Capability mit Nachweis/Fallbacks, Ereignisse mit Datenklasse, Tasks mit 10 Missionsstufen und 4 Profilen, Grants mit Tagesbudget, selbstzertifizierende Knoten-IDs; Drift-Tests gegen `app/` ([35](docs/35-omega-runtime-stand.md)).
- Härtung: Kill-Switch und Replay-Schutz überstehen Neustarts, fail-safe bei defektem Zustand, Replay je Absender, Lease-Ablauf im Tasker-Befehl, begrenzte Freigaben, `Object.hasOwn` statt geerbter Namen, Fencing-Tokens ≥ Uhrzeit, Reparaturpfad mit Journal-Quarantäne, Windows-feste Geheimnisdatei.
- Neu: Peer-Registry mit Kopplungscode, hash-verkettetes Journal, Knotendienst mit HTTP `/api/omega/v1`, CLI `omega`, Proben für adb/scrcpy, Java-Referenz der Tasker-Prüfung mit Interop-Test; 79 Tests mit festen RFC-8032-Sollwerten. CLI akzeptiert Schlüssel, die mit `-` beginnen. CI-Job `omega` mit JDK 21 und CLI-Rauchtest.
- Abnahmematrix um den Block OMG-01 bis OMG-09 ergänzt; die 27 App-IDs bleiben unverändert.

## 2026-11-04 · OMEGA-Runtime und Tasker-Brücke

- OMEGA-Runtime `omega/` (ohne Abhaengigkeiten): HLC, Ed25519-Ereignisse mit Replay-Schutz, Leases mit Fencing-Token, Trust Kernel E0-E4 mit Kill-Switch und Einmal-Freigaben, Tasker-Bruecke `omega.tasker/v1` mit Allowlist und HMAC, sechs JSON-Vertraege, 19 Tests; CI-Job `omega`.
- `omega/windows/Start-OmegaLink.ps1`: Plug & Play (mDNS -> adb connect -> scrcpy).
- `docs/34-tasker-bruecke.md`: Tasker-Anleitung fuer Plug & Play, Kill-Kachel und Freigabe-Overlay.

## 2026-11-03 · Nachprüfung, CI und PR-Triage

- Nachprüfung 0.5.4: Gesamtverifikation mit Pin PASS, 1.542 Web-Tests, 71 JVM-Tests ([30](docs/30-verifikation-2026-11-03.md)).
- Neue CI `.github/workflows/ci.yml` (ersetzt PR #14): Node 22.18.0 und 24, Quality-Pin, Reproduzierbarkeit, Android-Tests und Lint, Link-Prüfung.
- `tools/gradle/`: Lint unabhängig vom Release-Kalender, Maven-Central-Spiegel; gepinnte Dateien unverändert.
- PR-Triage-Werkzeug und Ergebnis ([32](docs/32-pr-triage-2026-11-03.md)); sichere Hermes-Einrichtung mit Prüfskript ([33](docs/33-hermes-sicher-einrichten.md)).
- Analyse und OMEGA-Plan v1.0 ([31](docs/31-analyse-und-omega-plan.md)); `app/docs/build-manifest.json` neu erzeugt.

## 2026-10-06 · K3 und geprüfter Memory-/Assistant-Routingpfad innerhalb 0.5.4

- Übernommenen Vorschlag anhand bestätigter Applyantwort und genauer Identität wiederfinden; Ergebnisnavigation bleibt lesend und bestätigt nichts
- Vier Eintragsaktionen gegen stille URL-Wechsel, alte Callbackgenerationen und veraltete Revisionen abgesichert
- Gültige Assistant-URLs sowie Memory-Inkarnation im validierten Browser-History-Eintrag über Tabwechsel, Reload und Zurück/Forward erhalten
- 15 geprüfte Sourceziele einschließlich bewusst angenommener Qualitymetadaten übernommen; alte 41 Schutzgruppen unverändert, neun ergänzt
- 1.492 App-Tests plus 50 Qualitytests, fünf Gatephasen, TypeScript/Generatoren/Webbuild PASS; alle 61 Assets bytegleich zum unabhängig geprüften Browserstand
- K1/K2-Nachweise erhalten, neue K3-/Adoptionsdokumente ergänzt; WRK-01-Vertragsentscheidung nicht enthalten
- Keine Versionserhöhung, neue Ausgabe, automatische Bestätigung, LLM-Engine, native Freigabe oder Zusammenführung

## 2026-10-05 · K2 und konkrete Änderungsvorschau innerhalb 0.5.4

- Bewusst gewählte gespeicherte Revision im vorhandenen Editor öffnen; Projektinkarnation, Revision und Navigation erneut prüfen
- History-/Routenfehler unabhängig korrigiert; alte Entscheidungen auch bei Rückkehr zur gleichen URL verwerfen
- Konkrete Nutzervorschau mit Projekt, Revision, Grundlage, Herkunft und Text; bei Korrektur bisheriger Eintrag sichtbar
- Nur die geprüfte Fassung bewusst als unbestätigten Vorschlag übernehmen; Inhaltsbestätigung bleibt separat
- 13 Sourceziele einschließlich bewusst angenommener Qualitymetadaten; bisherige 33 Gruppen unverändert, acht ergänzt
- Fünf Gatephasen, 1.459 App-Tests plus 50 Qualitytests, TypeScript/Generatoren/Webbuild PASS; 61 Assets bytegleich zum Browserprüfstand
- K1-Nachweis unverändert erhalten, Produktkontext unter Dokument 27 ergänzt; keine Versionsanhebung, Ausgabe, autonome Ausführung, echte LLM oder Zusammenführung

## 2026-10-05 · Lesende K1-Projektfortsetzung innerhalb 0.5.4

- Gespeicherte Entwurfsmetadaten und bestätigten nächsten Schritt dem gewählten Projekt und seiner Inkarnation zugeordnet
- Stale Grundlagen, Draftrevisionen, konkurrierende Änderungen und bewusste Navigation abgesichert; Entwurfstext bleibt außerhalb der Beratung
- Kein automatisches Öffnen/Übernehmen/Rebasieren, keine Inhaltsbestätigung oder Workflowausführung; vorhandene Editor-Autosicherung bleibt separat
- 13 geprüfte Sourceziele übernommen, drei neu und zehn geändert; alte 29 Schutzgruppen erhalten, vier bewusst angenommen
- Fünf Qualityphasen, 1.417 App-Tests plus 50 Qualitytests, TypeScript/Generatoren/Webbuild PASS; identische geprüfte K1-Browserassets
- K1-Dokumentation vom Plan auf den tatsächlich belegten lesenden Webumfang fortgeschrieben; keine Versionsanhebung, Ausgabe, native Freigabe oder Zusammenführung

## 2026-10-05 · Fortlaufender Assistant-/Mobile-Ausbau innerhalb 0.5.4

- Validierte Vorschläge, Herkunft und Quelldetails getrennt sichtbar gemacht; bestehende projektbezogene Detail-Einstellung verwendet
- Abbruch, stale Antworten und noch offene Adapterpromises sauber getrennt; Simulator bleibt produktiver Adapter, keine echte LLM-Engine aktiviert
- Mobile Aktionsleiste gegen zu frühe Rückkehr bei gehaltenen und mehreren Zeigern abgesichert
- 19 geprüfte Quelldateien übernommen: fünf neue, 14 geändert, keine gelöscht; keine Versionsanhebung
- 29 bewusst angenommene Schutzgruppen, alte 23 unverändert; externer Pin 7d4b3aa380bafa20ad846eab77e2e5b1684a5a0096ecf2efcac26975d9f2fe36
- Fünf Gatephasen, 1.401 App-/Laufzeittests und 50 Qualitytests PASS; identischer browsergeprüfter Webbuild dokumentiert
- Kein Nutzerpaket, APK-Release, Merge oder Deployment; native und Gerätegates bleiben offen

## 2026-10-05 · 0.5.4, unabhängig geprüfter Webgesamtstand

- Vollständigen Neundateidiff gegen 857cc787 übernommen und alle Quellen mit dem angenommenen 1.013-Dateien-Qualitysnapshot abgeglichen
- Labelsichtbarkeit, Assistant-Race-Korrektur, drei neue Hilfs-/Testdateien und bewusst geprüfte Qualitymetadaten zusammengeführt
- Externer Pin 592525a78c17468c61cb82776e22131076d9f6491359a4be8cfb5d5e6ca6de87; alle fünf Gatephasen, 1.367 Runtime- und 50 Qualitytests PASS
- Browserregression und 61 identische Buildassets belegt; nativer Compile-/Test-/Lint-/APK-/Gerätestatus bleibt offen
- Source-/Prüfbelege und sachliche README aktualisiert; keine APK, Schlüssel, Force-Push oder Merge

## 2026-10-05 · FINAL984 / Prototyp 0.5.3, Code 11

- Geprüften Finalstand mit 984 Quelldateien übernommen: 35 neue, 33 geänderte Dateien gegenüber Freeze 949, keine Quelldateien gelöscht
- App-Menü, begrenzte Assistentenbewegung, native AR-Status-/Detail-/Darstellungskorrekturen und geprüften lokalen Qualitätsvertrag integriert
- Alle Remote-Dateien, Blob-SHAs und Modi gegen die finale Whitelist geprüft; Sourcehash 8be6face68bfa3307c92deb86d386850215c7d41e2fe781ac2206278a54dd7ea
- README und Nachweise auf den aktuellen Stand gebracht; Release Notes, Host-/Native-Logs und Qualitätsbericht ergänzt
- Separat ausgelieferte debug-signierte Test-APK dokumentiert; keine APK/Schlüssel oder privaten Referenzfotos ins Repository aufgenommen
- Historischen 949-Commit und dessen Nachweise erhalten; kein Merge oder Deployment

## 2026-10-05 · Vollständiger geprüfter Quellfreeze 949

- 949 unveränderte Appquelldateien unter app/ ergänzt; alle Remote-Blob-SHAs und Dateimodi abgeglichen
- Source- und Webbuild-Inventare, Prüfbeleg und vollständiges serielles Prüflog ergänzt
- README mit 2D/3D/AR, Begleiter, Assistenz, Mobile, Bewegungsgrenzen und vorhandenen eigenen Konzeptgrafiken aktualisiert
- Historischen Freeze 949 ausdrücklich von APK 930 und der separat gelieferten FINAL984-APK 0.5.3 (Code 11) getrennt
- Bestehende Dokumentation und Git-Historie erhalten; kein APK-Release aus diesem Quellschritt

## 2026-10-04, 12:30 UTC · Buildstatus präzisiert

- Frühere pauschale DNS-/Netzblockerdiagnose korrigiert: reguläres HTTPS über den vorhandenen Proxy funktioniert; Google und npm liefern HTTP 200
- Prüfsummenverifizierte Installation von Android SDK 36, Build Tools 35.0.0 und Gradle 8.14.3 dokumentiert; Gradle, aapt2 und apksigner starten
- Offiziellen Library-Quelltransfer getrennt diagnostiziert: Downloadhilfe meldet keinen HTTP-Status; separate Hostproben belegen Proxy-CONNECT 403, keine Azure-HTTP-Antwort
- Java-Inventar und Offlineprobe präzisiert: Compilermodul startet javac 21.0.12.1; reguläre Gradle-JavaCompile-Probe scheitert an unvollständiger JDK-Erkennung. Vollständiges JDK 21 erforderlich
- Weiterhin kein Appbuild, keine neue APK und keine Releasefreigabe

## 2026-10-04 · Dokumentationsgrundlage LowQuantFlow

- Bestehendes Repository „APP“ als private Dokumentationsbasis ausgebaut
- Verifizierte Appstruktur, 17 Bereiche, Datenmodell/-flüsse und Modulrollen beschrieben
- Import-, Backup-, Workflow-, Diagnose-, 2D-/3D-/AR- und Sicherheitsgrenzen abgegrenzt
- 27 Anforderungen, sieben Gates, Arbeitspakete und geplante additive Zielstruktur dokumentiert
- Quality-, Diagnose- und finale Brandingkombination mit konkreten Prüfgrenzen und Hashes eingeordnet
- Build-, Signier-, Migrations-, Sicherungs- und Beitragshinweise aufgenommen
- Eigene LowQuantFlow-Konzeptgrafiken und GitHub-spezifische Design-/Power-User-Methodik ergänzt

Dies ist eine Dokumentationsänderung. Keine App-Runtime, CI, Deploymentkonfiguration, Berechtigung, Signierung oder APK wurde dadurch verändert oder erstellt.
