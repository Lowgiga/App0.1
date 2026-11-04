# Änderungsprotokoll

## 2026-11-04 · Bestandsaufnahme Plan gegen Ist (docs/37)

- Bestandsaufnahme aller 27 Anforderungen ([37](docs/37-bestandsaufnahme.md)). Die Statustabelle erzeugt jetzt `tools/repo/requirements_inventory.py` aus der Matrix ([16](docs/16-acceptance-matrix.md)), mit CommonMark/GFM-Parser und 11 Tests. Die CI prüft mit `--check`, dass beide übereinstimmen.
- Korrektur: Die erste Fassung von Doku 37 (Commit `69462c0`) hatte Statuswerte und Gates aus einer älteren Matrixfassung abgeschrieben und war falsch.
- Matrix: `**Implementiert:**17` (UX-01) wurde nach CommonMark nicht fett dargestellt; korrigiert, ebenso „bei390px“ (UX-02).
- Neu: `tools/ci/check_test_counts.py` (4 Tests). Die CI vergleicht Badge und Werkzeugtabelle der README mit den Tests, die `unittest` tatsächlich findet. Veraltete Testzahlen waren der häufigste Selbstbefund auf diesem Branch. Dazu `tools/ci/check_asset_hashes.py` (4 Tests): Die CI prüft die SHA-256-Liste der Grafiken. Stand damals: 44 + 28 + 42 = 114 Tests.
- `AGENTS.md`: Prüfregeln und CI-Befehle für jeden Coding-Agenten.
- Korrektur: Der SHA-256 von `docs/assets/verification-status.svg` war seit `83a77dd` veraltet; er ist jetzt nachgezogen, zusammen mit der neuen Zahl 40.
- `docs/README.md` um Eintrag 37 ergänzt.
- Eigene Tiefenprüfung der drei neuen Werkzeuge: 13 Befunde behoben, jeder mit Regressionstest. Die Gegenprobe gegen `cd98769` ergab 25 Fehlschläge, 24 davon aus diesen Befunden, einer aus der erwarteten Zählabweichung der alten README. Der schwerste Befund: Ein Testmodul mit Importfehler zählte `unittest` als einen Test. Stand die falsche Zahl in der README, meldete `check_test_counts.py` „konsistent“. Jetzt endet die Prüfung dann mit Exit 2. Die übrigen: Schemaprüfung der Matrixtabelle statt `IndexError`, NFC für Umlaute aus macOS-Dateien, Markdown-sichere Ausgabe in Doku 37 (Code-Spans wurden zu echten Links), Standardpfad der Matrix unabhängig vom Arbeitsverzeichnis, Schreibfehler und doppelte Marker ohne Absturz bzw. stilles Durchwinken, fehlendes Werkzeugverzeichnis mit Exit 2 statt `ImportError`, Zählung nur aus Spalten mit dem Kopf „Tests“, nicht zuordenbare Werkzeuglinks als Fehler statt stillem Überspringen, genau ein Badge, Hash-Einträge nur als reine Dateinamen, Ausgabe nur in ASCII.
- Lint war nicht CI-gleich: Ein `ruff` 0.16.9 im `PATH` verdeckte das gepinnte 0.17.3, und `ruff format --check` lief lokal nicht. Die sechs neuen Dateien sind jetzt formatiert. `AGENTS.md`, README und Skill nennen den Aufruf `python -m ruff`.
- README: Die Aussage „alle Jobs lokal mit denselben Versionen geprüft“ war zu weit; sie nennt jetzt nur Doku und Lint und verweist für Web, Reproduzierbarkeit und Android auf Doku 30. Stand: 48 + 33 + 44 = 125 Tests.
- CodeRabbit-Runde zu `cd98769` (3 Befunde, alle umgesetzt): Unter Windows endet ein Pfad unterhalb einer regulären Datei laut Befund mit `FileNotFoundError` statt `NotADirectoryError`. Das Host-Audit hätte die Datei dann still als „fehlt“ gewertet. Jetzt prüft es die Elternpfade und meldet eine Warnung, ebenso wenn ein Elternpfad nicht prüfbar ist (2 neue Tests; das Windows-Verhalten selbst ist hier nicht nachgewiesen). Außerdem nennt `AGENTS.md` alle Lint-Schritte der CI einschließlich actionlint, und die README führt als lokal geprüft nur noch auf, was tatsächlich lief.

## 2026-11-04 · Aufteilung von #30, Werkzeuge mit Tests, Prüfung der Uploads

- README und Dokumentationsindex auf den Stand dieses Branches gebracht: Bestand, Prüfwerkzeuge, nicht Nachgewiesenes und offene Entscheidungen.
- #30 in vier Teile zerlegt: CI und Gradle-Lint-Fix (Lowgiga/APP#32), Werkzeuge (Lowgiga/APP#33), Doku (dieser Stand), OMEGA-Entwurf eingefroren (Lowgiga/APP#34, nicht zum Mergen).
- CI um einen Lint-Job erweitert (ruff, shellcheck, actionlint, exakt gepinnt). Die Link-Prüfung erfasst jetzt auch Bilder.
- PR-Triage mit Fixes und Tests. Das Windows-Host-Audit ist jetzt in Python (`tools/windows/omega_host_audit.py`), enthält Sicherheitsfixes und Tests und ersetzt `Test-OmegaHost.ps1` ([33](docs/33-hermes-sicher-einrichten.md)).
- Mehrere CodeRabbit-Reviews zu Lowgiga/APP#32 (31 Inline-Befunde laut GitHub-API) behoben, jeder mit Regressionstest: Die Link-Prüfung folgt CommonMark (Referenzlinks, Klammern, Wurzelpfade, Prozentkodierung, Fences, Code-Spans), die Triage-Muster treffen keine Teilwörter mehr und lesen Git-Ausgaben als UTF-8, das Host-Audit startet Werkzeuge nur über absolute Pfade (CWE-426) und liest UTF-8. Die Link-Prüfung nutzt jetzt einen CommonMark-Parser (markdown-it-py, hash-gepinnt) statt eigener Muster; alle CI-Python-Abhängigkeiten und Lint-Werkzeuge sind hash-gepinnt. Stand: 36 + 17 + 42 Unit-Tests, 100 % Zeilen- und Zweigabdeckung der Werkzeuge; die CI verlangt mindestens 98 % (`tools/ci/coverage.ini`).
- Hochgeladene Archive geprüft: Integrität 100 %; der N2-Fix für das Laufjournal ist als Lowgiga/APP#31 vorbereitet ([36](docs/36-uploads-2026-11-04.md)).

## 2026-11-03 · Nachprüfung, CI und PR-Triage

- Nachprüfung 0.5.4: Gesamtverifikation mit Pin PASS, 1.542 Web-Tests, 71 JVM-Tests ([30](docs/30-verifikation-2026-11-03.md)).
- PR-Triage mit Ergebnis ([32](docs/32-pr-triage-2026-11-03.md)); sichere Hermes-Einrichtung ([33](docs/33-hermes-sicher-einrichten.md)).
- Analyse und OMEGA-Plan v1.0 ([31](docs/31-analyse-und-omega-plan.md)).

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
