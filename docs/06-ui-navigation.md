# UI und Navigation

## Verifizierte 17 Arbeitsbereiche

Quelle: `upstream/app/mesh-app.tsx` (nav) und `upstream/lib/work-constants.ts` (viewIds). Die folgenden IDs sind bestehende Daten-/Navigationsverträge.

| ID | Sichtbarer Bereich | Rolle und Quellbeleg |
| --- | --- | --- |
| overview | Übersicht | Gemeinsamer Zustand, Kennzahlen, Widgets, Team/Timeline; mesh-app.tsx |
| agents | Agenten | Vier lokale Arbeitsprofile und Kooperationsdarstellung; mesh-app.tsx, coordination-panel.tsx |
| missions | Missionszentrale | Ziele, Zuständigkeit, Schritte und Checkpoints; command-center.tsx |
| approvals | Freigaben | Inhaltlich gebundene Anfragen/Entscheidungen; command-center.tsx |
| activity | Aktivität | Akzeptierte lokale Änderungen und begrenzter Verlauf; command-center.tsx |
| intelligence | Fokus & Intelligence | Fokus, Fortschritt, Stabilität und konkrete Vorschläge; neuro-panel.tsx |
| help | Hilfe | Bedienung, Daten und Grenzen; help-panel.tsx |
| connections | Verbindungen | Werkzeug, Anmeldung, Profilbindung und Leseabruf getrennt; mesh-app.tsx |
| pilot | PAZ-Pilot | Vorhandene projektbezogene Plan-/Übergabefläche; mesh-app.tsx |
| make | Automationen | Vorhandenen Ablauf verstehen und Startwunsch vorbereiten; mesh-app.tsx |
| lab | Funktionslabor | Abläufe vergleichen und begrenzte Übergaben vorbereiten; mesh-app.tsx |
| addons | Add-on-Katalog | Historisch sichtbarer Werkzeug-/Skillbestand; mesh-app.tsx |
| evidence | Evidenz | Quellen, Dokumente, Snapshotimport und Export; mesh-app.tsx plus lokale Overlays |
| chats | Missionräume | Projekt, Ziel, ausgewählte Quellen und Rückmeldungen; workspace-panels.tsx |
| matrix | Aufgabenmatrix | Priorität, Abhängigkeiten, Belege und Review; workspace-panels.tsx |
| space | 3D & Lernen | Beziehungen, Raumansicht, AR-Hinweise, Lernaufgaben; mesh-space.tsx, spatial-levels.tsx |
| settings | Einstellungen | Dashboard, Profile und Chatstandards; workspace-panels.tsx |

Die genannten Paneldateien liegen unter `upstream/app/` beziehungsweise als explizit erzeugte Integration unter `overlay/`. Die Appstruktur ist kein Nachweis einer Live-Anbindung von Make, externen Agenten oder Kataloganbietern.

## Studio

`src/studio/Studio.tsx` ergänzt vier bestehende Studioflächen:

- Kombinierte Fläche: `AdaptivePanel.tsx`
- Graph · 2D / 3D: `GraphExplorer`, SVG/Three und Inspector
- Skills & Prüfprozesse: `WorkflowPanel.tsx`
- Backup & Vorschau: `BackupPanel.tsx`

Ein weiterer Einstieg führt zum bestehenden Bereich „3D & Lernen“. Der Diagnosekandidat ergänzt ein ausklappbares Panel „Diagnose und Verbindungen“. Es bleibt auch bei nicht geladenen oder gesperrten Studioeinstellungen erreichbar.

## Navigation und Erhalt von Entwürfen

Bestehende URLs verwenden `view`, `q` und `studio=1`. `system-navigation.ts` vermittelt zwischen Studio und vorhandenen Bereichen. Die Command Palette wird über Ctrl/Cmd+K geöffnet. Neue Modi dürfen keine parallele Auswahl- oder Historyverwaltung mit abweichenden Daten erzeugen.

Quality R1 bindet die Aktivität der Originalbereiche bis zu den Sheet-Portalen durch. Bei Studio-/Historywechsel dürfen versteckte Dialogcontrols nicht bedienbar bleiben; Entwürfe werden beim bloßen Moduswechsel erhalten. Explizites Schließen folgt weiter der vorgesehenen Aufräumregel.

**Offen:** native dialog-first Android-Zurücknavigation und Dirty-Draft-Verhalten sind nicht durch diesen Portalfix als fertig abgenommen. Reale Tastatur-/Touch-/Screenreader-/WebViewprüfung bleibt erforderlich.

## Zukünftige Darstellung

Die sechs Werkstattmodi und drei Layouts aus dem [Produktziel](01-product.md) werden additiv auf dieselben Objekte gesetzt. Alle 17 Bereiche müssen erreichbar bleiben. Der mobile Fokus, die technische Werkbank und das Ausgabestudio dürfen weder zusätzliche Runner noch duplizierte Fachzustände starten.

## Bedienabnahme

- 390-px-Ansicht, große Schrift und erreichbare Controls
- Sichtbarer Tastaturfokus, Dialogfokus und verständliche Statusansagen
- Versteckte/inaktive Flächen sind nicht interaktiv
- Modus-/Historywechsel erhält beabsichtigte Entwürfe und Auswahl
- Stop, Pause, Speichern und Fehlersituationen sind klar unterscheidbar
- Bewegung aus und Energiesparen haben Vorrang vor visuellen Effekten
- Jede Erfolgsmeldung entspricht einer tatsächlich bestätigten Aktion

[Visualisierung](07-visualization-learning.md) · [Qualität](11-development-testing.md)
