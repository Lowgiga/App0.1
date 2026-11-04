# Import-Zwischenstand 0.5.1 – Wiederherstellung

Stand: 4. Oktober 2026, 08:56 UTC. Version `0.5.1-v7-import-preview-reconstructed`, Android-Quellkonfiguration versionCode 9, App-ID `de.lowgiga.cuecommandmesh.preview`.

## Einordnung

Dies ist ein wiederhergestellter, gezielt geprüfter **Quell-Zwischenstand**, keine fertig geprüfte Android-Anwendung. Der temporäre frühere Entwicklungsarbeitsbereich war nach der Wiederherstellung der Ausführungsumgebung nicht mehr vorhanden. Ausgangspunkt ist das erneut bereitgestellte Originalarchiv `Cue-Command-Mesh-0.5.0-Quellcode.zip`, 6.668.060 Byte, SHA-256 `8cde274e63cf4bd0aebb097e156d389a2a52e3419cf1c266bc01fd050e21c3bb`.

Die vollständigen erhaltenen Importpatchtexte wurden erneut angewendet. Die vor dem unten separat beschriebenen Parser-Folgepatch erzeugte Webausgabe ist bytegleich mit dem früher geprüften Importstand: 54 Dateien, Inhaltsgesamt-SHA-256 `e3417a5e914400fbd8809a1d864dbf4e4ab6079378a184608879b0cb04824795`. Dieser Vergleich belegt die Wiederherstellung der gebauten Webdateien; frühere Testergebnisse wurden trotzdem nicht als neue Testergebnisse übernommen.

Die anschließend entwickelte persistente Workflow-Wiederaufnahme ist **noch nicht enthalten**. Sie wird nach Sicherung dieses Import-Zwischenstands separat wiederhergestellt. Die künftige Next-App-ID und neue Signierung sind ebenfalls noch nicht angewendet. Kein privater Signierschlüssel wurde erzeugt.

## Enthaltene Importkorrekturen

- Rein berechnender Importplan und tatsächlicher Merge verwenden dieselbe kanonische lokale Transformation. Die Vorschau schreibt nichts.
- Vorhandene Raum-IDs gewinnen vollständig; auch zusätzliche Beiträge aus diesen importierten Räumen werden übersprungen. Die Oberfläche zählt neue Räume, übernommene und übersprungene Beiträge sowie vorhandene Beitrags-IDs getrennt.
- Quelldateigrenze: 3 MiB beziehungsweise 3.145.728 Byte. Zielbudget: tatsächlich serialisierter, transformierter Arbeitsstand einschließlich neuer Ereignisse und finaler Revision, höchstens 1.750.000 UTF-8-Byte.
- Keine stille Checkpointkürzung. Unbekannte Referenzen und ungültige Datensätze führen zur vollständigen Ablehnung. Die unveränderte Ereignisgrenze von 200 Einträgen wird mit der Zahl verdrängter Ereignisse offengelegt.
- Lokale Einstellungen und Arbeitsprofile bleiben erhalten. Importierte Missionen und Freigaben werden neu zur Prüfung vorgeschlagen. Alte Ereignisse/Interaktionen aus der Datei werden nicht als neue Ausführung übernommen. Vom Legacy-Format ergänzte Standardaufgaben werden gesondert bezeichnet.
- Einmalige Bestätigung eines intern gehaltenen Plans; atomare revisionsgeprüfte IndexedDB-Transaktion. Gleichzeitige, veraltete oder doppelte Bestätigungen können keinen zweiten Import auslösen.
- Abbruch, Zurücknavigation, Dateiwechsel, verspätete Antworten und Panel-Unmount sind geschützt. Nach unklarem Commitausgang wird neu geladen, aber nicht automatisch erneut importiert.
- Eine verspätete Bestätigung speichert exakt den geprüften Zielstand; bereits abgelaufene vorgeschlagene Freigaben benötigen eine neue Vorschau.

Kein Vollrestore, keine Cloud-Synchronisation, keine neue externe Providerverbindung und keine automatische Altdatenmigration.

## Frisch ausgeführte Prüfungen

Die folgende Tabelle dokumentiert die wiederhergestellte Basis vor dem späteren Parser-Folgepatch am 4. Oktober:

| Prüfung | Ergebnis |
|---|---|
| Originalarchiv: Größe, SHA-256, ZIP-CRC | Bestanden |
| Originalquellen-Drift | 226 Dateien byteidentisch |
| Vendorinventare | 5 gepinnte Module verifiziert |
| Native AR-Quellen | 18 Dateien byteidentisch |
| Geprüftes Domain-Kit | Unverändert verifiziert |
| `node --test tests/legacy-import.test.ts` | 13/13 bestanden |
| `node --test tests/local-adapter.test.ts tests/conflict-gate.test.ts` | 19/19 bestanden |
| `node --import ./scripts/register.mjs --test tests/system/legacy-import-ui.test.tsx` | 22/22 bestanden |
| `node --import ./scripts/register.mjs --test tests/system/legacy-import-provider.test.tsx` | 4/4 bestanden |
| `npm run typecheck` | Exit 0 |
| `npm run build` | Exit 0, 54 Webdateien |

