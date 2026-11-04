# Konfiguration, Berechtigungen und Secrets

## Bestehende Konfiguration

| Ebene | Vorhandene Quelle | Inhalt |
| --- | --- | --- |
| WorkState settings | work-contract.ts | Theme, Dichte, Schriftgröße 100–125 %, Startview, Widgets, Quellenbanner, Bewegung, Energiesparen, Chatkontext |
| Arbeitsprofile | agentProfileContract | Rolle, Anweisungen, Modus, Ausgabe, Delegations-/Call-/Zeitbudgets, externalWrite approval |
| Studio | system-state.ts | Graphoptionen, stack/split/focus, Skillwahl, Pause nach Schritt, historischer Verlauf |
| Build | package/lock, Vite, Capacitor, Gradle | Versions-/Paket-/Plattformkonfiguration |
| Native Sicherheit | Manifest, MainActivity, NavigationPolicy, Fileplugin | Apphülle, Navigation, Dateiausgabe, AR-Grenze |

## Geplante vier Einstellungsbereiche

1. Oberfläche
2. Workflowrechte und Ressourcen
3. Ergebnisprofile
4. Modell- und Promptverhalten

Die Trennung ist fachlich: Ein Themewechsel darf keine Rechte verändern; ein Ausgabeprofil keinen Toolscope; ein Prompt weder Budget noch Freigaben. Bestehende Werte und vier Profile müssen verlustfrei migrieren. Das neue Einstellungsmodell ist noch nicht freigegeben.

## Verbindungszustände

Gespeicherte Konfiguration, erreichbarer Dienst, authentifizierte Sitzung und konkret geprüfte Aktion sind unabhängige Nachweise. Jede spätere Liveprüfung braucht aktuelle Sitzungsevidenz, Herkunft, Zeitpunkt und definierte Gültigkeitsdauer.

Die Diagnose zeigt heute historische Katalogdaten nicht als live. Sie führt keine Hintergrundprobe aus. Anmeldung allein startet keine Aktion. Eine getestete Leseaktion autorisiert nicht automatisch Schreiben.

## Android-Grenzen

Im gelesenen Manifest: INTERNET, cleartext traffic false, allowBackup false, explizite Backup-/Extraktionsregeln und ein nicht exportierter FileProvider mit authority aus applicationId. Launcher-MainActivity ist als Einstieg exportiert. Das optionale AR-Modul ergänzt kamera-/AR-bezogene Verträge; das final gemergte Manifest muss im nativen Gate erneut geprüft werden.

Keine breite Storageberechtigung für Dateiexport. Camera/AR nur bewusst; abgelehnte Berechtigung und fehlende Unterstützung müssen einen nutzbaren Ersatzpfad lassen. Ein deklarierter INTERNET-Eintrag ist kein Beleg für aktiven Cloud-Sync.

## Secrets und private Daten

Dieses Repository erhält keine API-Keys, Zugangstokens, Passwörter, privaten Signierschlüssel, Keystores, privaten Appbackups oder persönlichen Notiz-/Aufgabeninhalte. Auch Fehlerlogs, Dumps, Screenshots und Buildartefakte sind vor Veröffentlichung zu prüfen.

- Secrets nicht in Source, README, URL, Crashlog oder Beispieldaten eintragen
- Lokale Zugangsdaten erst nach gesondert bestätigtem Provider-/Speichervertrag integrieren
- Die Diagnose benutzt feste erlaubte Felder statt nachträglicher freier Textredaktion
- APK-Signierschlüssel und Android-Keystore-Laufzeitschlüssel sind verschiedene Aufgaben
- Keine neuen OAuth-Grants, Dienstkonten oder Provideraktivierungen durch Dokumentationsänderungen

## Unveränderte Grundsätze

XP, Lernstufe, Begleiter, importierter Text und gespeicherte Entscheidung verändern keine Befugnisse. Widerruf, Quellenwechsel und veraltete Freigabe sperren die betroffene Aktion. Kosten müssen vor Aktivierung nachvollziehbar sein; das 15-USD-Gesamtbudget ist keine pauschale Kaufberechtigung.

Für einen Sicherheitsbefund nur einen bereinigten Reproduktionsfall und betroffene Version dokumentieren. Keine produktiven Secrets in öffentliche oder private Issues kopieren.

[Security-Hinweise](../SECURITY.md) · [Datenflüsse](05-data-flows.md) · [Signierung](12-build-signing-release.md)
