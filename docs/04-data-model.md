# Datenmodell und Persistenz

## Gemeinsamer WorkState

Primärvertrag: `upstream/lib/work-contract.ts`. Der gespeicherte Vertrag normalisiert unterstützte ältere Zustände auf **stateVersion 4**. Die lokale Hülle benutzt **formatVersion 1**, die IndexedDB-Datenbankversion ist **1**. Diese Nummern haben unterschiedliche Bedeutungen und dürfen nicht zusammengelegt werden.

| Feld | Inhalt und Beleg |
| --- | --- |
| stateVersion | Fachliche Version des Arbeitszustands |
| command | Missionen, Freigaben, Ereignisse, Interaktionen; command-contract.ts |
| checks | Bekannte Prüfmarker |
| notes | Lokale Notizen mit ID und Zeit |
| settings | Oberfläche, Startansicht, Widgets, Bewegung, Energiesparen, Chat-/Neurovorgaben |
| profiles | Vier lokale Arbeitsprofile mit Rolle, Anweisungen, Modus, Ausgabe und Ressourcen |
| rooms | Projekt-/Agenten-/Quellenbezug, Ziel, Ausgabe, Status und Nachrichten |
| tasks | Aufgabenmatrix mit Priorität, Zuständigkeit, Abhängigkeiten, Belegen und Review |
| learning | Gespeicherte Lernstände |
| updatedAt | Gespeicherte Revision; bei leerem Stand null |

Schreibverträge verlangen `expectedUpdatedAt`. Der bestehende Stand wird innerhalb derselben Transaktion mit der erwarteten Revision verglichen. Die neue Revision bleibt monoton, auch wenn die Gerätezeit hinter dem letzten gespeicherten Zeitpunkt liegt. Fachzeit und Revisionszeit werden nicht gleichgesetzt.

## Aufgaben, Missionen und Freigaben

**Aufgabe:** ID, Titel, Kategorie, P0/P1/P2, Profil-Owner, Status, Abnahmekriterium, Beleg, reviewed, Abhängigkeiten und archiviert. Der bestehende Matrixvertrag begrenzt den Bestand auf 60 Aufgaben und die Abhängigkeiten einer Aufgabe auf 12.

Aufgabenstatus: Offen → In Arbeit / Blockiert → Review → Erledigt, entsprechend den tatsächlichen Domainregeln. Statusbezeichnungen allein erlauben keine beliebige Transition.

**Mission:** Der eigene command-Vertrag verwaltet Ziel, Zuständigkeit, Scope und Abschlussbezug. Stufen sind Created, Planned, Assigned, Working, Waiting, Blocked, Review, Approved, Done und Error. Die erlaubten Übergänge stehen in `stageTransitions`; ein Zielstatus ersetzt keine Abnahme.

**Freigabe:** Anfrage und Entscheidung mit konkretem Inhalt und zeitlichen Grenzen. Der lokale Vertrag enthält `executed:false`. Eine positive Entscheidung bedeutet nicht, dass eine externe Aktion stattgefunden hat.

**Quality-Regel R2:** Änderungen an reviewrelevantem Inhalt machen einen neuen bewussten Review erforderlich. Die lokale PUT-Route weist ein mitgeführtes altes Review atomar zurück. Auch transitive Voraussetzungen werden geprüft. Es gibt keine automatische Reviewkaskade.

## Räume und Profile

Räume besitzen Projektbezug, Quellen, Ziel, gewünschte Ausgabe, Profil, Modus, Status und begrenzte Nachrichten. Bestehende Projektwerte sind paz, make, cue, hermes und custom. Diese historische Aufzählung ist kein bereits allgemeines Projektgedächtnis.

Profil-IDs: zimt, manus, junior und codex. Mode-IDs: FAST, DEEP, RESEARCH COUNCIL, DEV LOOP, BUILD und OPS. Die sichtbaren Labels und Profilanweisungen sind lokale Konfiguration. `externalWrite:'approval'` ist eine Grenze, keine eingerichtete Remoteverbindung.

## Lokale Speicher

| Speicher | Rolle | Schutz |
| --- | --- | --- |
| WorkStore | IndexedDB `cue-command-mesh-local`, Store `work`, Schlüssel `local-default` | Strikte Hülle, Schema, Referenzen, CAS, Schreibbudget |
| PreferencesStore | Studio-/Graph-/Workflowoptionen und historischer Verlauf | Ganzzahlig steigende Revision; Änderungen über CAS |
| WorkflowJournalStore | Recovery-Kandidat für lokale Fortsetzung | Validiertes Journal, Reservation, bestätigter Commit, Readback und Locks |
| Alte Studio-localStorage-Daten | Kompatibilitätseingang bei leerer neuer Preferences-Datenbank | Einmaliges Lesen, ursprüngliche Daten bleiben unverändert |

Beschädigte Daten werden nicht still durch Defaults überschrieben. Nicht verfügbare Speicherung sperrt neue Mutationen. Nach unklarem Speicherausgang wird nicht blind erneut geschrieben.

## Studiozustand und Ergebnisverlauf

`cue.system-state/v1` umfasst Graphkonfiguration, surfaceLayout stack/split/focus, Skillwahl, pauseAfterStep und höchstens 20 historische Ergebnisse. Ein Ergebnis führt ID, Zeit, Zustand, Quellrevision, Zahl bestätigter Schritte und begrenzte Outputs. Der Vertrag enthält ausdrücklich `historyPolicy:'historical-only-no-resume'`.

Dieser Verlauf bleibt vom operativen Recoveryjournal getrennt. Ein importiertes historisches Ergebnis erteilt keine neue Ausführungsbefugnis.

## Quellenkatalog

Der tatsächliche Katalog ist ein vollständiges Mesh-JSON mit zwölf Rootfeldern: schemaVersion, updatedAt, title, provenance, agents, integrations, make, pilot, sources, timeline, addonCounts und addons.

Quality R4 validiert insbesondere eindeutige, nichtleere Quellen-IDs und bekannte beschreibende Feldtypen, ohne die Hülle auf sources-only zu kürzen. Typ- und Referenzprüfung beweisen weder die Wahrheit noch die Aktualität von Beschreibungen.

## Geplante Erweiterung

MEM-01 benötigt einen versionierten projektgebundenen Vertrag für Herkunft, Revision, Gültigkeit und Entscheidungsstatus. Aufgaben und Notizen sind heute nicht vollständig projektisoliert. Eine neue Projektzuordnung darf bestehende Inhalte nicht still einem Projekt zuschlagen.

Erst Vertrag, Migration, Isolationstests und Exportregeln festlegen; keine neue Persistenz nur wegen eines zusätzlichen Panels.

[Datenflüsse](05-data-flows.md) · [Migration](13-migration.md)
