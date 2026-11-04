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
- [25 Arbeitslos K1/K2: Kontextberatung und Projektfortsetzung](25-context-continuation-work-package.md)
- [26 Geprüfter K1-Nachweis](26-k1-continuation.md)
- [27 Gebündelter Produktkontext und konkrete Änderungsvorschau](27-product-continuation-context.md)
- [28 Ergebnis wiederfinden, bestätigen und fortsetzen — K3](28-memory-result-continuation.md)
- [29 Gemeinsame K3-Quality-Adoption und Publishernachweis](29-k3-quality-adoption.md)
- [18 Architekturentscheidungen](18-decisions.md)
- [19 Glossar](19-glossary.md)
- [20 Power-User- und Profi-Methodik](20-power-user-method.md)
- [21 README-Design und Grafiksystem](21-readme-design.md)
- [Eigene Konzeptgrafiken](assets/README.md)

## Referenz

- [Quellen- und Evidenzregister](reference/evidence-register.md)
- [Dateiinventar des finalen Quellkandidaten](reference/source-inventory.md)
- [Beitragshinweise](../CONTRIBUTING.md)
- [Sicherheitsgrenzen](../SECURITY.md)
- [Änderungsprotokoll](../CHANGELOG.md)

## Wie Quellenpfade zu lesen sind

Die Appquelle liegt jetzt unter `app/`. Aktuelle Abdeckungs- und Arbeitslosseiten verlinken konkrete Repositorydateien, beispielsweise [LocalWorkStore](../app/src/local-adapter.ts). Ein verkürzter Pfad `src/...` in älteren Appdokumenten ist relativ zu `app/` zu lesen. Vorgeschlagene Dateien sind ausdrücklich geplant.

Historische Inventare/Einzelpaketberichte beschreiben ihre damaligen Stände. Beispielsweise nennen frühe Config-/Mobile-Dokumente die Assistantoberfläche bzw. persistente Drafts noch unimplementiert; die aktuelle integrierte Abdeckung steht in [16](16-acceptance-matrix.md), ihre exakte Quelle in [17](17-status-evidence.md#aktueller-geprüfter-stand). Keine historischen Belege rückwirkend umschreiben.

## Statuswörter

| Begriff | Bedeutung |
| --- | --- |
| Bestand | In der genannten Quelle vorhanden; aktuelle Laufzeitfreigabe folgt daraus nicht |
| Historische Prüfung | Für einen früheren, ausdrücklich benannten Stand ausgeführt |
| Geprüfter Kandidat | Exakte Kandidatenbytes mit bezeichnetem gezieltem Testumfang geprüft |
| Geplant | Gewünschter Ausbau, noch nicht implementiert oder abgenommen |
| Blockiert | Notwendiger Schritt kann mit der aktuellen Umgebung nicht ausgeführt werden |
| Ausgeliefert | Konkretes Artefakt mit Herkunft, Signatur und tatsächlich geprüftem Lieferumfang |

Aktuelle Fortschreibung: geprüfter kombinierter 0.5.4-Webstand; historische Abschnitte bleiben datiert erhalten. [Zurück zum Repository](../README.md)