Die vier neuen Integrationsprüfungen verwenden den echten gemeinsamen Stateprovider und den echten lokalen Store mit simuliertem IndexedDB. Nur die Zustellung bereits abgeschlossener Commitantworten wird künstlich verzögert. Geprüft wurden Commit/Reload, externer Speicherkonflikt mit neuer Vorschau und ausdrücklicher erneuter Bestätigung sowie Cancel und Panel-Unmount nach bereits erfolgter Speicherung. In den letzten beiden Fällen genau ein Reload, kein wiederholter Commit.

Eine isolierte negative Vergleichsprüfung entfernte ausschließlich die Übernahme der geplanten Revision. Der neue Test für um fünf Minuten verzögerte Bestätigung scheiterte dann an der falschen Revision; die unveränderte richtige Produktionsimplementierung bestand. Beleg: `reports/import-reconstructed-0.5.1/delayed-commit-mutation-red.log` und `import-green.log`.

## Lesende Prüfläufe der Vorbasis um 08:42–08:46 UTC

Nach dem erneuten Infrastrukturfehler wurden ausschließlich die tatsächlich ohne Dateischreiben ausführbaren Gruppen im bestehenden Lesesandbox ausgeführt. Alle Assertions, Verträge und produktiven Zeitlimits blieben unverändert. Die Läufe waren seriell; die Standard-Parallelausführung wurde damit nicht ersetzt oder als bestanden ausgegeben.

| Disjunkte Prüfgruppe | Bestanden |
|---|---:|
| Basistests ohne das gemischte Collaboration-Testfile | 179 |
| Rein lesende Collaboration-Fälle, ausdrücklich per Namen ausgewählt | 13 |
| Vollständige System-/UI-/Provider-Integrationsgruppe | 112 |
| Bestehende Reviewerregressionen | 19 |
| Vendorgruppen ohne schreibende Skill-Kernel-/Loader-Fixtures | 184 |
| Drei rein lesende Skill-Loader-Schemaprüfungen | 3 |
| Level-/AR-Domain | 30 |
| V7-Prüfungen | 7 |
| **Summe der frisch bestandenen Tests** | **547** |

Zusätzlich bestanden alle **18 Renderer-Simulationen**. Alle genannten Prozesse endeten mit Exit 0; kein Testfehler. Die oben genannten fokussierten Import-, UI-, Adapter- und Providertests sind Teil dieser Gruppen und werden in der Summe nicht nochmals gezählt.

Typecheck, Portabilität und alle vier eingefrorenen Quellinventare wurden nach der letzten Testdatei nochmals lesend erfolgreich geprüft. Die 17 bestehenden Arbeitsbereiche, Studio, bisherige Pause/Fortsetzung innerhalb derselben Sitzung, Backupvorschau und native Vertrags-/UI-Simulationen sind in den 112 Integrationstests enthalten. Das ist keine persistente Workflow-Recovery und keine physische Geräteprüfung.

Noch nicht ausgeführt: neun Collaboration-Git-Fixturetests, 17 Skill-Kerneltests sowie 16 schreibende Skill-Loadertests, zusammen 42 Tests. Sie erzeugen temporäre Dateien und benötigen den noch blockierten offiziellen Schreibprozessstart. Damit bleiben die vollständigen 589 Tests, die parallele Standardsuite und der vollständige `verify:serial`-Befehl als Gesamtfreigabe offen. Es wurden keine fehlgeschlagenen Assertions ausgeblendet; die Auslassung erfolgte vor Ausführung ausschließlich wegen der belegten Dateischreibanforderung.

Die vollständigen neuen Gruppenlogs liegen unter `reports/import-reconstructed-0.5.1/readonly_*.log` und `readonly-integration-112.log`. Das einzelne Wiederherstellungsdokument enthält zusätzlich die Prüfkommandos und Ergebniszusammenfassung; die Runtime-Patchdateien sind unverändert.

## Abgegrenzter Parser-Folgepatch, 08:53–08:56 UTC

Ein zusätzlicher reproduzierter Befund betraf mehrdeutige JSON-Objektschlüssel: `{"schemaVersion":99,"schemaVersion":4,...}` wurde bislang durch die native Last-Key-Wins-Auswahl als Version 4 angenommen. Dies ist eine belegte Parser-Mehrdeutigkeit, keine Behauptung einer weitergehenden ausgenutzten Sicherheitslücke.

