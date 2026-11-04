Aktueller Abnahmestand: **Version 1.4.2** am 01.10.2026 UTC. Ältere Abschnitte sind historische Prüfungen; ihre damaligen MFA-/Featuregrenzen sind kein aktueller Live-Status. Neue Nachweise stehen im letzten Abschnitt und im versionierten Audit.

# QA · 29.09.2026

## Nachgewiesen

- TypeScript `tsc --noEmit`: Exit 0 nach Implementierung der Speicherkorrekturen.
- Vinext-Produktionsbuild: Exit 0; Routen `/`, `/api/state`, `/mcp` erzeugt.
- `python tests/local-api.py`: 22 HTTP-Integrationstests, Exit 0.
- D1-Migration lokal: drei Spalten, nutzergebundener Primärschlüssel; erfolgreich einmalig eingespielt.
- Browser: Routingauswahl Content; stündlicher Takt 24 Aufrufe/Tag; 0,05 EUR/Aufruf ergibt 36 EUR im 30-Tage-Modell.
- Regression geprüft: Make-Prüfauftrag → PAZ-Pilot → Plan übergeben setzt PAZ-Mission und PAZ-Kontext korrekt zurück.
- Übergaben: eigener Content-Kontext ohne PAZ-Referenzen; Make-Prüfauftrag mit Szenario und unverändert inaktivem Status; Kopieren liefert tatsächlichen Hand-off-Text.
- Katalog: Make-Suche + Filter ergibt genau einen verwendeten Make-Eintrag; Werkzeugdetails vorhanden; leere Suche ergibt verständlichen Leerzustand.
- Mobile Prüfung: echte eingebettete App bei 390 × 844 CSS-Pixeln; untere Navigation funktioniert; Labor und Evidenz ohne horizontales Überlaufen; Verbindungen zeigen sechs Karten und blenden die Desktop-Tabelle aus.
- Neun Bildquellen in der Evidenzansicht und zwölf Quellen insgesamt.
- Sites-Zugriffskonfiguration vor Deployment: Eigentümer, Modus custom, ein erlaubter Nutzer, keine Gruppen, keine externen Besucher.
- Unabhängiges Review durch `/root/initialization_review`; gemeldete Speicher-/Provenienzprobleme korrigiert und zur Gegenprüfung zurückgegeben.

## HTTP-Testumfang

Fehlende Identität, frischer leerer Stand, ungültiges JSON, unbekannte Planmarker, fremder Origin, erstes Speichern, erneutes Lesen, Trennung zweier Nutzer, erfolgreiche Versionsaktualisierung, Ablehnung veralteter Änderungen und Erhalt des aktuellen Standes. MCP: Versionsverhandlung, genau drei Lesewerkzeuge, Identitätsprüfung, Status-/Plan-/Make-Daten, ungültige Argumente, null-Request, fremder Origin, ungültiger Protokollheader und kein vorgetäuschter SSE-Kanal.

## Grenzen

- Lokale Tests mit synthetischen Identitäten prüfen keinen vollständigen Produktions-Sign-in. In der Browser-Preview fehlt die reale Nutzeridentität; nutzergebundene Speicheraktionen wurden über lokale API-Tests geprüft.
- WebMCP `document.modelContext` war im Testbrowser nicht vorhanden; optionale Browserregistrierung daher nicht praktisch getestet.
- Kein echter Galaxy-S25-/Android-Gerätetest. Mobile Prüfung erfolgte im Browser bei 390 CSS-Pixeln.
- Keine PAZ-Projekt-/CI-Tests, kein Baseline-Diff, keine erfolgreiche Cue-GitHub-Operation oder Make-Ausführung durch diese App.
- Bereitstellungsstatus und kanonische Plugin-ID werden nach Veröffentlichung separat festgehalten; Plugin-Installation ist kein implizites Testergebnis.

# Tuning-QA · 30.09.2026

## Durchgeführt

