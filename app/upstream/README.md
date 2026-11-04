# Cue Command Mesh

Private Browser-App für lowgiga. Sie verbindet einen datierten Arbeitsstand aus Cue, einen Codex-GitHub-Handoff und eine direkte Make-Strukturprüfung mit nutzergebundenen Arbeitsnotizen. Die App ist eine funktionsfähige Arbeitsoberfläche; sie ist kein Live-Client für Cue.

## Bereiche · Version 1.4.2

- Übersicht und Rollen der vorhandenen Agenten Zimt, Manus und Junior.
- Verbindungen: Werkzeug, Anmeldung, Profilbindung und tatsächlich belegter Leseabruf separat.
- PAZ Issue #23: Commitreferenzen, sechs Planmarker, Testentwurf und gespeicherte Notizen. Marker belegen Planung, keine Implementierung oder bestandenen Tests.
- Make-Szenario 7098897: inaktiv, 900-Sekunden-Intervall, vier Module und zwei als gültig gemeldete Verbindungen. Kein Start.
- Funktionslabor: Routing für Software, Recherche, Content, Geräte und Automation; Takt-/Aufwandrechner mit optionalem eigenem Tarif; kontextbezogene Hand-offs und Checkpoints.
- Vollständiger Add-on-Katalog: 60 Gruppen, 1078 registrierte Werkzeuge und 274 Skills. Sichtbarkeit ist kein Beleg für Authentifizierung oder Cue-Zugriff.
- Zwölf Quellen einschließlich neun Screenshots. JSON-Export; Importvorschau und Zusammenführung mit Erhalt vorhandener Einträge.
- Einstellungen: Farbschema, Dichte, Schriftgröße, Startansicht, Widget-Reihenfolge und Sichtbarkeit, Quellenbanner, Bewegung und Energiesparmodus.
- Arbeitsprofile für Zimt, Manus, Junior und die Codex-Rolle: Aufgaben, Vorgaben, Modus, Ausgabeformat und vorgeschlagene Delegations-/Aufruf-/Zeitbudgets. Diese Profile gelten in dieser App; sie ändern keine entfernten Cue-Agenten. Externe Schreibaktionen behalten den Freigabeschritt.
- Vier Agentenbereiche mit eigener Suche, Missionen, offenen Gegenprüfungen, Entscheidungsvermerken und direkten Profilverknüpfungen. Ein fehlender Speicherzugriff wird als unbekannter Arbeitsstand angezeigt.
- Missionszentrale: Ziel, Umfang, Projekt, Owner, Reviewer, Phase, Priorität, Ergebnis und Checkpoint. Aufgaben, Missionräume und Quellen gezielt zuordnen; strukturierte Übergaben kopieren oder als Datei sichern. Abschluss verlangt Beleg, unabhängigen Reviewer und erledigte Aufgaben. Änderungen an abnahmerelevanten Aufgaben einschließlich aller Voraussetzungen erfordern erneut die Gegenprüfung.
- Freigabezentrale: konkrete Anfrage mit Aktion, Ziel, Daten, Risiko, Auswirkung, Prüfbeleg, Rückweg und Ablaufdatum. Entschiedene Inhalte bleiben unveränderlich; abgelaufene Anfragen können abgelehnt oder als neue Anfrage vorbereitet werden. Diese persönlichen Entscheidungen starten keine Aktion und schalten keine Rechte frei.
- Aktivität: serverseitig erzeugte, sequenzierte Ereignisse akzeptierter App-Änderungen; gemeinsam mit dem Zustand gespeichert. Letzte 200 Ereignisse, Filter und Suche. Kein externer Auditnachweis und keine Live-Telemetrie.
- Missionräume: Projekt, Ziel, zuständiger Agent, Modus, ausgewählte Quellen, Aufträge, Notizen und manuell übernommene Rückmeldungen. Kontextbezogene Hand-offs und reversible Archivierung. Kein Live-KI-Chat.
- Aufgabenmatrix: Priorität, Kategorie, Zuständigkeit, Status, Abhängigkeiten, Akzeptanzkriterien und Belege. Erledigt erfordert Beleg, Review und erledigte Voraussetzungen. Karten oder Board, Filter und Archiv.
- 3D & Lernen: semantische 2D-Karte, bedarfsgeladenes echtes Three.js-3D, optionaler GLSL-Auswahlstil und WebXR mit getrenntem Surface-/Free-Modus, frischen horizontalen Treffern und ausdrücklicher Platzierung. Fünf Quizthemen und vier aufbauende Praxislevel mit getrennten persönlichen XP.
- Kontextmenü „Verknüpfen“, Schnellsuche mit Strg/Cmd+K, gezielte Profilverknüpfungen, vorbereitete PAZ-/Make-Missionen, mobile Navigation und Übergänge mit reduzierbarer Bewegung.

