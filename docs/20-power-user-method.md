# Power-User- und Profi-Methodik

LowQuantFlow soll anspruchsvolle Arbeit verständlich und überprüfbar machen. Eine eindrucksvolle Oberfläche unterstützt Orientierung und Rückmeldung; Belege, kontrollierte Datenänderungen und klare Rechte bleiben die Grundlage.

## Acht Schritte für jede Änderung

| Schritt | LowQuantFlow-spezifische Leitfrage | Verbindliches Ergebnis |
| --- | --- | --- |
| 1 Idee | Welcher konkrete Werkstattweg wird besser? | Problem, Nutzerweg, Erfolgskriterium; Konzept/Experiment/Implementierung trennen |
| 2 Evidenz | Was belegt die Lücke in diesem Stand? | Datei-/Hash-/Commitbezug, Reproduktion oder Messung, betroffene Plattform |
| 3 Entscheidung | Reicht ein vorhandener Baustein oder Nichtändern? | Kleinste tragfähige Lösung, Alternative, Kosten/Lizenz/Risiko, Abbruchkriterium |
| 4 Kleiner Patch | Bleibt der Zweck zusammenhängend? | Begrenzter Diff, vorhandener Stack/Runner/Renderer erhalten |
| 5 Prüfung | Welche Aussage ist wirklich nachgewiesen? | Reproduzierbarer Befehl, Ergebnis, Umgebung, Stand; offene Gates getrennt |
| 6 Review | Stimmen Wirkung, Nachweis und sichtbare Aussage? | Unabhängige Prüfung von Diff, Annahmen, Daten/Rechten, UX und Rückweg |
| 7 Auslieferung | Ist der bezeichnete Umfang tatsächlich freigegeben? | Artefakt/Hash, passende Gates, Changelog und bekannte Grenzen |
| 8 Rücknahme | Wie kommen Code und Daten sicher zurück? | Revert-/Featureflag-/Migrations-/Restoreplan vor Veröffentlichung |

## App-spezifische Entscheidungskriterien

- Gemeinsamen WorkState und bestehenden lokalen Transport statt paralleler Fachzustände verwenden
- Review an gespeicherten Inhalt und Revision binden
- Vorhandene Importgrenzen und CAS nicht für bequemere Demos abschwächen
- Projektisolation vor projektübergreifender Suche oder Kontextpaketexport
- Deterministische Wirkungsanalyse vor unbelegten „intelligenten“ Aussagen
- Shadow ohne operative Writes; Simulation nie als Ausführung etikettieren
- Ein Runner mit Scope/Budget/Stop, kein impliziter Hintergrundagent
- Begleiter in derselben Three-Instanz; 2D und Energiesparen behalten
- Bereinigte Präsentation über feste erlaubte Felder
- Optionales Video-Studio ohne still aktivierten Anbieter

## Toolstack bewusst wählen

| Aufgabe | Vorhandenes Werkzeug zuerst | Neues Werkzeug erst wenn |
| --- | --- | --- |
| UI | React 19.2.6, bestehende Komponenten und Overlays | Reale Lücke nicht sinnvoll im vorhandenen System lösbar |
| Typen/Verträge | TypeScript, Zod, bestehende Domainverträge | Konkreter zusätzlicher Vertrag belegbar nötig |
| Build | Gepinntes Vite/npm-Lockfile | Messbare funktionale/qualitative Verbesserung samt kompatiblem Rückweg |
| Native App | Capacitor und vorhandener Androidhost | Bestehende Plattformgrenze nachweislich unzureichend |
| Daten | IndexedDB, CAS, bestehende Speicher | Migration, Sicherung und Mehrwert vorher nachgewiesen |
| Visualisierung | SVG, Three, bestehender Graph/Inspector | Keine zweite Engine nur für einen neuen Effekt |
| Tests | Node, happy-dom, fake-indexeddb, bestehende Suiten | Echte zusätzliche Browser-/Geräteabdeckung mit definiertem Zweck |
| Dokumentation | Markdown, Mermaid, eigene SVG | Keine Build-/UI-Abhängigkeit nur für README-Dekoration |

Innovativ ist eine bessere belegte Arbeitsweise, nicht die Zahl eingebauter Bibliotheken. Kandidaten vor Aufnahme auf Wartung, Lizenz, Kompatibilität, Angriffsfläche, Bundlekosten und Exitpfad prüfen.

## Tests und Messung

Regressionen zuerst reproduzieren. Code und generierten Output zusammen testen. Datenspeicherfälle umfassen Reload, Konkurrenz, Migration, Abbruch und unbekannten Ausgang. Native Abnahme prüft Offline, Permission Denial, Unsupported AR, Lifecycle und Dateidialoge.

Eine gezielte Suite mit 264 Fällen sagt nicht „alles grün“. Ein Browsererfolg belegt keine native Kamera-AR. Performancebaseline nennt finalen Build, Dataset, Browser/WebView und Gerät. Keine Warnschwelle zum Bestehen hochsetzen.

## Vorschlag für spätere Repositoryautomation

**Geplant, nicht installiert:** eine kleine reine Dokumentationsprüfung für relative Links, Markdown und SVG-Herkunft. Ihr Badge dürfte nur diese Prüfung benennen.

Eine spätere App-CI braucht einen separaten Auftrag und echte Source. Vollständige SHA-Pins für fremde Actions, minimale Jobrechte, standardmäßig contents:read, keine Secrets in Fork-PRs und kein unsicherer Checkout fremden Codes in privilegierten pull_request_target-Läufen. Hier wurden keine Workflows angelegt.

Gepinnte npm-Installation erfolgt mit npm ci; ein Lockfilewechsel wird begründet und geprüft. Keine pauschalen Reparatur- oder Upgradebefehle als Ersatz für Ursachenanalyse.

## Primärquellen

- [npm ci und Lockfile-Verhalten](https://docs.npmjs.com/cli/v11/commands/npm-ci/)
- [Capacitor-Entwicklungsablauf](https://capacitorjs.com/docs/basics/workflow)
- [GitHub Actions sicher verwenden](https://docs.github.com/en/actions/reference/security/secure-use)
- [GitHub-Statusbadges](https://docs.github.com/en/actions/how-tos/monitor-workflows/add-a-status-badge)
- [Playwright-Geräte-/Bewegungsemulation](https://playwright.dev/docs/emulation)

Diese Quellen erklären Werkzeuge und Gestaltungsregeln; sie sind keine Tests der LowQuantFlow-App.

[Beitragen](../CONTRIBUTING.md) · [Entscheidungen](18-decisions.md)
