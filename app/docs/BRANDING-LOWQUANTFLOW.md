# LowQuantFlow · Brandinggrenze und Auslieferungsnamen

Dieser Branding-Schritt folgt auf die geprüfte Original → Import V2 → Recovery → Next → Quality → lokale Diagnose-Kette. Er ändert aktuelle App-Anzeigen und neue Dateinamenvorschläge, ohne den bisherigen Preview-Bestand oder historische Artefakte umzubenennen.

## Sichtbare Stellen

- Capacitor appName, Android app_name/title_activity_main, HTML-Titel und lokales Banner: LowQuantFlow
- Sidebar/Topbar/Footer über scripts/build-ui-overlays.mjs; die geerbten Originaldateien bleiben byteidentisch. Der Footer kennzeichnet v1.4.2 ausdrücklich als Basisversion
- Studioüberschrift und zugänglicher Studio-Name: LowQuantFlow Studio
- Neue Handoff-Absender, Dateidialogbeschreibung, Clipboardlabel und nativer AR-Snapshottitel
- Neue vorgeschlagene Exportnamen: LowQuantFlow-snapshot.json, LowQuantFlow-handoff.md, LowQuantFlow-system-backup.json, LowQuantFlow-local-results.json und LowQuantFlow-academy-arbeitsbuch.md

## Unveränderte Grenzen

applicationId bleibt de.lowgiga.cuecommandmesh.next, Java-Namespace bleibt de.lowgiga.cuecommandmesh.preview. Provider, Sicherheits-/Backupregeln, Quellen-/Datenbank-/Schema-/Event-/Skill-IDs, Backup-producer.name, Journalinhalte und die Standard-Laufdaten bleiben unverändert. Command Mesh Systembackup ist ein bestehender Laufdatenname, kein aktueller Shelltitel. Historische Quelldokumente dürfen ihre damaligen Namen zeigen. Cue kann dort einen externen Quellen-/Projektkontext bezeichnen.

Alle 226 Upstream-Dateien, 18 nativen AR-Moduldateien und sechs nativen AR-Erweiterungsdateien bleiben bytegleich. Die vorhandene historische Browserfixture in extensions/level-ar/source/tests/level-ar-browser.mjs erwartet den alten Seitentitel; sie wird nicht umgeschrieben oder als neue Brandingabnahme ausgegeben. Ein künftiger echter Browsercheck muss den aktuellen LowQuantFlow-Titel prüfen.

## Neue Auslieferungsnamen

Für künftige geprüfte Ausgaben: LowQuantFlow-<tatsächliche-Version>-Quellcode.zip, LowQuantFlow-<tatsächliche-Version>-Pruefbericht.md und erst nach Build/Signaturabnahme LowQuantFlow-<tatsächliche-Version>-Android.apk. Platzhalter sind keine bereits erstellten Dateien. Interne Gradle-Dateinamen wie app-release-unsigned.apk werden nicht als signierte Auslieferung ausgegeben. Bereits gesicherte Library-Dateien bleiben unter ihren bisherigen Identitäten und Namen erhalten.

## Offene Abnahmen

In-Memory-Prüfungen und dokumentierte Generatorausführung ersetzen kein frisches npm ci, keine Vite-/Webausgabe, keinen Capacitor-Sync, keine nativen Tests/Lint/Builds, keine Signaturprüfung und keine echte Browser-/Android-Geräteabnahme. Die neue Vite-Version aus Quality wurde hier nicht installiert. LowQuantFlow muss nach dem späteren Sync in generierter Config, gepacktem HTML und Android-Launcher/Activity sichtbar sein; technische .next-ID und vorhandene Daten müssen erhalten bleiben. Keine neue Signierung oder Schlüsseloperation gehört zu diesem Branding-Schritt.