Der minimale Folgepatch in `src/legacy-import.ts` behält die native JSON-Syntaxprüfung bei und prüft anschließend iterativ jeden dekodierten Objektschlüssel auf Eindeutigkeit innerhalb genau dieses Objekts. Doppelte und escaped-äquivalente Schlüssel werden vollständig vor der Planung abgewiesen. Gültige eindeutige V1–V4-Dateien bleiben unverändert akzeptiert. Textwerte mit schlüsselähnlichem Inhalt und gleiche Namen in unterschiedlichen Objekten werden nicht fälschlich zurückgewiesen. Keine zusätzliche Größen- oder Verschachtelungsgrenze und keine Änderung an Upstream oder Vendorcode.

Tests-first-Nachweis: zehn neue Fälle in `tests/legacy-import-json.test.ts`; vor dem Patch sieben erwartete Fehler, drei gültige Kontrollen bestanden. Nach dem Patch alle zehn grün. Der fokussierte Lauf einschließlich bestehender Import-/Adapter-/CAS-Regressionen bestand mit 42/42 und anschließendem Typecheck.

Nach der letzten Produktionsänderung wurden sämtliche bereits als lesend ausführbar identifizierten Gruppen **erneut** in einem geordneten seriellen Gesamtlauf geprüft: **557/557 Tests plus 18 Renderer-Simulationen bestanden**, alle Prozesse Exit 0. Disjunkte Gruppenzahlen: 189 Basis, 13 Collaboration, 112 Integration, 19 Reviewer, 184 Vendor, 3 Loader, 30 Level, 7 V7. Abschließend Typecheck, Portabilität und alle vier unveränderten Quellinventare erneut bestanden. Protokoll: `reports/import-reconstructed-0.5.1/parser-final-readonly.log`.

Die unverändert 42 dateischreibenden Fixturetests bleiben offen; damit sind für die vollständige Suite jetzt 599 Tests vorgesehen. Parallele Standardsuite, kompletter `verify:serial`-Befehl, frischer Webbuild **nach** diesem Parserpatch, Capacitor-Sync, Android-Tests/Lint/APK und Geräteabnahme sind noch nicht abgeschlossen. `dist/` und `docs/build-manifest.json` gehören weiterhin zur vorangehenden wiederhergestellten Basis; sie sind kein Buildnachweis des Parserpatches. Vor einer Laufzeitauslieferung zwingend frisch bauen und alle Assets prüfen.

Dieser Folgepatch schließt den Import-Zwischenstand ab. Weitere optionale Härtungen sind nicht Bestandteil dieser Änderung; als Nächstes folgt die Wiederherstellung der bereits beauftragten Workflow-Wiederaufnahme.

## Noch offen und ausdrücklich nicht behauptet

- Die vollständige parallele Standardsuite und `verify:serial` sind für diesen wiederhergestellten Stand **noch nicht abgeschlossen**. Ein späterer Start der Basistests brach vor dem Prozessstart mit einem Infrastruktur-/Mountfehler ab. Die gezielten grünen Prüfungen sind keine vollständige Freigabe.
- Der Cloudbrowser konnte die gestartete lokale Vorschau nicht öffnen: `ERR_BLOCKED_BY_CLIENT`; anschließend ausdrückliche Ablehnung durch die Browser-URL-Sicherheitsrichtlinie. Es wurde kein anderer Host oder Protokollweg zur Umgehung verwendet. Daher kein echter Screenshot der laufenden Importansicht und keine visuelle Browserabnahme.
- Kein neuer Android-SDK-Aufbau, kein nativer Gesamttest, kein Lintlauf, kein neuer APK-Build und keine Signierung in dieser Wiederherstellungsphase.
- Keine physische Samsung-S25-/Android-/Dateidialog-/GPU-/Kamera-AR-Abnahme. DOM- und IndexedDB-Simulationen ersetzen diese nicht.
- Der bekannte große Three.js-Buildchunk erzeugt weiterhin eine Größenwarnung. Es wurde weder eine Warnschwelle noch eine Testgrenze zur Beschönigung angepasst.
- Ältere im Originalarchiv enthaltene Android- und Webprotokolle bleiben historische Belege ihrer jeweiligen Version.

## Fortsetzung

Zuerst diesen Zwischenstand privat sichern. Danach Standardsuite und serielle Gesamtsuite frisch ausführen, Workflow-Wiederaufnahme wiederherstellen und erneut prüfen. Vor jedem nativen Build: frischer Webbuild, Capacitor-Sync und Prüfung aller eingebetteten Webdateien. Ein installierbarer Next-Teststand benötigt anschließend eigene native Prüfungen, Manifest-/App-ID-Kontrollen sowie neue Signatur- und Alignmentnachweise. Temporäre Cloudspeicherung ist keine dauerhafte Sicherung eines privaten Signierschlüssels.
