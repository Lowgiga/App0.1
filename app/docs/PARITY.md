# Appearance-Prototyp 0.5.4 vom 5. Oktober 2026

Aktueller Quellkandidat: `0.5.4-prototype-20261005`. Android-Versionscode: `12`. App-ID `de.lowgiga.cuecommandmesh.next` und bisheriger Debugsigner bleiben vorgesehen; die Signaturkontinuität ist am neu gebauten Artefakt erneut zu prüfen. Dieser Kandidat erweitert die lokalen Hologramm-Darstellungen. Gemeinsame Projektion, Vorschau und Speichergrenzen: [Appearance-Spezifikation](superpowers/specs/2026-10-05-appearance.md). Individuelle Darstellungen sind nicht im bisherigen Projektbackup enthalten; Wiederherstellung bleibt reine Vorschau. Tests, Build und Geräteabnahme gelten nur mit neuen eigenen Nachweisen.

Die folgenden Abschnitte bleiben als historischer Bericht erhalten und bestätigen diesen neuen Kandidaten nicht.

# Prototyp-Nachtrag 0.5.3 vom 5. Oktober 2026

Aktueller Quellkandidat: `0.5.3-prototype-20261005`, Android-Versionscode `11`. Ausführungs- und Geräteabnahmen sind im gesonderten aktuellen Prüfbericht ausgewiesen; die Versionsnummer ist keine Produktionsfreigabe. Neue Funktionsbeschreibung und offene Abnahmen: [WORKFLOW-RECOVERY.md](WORKFLOW-RECOVERY.md). Die folgende Übersicht ist als historischer Bericht des ausdrücklich genannten 0.5.0-Standes erhalten; ihre Testzahlen, Hashes und Aussagen zur Sitzungspersistenz sind keine Freigabe des neuen Kandidaten.

# Funktionsumfang und echte Grenzen

Stand: integrierter lokaler Android-first Kandidat, V7 / App 1.4.2 / WorkState 4. Ausgangscommit: `3e921804b13e0d7c70d1ff15474f0387e84d70b6`. Das ist ein eigenständig gebauter lokaler React/Vite-Client mit gebündelten Daten und Quellcode, keine Weiterleitung auf eine Website.

Portversion **0.5.0-v7-integrated-preview**, 226 byteidentische V7-Originaldateien.

## Übernommen

- Alle 17 ursprünglichen Arbeitsbereiche, einschließlich Missionszentrale, Freigaben, Aktivität, Räume, Aufgabenmatrix, Einstellungen, 2D/3D, Academy und ursprünglichem AR-Pfad
- Originale Quellen, Dokumente und Screenshots; unverändertes V7-Archiv unter `upstream/`
- Ein zentral geladener WorkState für ursprüngliche Ansichten und Studio. Änderungen passieren weiterhin über den geprüften lokalen Transport mit Schema-, Referenz-, Budget-, Konflikt- und Ereignisprüfungen
- Ursprünglicher ergänzender Legacy-Snapshotimport. Er ist keine vollständige Wiederherstellung und übernimmt keine historischen Freigaben als neue Rechte
- Explizite Plattformadapter für Snapshot-, Workbook-, Raum-/Mission-/Checkpoint-Dateiexporte und Clipboard-Auswahllinks

## Neu integriert

- Graph Explorer: kanonischer V7-Zustand, drei Layouts, SVG-2D, bedarfsweise Three-3D, Inspector, Filter, gekoppelte Navigation, Hologramm als Bildschirmstil, abschaltbare Übergänge
- Persönliche Graph-/Studio-/Prüfoptionen in streng versionierter, revisionsgeprüfter IndexedDB-Transaktion; Systembackup umfasst gespeicherte Optionen
- Vier verifizierte Offline-Skills und begrenzte lokale Prüfprozesse mit tatsächlichen Handlern, frischen Selbsttests, Pause/Stop und echten Zustands-/Fehler-/Ereignisrückmeldungen
- Ergebnisverlauf (höchstens 20, zusätzlich größenbegrenzt), historisch exportierbar. Keine Replay-Rechte; private Lauf-Fortsetzungspunkte sind nur in der aktuellen Sitzung verfügbar
- Vollständige portable Backupdatei des gelieferten JSON-Zustands mit Integritätsprüfung, vollständigen Eingangsdaten, Inventar und Konfliktvorschau
- Gebündelte Markdown-/JSON-Quelldokumente in einem exakten Vier-Dateien-Textviewer im vorhandenen Source-Sheet; Originaltext-Export über Plattformadapter
- Native Kamera-AR: eigener experimenteller Einstieg neben Browser-WebXR, kein automatischer Kompatibilitätsabruf, Energiespar-Sperre und reine Auswahlrückgabe ohne Datenmutation
- Android Storage Access Framework: Nutzerauswahl des Speicherorts, begrenztes Cache-Staging, kein breiter Speicherzugriff, Erfolg erst nach Streamabschluss. Abbruch und Fehler werden getrennt gemeldet

