# Dokumentation

Die Dokumentation trennt vier Ebenen: **vorhandene Quelle**, **gezielt geprüfte Kandidaten**, **geplante Erweiterung** und **tatsächlich ausgeliefertes Artefakt**. Ein Dateiname, Testbericht oder Buildplan hebt diese Trennung nicht auf.

## Produkt und Architektur

- [01 Produktziel und Umfang](01-product.md)
- [02 Bestehende Architektur](02-current-architecture.md)
- [03 Verifizierte Ordnerstruktur und Modulrollen](03-source-tree.md)
- [04 Datenmodell und Persistenz](04-data-model.md)
- [05 Datenflüsse und Vertrauensgrenzen](05-data-flows.md)
- [06 UI und 17 Arbeitsbereiche](06-ui-navigation.md)
- [07 2D, 3D, AR und Lernen](07-visualization-learning.md)
- [08 Skills, Workflows und Recovery](08-skills-workflows.md)
- [09 Import, Backup und Restore](09-import-backup-restore.md)
- [10 Konfiguration, Berechtigungen und Secrets](10-configuration-security.md)

## Entwicklung und Weiterentwicklung

- [11 Entwicklung und Teststrategie](11-development-testing.md)
- [12 Build, Signierung und Auslieferung](12-build-signing-release.md)
- [13 Migration und Wiederherstellung](13-migration.md)
- [14 Geplante Zielstruktur](14-target-structure.md)
- [15 Arbeitspakete und Reihenfolge](15-roadmap.md)
- [16 Anforderungen und Abnahmematrix](16-acceptance-matrix.md)
- [17 Status, Evidenz und Blocker](17-status-evidence.md)
- [18 Architekturentscheidungen](18-decisions.md)
- [19 Glossar](19-glossary.md)
- [20 Power-User- und Profi-Methodik](20-power-user-method.md)
- [21 README-Design und Grafiksystem](21-readme-design.md)
- [22 Code-Health, Matrix und Innovationen](22-code-health-matrix.md)
- [Eigene Konzeptgrafiken](assets/README.md)

## Referenz

- [Quellen- und Evidenzregister](reference/evidence-register.md)
- [Dateiinventar des finalen Quellkandidaten](reference/source-inventory.md)
- [Beitragshinweise](../CONTRIBUTING.md)
- [Sicherheitsgrenzen](../SECURITY.md)
- [Änderungsprotokoll](../CHANGELOG.md)

## Wie Quellenpfade zu lesen sind

`src/local-adapter.ts` bezeichnet einen Pfad **innerhalb des separat verwahrten App-Quellpakets**, nicht eine fehlende Datei dieses Dokumentationsrepositories. Solche Pfade stehen als Code, nicht als irreführende Repositorylinks. Relative Markdownlinks führen ausschließlich zu hier vorhandener Dokumentation.

Das vollständige Inventar bezeichnet den exakten finalen Kandidaten aus Original, Import V2, Recovery, Next, Quality, Diagnose und Branding. Es wurde im RAM rekonstruiert. Der beschreibende Hauptbaum wurde zusätzlich direkt an der lesbaren Importbasis geprüft; Nachtragspfade sind ausdrücklich gekennzeichnet. Alle vorgeschlagenen neuen Pfade sind als **geplant, nicht implementiert** gekennzeichnet.

## Statuswörter

| Begriff | Bedeutung |
| --- | --- |
| Bestand | In der genannten Quelle vorhanden; aktuelle Laufzeitfreigabe folgt daraus nicht |
| Historische Prüfung | Für einen früheren, ausdrücklich benannten Stand ausgeführt |
| Geprüfter Kandidat | Exakte Kandidatenbytes mit bezeichnetem gezieltem Testumfang geprüft |
| Geplant | Gewünschter Ausbau, noch nicht implementiert oder abgenommen |
| Blockiert | Notwendiger Schritt kann mit der aktuellen Umgebung nicht ausgeführt werden |
| Ausgeliefert | Konkretes Artefakt mit Herkunft, Signatur und tatsächlich geprüftem Lieferumfang |

Stand dieser Dokumentationssammlung: 4. Oktober 2026. [Zurück zum Repository](../README.md)
