# Produktziel und Umfang

## Wofür LowQuantFlow entsteht

LowQuantFlow ist eine persönliche Entwicklungswerkstatt. Aus einer Idee soll ein abgegrenzter, prüfbarer Auftrag werden: Ziel und Nicht-Ziele festhalten, Quellen zuordnen, Auswirkungen verstehen, Varianten vergleichen, den nächsten sicheren Schritt wählen, Ergebnisse prüfen und bestätigte Entscheidungen für das richtige Projekt erhalten.

Die bestehende App bildet bereits lokale Missionen, Aufgaben, Räume, Quellen, Freigabekarten, Lernfortschritt und grafische Beziehungen ab. Der Ausbau verbindet diese Grundlagen, statt eine zweite Projektverwaltung oder einen zweiten Runner einzuführen.

## Durchgehender Arbeitsweg

1. **Idee und Konstruktion:** Projekt, gewünschtes Ergebnis, Eingaben, Grenzen, Schritte und Abnahmekriterien erfassen
2. **Wirkungsanalyse:** direkte und transitive Auswirkungen aus tatsächlich bekannten Beziehungen ableiten; Unbekanntes kennzeichnen
3. **Varianten und Entscheidung:** Alternativen mit denselben Kriterien und nachvollziehbaren Annahmen vergleichen
4. **Shadow-Prüfung:** Folgen auf einer getrennten Zustandskopie vorführen; keine operative Änderung
5. **Begrenzte Ausführung:** bewusst gestartete lokale Abläufe mit Scope, Budget, Pause und Stop
6. **Review:** Befund, Beleg und geprüfte Revision zusammenführen
7. **Projektgedächtnis:** bestätigte Entscheidungen und Herkunft projektgebunden erhalten
8. **Präsentation:** ausdrücklich zugelassene Ergebnisse bereinigt darstellen oder exportieren

Die Schritte 1–8 sind das Zielbild. Vorhandene Teilfunktionen und neue Anforderungen werden in der [Abnahmematrix](16-acceptance-matrix.md) getrennt geführt.

## Erhaltener Bestand

- 17 vorhandene Arbeitsbereiche, Studio und gemeinsame Navigation
- Vier konfigurierbare lokale Arbeitsprofile; Profilnamen sind keine live verbundenen Agenten
- Mission Map, Timeline, Command Palette und Missionräume
- Lokale Datenhaltung, vorhandene Importregeln und explizite Konfliktbehandlung
- Gemeinsamer Graph für 2D und 3D, optionale AR-Pfade und Lernfunktionen
- Vier begrenzte deterministische Offline-Skills
- Portable Backupausgabe und prüfende Vorschau

## Sechs neue Werkstattmodi

| Geplanter Modus | Aufgabe |
| --- | --- |
| Ideen und Konstruktion | Auftrag formulieren und Wirkung verstehen |
| Entwicklungsbegleitung | Zustand, Blocker, nächsten sicheren Schritt und Reviewbedarf erklären |
| Video-Studio | Separater optionaler Medienarbeitsbereich |
| Begrenzter Autopilot | Bewusst gestartete, klar begrenzte Prüfpläne |
| Diagnose | Lokale, bereinigte Zustands- und Evidenzsicht |
| Bereinigte Präsentation | Ergebnisansicht ohne technische oder private Nebeninhalte |

Diese Modi ersetzen nicht die bestehenden Profilwerte FAST, DEEP, RESEARCH COUNCIL, DEV LOOP, BUILD und OPS. Die drei geplanten Layouts **mobiler Fokus**, **technische Werkbank** und **Ausgabestudio** ordnen denselben Zustand unterschiedlich an.

## Optionale Module

**3D-Begleiter:** Funktionaler, abschaltbarer Actor im vorhandenen Three-Viewport. Reale Objekt- und Laufzustände dürfen Hinweise und Animationen auslösen. Kein zweiter Renderer, kein Berechtigungsgeber, kein automatischer AR-Start. Assetrechte, GLB-Inventar, Animationen und Geräteverbrauch sind vor Integration zu prüfen.

**Video-Studio:** Zunächst lokales Storyboard und Shotplan mit klarer Projekt-/Medienzuordnung. Externe Generierung oder Rendering benötigen später einen ausgewählten, ausdrücklich autorisierten Anbieter und eine Kostenentscheidung. Kein Anbieter ist durch diese Dokumentation aktiviert.

## Bewusste Grenzen

Die App ist derzeit keine aktive Cloud-/MCP-Zentrale und kein universeller Agent. Lokale Freigabekarten führen externe Aktionen nicht aus. Eine lokale Diagnose meldet keine live erreichbare Verbindung ohne entsprechende Evidenz. Ein Backup ist keine Vollwiederherstellung; ein historisches Ergebnis ist keine Fortsetzungsberechtigung.

Kostenlos zuerst; Gesamtbudget höchstens **15 USD**. Dies ist ein Planungsrahmen und keine pauschale Kauf-, Login-, Datenübertragungs- oder Providerfreigabe. Die erste neue Kern-APK ist eine Zwischenlieferung, nicht der Abschluss sämtlicher Erweiterungen.

[Architektur](02-current-architecture.md) · [Arbeitspakete](15-roadmap.md)