Das PAZ-Zielrepository ist `Klarmedizin-V4/prometheus-archon-zeta` (vom Nutzer am 30.09.2026 erneut bestätigt). Die App-Quellcodeablage ist davon getrennt.

## Daten und Privatsphäre

Der Quellenstand in `lib/mesh-data.json` ist ein datierter Snapshot vom 29.09.2026. Aktualisierungen erfolgen bewusst durch neue geprüfte Quellen, nicht durch behauptete Live-Synchronisation. Private Sites-Zugriffskontrolle schützt Seiten, Quelldokumente und Screenshots. Zugriff ist auf den Eigentümer begrenzt; keine externen Betrachter oder Gruppen.

Arbeitsnotizen, Planmarker, Einstellungen, Arbeitsprofile, Missionräume, Aufgaben, Missionen, Entscheidungen und Lernfortschritt liegen in D1 (`mesh_work`), getrennt durch die vom Plattform-Dispatcher gelieferte Nutzeridentität. Keine Identität führt an `/api/state` und MCP-Datenwerkzeugen zu HTTP 401. Schreibzugriffe validieren Inhalt und Origin. Eine veraltete Version erzeugt 409; der Client lädt den aktuellen Stand und erhält die noch nicht gespeicherten Formulare zur erneuten Prüfung. Alte Speicheranfragen für Marker und Notizen erhalten neue Datenbereiche. Maximal 100 Notizen mit jeweils 5000 Zeichen, 12 Räume, 30 Beiträge je Raum, 60 Aufgaben, 30 Missionen und 60 Freigabeanfragen. Unbekannte Felder, zyklische Abhängigkeiten und unvollständige Abschlussnachweise werden abgewiesen. Importversionen 1, 2, 3 und 4 werden unterstützt. Importierte Missionen beginnen erneut als Entwürfe und Entscheidungen als offene Anfragen; alte Protokolle ersetzen nie den kanonischen Verlauf.

Die neue API-Antwort wird mit `X-Mesh-State-Version: 4` angefordert. Noch offene ältere Clients erhalten das bekannte Format und bewahren beim Speichern die neuen Bereiche. Eine neue Startansicht wird alten Clients als Übersicht angezeigt und bleibt beim normalen Rundlauf erhalten; neue Startansichten im aktuellen Client konfigurieren.

Die Verknüpfungsvorschläge navigieren innerhalb der App oder bereiten Entwürfe vor. Sie melden keine neu authentifizierten Dienste, messen keine echte Agentenauslastung und führen keine Automationen aus. Die 3D-Kanten visualisieren einen datierten Arbeitsstand und geplante Beziehungen. AR startet ausschließlich durch einen eigenen Klick auf einem unterstützten Gerät; die App zeichnet keine Kamerabilder auf und lädt keine hoch.

## Private MCP-Schnittstelle

`/mcp` implementiert stateless Streamable HTTP mit vier schreibfreien Werkzeugen:

| Werkzeug | Daten | Außenwirkung |
| --- | --- | --- |
| `mesh_get_status` | Datierter Agenten-/Integrationsstand | Keine |
| `mesh_get_paz_plan` | PAZ-Plan und eigener gespeicherter Arbeitsstand | Keine |
| `mesh_get_make_evidence` | Gespeicherte Make-Strukturprüfung | Keine |
| `mesh_get_collaboration_brief` | Arbeitsbrief für Low, Dateigrenzen, Inhaltskennung und begrenzter eigener Missionskontext | Keine |

Alle Werkzeuge haben leere Eingabeschemata und `readOnlyHint: true`. Keine externen Dienste werden vom App-Server aufgerufen. MCP-Verbindung in ChatGPT ist eine separate Nutzerinstallation; Bereitstellung allein bedeutet keine installierte Verbindung.

