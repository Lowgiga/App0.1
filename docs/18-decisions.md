# Architekturentscheidungen

Diese kompakte ADR-Sammlung dokumentiert bestehende Projektentscheidungen. „Angenommen“ bedeutet eine festgelegte Richtung, nicht automatisch eine vollständig abgenommene Implementierung. Eine spätere Änderung erhält einen neuen Eintrag mit Bezug auf die ersetzte Entscheidung.

## ADR-001 · Bestehende App additiv erweitern

**Status:** Angenommen. **Datum:** 2026-10-04.

**Kontext:** Die App hat 17 Bereiche, gemeinsame Daten, lokale Grenzen und grafische/Workflowbausteine. Ein Rewrite würde bewährte Verträge und Nachweise verlieren.

**Entscheidung:** Bestehendes React-/TypeScript-/Vite-/Capacitor-/IndexedDB-/Three-Fundament weiterverwenden. Neue Werkstattfunktionen an vorhandene Domain und Runner anbinden.

**Folgen:** Kleine nachvollziehbare Änderungen; Migrations- und Regressionstests bleiben nötig. Zusätzliche Architektur wird nur bei konkretem Bedarf eingeführt.

## ADR-002 · Upstream schützen, Integration explizit erzeugen

**Status:** Angenommen.

**Kontext:** Die V7-Grundlage ist nach Herkunftshashes gebunden. Android-/Lokalintegration benötigt gezielte Anpassungen.

**Entscheidung:** Original unter upstream erhalten; Generatoren und overlay gemeinsam ändern und auf Drift prüfen.

**Folgen:** Herkunft bleibt kontrollierbar. Generator und erzeugter Output dürfen nicht auseinanderlaufen. Historische Referenzen werden nicht als aktuelle Laufzeit ausgegeben.

## ADR-003 · Gemeinsamer Zustand, lokale Daten zuerst

**Status:** Angenommen.

**Entscheidung:** Ein WorkState für Arbeitsbereiche und Studio; separate revisionsgeschützte Preferences und klar abgegrenztes Recoveryjournal. Keine implizite Cloudverbindung.

**Folgen:** Konsistente Auswahl und Fachobjekte; lokale Daten sind gegen Löschung/Deinstallation zu sichern. Aktiver Sync braucht später einen eigenen Vertrag.

## ADR-004 · Next getrennt von Preview

**Status:** Angenommen; native Abnahme offen.

**Entscheidung:** Neue applicationId de.lowgiga.cuecommandmesh.next. Bestehender Java-Namespace kann .preview bleiben. Sichtbare Marke LowQuantFlow; technische Datenkennungen unverändert.

**Folgen:** Parallele Installation vorgesehen; persönliche Daten migrieren nicht automatisch. Signier- und Appdatenbackup sind getrennte Aufgaben.

## ADR-005 · Keine Autorität aus Darstellung oder Historie

**Status:** Angenommen.

**Entscheidung:** XP, Begleiter, Quellenkatalog, Prompttext, historische Ergebnisse und importierte Entscheidungen verleihen keine Ausführungsrechte. Konkrete Freigaben bleiben inhaltlich/revisionsgebunden.

**Folgen:** Ehrliche Verbindungszustände, unbekannte Werte und sichtbare Blockaden gehören zum Produkt. Benutzerfreundliche Darstellung darf Grenzen nicht wegvereinfachen.

## ADR-006 · Backupvorschau vor produktivem Vollrestore

**Status:** Angenommen; Restoreausbau geplant.

**Entscheidung:** Bestehenden Export/Prüf-/Vergleichsvertrag erhalten. Zuerst isolierte Rückleseprüfung, später eigener atomarer/unterbrechbarer Restorevertrag.

**Folgen:** Kein Datenverlust durch überversprochene Wiederherstellung; zusätzliche Arbeit für mehrere Speicher und Rollback erforderlich.

## ADR-007 · Optionale Medienmodule im vorhandenen Kern

**Status:** Richtung angenommen; Implementierung geplant.

**Entscheidung:** Begleiter als abschaltbarer Actor im vorhandenen Three-Renderer; Video-Studio als eigener optionaler Arbeitsbereich. Providerwahl und Außenwirkung separat.

**Folgen:** Kein zweiter 3D-/Runnerstack; Asset-/Lizenz-/Performanceabnahme und Medienisolation bleiben Pflicht.

## Wann eine neue ADR nötig ist

Neue Datenbank, fremder ausführender Provider, grundlegende Authentifizierung, schwer umkehrbare Schemaänderung, neuer Renderer oder maßgebliche Berechtigungsgrenze. Eine Labelkorrektur oder Routinebibliothekskorrektur braucht normalerweise keinen neuen Architekturprozess.

Neue ADR: Kontext → Entscheidungstreiber → kleinste tragfähige Optionen → Entscheidung → Folgen/Risiken → Migrations-/Rücknahmeweg → Nachweise. Nichts ändern oder vorhandenen Baustein verwenden ist eine ernsthaft zu prüfende Alternative.

[Power-User-Methodik](20-power-user-method.md) · [Beitragen](../CONTRIBUTING.md)
