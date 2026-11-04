# Build, Signierung und Auslieferung

## Aktueller Lieferstatus

Original 0.5.0 ist der vorhandene installierbare Stand. Für den neueren LowQuantFlow-/Next-Kandidaten gibt es in diesem Repository **keine neue APK und keine Releasefreigabe**. Geprüfte Patches ersetzen weder eine vollständige materialisierte Quelle noch einen frischen nativen Build.

## Buildumgebung: Nachweis vom 4. Oktober 2026, 12:30 UTC

- Regulärer HTTPS-Zugriff über den vorhandenen Proxy funktioniert: Google und npm lieferten HTTP 200. Die frühere pauschale DNS-/Netzblockerdiagnose ist korrigiert; keine Netzsicherheitsänderung war nötig
- Android SDK 36, Build Tools 35.0.0 und Gradle 8.14.3 sind prüfsummenverifiziert installiert; Gradle, aapt2 und apksigner starten. Node 24 ist vorhanden
- Der frische offizielle Library-Download des Originalquellartefakts scheitert weiterhin mit „download failed“, ohne verfügbaren HTTP-Status. Separate HTTPS-HEAD-Proben belegen Proxy-CONNECT 403 Forbidden für beide benötigten Library-Speicherhosts, keine Azure-HTTP-Antwort. Die minimale gezielte Hostfreigabe ist angefordert
- Das vorhandene Modul jdk.compiler startet javac 21.0.12.1 über Java. Die normale Offline-Gradle-JavaCompile-Probe scheitert jedoch: Gradle meldet Is JDK: false und findet keine passende Compiler-Toolchain. bin/javac und lib/ct.sym fehlen; --release 21 scheitert, -source 21 -target 21 funktioniert nur über den Modulpfad. Benötigt wird eine vollständige JDK-21-Installation; die erfolgreiche Modulprobe ist kein Ersatz für den regulären Gradle-Build
- Eine zuvor geprüfte offizielle JDK-Bezugsquelle wurde ebenfalls bereits beim Proxy-Tunnel mit 403 abgewiesen. Eine zusätzliche gezielte Hostfreigabe ist angefordert. Das ist keine Bestätigung eines Vendor-HTTP-Fehlers und kein Anlass zur Umgehung der Sperre
- Diese Vorbereitung ist **kein Appbuild**. Neue Webausgabe, Androidtests/Lint/Build, Signierung und APK bleiben offen

## Identitäten

| Ebene | Preview | Next-/LowQuantFlow-Kandidat |
| --- | --- | --- |
| Android applicationId | de.lowgiga.cuecommandmesh.preview | de.lowgiga.cuecommandmesh.next |
| Java-/Android-Namespace | de.lowgiga.cuecommandmesh.preview | bleibt de.lowgiga.cuecommandmesh.preview |
| Quellversion | Original/ältere Zwischenstände | 0.5.2-v7-workflow-recovery-reconstructed |
| versionCode | abhängig vom konkreten alten Artefakt | vorgesehen 10 |
| Sichtbare Marke | historische Labels | LowQuantFlow |

Namespace und applicationId müssen nicht identisch sein. Entscheidend sind das tatsächlich gebaute Manifest, Activity-/Providerauflösung und APK. Historische IDs, Datenkeys, Producername und Workflow-/Skill-/Journalverträge werden für eine sichtbare Marke nicht umbenannt.

## Reproduzierbare Reihenfolge

1. Vollständige Quellkette mit Größen, SHA-256, Vor-/Nachhashes und Dateiinventar prüfen
2. Unabhängige Zielkopie erstellen; Previewquelle unverändert erhalten
3. Patches exakt und vollständig anwenden; finalen Baumhash prüfen
4. Frisches npm ci mit dem gepinnten Lockfile
5. Herkunfts-/Pinprüfer, Typecheck, vollständige Standard- und serielle Suite
6. Frischer Webbuild und neues Buildmanifest
7. Capacitor-Sync
8. Vollständiger Vergleich zwischen frischem dist und eingebetteten Android-Webdateien
9. Android-UnitTests, Lint, Build und gemergtes Manifest
10. Kontrollierte Signierung, Zertifikat- und Alignmentprüfung
11. Getrennte Installation, Daten- und Geräteabnahme
12. Artefakt, Sourcehash, Prüfergebnisse und bekannte Grenzen gemeinsam ausliefern

Alte oder unerwartete Chunks sind ein Abbruchgrund. Ein erfolgreicher Sync-Exit ist kein Ersatz für den Dateivergleich.

## Befehlsvorlage für die App-Quelle

Voraussetzungen laut gesicherter Quelle: JDK 21, Android SDK Platform 36 und gepinnte Toolchain; Build Tools 35.0.0 sind in der vorhandenen Anleitung genannt. SDK-Pfade und akzeptierte Lizenzen müssen in der tatsächlichen Buildumgebung geklärt sein.

```sh
npm ci
npm run verify:serial
npx cap sync android
cd android
./gradlew :app:testDebugUnitTest :cue-native-ar:testDebugUnitTest \
  :app:lintDebug :cue-native-ar:lintDebug :app:assembleDebug
```

Dies ist eine dokumentierte geplante Ausführung, kein in diesem Repository ausgeführter Build. Eine Debug-APK ist ein Testpaket und keine Produktionsfreigabe.

## Signierung

Ein neuer geprüfter Next-Signierschlüssel ist noch nicht erzeugt oder dauerhaft gesichert nachgewiesen. Private Schlüssel und Passwörter gehören nicht ins Repository. Der öffentliche Zertifikatfingerprint darf zum Auslieferungsnachweis gehören.

Erforderlich: nutzerkontrollierte Primärverwahrung und eine unabhängig geprüfte verschlüsselte Offlinekopie. Die Wiederherstellbarkeit muss tatsächlich getestet werden; „Backup geplant“ bedeutet nicht „Backup vorhanden“.

Ein Update derselben applicationId benötigt die passende Signatur. Bei Signaturabweichung nicht die vorhandene App deinstallieren, um den Fehler zu umgehen. Deinstallation kann lokale Daten löschen. Preview und Next sollen parallel installiert bleiben und getrennte packageName, UID und dataDir erhalten.

## Zwei verschiedene Sicherungen

**Appdaten:** kontrollierter Export, Rückleseprüfung, sichere Ablage und später eigener Restorevertrag.

**Signiermaterial:** private Schlüsseldatei, Passwort-/Zugangsweg, Wiederherstellungsanleitung, öffentliche Identitätsdaten und getrennte verschlüsselte Kopie. Android Keystore für Laufzeitschlüssel ersetzt nicht die Sicherung des APK-Signierschlüssels.

## Auslieferungsprotokoll

Pro Lieferung dokumentieren: Version/Code/applicationId, Source- und APK-Hash, öffentlicher Zertifikatfingerprint, durchgeführte Prüfungen, Plattform-/WebView-/Geräteversion, bekannte Einschränkungen und Rückweg. Weder ein GitHub-Dokumentationscommit noch ein gezielter grüner Test ist ein APK-Release.

[Freigabegates](16-acceptance-matrix.md) · [Migration](13-migration.md)
