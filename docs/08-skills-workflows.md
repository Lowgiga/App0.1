# Skills, Workflows und Recovery

## Vorhandene Bausteine

`vendor/skill-core/` definiert Manifeste, Ressourcen, Ein-/Ausgabeverträge, Loader, Host und Kernel. `vendor/local-workflows/` ergänzt den Browserkatalog und einen begrenzten Runner. `src/studio/workflow-host.ts` verbindet den lokalen Appzustand mit diesen Bausteinen.

Die vier vorhandenen Offlinefunktionen sind Missionsprüfung, Grapherklärung, Backupplanung und Quellenstatus. Die Studioauswahl heißt mission-check, graph-explain, backup-plan oder source-status; „all“ kombiniert die begrenzten lokalen Prüfungen. Das sind deterministische Handler, keine LLM-/Shell-/MCP-Ausführung.

## Paketvertrag

- Version und SHA-256 müssen zum konkreten Paket passen
- Manifest, Ressourcenpfade, deklarierte Dateien und Metadaten werden geprüft
- Doppelte JSON-Schlüssel, Traversal, fehlende oder zusätzliche Ressourcen werden abgelehnt
- Ein versiegelter Browserkatalog wird bei Initialisierung geprüft; Änderung benötigt einen neuen Katalog
- Inhaltliche Instruktionen sind Daten und keine Berechtigungsquelle
- Effektklassen unterscheiden lokale Berechnung, externes Lesen und externes Schreiben; der lokale Runner erlaubt nur die begrenzten lokalen Effekte

Hashintegrität beweist keine Herkunftsautorität. Der Host behält seine Grants und Schreibschnittstellen privat; importiertes JSON erhält darauf keinen Zugriff.

## Pipelinegrenzen

Vertrag: `cue.local-pipeline/v1`. Jeder Schritt enthält stepId, kind, skillId, version, versionHash und input. Kein beliebiger Ausdrucksinterpreter und keine freie Verkabelung von Resultaten zu neuen Befehlen.

Bestehende Limits:

| Grenze | Wert |
| --- | ---: |
| Schritte | 1–8 |
| Gemessene verstrichene Laufzeit einschließlich Speicherprüfung je ausdrücklicher Fortsetzung | höchstens 1000 ms |
| Input/Output pro Schritt | jeweils 128 KiB |
| Pipeline-/Checkpoint-JSON | 1 MiB |
| Studio-Ergebnisverlauf | höchstens 20 Einträge |

Kleinere gespeicherte Budgets bleiben verbindlich. Synchrone Handler, Stores oder Hostcallbacks sind nicht präemptiv unterbrechbar; Prüfungen an Grenzen sind keine harte Echtzeitgarantie. Es wird kein pauschales Fünf-Sekunden-Limit eingeführt.

## Erfolgs- und Stopsemantik

Ein Schritt ist erst erfolgreich, wenn sein Resultat validiert, atomar gespeichert und der vertragliche Commit bestätigt ist. Ereignisse enthalten begrenzte Statusmetadaten statt Rohinputs, Outputs, Grants oder Fehlerstacks.

Pause greift kooperativ an sicheren Grenzen. Abort und Budget werden vor/nach Handlern sowie um Hash-/Commitgrenzen geprüft. Ein bereits gespeichertes Resultat verschwindet bei später erkanntem Stop nicht; der Terminalzustand muss den beobachteten Stop ehrlich abbilden.

## Recovery-Kandidat 0.5.2

Neue Kandidatenbausteine:

- `src/studio/workflow-journal.ts`: validierter persistenter Speichervertrag
- `src/studio/durable-workflow-host.ts`: Reservation, Ausführung, bestätigter Commit und Readback
- `src/studio/workflow-runtime.ts`: gemeinsame Laufzeitbausteine für Memory-/Durable-Host
- überarbeitete Workflow-UI mit ausdrücklicher Fortsetzen-/Stopentscheidung

Reload liest das Journal und startet **nichts**. Bestätigte Schritte werden nicht erneut berechnet. Die Fortsetzung prüft aktuelle Quellen, Skillversion/-hash, Journalrevision und vorhandene exklusive Web Locks. Fehlende Locks, Drift, falsche ACKs oder abweichendes Readback blockieren.

Ergebnisverlauf und Backup bleiben historisch. Ein fremdes oder importiertes Journal darf keine Resume-Autorität liefern. Es gibt keine allgemeine Exactly-once-Zusage für externe Wirkungen und keine Android-Hintergrundausführung.

## Haltbarkeit und Abnahme

IndexedDB verwendet Standard-Durability. transaction.oncomplete, CAS und Locks sind keine absolute Garantie gegen Stromverlust, Betriebssystemabsturz, Speicherbereinigung oder Deinstallation. Echte Reload-/Mehrfachsitzungs-/WebView-/Prozessprüfungen bleiben offen.

Gezielte Recovery- und kombinierte Kandidatentests sind im [Statusnachweis](17-status-evidence.md) abgegrenzt. Historische 664 Tests dürfen nicht als frisch ausgeführte Recoveryprüfung erscheinen.

## Ausbau zum begrenzten Autopilot

AUT-01 erweitert diesen Runner um ausdrücklich gestartete Prüfpläne, sichtbaren Scope, Ressourcen, Stopbedingungen und Ergebnisbelege. Dafür werden kein zweiter Runner und keine neue implizite Außenwirkungsbefugnis eingeführt. Externe Ausführung bleibt ein eigener späterer Integrationsvertrag.

[Rechte](10-configuration-security.md) · [Datenflüsse](05-data-flows.md) · [Abnahmematrix](16-acceptance-matrix.md)