Zwei zusätzliche Browser-WebMCP-Lesewerkzeuge werden nur registriert, wenn die experimentelle `document.modelContext`-API vorhanden ist. In der verwendeten Testbrowser-Laufzeit war sie nicht verfügbar. Die reguläre `/mcp`-Schnittstelle ist davon unabhängig.

## Entwicklung und Prüfungen

Offizieller Vinext-/React-Starter mit vorhandenen Shadcn-Bausteinen, D1 und geprüfter Drizzle-Migration. Die bestehende Lockdatei bleibt verbindlich.

```bash
node node_modules/typescript/bin/tsc --noEmit
node tests/foundation-domain.mts
node tests/intelligence-domain.mts
node tests/spatial-academy-domain.mts
node --test tests/collaboration-domain.mts
python3 tests/run-api-audit.py
node scripts/measure-bundle.mjs
```

Die HTTP-Tests richten sich ausschließlich an den isolierten kompilierten Worker auf Port 8787 und verwenden synthetische lokale Testidentitäten. Sie prüfen die App-Logik, nicht die Produktionsanmeldung des Sites-Dispatchers. Der HTTP-Harness startet den eigenen kompilierten Worker, wendet die Migration nur auf seine isolierte lokale D1 an und beendet seinen Prozess. Produktionsmigration und Veröffentlichung erfolgen über Sites.

Einstellungen, Missionräume, Matrix, Command Center und 3D werden bei Bedarf geladen. Das Bundle-Skript erfasst auch gemeinsam statisch geladene Abhängigkeiten und prüft die Budgets; kleinere Einzeldateien allein gelten nicht als Verbesserung des Gesamtladens. Motion-Tokens und reduzierte Bewegung sind in `app/globals.css` definiert. Die weitere Vision – Zeitbewertung jeder Evidenz, zusätzliche Graph-Entitäten, Produktvergleich und kontrollierte Worker – folgt in getrennten Waves gemäß Feature Map.

Siehe `QA.md` und `CHECKPOINT.md` für tatsächlich durchgeführte Prüfungen und Fortsetzung. Die private Veröffentlichung enthält ausschließlich diese Browser-App. PAZ-Code, Make-Ausführung, Versand, Zahlungen und dauerhafte Automationen gehören zu gesonderten Missionen.


## Dashboard-Matrix · Version 1.3

Fokus & Intelligence verbindet fünf konfigurierbare Ansichten: Überblick, Deep Focus, Fortschritt, Stabilität und Risiko. Die Neurotransmitter-Bezeichnungen sind eine Bedienmetapher. Regelgewichte von 0–100 werden aus dokumentierten App-Daten abgeleitet; weder menschliche Kognition noch externe Agentenaktivität wird gemessen.

State-Version 4 ergänzt Missionsfristen, berechnete Profile, Neuro-Einstellungen und 120 unveränderliche App-Interaktionsnachweise. Version-3-Clients erhalten kompatible Antworten und bewahren die neuen Bereiche. `GET/PUT /api/state` bleiben die Zustandsoperationen. `POST /api/actions` validiert `focus-follow`, `risk-plan` und `risk-accept` unter demselben Versionsschutz. Andere Zustandsmethoden liefern 405; unbekannte API-Pfade 404.

Fokus-Empfehlungen beginnen eine zulässige Missionsphase oder eine Aufgabe mit erfüllten Voraussetzungen. Sie starten keine entfernte Ausführung. Risiko planen erzeugt eine wirkliche eigene Prüfaufgabe; Risiko akzeptieren dokumentiert eine begründete Entscheidung und lässt die Bedingung sichtbar. Eine Behebung wird erst durch geänderte Daten nachgewiesen. Der SHA-256-Digest bindet die vollständige kanonische Bedingung unabhängig vom rotierenden Eventlog; Request-IDs erlauben die Bestätigung nach Antwortverlust. Beides ersetzt keine Authentifizierung.

Die automatische Priorität ist standardmäßig aus. Ihr nichtmodaler Hinweis erhält den Fokus. Eine zusätzliche Option aktiviert ausdrücklich den automatischen Prüfdialog. Reduced Motion, Bewegung aus und Energiesparen reduzieren Effekte. Die 2D-Mission Map hat beschriftete Knoten, Relationslisten, Knotendetails und verfolgbaren Kontext. Knoten und Beziehungen sind per Tab, Pfeiltasten, Pos1 und Ende bedienbar. Herkunft wird durch Form und Text zusätzlich zur Farbe dargestellt. Fehlender persönlicher Stand wird als unbekannt gekennzeichnet; Vorlagen bleiben als solche erkennbar.