## Nicht als fertig behauptet

| Lücke | Aktueller Stand | Erhaltener oder geplanter Integrationsweg |
|---|---|---|
| Persönliche Cloud-Arbeitsdaten | Vollständiger Nutzerexport fehlt; keine erfundenen Daten | Nutzerexport separat prüfen, Legacy-Merge oder später freigegebene Vollrestore-Transaktion |
| Vollständige Wiederherstellung | Preview-only, kein Anwenden-Knopf | Separate explizite Bestätigung, atomare Vorsicherung, CAS, Prüfung und Rollback erforderlich |
| Sites-Login / D1 Cloudsync | Lokal isoliert, keine Anmeldung oder Synchronisation | Originale API-/D1-Quellen bleiben erhalten; späterer authentifizierter WorkTransport mit gemeinsamer Domain, Konflikt-/Versionstests und eigener Freigabe |
| MCP/echte Provider | Keine Bridge zu externen Agenten oder Tools, kein live verifiziertes Toolinventar | Originaler MCP-Endpunkt im Sourcearchiv, getrennte authorisierte Provideradapter und Herkunfts-/Readinessbelege |
| Adaptive Oberfläche | Nach unabhängigem Review integriert: drei Anordnungen, gemeinsame Hostprojektionen, Graph-/Skillslots und typisierte Navigation | Internes geschlossenes Schema, keine A2UI-/MCP-Apps-Kompatibilitätsbehauptung |
| Lernpfade und Browser-AR | V7 mit fünf separaten Academy-Ableitungen und vier Praxisleveln, optionalem Shader, gleichwertiger 2D-Alternative, explizitem Surface-/Free-WebXR und Diagnose | Gemeinsamer Graph/WorkState, zusätzliche Abbruch- und Three-Lifecycleabsicherung; keine Hardwareabnahme |
| Native Kamera-AR | Optionaler nativer ARCore-1.54.0-Adapter Revision 6 experimentell integriert. Kein Hardwarepass | Explizite Privacy-/Startschritte, vollständiger gewählter Graphbereich; Prüfung auf realem ARCore-Gerät bleibt Pflicht |
| Android-Runtime/Dateidialog | Quellimplementation und Logiktests; tatsächliche Geräteprüfung offen | Auf Samsung/Android Save/Cancel/Fehler/Lifecycle/Mehrfachklick und Clipboard ausführen |
| GPU/WebGL/AR | Node/DOM-Tests beweisen weder GPU noch Kamera-AR | Physisches Gerät und unterstützter Browser/WebXR; falls nicht verfügbar ehrliche Diagnose |
| Windows-native Paket | Noch nicht erstellt | Derselbe portable Webkern und explizite weitere Plattformhülle |
| Hintergrund-Autonomie | Nur begrenzte lokale Funktionen im geöffneten App-Prozess | Keine OS-Hintergrunddienste, Cron, Fernsteuerung oder automatische externe Handlung |

Native Hostkompilierung, 31 JVM-Tests und Lint wurden lokal ausgeführt; Installation, Signierung, finale APK-Assets und Hardwareverhalten bleiben getrennte Abnahmen. SHA-256 belegt Bytegleichheit und Integrität, nicht Sicherheit, Nutzerdatenvollständigkeit oder Geräteeignung.

### Lokale Kooperationsartefakte

Kooperationsbriefe tragen ihre lokale Herkunft und den nicht verifizierten persönlichen Cloudimport im deterministisch gebundenen JSON-Inhalt. Datei, Clipboard, Vorschau und Reportzuordnung verwenden dieselbe lokale Bindung; der getrennte Website-MCP-Brief ist nicht austauschbar. Manuelle Berichtübernahme speichert nur eine ausdrücklich ungeprüfte Notiz und erteilt keine Berechtigung.

### Begrenzte Domainkorrekturen

Entfernte Aufgaben erzeugen nun ein kanonisches Ereignis in derselben geprüften lokalen Schreiboperation. Zustandsändernde Fokusvorschläge werden nach einem zulässigen Rücksprung erneut gegen den aktuellen Zustand geprüft; Request-ID-Deduplizierung, CAS und geschlossene Missionen bleiben geschützt. Legacy-Import weist ausdrücklich darauf hin, dass vorhandene Räume einschließlich ihrer Beiträge vollständig gewinnen, dass 3 MiB Dateilimit gelten und dass der Zielzustand einschließlich Ereignissen höchstens 1.750.000 UTF-8-Byte umfassen darf. Ein erfolgreicher Export garantiert keinen späteren Legacy-Import.