- TypeScript `node node_modules/typescript/bin/tsc --noEmit`: Exit 0 nach den Review-Korrekturen.
- `python tests/local-api.py`: 22 Prüfungen, Exit 0.
- `python tests/tuning-api.py`: 22 zusätzliche Prüfungen, Exit 0. Insgesamt 44 lokale API-Prüfungen.
- Neuer Testumfang: Altbestand mit Standardwerten, Erhalt der neuen Bereiche bei alten Speicheranfragen, Einstellungen/Arbeitsprofile/Lernfortschritt, unbekannte Felder, unveränderbarer Freigabeschritt für externe Writes, doppelte Profile, Matrix-Beleg-/Review-/Abhängigkeitsregeln und Zyklen, Missionraum-Speicherung, Nutzertrennung, doppelte Beiträge, Archiv/Wiederherstellung und Versionskonflikt mit Erhalt des aktuellen Standes.
- Browser: Dashboard-Einstellungen, Profilentwurf, Tab-Navigation, Verknüpfen-Menü, Strg+K-Suche, PAZ-Missionentwurf und Rückkehr ohne erneutes Öffnen eines verbrauchten Entwurfs.
- Wiederherstellung: ein ungespeicherter Profilentwurf bleibt nach „Erneut laden“ erhalten.
- Hologramm-Ausweichansicht: Rotation per Bedienelement und Make-Auswahl in Graph/Liste/Inspector geprüft. Korrigierter Pointer-Capture-Konflikt anschließend erfolgreich nachgeprüft.
- Lernen: falsche Antwort zeigt fehlenden Nachweis; richtige Antwort zeigt Erklärung. Fortschrittsspeicherung separat in API-Prüfungen.
- Mobile Preview bei 390 × 844 CSS-Pixeln: Menüs und untere Navigation bedienbar; Einstellungen einspaltig; Seitenbreite 375 px einschließlich eigener Scrollbar, scrollWidth 375 px. Das Board scrollt innerhalb seines Containers. Filter-Leerzustand geprüft.
- Unabhängiges Review `/root/initialization_review`: Formularerhalt bei Reload/409, XR-Lifecycle, gesteuerte Einstellungs-Tabs, Importgrenzen, Beitragsspeicherung bei gleichzeitigem Konfigurationsentwurf und einmalige Übernahme von vorbereiteten Missionen korrigiert. Schlussprüfung meldet an den nachgeprüften Stellen keine weiteren konkreten Befunde; statisches Review, keine weiteren vom Reviewer ausgeführten Tests.
- Lokaler Produktionsbuild `node /root/.codex/plugins/cache/openai-curated-remote/sites/0.1.75/scripts/build-site.mjs`: Exit 0; Routen `/`, `/api/state`, `/mcp`. Warnung zu einzelnen Chunks über 500 kB; Three.js wird erst beim Öffnen des 3D-Bereichs geladen. Kein Hardware-Leistungsbenchmark.
- Quellcode-Push und private Veröffentlichung wurden zunächst von der automatischen Freigabeprüfung mangels ausdrücklicher Nutzerfreigabe abgelehnt und nicht ausgeführt. Am 30.09.2026 hat der Nutzer genau diesen Schritt ausdrücklich freigegeben. Der offizielle Ablauf wird auf derselben privaten Site fortgesetzt; Abschlussstatus und Version stehen im Tuningbericht.

## Praktische Grenzen

- WebGL ist im verwendeten Cloud-Testbrowser deaktiviert. Deshalb wurde die interaktive CSS-/SVG-Hologramm-Ausweichansicht praktisch getestet; die Three.js-Szene wurde typgeprüft, aber nicht grafisch auf realer Hardware abgenommen.
- WebXR wird auf Unterstützung und sicheren Kontext geprüft. Kein realer AR-Session-/Kameratest und keine Android-Hardwareprüfung.
- Die Browser-Preview ist nicht authentifiziert. Speicher- und Isolationsprüfungen erfolgten über die lokale API mit synthetischen Testidentitäten. Ein authentifizierter Produktions-Browsertest ist offen.
- Die automatische Freigabeprüfung hat das Entfernen eines Development-Guards an einer temporären Browser-Testseite abgelehnt. Diese Änderung wurde nicht ausgeführt. Die Testseite und sämtliche temporären Browser-Identitäts-Props wurden entfernt; es gibt keinen neuen Produktions-Auth-Bypass.
- PAZ und Make bleiben externe fachliche Aufgaben: keine PAZ-CI-Tests, keine bestätigte neue Cue-Profilbindung und kein Make-Start durch das Tuning.

## Technische Primärquellen