Gesamtes Schreibbudget: 1.750.000 UTF-8-Bytes mit Reserve für Ereignisse. Bestehende größere Daten bleiben lesbar; neue Writes müssen das Budget einhalten. Import ist eine sichere Zusammenführung, kein destruktiver Datenbank-Restore. Nach einem fehlgeschlagenen Abruf darf ein zuvor geladener Stand weiter exportiert werden; vor dem ersten erfolgreichen Abruf bleibt Export gesperrt.

Die D1-Abfrage liest genau eine nutzergebundene JSON-Zeile über den Primärschlüssel. Der lokale Query-Plan bestätigt den bestehenden Index. Profile werden innerhalb des begrenzten Zustands gefiltert; ein ungenutzter JSON-Profilindex wird nicht angelegt. Bei späteren normalisierten Eventtabellen muss der Zugriff erneut gemessen werden.

`docs/DASHBOARD_AUDIT_V1_3.json` enthält Messwerte und offene Prüfungen. `docs/PERFORMANCE_BASELINE_V1_2.json` hält den Ausgangsbuild fest; `scripts/measure-bundle.mjs` vergleicht Root-Chunk, vollständige statische JS-Abhängigkeiten und CSS. Wiederholte Builds entfernen ausschließlich generierte Assets; mehrdeutige alte Chunks lassen die Messung fehlschlagen. Command Center, Palette, Matrix, Hilfe und 3D bleiben bedarfsgeladen.


## Mesh Explorer und Academy · Version 1.4

Der Explorer verbindet den gespeicherten eigenen Stand mit Agenten, Missionen, Aufgaben, Missionräumen und Quellen. Drei ausdrücklich geplante Systeme ergänzen den Kontext. Knoten zeigen Herkunft und Details; Beziehungen sind verfolgbar. Team, Missionen und Gesamtkontext filtern die Ansicht; Nachbarschaft isoliert direkte Beziehungen. Maximal 32 Knoten werden zugleich gezeigt. Der Auswahl-Link erhält Knoten und Bereich, ohne Zugriff zu gewähren. Vier geführte Schritte erklären Übergaben und Review, ohne Agentenaktivität zu erfinden.

2D erscheint sofort. Erst „Räumliches 3D“ lädt Renderer, Three.js und OrbitControls. Fokus vergrößert die Auswahl; Zentrieren und Zoom sind direkt bedienbar. Drehung beginnt ausschließlich nach einem Klick und ruht bei Reduced Motion, Energiesparen, ausgeblendeter Seite oder einer nicht sichtbaren Szene. Die DOM-Knotenliste bleibt gleichwertig bedienbar. Grafikverlust wechselt in die funktionale 2D-Ansicht; ein erneuter 3D-Start wird angeboten.

AR bleibt ein optionales räumliches Planungsmodell: unterstütztes Gerät, sicherer Kontext, eigene Startentscheidung und bedienbares DOM-Overlay sind erforderlich. Vor mir zentrieren, Größe ändern und Beenden sind explizite Aktionen. Es gibt keine Flächen- oder Raumerkennung. Nach XR-Ende wird die normale Ansicht erst nach der Renderer-Wiederherstellung neu gezeichnet, auch bei pausierter Bewegung. Der neue Geräteablauf ist noch nicht auf einem echten Android-Gerät getestet.

Die fünf bisherigen Lernthemen bleiben mit ihren gespeicherten IDs erhalten. Jedes enthält Prinzip, Wissensfrage, Fallprüfung und Anwendung. Die Empfehlung ergibt sich nachvollziehbar aus offenen App-Aufgaben und Missionen. Wissensfrage und Fall müssen korrekt geprüft sein; eine eigene Begründung von mindestens 20 Zeichen ist Voraussetzung für eine gespeicherte Übungsnotiz. Quizstand und Notiz werden gemeinsam über den bestehenden Versionsschutz gespeichert.

