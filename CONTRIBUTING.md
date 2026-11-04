# Zu LowQuantFlow beitragen

## Geltungsbereich

Dieses Repository enthält derzeit Dokumentation und eigene Konzeptgrafiken. Appcode und Buildinfrastruktur werden hier nicht durch leere Attrappen ersetzt. Eine spätere Quellübernahme braucht einen eigenen, überprüften Umfang.

## Vor jeder Änderung

1. Bestehende Quelle, aktuelle Nachträge und [Status](docs/17-status-evidence.md) lesen
2. Problem, Nutzerweg, betroffene Anforderung und Erfolgskriterium benennen
3. Vorhandenen Baustein und kleinsten tragfähigen Patch wählen
4. Daten-/Rechte-/Migrations-/Plattformfolgen prüfen
5. Nicht durchgeführte Prüfungen ausdrücklich offenlassen

## Dokumentationsstandard

- Ist, Kandidat und Planung sichtbar trennen
- Quellpfade gegen den passenden Stand prüfen; nicht vorhandene Source nicht verlinken
- Relative Links und Überschriften prüfen
- Testzahl mit Datum, Stand, Umgebung und Umfang verbinden; überlappende Suiten nicht summieren
- Kein falscher Buildbadge, Screenshot oder Installationslink
- Keine Secrets, persönlichen Nutzdaten, privaten Notizen oder vollständigen Produktionslogs
- Neue Grafiken mit Alttext, Herkunft, statischem Fallback und klarer Konzeptkennzeichnung
- Fremde Dateien nur mit geprüfter Lizenz und erhaltenen Hinweisen; keine Logos beiläufig kopieren

## Änderungsvorlage

```text
Ziel / Nutzerweg:
Anforderung:
Ausgangsstand / Beleg:
Kleinster Patch:
Daten- und Berechtigungsfolgen:
Ausgeführte Prüfung:
Nicht ausgeführte Prüfung:
Rücknahmeweg:
Offene Entscheidung:
```

## Codearbeit in der gesicherten Appquelle

Regression vorher reproduzieren; nachher gezielt und angrenzend prüfen. Generatoren und erzeugte Dateien gemeinsam behandeln. Kein Rewrite, breites Dependencyupgrade, Datenreset oder neuer Anbieter ohne Auftrag und begründete Entscheidung.

Ein unabhängiger Review prüft Diff, Annahmen, Rechte/Secrets, Lizenz, Zugänglichkeit, Größen-/Laufzeitkosten und Reversibilität. Die vollständigen Gates stehen in der [Abnahmematrix](docs/16-acceptance-matrix.md).

[Power-User-Methodik](docs/20-power-user-method.md) · [Architekturentscheidungen](docs/18-decisions.md)
