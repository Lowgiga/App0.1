# Systemarchitektur · tatsächlicher Aufbau

## Anwendung und Grenzen
React 19 / TypeScript / Vinext (Next-artige App-Routen), Cloudflare Worker und D1, vorhandene UI-Komponenten. Eine stabile Navigation führt zu 17 kontextuellen Arbeitsflächen. Optionales Three.js ist lazy. Kein separater Hermes-/FastAPI-Server oder nativer Desktopworker wird durch diese App behauptet.

## Datenfluss
Authentifizierte Nutzeridentität → eigenes `readWork` → validierter State v4 → editierbare Clientansichten. `/api/state` akzeptiert einen erwarteten `updatedAt`-Stand; Konflikt erzeugt 409. Canonical App-Ereignisse und Änderungen liegen in derselben Speicheroperation. `/api/actions` validiert explizite App-Aktionen; Freitext führt keine externe Arbeit aus. UI-Entwürfe bleiben bei Konflikten zur Prüfung erhalten.

## Erweiterungspunkte
| Erweiterung | Heute vorhanden | Sichere Grenze |
|---|---|---|
| Arbeitsprofile | Vier konfigurierbare eigene Profile | Keine entfernte Agentensteuerung oder Identitätsvortäuschung |
| Missionen / Matrix | Eigene Aufgaben, Belege, Voraussetzungen, Review | Abschluss nur mit tatsächlichen Kriterien |
| Kooperations-MCP | Vier read-only Operationen, privater Brief | OAuth-Clientverbindung separat; keine Zustellungsbehauptung |
| Visualisierung | Gemeinsames semantisches Graphmodell; DOM/SVG/Three.js | Keine künstlichen Kommunikationspulse |
| AR | Nutzerklick, expliziter Modus, WebXR-Sitzung/Hit-Test | Kein Kameraupload; Hardwareabnahme separat |
| Lernen | Bestehende Quizflags plus streng gelesene versionierte Levelnotizen | Persönliche Übungen, keine Security-/Permissionquelle |
| Add-on-Katalog | Datierter Bestand und Capability-Beschreibung | Nicht automatisch geladen, verbunden, gesund oder autorisiert |
| Adaptive UI | Eigene vertraute Panels und kontextuelle Navigation | Fremde Beschreibungen brauchen Schema, Komponenten-Allowlist, Depth-/Node-/Bytebudget |

## Erweiterungsentscheidung
MCP für Tools, AG-UI für Ereignis-/Oberflächenkommunikation, A2UI für deklarative UI und MCP Apps für hostkontrollierte interaktive Toolansichten. Die aktuelle App stellt normales read-only MCP bereit. A2UI-/AG-UI-/MCP-Apps-Kompatibilität wird nicht erfunden. Künftige Adapter werden einzeln gegen tatsächliche Zielhosts geprüft; rohe HTML-/JS-Ausführung wird abgewiesen.

## Betrieb und Sicherheit
Sites Owner-only-Publikum unverändert. Auth- und State-Routen, Migrationsdateien und Paketabhängigkeiten sind in dieser Wave geschützt. Secrets bleiben in genehmigten Laufzeitmechanismen, niemals in Notizen oder Handoffs. React rendert Lerndetails als Text. Kamera-Permission kommt nur aus der sichtbaren WebXR-Anforderung. Ein zusätzlicher Dienst wird erst nach dokumentierter Capability, Scope, Auth und Fehler-/Stopmechanismus integriert.

## Budget und Qualität
Initiale statische JS-Closure ≤ 220 KiB gzip, root app zusätzlich ≤ 100 KiB gzip, CSS ≤ 10 % Wachstum zur gespeicherten v1.2-Basis. Messung über echte Buildassets, keine geschätzten Bytes. Ein Renderer, maximal 32 Knoten, DPR maximal 1.5 bzw. 1 im Energiesparmodus, pausierte Offscreen-/Reduced-Motion-Effekte. Runtime-AR muss für Sensortracking zeichnen; optionale kosmetische Bewegung ist davon getrennt.

## Recovery
Client-/CAS-Fehler zuerst lesen und auf tatsächlichen Ausgang prüfen. Keine blinden externen Retries. Snapshot-Import ist Zusammenführung, kein vollständiges DB-Restore. Lokaler D1-Neustart ist eine eng begrenzte Recoveryprüfung. `CHECKPOINT.md`, voller Commit, Scope-Guard, Diff und echte Testausgabe erlauben einen getrennten Agentenfortsetzungsprozess.


## Motion und Lernvertrag
Motion-Tokens aus dem vorhandenen CSS: instant 0 ms, fast 140 ms, normal 220 ms, deliberate 340 ms, ambient 8000 ms. Auswahl, Zustandswechsel und benutzergewählte Rotation erklären lokale Interaktion. Reduced Motion schaltet CSS-Animationen/Übergänge und kosmetische Rendererbewegung ab; Energiesparen und unsichtbare Szenen reduzieren Frames. XR-Sensortracking benötigt weiterhin reale Frames. Kein Fortschrittspuls ohne dokumentierte lokale Aktion.

Levelrecord v1: `level`, `provenance=personal-practice`, `observedAt`, `graphDigest`, `path`, `nodeId`, `detail`, optionale `taskId`/`missionId`. Strict Zod-Lesen, zeitlich gültige IDs und Referenzen, Graphdigest ohne Behauptung eines externen Zustands. Unbrauchbare importierte Notizen bleiben gespeichert, werden aber nicht als Levelabschluss gezählt. Ein späterer Level ersetzt keine fehlende Voraussetzung. Kein zusätzlicher D1-Index oder neues Schema in dieser Wave.

## Prüfstrategie
Domain für reine AR-/Lernlogik; HTTP für kanonische atomare Persistenz, Race/CAS und Nutzertrennung; lokal kompilierter Browser für reale Grafik, Tastatur/Touch, Fehler-Recovery und gezielt simulierte XR-Lifecyclefälle. Abschlussprotokoll und Exitcode müssen übereinstimmen. Hardware-AR, reale Remote-Integration und menschliche Nutzer-/Screenreadertests bleiben eigenständige Abnahmen.
