# Migration und Wiederherstellung

## Zwei verschiedene Migrationsaufgaben

1. **Quelle rekonstruieren:** Original und präzise Nachträge zum neuen Kandidaten zusammensetzen
2. **Persönliche Daten übertragen:** bestehende Previewdaten kontrolliert in eine neue Installation bringen

Eine erfolgreiche Quellrekonstruktion überträgt keine persönlichen Daten. Eine neue applicationId hat getrennten Appspeicher. Automatische Preview-zu-Next-Migration ist nicht implementiert.

## Quellkette

```text
Original 0.5.0
 → Import-Wiederherstellung Version 2
 → Recovery-Wiederherstellung
 → Next-Konfigurationsnachtrag
 → Quality-Korrektur
 → lokale Diagnose
 → LowQuantFlow-Brandingkombination
```

Jeder Schritt benötigt die exakten Eingangsbytes. Vorhash, Patchhash, Zielhash und erwartete Dateizahl prüfen. Kein Fuzz, kein Teilpatch, kein Ersetzen der historischen Grundlage. Der [Quellenregister](reference/evidence-register.md) bezeichnet diese Artefakte, ohne sie als Dateien dieses Repositories auszugeben.

Die lesbare Importbasis und der final zusammengesetzte Kandidat sind unterschiedliche Bestände. Ein alter README- oder package.json-Wert in der Basis darf nicht den Status des Nachtrags widerlegen oder als neue Releaseversion übernommen werden.

## Datentransfer Preview → Next

Geplanter sicherer Ablauf:

1. Preview und vorhandene Daten erhalten
2. Unterstützten Export erstellen; Zielort und abgeschlossenen Schreibstatus prüfen
3. Export offline rücklesen/validieren und sicher verwahren
4. Next separat mit überprüfter applicationId und Signatur installieren
5. Nur den tatsächlich unterstützten Importpfad verwenden
6. Vorschau, Zielgröße, Zurücksetzungen und Konflikte vor Bestätigung prüfen
7. Übertragene Inhalte und beabsichtigte Grenzen im neuen Stand vergleichen
8. Preview erst nach einer gesonderten Entscheidung verändern; kein automatisches Löschen

Legacy-Merge kann Daten ergänzen. Er ist kein exakter Vollrestore von WorkState, Preferences und Journal. Ein Systembackup lässt sich derzeit lediglich prüfen und vergleichen. Persönliche Datenübernahme ist deshalb nicht als abgeschlossen zu melden.

## Fachliche Schemaentwicklung

Neue Projektgedächtnis-/Konstruktordaten brauchen vor Implementierung:

- Versionierten Vertrag und klaren Besitzer der Migration
- Umgang mit fehlenden Projektzuordnungen und unbekannten älteren Feldern
- Erhalt von Herkunft, Revision und expliziten Entscheidungen
- Import-/Export-/Größen- und Konkurrenzprüfungen
- Isolierte Upgrade- und Fehlerfixtures
- Definierten Rückweg; Code-Revert allein reicht bei neuerem Speicherformat nicht

Keine stillen Projektzuordnungen und kein destruktiver Reset für eine Demo.

## Fehler- und Wiederanlaufregeln

Unbekannte Version oder korrupter Speicher: Daten erhalten, Mutation sperren, verständliche Diagnose anbieten. Unklarer Commit: neu lesen und mit dem vereinbarten Protokoll abgleichen, keine automatische Wiederholung einer möglicherweise wirksamen Aktion.

Workflow-Recovery startet nach Reload nichts. Bestätigte Schritte bleiben bestätigt; veraltete Quellen, Versionen oder nicht belegbarer Ausgang blockieren. Backup-Checksummen verleihen keine Fortsetzungsrechte.

## Grenzen

Standard-IndexedDB-Durability ist keine Garantie gegen jedes Strom-/OS-/Speicherereignis. Die getrennte Next-Identität löst keine Schlüsselverwahrung. Ein neuer Produktname darf keine Datenbanknamen und Paketverträge aus Versehen migrieren.

[Import und Restore](09-import-backup-restore.md) · [Build/Signierung](12-build-signing-release.md)
