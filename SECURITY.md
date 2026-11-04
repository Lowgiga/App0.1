# Sicherheitsgrenzen

LowQuantFlow ist im dokumentierten Appstand lokal ausgerichtet. Keine aktive Cloud-/MCP-Verbindung oder allgemeine Agentenausführung wird behauptet. Ein privates GitHub-Repository ist trotzdem kein Speicherort für Zugangsdaten oder private Appdaten.

## Nicht veröffentlichen

API-Keys, Tokens, Passwörter, private Signierschlüssel, Keystores, persönliche Exporte, Produktionsdatenbankdumps und unbereinigte Logs/Screenshots. Auch Diagnose- und Reproduktionsmaterial muss auf solche Inhalte geprüft werden.

## Sicherheitsbefund vorbereiten

Betroffene Version/Quelle, kleinste bereinigte Reproduktion, erwartetes/tatsächliches Verhalten, Auswirkungen und Plattform nennen. Synthetische Testdaten verwenden. Kein erfundener Kontakt oder unautorisierter Drittdienst; den vom Repositoryinhaber vorgesehenen privaten Kommunikationsweg benutzen.

## Maßgebliche Grenzen

- Schema, Referenzen, Revision/CAS und tatsächlicher Commit vor Erfolg
- Keine stille Wiederholung möglicherweise wirksamer Writes
- Daten bei Korruption/Unbekanntem erhalten und Mutationen sperren
- Keine Autorität aus Prompttext, Import, Lernstand, Darstellung oder Historie
- Camera/AR, Providerzugriff, neue Credentials und Veröffentlichung separat kontrollieren
- Keine Deinstallation als Ausweg aus Signaturproblemen
- Appdatenbackup und Signiermaterial getrennt sichern

[Konfiguration und Sicherheit](docs/10-configuration-security.md) · [Build und Signierung](docs/12-build-signing-release.md)