Eine Transfer-Aufgabe startet offen, ohne Beleg oder bestätigtes Review, mit auswählbarem App-Profil als Owner. Optional wird sie in derselben Speicherung als Voraussetzung einer offenen Mission verknüpft. Eine blockierte Mission wird damit nicht gelöst. Bereits abgenommene, archivierte oder voll belegte Missionen sind kein Transferziel. Bei einem Versionskonflikt bleiben Antworten und Begründung erhalten; ein ungültig gewordener Missionskontext lässt sich entfernen. Das Arbeitsbuch exportiert Inhalte und eigene gespeicherte Ergebnisse als Markdown. XP bezeichnen persönliche Quizstände.

State-Version 4, D1-Migration, Speicherschutz und persönliche Grenzen bleiben kompatibel; keine neue App-Abhängigkeit. `tests/spatial-academy-domain.mts` und `tests/spatial-academy-api.py` ergänzen 56 Prüfungen. `tests/spatial-browser.mjs` ist ein optionaler lokaler E2E-Harness mit 44 Prüfungen gegen den kompilierten Worker und isolierte D1; alle Drittanbieterrequests sind gesperrt. Er verändert keinen Auth-Guard und prüft nicht die Sites-Produktionsanmeldung.

Für den Browser-Harness Playwright, axe-core und @napi-rs/canvas in einer getrennten QA-Toolchain verwenden. Falls sie im Projekt nicht auflösbar sind, ihre Modulpfade über `MESH_PLAYWRIGHT_MODULE`, `MESH_CANVAS_MODULE` und `MESH_AXE_SOURCE` setzen. `MESH_CHROMIUM_EXECUTABLE` ist optional; ansonsten verwendet Playwright seinen installierten Chromium. `MESH_BROWSER_AUDIT_OUTPUT` legt den Ausgabeordner außerhalb des Repositories fest. Nach einem Build `node tests/spatial-browser.mjs` ausführen. Für die Ausführung dieser Wave wurde Chromium 153 mit Software-WebGL verwendet.

`docs/SPATIAL_ACADEMY_AUDIT_V1_4.json` enthält die ausgeführten Prüfungen und offenen Grenzen. Das Bundle-Skript prüft jetzt zusätzlich, dass Renderer und 3D-Engine sowohl außerhalb des initialen JavaScript als auch außerhalb der statischen 2D-Imports bleiben. `--check-only` prüft einen bereits gebauten Release ohne den Report erneut zu schreiben.

## Codex und Low · Version 1.4.1

Unter **Agenten → Codex & Low** liegt der Kooperationsbereich. Codex übernimmt Dashboard, UX und Abnahme in einem eigenen Git-Worktree. Lows Nische sind Integrationsbefunde, lokale Geräteprüfungen und isolierte Adapterentwürfe unter `integrations/low/`, `tests/low/` und `docs/low/`. Gemeinsame Datenverträge, Migrationen, Authentifizierung, State-/Action-Endpunkte und Paketabhängigkeiten bleiben in dieser Wave eingefroren. Die vier bestehenden App-Profile bleiben erhalten; Low wird nicht als erreichbare fünfte Ausführungsinstanz ausgegeben.

Der Brief lässt sich kopieren oder als JSON exportieren; er enthält höchstens sechs eigene Missionskurzfassungen und keine privaten Notizen oder Zugangsdaten. UI und privater MCP-Lesebefehl erzeugen dieselbe SHA-256-Inhaltskennung für denselben Arbeitsstand. Export ist noch keine Zustellung. Lows Identität, Kanal und Annahme sind nicht bestätigt. Zwei Remote-Geräte wurden beim datierten Commander-Abruf als offline gemeldet; die App aktualisiert diesen Befund nicht live.

Tatsächlich erhaltene LowReport-JSON wird auf Format, Mission, Revision, Inhaltskennung und Dateigrenzen geprüft. Ein passender Bericht wird ausschließlich als gekennzeichnete ungeprüfte Notiz über den bestehenden Versionsschutz gespeichert. Er bestätigt keine Identität, Tests oder aktuelle Source-Revision und verändert keine Mission, Freigabe oder entfernte Agenteneinstellung. Gemeldete Befehle bleiben Text. Abweichende Briefe können ausdrücklich als historische ungeprüfte Notiz gesichert werden, ohne als aktueller Auftrag zu gelten; ein Versionskonflikt erhält den Entwurf.

