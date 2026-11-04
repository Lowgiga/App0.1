# Produktkontext: vom Ziel zur geprüften Fortsetzung

Diese Arbeitskarte bündelt das [Produktziel](01-product.md), die unveränderten [27 Anforderungen](16-acceptance-matrix.md), [Architekturentscheidungen](18-decisions.md) und den [K1/K2-Verlauf](25-context-continuation-work-package.md). Sie ersetzt keine pauschale Anforderungsabnahme: K1 sowie K2 samt History-/Routenkorrekturen und konkreter Vorschau sind im bezeichneten Webumfang unabhängig geprüft und bewusst angenommen. Appversion und Plattformfreigaben bleiben unverändert.

## Zusammenhängender Nutzerweg

Ziel im bestehenden Missionraum → bestätigtes Projektgedächtnis mit Herkunft → persönlicher unbestätigter Entwurf → ausdrücklich gestartete Offline-Beratung über belegte Grundlage → konkrete Änderungsvorschau im Editor → ausdrückliche Übernahme als Vorschlag → separate Bestätigung → spätere projektgebundene Fortsetzung.

K1 verbindet gespeicherte Entwurfsmetadaten mit der Beratung. K2 öffnet die bewusst gewählte Revision im vorhandenen Editor. Die Historykorrektur verwirft veraltete Wechselentscheidungen auch bei Rückkehr zur identischen Projekt-URL. Eine interne Rückkehr nach gescheiterter Entwurfsicherung erhält dagegen genau die noch ausstehende Entscheidung.

Der anschließende Vorschauschritt schließt die bisherige Lücke zwischen Editor und Übernahme: „Änderung prüfen“ sichert den persönlichen Entwurf über die bestehende Sicherung und liest ihn erneut. Die Vorschau zeigt Projekt, Entwurfrevision, Arbeits-/Gedächtnisbasis, Art, Herkunft und konkreten Text; bei einer Korrektur zusätzlich den bisherigen Eintrag. Noch kein Gedächtnisvorschlag wird dabei erzeugt. „Geprüften Vorschlag übernehmen“ verwendet ausschließlich diese Fassung. Es handelt sich um die Sichtprüfung durch den Nutzer und die lokalen Vertrags-/CAS-Prüfungen, nicht um eine behauptete fachliche Modellprüfung.

Neue Eingabe, Laden, Öffnen, Rebase, Verwerfen, Projekt-/Tab-/Historywechsel entwerten die Freigabe. Änderungen anderer Tabs werden durch die bestehende atomare Revision-/Basisprüfung abgewehrt. Abbrechen erhält den Entwurf. Die Übernahme schließt ihn als `applied` ab und erzeugt einen unbestätigten Vorschlag; eine bestehende bestätigte Entscheidung bleibt bis zur separaten Bestätigung erhalten. Verlorene Schreibantworten nutzen weiterhin den vorhandenen Wiederleseweg ohne automatisches zweites Schreiben.

## Alle Anforderungen bleiben im Blick

| Zusammenhang | Erhaltene IDs | Bedeutung für diesen Schritt / nächste Grenze |
| --- | --- | --- |
| Quelle und Auslieferung | REL-01, REL-02, REL-03, REL-04 | Exakte Quelle und Webchecks; APK, Signierung und Gerät weiterhin gesondert offen |
| Daten und Wiederaufnahme | DAT-01, DAT-02, RUN-01 | Bestehende Import-/Backup-/CAS-/Journalverträge erhalten; kein neuer Restore oder automatischer Runner |
| Diagnose | OBS-01, OBS-02 | Lokale Speicherbelege von unbestätigtem Ergebnis unterscheiden; keine behauptete Live-Verbindung |
| Projekt und Konfiguration | MEM-01, CFG-01 | Dieser Schritt erweitert den vorhandenen Memoryeditor; vier umfassende Einstellungsbereiche bleiben offen |
| Konstruktion und Wirkung | WRK-01, WRK-02, DEC-01 | Die Vorschau betrifft Memoryeinträge; kein allgemeiner Aufgabenkonstruktor, Wirkungsgraph oder Variantenvergleich |
| Review und Rechte | REV-01, SAFE-01 | Konkrete Revision statt dauerhafter Zustimmung; Vorschlag und Bestätigung bleiben getrennt |
| Simulation und Ausführung | SIM-01, AUT-01 | Offline-Beratung bleibt Simulation; kein Shadow-/Autopilot-/Engineausbau |
| Lernen und Bedienung | LEARN-01, UX-01, UX-02, DEV-01 | Durchgehender Weg im vorhandenen Studio, Fokus und Mobilansicht; keine zweite Domain |
| Ausgabe und Module | OUT-01, MOD-01, MOD-02 | Bestehende Exportgrenzen; Medien-/Renderer-/Videofunktionen separat |
| Integration und Qualität | INT-01, QA-01 | Keine Provider-, Kosten-, Modell- oder OS-Rechteentscheidung; gezielte Regressionen und gemeinsamer Integrationscheckpoint |

