# Lokale Workflow-Wiederaufnahme · rekonstruierter Quellkandidat

Dieser Nachtrag enthält die wiederhergestellte Implementierung der lokalen Workflow-Wiederaufnahme. Er ist aus erhaltenen Textbelegen und gezielt neu ergänzten Regressionen zusammengesetzt. Bytegleichheit mit dem verlorenen ursprünglichen 0.5.2-Paket ist nicht nachgewiesen. Frühere 664 erfolgreiche Tests und 18 Renderer-Prüfungen bleiben historische Ergebnisse.

## Bedienung und Grenzen

Die vier eingebauten Offline-Prüfungen mission-check, graph-explain, backup-plan und source-status rechnen deterministisch ohne externe Änderungen. Nach erneutem Öffnen wird ein gespeicherter Lauf nur gelesen. Fortsetzung oder Stop erfordern eine ausdrückliche Auswahl. Unterbrochen, pausiert, gestoppt, fehlgeschlagen und abgeschlossen werden getrennt angezeigt; angeforderte Controls werden erst nach bestätigter Speicherung als Ergebnis ausgegeben.

Bestätigte Schritte werden nicht erneut ausgeführt. Eine unbestätigte reine Berechnung darf nach ausdrücklicher Fortsetzung wiederholt werden. Geänderte Quelldaten oder Skillversionen sperren Resume und führen zum bewussten Stop und Neuplanen. Es gibt keinen Android-Hintergrundservice, keine Cloudautonomie, keine externen Provider und keine neuen Credentials.

## Technischer Vertrag

Das getrennte IndexedDB-Journal cue-system-workflow-journal-v1 enthält einen aktuellen Lauf mit Schema cue.workflow-journal/v1, eindeutiger Laufkennung, Schrittkennungen, Quellfingerabdruck und bestätigt gespeicherten Ergebnissen. Revisions-CAS, Transaktionsabschluss, bestätigter Rückgabewert und Readback werden geprüft. Unbekannte oder beschädigte Daten werden nicht durch einen leeren Default ersetzt.

Exklusive Web Locks verhindern konkurrierende Ausführung. Ohne unterstützte Sperren bleibt Lesen möglich, Ausführung gesperrt. Persistiert werden Daten, keine ausführbare Autorität. Jeder verbleibende Schritt erhält frische Katalog-, Hash-, Toolbindungs- und echte lokale Selbsttests. Ein Schritt wird vor der Berechnung reserviert, sein bestätigtes Ergebnis vor dem nächsten Schritt gespeichert.

Pause und Stop bleiben auch bei verschachtelten asynchronen Rückgaben verbindlich. Stop darf Pause verstärken. Der Lock bleibt bis zur bestätigten abschließenden Schreibung gehalten. Höchstens acht Schritte und 1000 ms je ausdrücklicher Fortsetzung gelten weiter; kleinere gespeicherte Zeitlimits bleiben maßgeblich.

## Speicherhaltbarkeit

Die Implementierung verwendet IndexedDB-Transaktionen mit Standard-Durability und wartet auf deren Abschluss. Das ist keine absolute Zusage für Stromverlust, Betriebssystemabsturz, Speicherräumung, Privatmodus oder Deinstallation. Der optionale strict-Hinweis kann stärkere Persistenz anfordern, wurde in diesem erhaltenen Quellstand aber nicht nachträglich stillschweigend ergänzt. Konkretes Ziel-WebView-Verhalten ist separat zu prüfen. Quelle: [IndexedDB-Transaktions-Durability](https://w3c.github.io/IndexedDB/#transaction-durability).

Das Journal wird bewusst nicht als portable Resume-Berechtigung exportiert. Bestehender Verlauf bleibt historische Information. Vor Ersetzen eines terminalen Journals sichert die Oberfläche dessen Ergebnis im vorhandenen historischen Verlauf; ein Fehler blockiert den neuen Lauf. Preview und eine spätere Next-Installation haben getrennte Daten, ohne automatische Migration.

## Herkunft und erforderliche Verifikation

- Journal-Code und 24 Tests sowie UI-Code und 22 Tests stammen aus vollständig erhaltenen Erzeugungsblöcken und Nachpatches; historische Enddatei-Hashes fehlen
- Der zentrale Host kombiniert Zeilen 1–99 einer vollständigen älteren Aufnahme mit dem späteren finalen Ausschnitt; dies ist eine nachvollziehbare Rekonstruktion, kein bytegleich nachgewiesener Originalendstand
- 27 Host-Testfälle sind erhalten. Fünf Definitionen wurden aus Anforderungen und historischen Reproskripten neu ergänzt: echte Journalinstanzen/Dispose, verlorene Terminalantwort, CAS-Konflikt, verschachtelte Controls und präzise Quellzeitstempel
- Navigationstest-Harness und Backup-Producer-Regression wurden nachvollziehbar neu ergänzt; vorhandene Verhaltensassertionen und Limits bleiben erhalten

Die Laufzeitdateien wurden während der Dokumentvorbereitung nicht in die eingefrorene Importquelle geschrieben. Maßgeblich sind die konkret datierten Prüfungen im zugehörigen Wiederherstellungsbericht. Vollständige Standardsuite, serielle Gesamtsuite, Webbuild, Capacitor-Sync, native Tests und echte Geräteprüfung dürfen erst nach tatsächlichem Abschluss als bestanden gelten. Ältere dist-Dateien und Buildmanifeste sind keine neue Recovery-Webausgabe.