`AGENTS.md`, `lib/collaboration-registry.json` und `scripts/check-agent-scope.mjs` definieren die Arbeitsteilung. Die lokale Scope-Prüfung erfasst auch staged Änderungen, neue Dateien, Umbenennungsquellen, Löschungen, Symlinks und Submodule. Sie ist eine Projektprüfung, kein Betriebssystemschutz. Vor Integration tatsächlichen aktuellen Remote-HEAD, vollständigen Diff und Tests separat prüfen. Kein Force-Push, automatischer Merge oder gemeinsames Schreiben in einem Worktree.

Details: `docs/COLLABORATION.md`, `docs/COLLABORATION_AUDIT_V1_4_1.json`, `QA.md`. Der optionale Browser-Harness `tests/collaboration-browser.mjs` verwendet dieselbe getrennte QA-Toolchain wie die Spatial-Suite, ohne Canvas-Abhängigkeit. Nach einem Build mit `MESH_BROWSER_AUDIT_OUTPUT` außerhalb des Repositories ausführen. `scripts/package-release.mjs` packt ausschließlich die bestehenden Build-Artefakte; die genaue gepushte Source-Revision muss vor dem privaten Sites-Deployment geprüft sein.


## AR und Praxislevel · Version 1.4.2

Im räumlichen Explorer bleibt der Graph derselbe wie in 2D. „Hologramm-Auswahl“ ist ein optionaler echter GLSL-Grafikstil, kein physischer Projektor und keine Agentenaktivität. Das Lernsystem folgt vier Schritten: Herkunft einordnen, eine reale Modellbeziehung verfolgen, Perspektive/Fokus erkunden, einen offenen prüfbaren Auftrag vorbereiten. Jeder gespeicherte Praxislevel zählt einmal 25 XP; die fünf alten Quizstände bleiben getrennt erhalten. Die gleichwertige 2D-Route benötigt weder GPU noch Kamera. Der letzte Schritt erzeugt Notiz, offene unreviewte Aufgabe und gegebenenfalls Missionsreferenz in einem Versionsschutz-Write.

Unter „AR-Modus & Diagnose“ den Modus ausdrücklich wählen. Surface verlangt Hit-Test und DOM-Overlay und sucht eine waagerechte Fläche. Ein frischer Zielring erlaubt bewusstes Platzieren; Zoom behält den Auflagepunkt. „Neu platzieren“ löscht die vorige Platzierung. Free startet ausdrücklich ohne Flächenerkennung. Die Sitzung beginnt ausschließlich durch den AR-Startklick; fehlende Berechtigung oder Unterstützung erzeugt keinen stillen Ersatzmodus. Browserfehler behalten Name, Originalmeldung, Phase und Zeitpunkt. Ist ein Ende unbestätigt, bleiben Status und Beenden erreichbar; ein weiterer Start ist gesperrt. Verspätete Grafikbindung einer beendeten Sitzung führt zum 2D-Fallback mit frischem Renderer-Retry.

Die Browser-QA prüft echte WebGL-Pixel und gezielt simulierte XR-Sitzungen. Tatsächliche Kamera-/Tischabnahme auf einem unterstützten Android-Gerät ist separat nach `docs/AR_DEVICE_QA.md` auszuführen. Kein eigenes Kamerabild wird hochgeladen. Low hat einen konkreten getrennten Geräteauftrag, aber noch keinen verifizierten Empfangskanal.

Die API-Teststeuerung verlangt neben Exit 0 auch einen vollständigen Abschlussnachweis mit übereinstimmender Anzahl an PASS-Zeilen. Leere oder abgeschnittene Protokolle gelten nicht als Erfolg. Die neue Browser-Suite `tests/ar-spatial-browser.mjs` nutzt dieselbe getrennte Playwright-/axe-/Canvas-Toolchain und Umgebungsvariablen wie `tests/spatial-browser.mjs`.

Projektdateien: `PROJECT.md`, `STATE.md`, `DECISIONS.md`, `TASKS.md`, `EVIDENCE.md`, `RUNS.md`, `CHECKPOINT.md`. Systemdateien: `docs/SYSTEM.md`, `docs/SCENE_CONTRACT.md`, `docs/AR_DEVICE_QA.md`, `docs/PROTOCOLS_2026.md`, `AGENTS.md`, `lib/collaboration-registry.json`. Prüfbericht: `docs/AR_SPATIAL_AUDIT_V1_4_2.json`; Budget: `docs/BUNDLE_REPORT.json`.