ADR-001/003 verlangen die bestehenden lokalen Bausteine. ADR-005 verhindert Autorität aus Beratung, Historie oder Darstellung. ADR-002 schützt Upstream/Generatoren, ADR-004/006/007 bleiben unverändert. Alle 27 IDs sind hier genau einmal zugeordnet; ihre detaillierten offenen Teilumfänge bleiben in der Abnahmematrix maßgeblich.

## Konkrete Code- und Prüfanker

- [Editor](../app/src/use-personal-memory.ts): gespeicherte Fassung erneut lesen, flüchtige Vorschauidentität, Eingabeversion und Draftbasis beim Apply prüfen.
- [Projektgedächtnis](../app/src/studio/ProjectMemoryPanel.tsx): Historybesitz, Vorschau, vorher/nachher, Fokus, bewusste Übernahme und Abbruch.
- [Bestehende Transaktion](../app/src/personal-continuation-transaction.ts): unveränderte atomare CAS-Grenze.
- [Fortsetzungs-UI](../app/tests/system/personal-continuation-ui.test.tsx), [Memory-UI](../app/tests/system/project-memory-ui.test.tsx), [Assistant-UI](../app/tests/system/assistant-ui.test.tsx): bestehende Fälle bleiben erhalten; neue History-, Vorschau-, Drift-, Abbruch- und Korrekturfälle.

Keine zusätzliche Harnessplattform. Gezielte Tests während der Änderung; anschließend eine gepinnte vollständige Verifikation auf der gemeinsamen eingefrorenen Quelle. Desktop-/Mobilbrowserbelege sind an die bytegleichen Produktionsassets gebunden. Die Qualitymetadaten wurden erst nach unabhängigem Review und ausdrücklicher Freigabe aktualisiert.

## Angenommene Bindung

Quelle `c123f8ab5f155c61382a9b58208bb73e04b91a3188f8159241d588bd17285869`; externer Pin `2dcc49f273fd7378166463c2778cfd6cc4b8c46cd1c2d6313c206f6b86ec4489`. 41 Schutzgruppen, keine Ausnahmen. Der unveränderte [K1-Nachweis](26-k1-continuation.md) bleibt die historische Grundlage. Native Ausgabe, Signierung und physisches Gerät bleiben gesondert offen.

Die einmalige gepinnte Integrationsverifikation dieses Stands ist PASS: 50 Quality-Werkzeugtests, 1.459 App-Tests, TypeScript, Generatoren und Webbuild; Quelle vor/nach identisch. Releaseaussage ausschließlich `web-built`. Alle 61 Produktionsassets bleiben bytegleich zum Desktop-/Mobilbrowser-geprüften Stand (Inhalts-SHA `4116ca265a7f4630f60499f851aeffa6f1c4db148e29dd1e524d66d695c01240`). Keine erneute Browserprüfung für unveränderte Assets und keine native/device-Abnahme behauptet.

## Folgepfad K3: Ergebnis wiederfinden und bewusst bestätigen

Der unabhängig geprüfte [K3-Folgepfad](28-memory-result-continuation.md) ergänzt den lesenden Sprung zum konkret übernommenen Vorschlag. Der angenommene c123-Stand bleibt als historische Referenz erhalten; die gemeinsame K3-Adoption ist [separat dokumentiert](29-k3-quality-adoption.md). Bestätigung, Korrektur und die Fortsetzungskarte verwenden ihre bestehenden Verträge; keine automatische Bestätigung und keine zusätzliche Ausführungsbefugnis.
