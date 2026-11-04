# Datenflüsse und Vertrauensgrenzen

## 1. Lesen und Anzeigen

```text
Gebündelter Quellenkatalog + lokaler IndexedDB-WorkState
  → validierender LocalWorkStore
  → WorkTransport / SharedWorkState
  → Arbeitsbereiche + Studio
  → Graphadapter → SVG / Three / gemeinsamer Inspector
```

Die Darstellung liest denselben Zustand. Eine Graphansicht oder ausgewählte Quelle löst keine externe Verbindung aus. Bei nicht sicher geladenem Zustand bleiben Aktionen, die aktuelle Daten voraussetzen, gesperrt.

## 2. Bewusste Änderung

```text
UI-Entwurf + erwartete Revision
  → lokaler /api/state PUT oder /api/actions POST
  → Schema + Domainregeln + Referenzen + Rechte-/Reviewgrenzen
  → readwrite-Transaktion / Vergleich mit aktuellem Stand
  → begrenzter Zielzustand
  → bestätigter Commit
  → gemeinsamer sichtbarer Zustand
```

Unbekannte Pfade, Methoden, Identitätsheader oder ungültige Eingaben werden kontrolliert abgelehnt. Die Pfadnamen sind ein lokales Protokoll und kein Beleg für HTTP-Serverbetrieb. Die App darf Erfolg erst nach dem vertraglich bestätigten Speichervorgang melden.

## 3. Legacy-Import

Dateiauswahl → 3-MiB-Eingangsgrenze → eindeutiges JSON → V1–V4-Decodierung → Referenzprüfung → deterministischer Merge/Transformation → exakter Zielbestand mit 1.750.000-Byte-Budget → Vorschau → ausdrückliche Einmalbestätigung → CAS gegen unveränderte Ausgangsrevision und Ausgangsinhalt.

Bei konkurrierender Änderung wird neu geplant. Ein Plan kann nicht nachträglich gegen einen anderen Stand „passend gemacht“ werden. Übernommene historische Daten erzeugen keine aktuelle Review- oder Ausführungsautorität.

## 4. Skill-/Workflowlauf

Bewusst gewählter Prüfplan → Paketversion und Hash → Hostprüfung aktueller Quellen/Fähigkeiten → Laufreservation → lokaler deterministischer Handler → Schema-/Budget-/Abbruchkontrolle → bestätigter Ergebniscommit → Statusereignis.

Recovery ergänzt einen persistenten Journalpfad mit exklusiven Web Locks und Readback. Reload liest den Zustand und startet nichts. Ein unklarer Schritt wird nicht durch gut gemeintes automatisches Replay zu einer behaupteten erfolgreichen Wirkung.

## 5. Backup und Dateiausgabe

WorkState + vollständiger Quellenkatalog + geprüfter Studiozustand → portable Hülle mit Integritätsdaten → Plattform-Dateidienst → Android-Zieldialog oder Browsermechanismus.

Die Rückrichtung ist aktuell **Prüfen und Vergleichen**, kein produktiver Vollrestore. Historische Ergebnisse bleiben dokumentarisch. Die Backuphülle enthält keine Freigabe zur Wiederaufnahme aus fremdem/importiertem Journal.

## 6. Lokale Diagnose

Bekannte lokale Statuswerte → feste Positivliste → begrenzte Metadaten/Zähler/Fehlerklassen → ausklappbares Panel und lokale JSON-Vorschau.

Kein Rohpayload, keine Notiz-/Aufgabentexte, keine URLs, Nutzerkennungen, Header, Credentials oder Stacks. Keine Netzwerkprobe, Telemetrie, neue Persistenz oder Exportfunktion. „Unbekannt“ ist ein gültiger Zustand und darf nicht zu „verbunden“ oder „kein Fehler“ umgedeutet werden.

## 7. Optionales AR

Geladener Graph + expliziter Scope → begrenzter Snapshot mit Inhaltsrevision → bewusster nativer Einstieg → ggf. Kamera-/AR-Dienst-Abfrage → ARCore-Ansicht → validierte Antwort.

Auswahl wird nur übernommen, wenn Snapshotrevision und Knotenmitgliedschaft noch stimmen. Ein Ergebnis eines alten Graphen wird verworfen. Öffnen von AR-Hinweisen ist kein Kamera-Start.

## Vertrauensmatrix

| Eingang | Darf enthalten | Darf nicht bewirken |
| --- | --- | --- |
| Quelle / importierter Text | Fachinhalt und Herkunftsangabe | Neue Rechte, Befehlsausführung oder ungeprüfte Verbindung |
| Skillpaket | Verifiziertes Manifest und begrenzte Ressourcen | Beliebigen Code, Shell, Netzwerk oder Installation |
| Prompt / Profil | Darstellungs- und Arbeitsvorgaben | Scope, Budget oder Freigaben eigenständig erweitern |
| Historischer Verlauf | Frühere Resultate und Zeitangaben | Live-Zustand oder Resume-Autorität |
| Freigabekarte | Konkrete Entscheidung über bezeichneten Inhalt | Unbezeichnete zusätzliche Aktionen |
| 3D-Begleiter | Abgeleitete Anzeigeereignisse | Rechte, Lernnachweise oder externe Aktionen |
| Diagnoseprojektion | Zugelassene Metadaten | Rohdaten-/Secretweitergabe |

[Skills](08-skills-workflows.md) · [Import/Backup](09-import-backup-restore.md) · [Sicherheit](10-configuration-security.md)
