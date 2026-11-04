# Import, Backup und Restore

## Drei getrennte Funktionen

| Funktion | Heute belegter Umfang | Keine Zusage |
| --- | --- | --- |
| Legacy-Snapshotimport | Vorschau und bestätigter Merge von V1–V4-Arbeitsdaten | Kein vollständiger Ersatz sämtlicher Appspeicher |
| Systembackup | Export von WorkState, Quellenkatalog, Studiooptionen und historischem Ergebnisverlauf | Keine Cloud-Synchronisation |
| Backupvorschau | Hülle, Integrität, unterstützte Schemata/Referenzen und Unterschiede prüfen | Kein produktiver Vollrestore; restoreAvailable bleibt false |

## Legacy-Importvertrag

Quellen: `src/legacy-import.ts`, `src/local-adapter.ts`, `src/LegacyImportPanel.tsx`, `upstream/lib/work-snapshots.ts`.

1. Die Eingangsdatei ist höchstens **3 MiB = 3.145.728 Byte** groß
2. JSON wird auf doppelte und gleich dekodierte Objektschlüssel geprüft; Last-key-wins wird nicht still akzeptiert
3. Unterstützte Snapshotversionen werden vollständig decodiert und ihre Quellenreferenzen validiert
4. Ein deterministischer Plan erzeugt den tatsächlichen transformierten Zielbestand
5. Das Zielbudget ist **1.750.000 UTF-8-Byte**; Zeichenanzahl ist nicht Byteanzahl
6. Die Vorschau zeigt neue/erhaltene Räume, importierte/übersprungene Beiträge, Duplikate, Notizen, Aufgaben, Marker, Lernstände und ignorierte historische Ereignisse
7. Erst die ausdrückliche Einmalbestätigung darf schreiben
8. Der Commit prüft erwartete Revision **und** Ausgangsinhalt in derselben Transaktion

Bei veraltetem Plan, abgelaufener maßgeblicher Freigabe, Größenüberschreitung oder ungültiger Referenz bleibt der Altbestand erhalten. Zwei konkurrierende Pläne dürfen nicht beide denselben Ausgangsstand überschreiben. Importierte Missionen/Freigaben werden nicht als bereits aktuell abgenommen ausgegeben.

## Systembackup

`src/backup-adapter.ts` verwendet `vendor/portable-kit/backup.mjs`. Die bestehende Backuphülle trägt Producer, Quellrevision, Arbeitsrevision, Exportzeit und Integritätsdaten. Das Limit ist **8 MiB**. Der native Textdateidienst besitzt ebenfalls ein 8-MiB-Exportlimit.

Der vollständige Quellenkatalog wird erhalten. Quality R4 prüft eingehende Backups gegen ihren eigenen Katalog und den Zielbestand gegen dessen Katalog. Ein älterer legitimer Katalog muss nicht bytegleich zum aktuellen sein. Ungültige Referenzen bleiben auch bei korrektem Hash ein Fehler.

Eine korrigierte lokale Uhr kann zu einer logisch angepassten Exportzeit führen; observedWallTime, logicalExportTime und die ausdrücklich bezeichnete monotone Zeitpolitik dokumentieren dies. Ein Zeitstempel ist weder Live-Nachweis noch Signatur.

## Integrität ist nicht Wahrheit

SHA-256 erkennt Änderungen an Bytes. Er beweist nicht, dass Beschreibungen wahr, Quellen aktuell, Anbieter erreichbar oder Reviewentscheidungen noch gültig sind. Zusätzliche Snapshotfelder erhalten keine pauschale semantische Bestätigung.

Die Oberfläche muss genau den tatsächlichen Prüfumfang benennen. „Vollständig geprüft“ ohne Angabe von Schema-, Referenz- und Wahrheitsgrenzen wäre irreführend.

## Datei speichern

`src/platform/files.ts` unterscheidet:

- **saved:** der unterstützte native/File-System-Write wurde abgeschlossen
- **cancelled:** Zielauswahl abgebrochen
- **dispatched:** Download an den Browser übergeben; Speicherung am Ziel nicht bestätigt

Nur ein laufender Export gleichzeitig. Namen, erlaubte MIME-Typen und UTF-8-Größe werden validiert. Nach einem Fehler kann eine partielle Zieldatei verbleiben. Android verwendet einen bewussten Dateidialog und keine breite Storageberechtigung.

## Geplanter isolierter Restore

DAT-02 ergänzt zuerst eine **isolierte Wiederherstellungsprobe**: separate Testspeicher, vollständig rückgelesene Felder, erneutes Öffnen und unveränderte Produktionsdaten. Ein produktiver Vollrestore benötigt zusätzlich eine eigene Unterbrechungs-/Rollbackstrategie über WorkState, Preferences und Journal.

Ein Code-Revert ist kein Speicherschema-Downgrade. Backups und historische Ergebnisse dürfen keine fremde Resume-Autorität einführen. Produktive Migration wird erst nach gesonderter Abnahme angeboten.

[Migration](13-migration.md) · [Datenmodell](04-data-model.md) · [Build und Sicherung](12-build-signing-release.md)