- [Three.js ARButton](https://threejs.org/docs/pages/ARButton.html)
- [MDN XRSystem.isSessionSupported](https://developer.mozilla.org/en-US/docs/Web/API/XRSystem/isSessionSupported)
- [MDN XRSystem.requestSession](https://developer.mozilla.org/en-US/docs/Web/API/XRSystem/requestSession)

Lokaler Browsernachweis: `public/documents/cue-mesh-tuning-preview.jpg`.

# Foundation-QA · Version 1.2 · 30.09.2026

## Tatsächlich durchgeführte Prüfungen

- `node node_modules/typescript/bin/tsc --noEmit`: Exit 0 nach den finalen Quelländerungen.
- `node tests/foundation-domain.mts`: 24 einzelne Tests bestanden, Exit 0. Der direkte Node-Aufruf führt die Domänentests aus.
- `python tests/foundation-api.py`: 40 lokale HTTP-Prüfungen bestanden, Exit 0.
- `python tests/local-api.py` und `python tests/tuning-api.py`: jeweils 22 bestehende Prüfungen erneut bestanden, Exit 0. Insgesamt 108 Domain-/HTTP-Prüfungen.
- Produktionsbuild über `build-site.mjs`: Exit 0; Routen `/`, `/api/state`, `/mcp`. Die Warnung für den separat geladenen Three.js-Chunk bleibt sichtbar.
- `node scripts/measure-bundle.mjs`: Exit 0. Statisch geladenes JavaScript einschließlich Browser-Einstieg und geteilter Abhängigkeiten rund 208 KiB gzip, unter 220 KiB. Root-App-Chunk rund 42 KiB, zusätzlicher Command-Center-Code rund 9 KiB. Exakte Dateigrößen und Budgets in `docs/BUNDLE_REPORT.json`. Kein Netzwerk-, LCP- oder Hardwarebenchmark.
- Unabhängiges statisches Review durch `/root/initialization_review`; relevante Befunde korrigiert und nachgeprüft. Keine zusätzlichen vom Reviewer ausgeführten Tests.

## Abgedeckte Verhalten

State-Version 3, leere additive Altbestandsdefaults, strikte verschachtelte Verträge, keine behauptete Ausführung, vorhandene Antwortformate, Erhalt neuer Startansichten bei älteren Clients, Referenzintegrität, erlaubte Missionsphasen, Beleg und unabhängiger Reviewer für Abschluss, Abschlussblockade bei offenen Entscheidungen, nachträgliche Aufgabenänderungen einschließlich transitiver Voraussetzungen, unveränderliche entschiedene Inhalte, serverseitige Entscheidungszeit, abgelaufene Anfragen und Ablehnung ohne Verlängerung. Atomare App-Ereignisse mit serverseitiger Zeit und wachsender Sequenz; kein Ereignis bei abgewiesenen oder veralteten Writes, Manipulationsschutz, Rotation bei 200 Einträgen und Nutzertrennung. Importversionen 1/2/3, Erhalt bestehender IDs und des kanonischen Protokolls, sichere Wiederprüfung historischer Daten, gemeinsame Kapazitätsgrenzen. Browser-UUID-Fallback für HTTP-Preview.

## Browserabnahme

- Mission anlegen: Fokus, erlaubte neue Phase, Felder, Aufgaben-/Quellenzuordnung und Schließen geprüft. Speichern ist ohne Preview-Identität gesperrt.
- Entscheidungsanfrage: Aktion, Ziel, Daten, Begründung, Ergebnis, Auswirkungen, Prüfbeleg, Rückweg und Ablaufdatum bearbeitet; keine externe Aktion.
- Vier individuelle Agentenbereiche; Suche nach Junior reduziert korrekt auf einen Bereich; Profilverknüpfung öffnet Junior in den Agenteneinstellungen.
- Ungespeicherte Rollenänderung bleibt nach „Erneut laden“ erhalten.
- Command-Palette findet Aktivität und öffnet den neuen Bereich. Fehlender Speicherstand wird in Missionen, Entscheidungen, Agenten und Verlauf ausdrücklich angezeigt.
- Mobile Abnahme im eingebetteten echten App-Dokument: 390 × 844 CSS-Pixel, `innerWidth=390`, `body.clientWidth=375`, `body.scrollWidth=375`; untere Navigation sichtbar, Missionen/Freigaben erreichbar. Neues Missionssheet: Breite und Scrollbreite jeweils 355 px, kein horizontaler Überlauf.
- Bestehender 3D-Bereich lädt bei Bedarf. Fehlendes WebGL erzeugt die Hologramm-Ausweichansicht; Make-Auswahl und Rotation funktionieren. Keine behauptete neue Verbindung.
- Temporäre responsive Testseite vor dem finalen Build entfernt. Keine Test-Identität oder Lockerung der Anmeldung im Browser eingeführt.

## Grenzen und Fortsetzung

Die lokale Browser-Preview hat keine echte Nutzeridentität. Persistenz, Zustandskonflikte und Isolation wurden über die lokale HTTP-API mit separaten synthetischen Testidentitäten geprüft; tatsächliche Produktionsanmeldung offen. Kein realer Android-/AR-/GPU-Test und kein gemessener LCP-Wert. Motion-Regeln und Reduced-Motion-CSS sind vorhanden; neue Hologramm-/Morphing-Experimente stehen in späteren Waves. Keine PAZ-CI, Make-Ausführung oder neuen Cue-Agentenrechte. Das Ereignisprotokoll enthält persönliche akzeptierte App-Änderungen, keine externe Worker-Telemetrie. Private Deploymentdetails werden im Foundationbericht nach erfolgreicher Bereitstellung festgehalten.

Browsernachweis: `public/documents/cue-mesh-foundation-preview.jpg`.


# Dashboard-QA · Version 1.3 · 30.09.2026

TypeScript einschließlich `--noUnusedLocals --noUnusedParameters`, `git diff --check` und Produktionsbuild erfolgreich. 24 Foundation-Domänentests, 30 Matrix-Domänentests, 22 lokale HTTP-, 22 Tuning-HTTP-, 40 Foundation-HTTP- und 36 Matrix-HTTP-Prüfungen bestanden: 174 insgesamt. Eigener kompilierter Worker mit isolierter lokaler D1, keine Produktionsidentität oder externe Systeme.

Geprüft: v3→v4-Kompatibilität, berechnete Gewichte, explizite Fristen, aktuelle statt historische Risiken, erlaubte Fokusaktionen, Aufgabenabhängigkeiten, unveränderliche Kausalkette, begründete Risikoakzeptanz ohne behauptete Behebung, verknüpfte Prüfaufgabe, geänderte Risikobedingung, SHA-256 gegen Node crypto, lange legal escaped Inhalte, Request-IDs, neue und bestehende Räume nach Antwortverlust mit Folgebeitrag, API-Origin/Fetch-Metadata/MIME/Bodylimits, 400/401/403/404/405/409, Nutzertrennung, unveränderliche Ereignisse, Versionskonflikte, Import und Gesamtbudget. Alte große Zustände bleiben lesbar.

Budget: Root-App 39634 Bytes gzip, gegenüber v1.2 -3012 Bytes. Initiale statische Client-JS-Abhängigkeiten 217879 Bytes gzip, Grenze 225280. CSS 213746 Bytes, Wachstum 6.12% unter 10%. Optionale Module und Three.js außerhalb des initialen Imports. Keine LCP-/Hardware-/Netzwerksimulation.

Begrenzter Lasttest: 128 Leseanfragen, 8 Threads, 0 Fehler, Median 15.011 ms, P95 19.394 ms. 8 konkurrierende Writes auf dieselbe Version: 1 akzeptiert, 7 Konflikte, eine gespeicherte Änderung und konsistente Ereignisse. Der beobachtete Durchsatz ist keine Kapazitätszusage. Eigener Prozessneustart: vollständiger Stand und Eventsequenz erhalten, 634.27 ms in diesem lokalen Versuch. Kein Produktionsbackup-/Restoretest.

Browser: 27 Knoten und 11 Beziehungen; Pfeil-/Ende-Navigation, sichtbarer Fokus, Details, Verbindungen verfolgen, Filter, Command-Palette und Hilfesuche geprüft. Mobile App-Dokument bei 390 CSS-Pixeln ohne horizontalen Überlauf, vier Kopfzeilenaktionen 44×44 px, drei Checkbox-Labels 44 px hoch. Doppeltes main-Landmark entfernt; Sheet-Schließen auf 44 px vergrößert. Vorlagen und unbekannter Stand sind ausdrücklich beschriftet. Herkunft bleibt durch ●/■ plus Text in Graustufen unterscheidbar.

A11y-Prüfung ist eine DOM-/Tastatur-/CSS-Prüfung, kein vollständiger Screenreader- oder WCAG-Nachweis. Reduced-Motion-Regeln und abschaltbare Effekte sind vorhanden; native Geräteeinstellung nicht emuliert. Echtes Android/WebGL/WebXR, authentifizierte Browser-Speicherung, echte Nutzerstudie, Live-GitHub/Make/Cue, Produktions-Disaster-Recovery und externe SRE-Alerts bleiben offen. Missionen werden reversibel archiviert; Hard-Delete ist bewusst nicht implementiert.

Unabhängiges statisches Review: Befunde zu Export vor Laden, Import von Voraussetzungen, Antwortverlust, großer Bestandslesbarkeit, erneuter Risikoakzeptanz, automatischem Dialogfokus und Digest-Grenzen korrigiert und nachgeprüft; keine relevanten Restbefunde in den geprüften Randfällen. Reviewer hat keine zusätzlichen Tests ausgeführt. Browsernachweis: public/documents/cue-mesh-neuro-preview.jpg.


# Explorer- und Academy-QA · Version 1.4 · 01.10.2026

## Tatsächlich ausgeführt

TypeScript mit `--noEmit --noUnusedLocals --noUnusedParameters`, Diff-Prüfung und Produktionsbuild: Exit 0. 81 Domain- und 149 lokale HTTP-Prüfungen: 230 bestanden. Davon 27 neue Domain- und 29 neue HTTP-Prüfungen für Explorer, Lerntransfer und Kompatibilität. API-Harness: eigener kompilierter Worker, isolierte lokale D1, synthetische Identitäten. Kein Produktionszugriff.

44 Browser-Prüfungen über den optionalen `tests/spatial-browser.mjs`: Exit 0. Cloud-Browser konnte die lokale Vorschau nicht erreichen; die private Site fordert Anmeldung. Der vom Nutzer ausdrücklich gewünschte Playwright-Test wurde deshalb lokal ausgeführt. Chromium 153, 1440×1000 und 390×844 CSS-Pixel. Die QA-Pakete wurden ausschließlich in einer separaten Testumgebung installiert; keine zusätzliche App-Abhängigkeit. Drittanbieterrequests sind im Harness gesperrt.

Geprüft: sinnvoller erster 2D-Frame ohne Framework-Overlay; keine initialen 3D-Downloads; 32-Knoten-Grenze bei größerem Bestand; tatsächliche Desktop-/Mobile-Spaltennavigation, Pos1/Ende und sichtbarer Fokus; verfolgte Beziehungen; geführte Übergabe ohne Schreibaktion; Auswahl-Link und Reload. Tatsächlich gerenderter Software-WebGL-Frame mit sichtbaren Knoten und 6262 helleren Pixeln in 749×441 Pixeln; Fokus verändert die Ansicht; Knotenauswahl erhält das Canvas; nutzergesteuerte Rotation, Pause und emuliertes Reduced Motion ergeben die erwarteten Frameänderungen. Kontrollierter WebGL-Kontextverlust wechselt zu 2D; Retry erzeugt ein neues nutzbares Canvas. Nicht unterstützte AR bleibt gesperrt.

Lernkette: falsche Antwort erklärt Beleglücke; ungeprüfte Fälle verhindern Speicherung; richtige Wissensfrage und Mehrfachauswahl führen zur eigenen Begründung. UI speichert Notiz und Quizstand und erhält alte Abschlüsse. Reale offene Transfer-Aufgabe besitzt ausgewählten Owner; Missionsreferenz ist zusammen mit der Aufgabe gespeichert. Doppelanlage gesperrt, Markdown-Arbeitsbuch exportiert, Reload erhält Ergebnisse. Ein konkurrierend archivierter Missionskontext löst 409 aus; Antworten und Begründung bleiben erhalten. Kontext entfernen und danach erneut speichern funktionieren. Fehler beim initialen Abruf zeigt Vorlagen und sperrt persönlichen Export.

Mobile: kein horizontaler Dokumentüberlauf bei 390 px; alle sichtbaren neuen Buttons, Selects, Textareas und Summary-Ziele mindestens 44×44 px. Sidebar lässt sich öffnen; Navigation zum Lernbereich schließt sie. axe-core 4.11.1: keine WCAG-A/AA-Verstöße im neuen spatial-workspace für Desktop/Light und Mobile/Dark. Ein erwarteter 409-Konsolenfehler stammt aus der bewusst ausgelösten Konfliktprüfung; keine unerwarteten App-Konsolenfehler.

## Messung und Review

Bundlewerte: initiale statische Client-JS-Abhängigkeiten 219736 Bytes gzip, Budget 225280. Root-App ungefähr 39673 Bytes gzip, rund 2973 Bytes kleiner als v1.2. CSS 219795 Bytes, Wachstum 9.12% unter 10%. 2D/Academy zusätzlich rund 15049 Bytes gzip, separater Renderer rund 3682 Bytes, Three.js und OrbitControls 189809 Bytes. Beide 3D-Stufen sind bedarfsgeladen. Die Three.js-Chunkwarnung bleibt dokumentiert. Kein LCP-, Android-GPU- oder Netzwerkbenchmark. Exakte aktuelle Assets in docs/BUNDLE_REPORT.json.

Begrenzte Last-/Versionsprüfung erneut bestanden: 128 Leseanfragen mit acht Threads, null Fehler; acht Writes auf dieselbe Revision ergeben eine akzeptierte Änderung und sieben Konflikte. Neustart der eigenen lokalen D1-Laufzeit erhält Stand und Sequenz exakt. Messwerte im 1.4-Audit, kein Kapazitätsversprechen und kein Produktions-Restoretest.

Unabhängiges statisches Review durch /root/initialization_review: XR-Rückkehr, Lifecycle bei Auswahl, bedienbares AR-Overlay, idempotente Rückkehr und Entfernen ungültigen Missionskontexts korrigiert beziehungsweise nachgeprüft. Abschließend keine konkreten Restblocker in den geprüften Änderungen. Der Reviewer führte selbst keine Browser- oder Gerätetests aus.

## Offene Grenzen

Die private Produktionsanmeldung erreicht aktuell die OpenAI-Passkey-MFA; die Abnahme im angemeldeten Eigentümerkonto ist noch offen. Software-WebGL ersetzt keinen Geräte-GPU-Test. Das hochgeladene Video belegt die Darstellung der ursprünglichen AR-Szene; die neuen AR-Bedienelemente wurden nicht auf Android gestartet. Der ursprüngliche leere Inline-Frame der Screenshots wurde auf dem Gerät nicht unabhängig reproduziert. Keine echte Nutzerstudie, vollständige Screenreaderabnahme, Flächenerkennung oder AR-Verankerung. Externe Cue/Make/GitHub-Adapter, SRE-Alerting und produktiver Backup-Restore bleiben separate Aufgaben.

Browsernachweise: public/documents/cue-mesh-spatial-desktop.jpg und public/documents/cue-mesh-academy-mobile.jpg. Beide zeigen die lokale QA-Umgebung, keine bestätigte Produktionsanmeldung.

# Kooperations-QA · Version 1.4.1 · 30.09.2026 UTC

## Ausgeführt

103 Domain-/Git-Fixture-Prüfungen und 174 lokale HTTP-Prüfungen bestanden: 277 insgesamt. Davon 22 neue Domain- und 25 neue HTTP-Prüfungen. TSC mit `--noEmit --noUnusedLocals --noUnusedParameters` und Produktionsbuild Exit 0. Die vorhandenen HTTP-Suites für State, Tuning, Foundation, Intelligence und Academy bleiben erfolgreich. Testdaten liegen ausschließlich in isolierter lokaler D1 mit synthetischen Identitäten.

27 neue lokale Browserprüfungen und 44 Spatial-/Academy-Regressionsprüfungen erfolgreich: 71. Chromium 153, Desktop 1440×1050 beziehungsweise 1440×1000 und Mobile 390×844. Summe 348 funktionale Prüfungen; Last- und Neustartversuche zusätzlich separat. Keine neuen App-Abhängigkeiten.

Geprüft: Dashboard lädt den Kooperationsbereich erst beim Öffnen von Agenten; Low bleibt sichtbar unbestätigt. Kopie und JSON-Export enthalten denselben SHA-256-Briefhash wie MCP und keine privaten Notizen. Lesen/Export erzeugt keinen App-Write und keinen entfernten Auftrag. Ungültige, unbekannte oder außerhalb von Lows Dateigrenzen liegende Reports scheitern. Code- und HTML-ähnliche Angaben bleiben inerte Texte. Ein passender Bericht speichert nur eine gekennzeichnete ungeprüfte Notiz mit einem kanonischen Notizereignis; Missionen, Freigaben und vier Profile bleiben unverändert.

Ein Versionskonflikt erhält die Rückmeldung und den anderen Speicherstand. Eine ältere gültige Rückmeldung lässt sich ausdrücklich als historische ungeprüfte Notiz erhalten, ohne als aktueller Integrationsauftrag zu gelten. Reload erhält den Bericht. Fehlender persönlicher Stand sperrt Briefkopie und Export. Mobile: kein Dokumentüberlauf, sichtbare neue Ziele mindestens 44×44 px, Touch-Prüfung funktioniert, echter Tastaturfokus sichtbar, emuliertes Reduced Motion. axe-core findet im neuen Kooperationsbereich keine automatisierten WCAG-A/AA-Verstöße für Desktop/Light und Mobile/Dark. Keine unerwarteten Konsolenfehler; der bewusst erzeugte 409 ist dokumentiert.

Git-Fixtures prüfen eigene neue Dateien und Löschungen, Umbenennung einer geschützten Quelle, Symlinks, Index-Gitlinks, geschützte Mode-Änderungen, falschen Branch, abgekürzten oder nicht vorhandenen Basiscommit und falsches Arbeitsverzeichnis. Eine gezielte Regression stellt sicher, dass ein staged Symlink mit TAB im Dateinamen auch nach Entfernung im Worktree FAIL liefert. Steuerzeichen und case-insensitive Secrets-/Buildnamen werden abgewiesen. Der Guard bleibt eine lokale Projektprüfung, kein Betriebssystemschutz.

Der API-Harness wartet jetzt auf den Startup-Nachweis seines eigenen Workers und einen erfolgreichen authentifizierten lokalen State-Read. Der alte 401-Readiness-Test konnte vor der lokalen Migration erfolgreich sein; dieses Testaufbau-Rennen ist korrigiert. Der neue Notiztest erwartet das bestehende kanonische `workspace-updated`-Ereignis statt eines erfundenen `note_added`.

## Budget und begrenzte Betriebsprüfung

Gemessener Kandidatenbuild: initiale statische Client-JS-Abhängigkeiten 220712 Bytes gzip unter 225280. Root-App 39851 Bytes gzip, zusätzliche optionale Kooperations-Abhängigkeiten 6309 Bytes. CSS 220192 Bytes, +9,321% gegenüber v1.2 unter 10%; gegenüber v1.4 nur 361 Bytes zusätzlich. Koordination, Command-Bereich, Renderer und Three.js bleiben bedarfsgeladen. Exakte gemessene Assets in `docs/BUNDLE_REPORT.json`; der Release-Build muss `--check-only` separat bestehen. Kein LCP-, Akku- oder Netzwerkbenchmark.

Begrenzter lokaler Lastversuch: 128 Reads, acht Threads, null Fehler, Median 12,564 ms, P95 14,855 ms. Acht Writes derselben Revision: einer akzeptiert, sieben 409, eine Änderung und atomare Ereignisse. Lokaler Worker-Neustart erhält eigenen Zustand und Sequenz exakt; 426,59 ms in diesem Versuch. Keine Produktions-Kapazitätszusage und kein Produktionsbackup-/Restore.

## Unabhängiges Review und reale Verbindung

`/root/initialization_review` prüfte statisch und las die konkreten Änderungen. Zwei P2s – TAB-Pfadverarbeitung und Verlust älterer Brief-Rückmeldungen bei parallelen Änderungen – korrigiert und gezielt nachgeprüft. Abschließendes Urteil PASS, keine relevanten Restbefunde. Der Reviewer ist nicht Low und führte selbst keine Browser-/Geräteprüfungen aus.

Sites-Metadaten: bestehende private Site aktiv, Eigentümerrolle, ein zugelassener Owner, keine Gruppen oder externen Besucher, kein Scheduler. Vor der privaten 1.4.1-Aktualisierung ist die bisherige Produktionsapp im Cloud-Browser wieder erreichbar und zeigt persönlichen App-Kontext; der vorherige OpenAI-MFA-Block ist damit aufgehoben. Authentifizierte Produktions-Speicherwrites für dieses neue Modul bleiben zusätzlich zur lokalen Abnahme gesondert zu prüfen; keine Testberichte werden in den produktiven Stand eingeschleust.

Direkte Low-/Cue-Verbindung, Identität, Zustellung und Annahme weiterhin unbestätigt. Remote Commander meldete beim datierten Probeabruf zwei Geräte offline. Echte Android-/AR-Prüfung, Nutzerstudie, vollständige Screenreaderabnahme und Live-Integrationsadapter bleiben offen. Dies ist eine geprüfte Kooperationsgrundlage und keine behauptete Zusammenarbeit mit einem tatsächlich angeschlossenen Low.

Details: `docs/COLLABORATION_AUDIT_V1_4_1.json`, `docs/COLLABORATION.md`. Screenshot `public/documents/cue-mesh-coordination-preview.jpg` zeigt den lokalen QA-Stand.


# AR- und Praxislevel-QA · Version 1.4.2 · 01.10.2026 UTC

## Abnahme

132 Domainprüfungen, 195 HTTP-Prüfungen und 114 Browserprüfungen bestanden: **441 funktionale Checks**. Neu: 29 Domain-, 21 HTTP- und 43 Browserchecks. TypeScript inklusive ungenutzter Variablen/Parameter und Build Exit 0. Die sieben HTTP-Suites ergeben 22 lokal + 22 Tuning + 40 Foundation + 36 Intelligence + 29 Academy + 25 Kooperation + 21 AR/Praxis = 195. Der Harness prüft jetzt Exitcode UND vollständiges Abschlussprotokoll; eine zunächst unvollständige Intelligence-Logdatei wurde nicht gezählt und mit vollständigem erneuten Lauf ersetzt.

43 neue Browserchecks, 44 vorhandene Spatial-/Academy-Regressionen und 27 Kooperationsprüfungen: lokal kompilierte App, isolierte D1, synthetische Identitäten, Chromium 153, 1440×1000 beziehungsweise 1440×1050 und 390×844 CSS-Pixel. Tatsächlich sichtbare WebGL-Pixel, Fokusänderung und eigener GLSL-Auswahlshader, stabiler Reduced-Motion-Frame, 2D-Alternative ohne Canvas. Kein echter Kameratest.

Lernen: falsche Herkunft blockiert; nachfolgende Level bleiben bis zur Speicherung gesperrt; tatsächliche Modellbeziehung führt zum richtigen Knoten. Vier Praxisabschlüsse vergeben insgesamt 100 XP und erhalten alte Quiz-XP; Reload und einmalige Speicherung bestanden. Gleichwertiger 2D-Perspektivpfad. Transfer erzeugt offene Aufgabe, Notiz und optionale Missionsreferenz atomar mit kanonischen sequenzierten Ereignissen. Alte State-v3-Leser/-Writes behalten neue gewöhnliche Notizen und v4-Referenzen. Ungültige IDs, fehlende Referenzen, falscher Abschluss und veraltete Writes erzeugen keine Teiländerungen. CAS-Konflikte erhalten Antworten und Begründung; ein archiviertes Missionsziel bleibt sichtbar und kann ausdrücklich entfernt werden.

WebXR wird in diesen Browserchecks gezielt simuliert: genaue Berechtigungsursache/Phase, erforderlicher Hit-Test ohne heimlichen Free-Fallback, expliziter Free-Modus, verzögertes Setup, frische horizontale Pose, bewusstes Platzieren, Maßstab, Trackingverlust und Neuplatzierung. Unbestätigtes Sitzungsende behält Beenden und sperrt neue Starts. Ein späterer Frame überschreibt diesen Zustand nicht. Fehlgeschlagener Start plus fehlgeschlagenes Cleanup zeigt beide Ursachen und behält Sitzungsownership. Verzögerte Three.js-Bindung nach nativem Ende verwirft den Renderer und erzeugt einen bedienbaren 2D-Rückweg. DOM-Overlay verhindert versehentliche XR-Auswahl; z-index 80 hält AR-Tasten über der Sidebar.

Mobile neue Elemente: kein horizontaler Dokumentüberlauf, geprüfte sichtbare Touch-Ziele mindestens 44×44 px, brauchbare Navigation und Entwurfswiederaufnahme. axe-core meldet in den geprüften neuen Bereichen keine automatisierten WCAG-A/AA-Verstöße. Das ersetzt keinen menschlichen Screenreader- oder vollständigen WCAG-Nachweis. Erwartete 409-Konsoleinträge stammen aus bewusst ausgelösten Konkurrenzkonflikten; keine unerwarteten App-Konsolenfehler.

## Performance und Daten

Echte Buildassets: initiale statische Client-JS-Closure **220477 Bytes gzip** bei 225280 Budget; Root-App 39865 Bytes gzip, -2781 gegenüber v1.2. CSS 220577 Bytes, 9.513% Wachstum bei 10% Budget. Three.js/OrbitControls 189809 Bytes gzip bleiben außerhalb initialer und 2D-Imports; Renderer 7240 Bytes, räumlicher Bereich 22755 Bytes zusätzlich. Große optionale Three.js-Chunkwarnung dokumentiert. Keine neue App-Abhängigkeit. Kein LCP-, Android-GPU-, Akku- oder Netzwerkbenchmark.

Begrenzter Lastlauf: 128 Reads mit 8 Threads, 0 Fehler, Median 12.683 ms und P95 25.875 ms. Acht Writes derselben Version: eine akzeptierte Änderung, sieben Konflikte, atomare Ereignisse. Vollständiger lokaler D1-Stand und Sequenz nach Neustart erhalten, 620.84 ms in diesem Versuch. Keine Kapazitätszusage und kein Produktions-Disaster-Recovery.

## Unabhängiges Review und Betriebsgrenzen

Reviewer `/root/initialization_review`: abschließendes statisches PASS. Startlock bei nativem Ende, unbekannter Endzustand, stale Missionskontext, späte Rendererbindung und Overlay-Reihenfolge korrigiert und mit ausgeführten Tests belegt. Reviewer führte selbst keine Tests oder Geräteaktionen aus und ist nicht Low.

Privates Publikum vor Veröffentlichung: Owner-Rolle, eine zugelassene Person, keine Gruppen, externen Besucher oder Scheduler. Source und spätere Veröffentlichung gehören zur bestehenden App. Der genaue gepushte Commit sowie gespeicherte Version und terminaler Deploymentstatus werden durch Sites festgehalten; diese Datei behauptet keinen zukünftigen Deploymenterfolg.

Physisches Kamera-Passthrough, echte Tischfläche/Drift, native AR-Unterstützung, Low-Identität/Empfang, Produktions-Restore, Nutzerstudie und Geräte-Screenreader bleiben NOT RUN / NOT VERIFIED. Protokolladapter aus dem Architekturtext stehen als priorisierter Backlog, nicht als versteckte Implementierung. Tatsächlich verwendete Add-ons: lesende Figma-Shaderreferenz, Visualisierungs-/Three.js-Skills, Frontend-/QA-Werkzeuge und private Sites-Veröffentlichung.

Nachweise: `docs/AR_SPATIAL_AUDIT_V1_4_2.json`, `docs/BUNDLE_REPORT.json`, neue reproduzierbare Tests. `public/documents/cue-mesh-ar-levels-preview.png` zeigt den echten lokalen 2D-Explorer mit synthetischen QA-Daten, keine Kameraprojektion.
