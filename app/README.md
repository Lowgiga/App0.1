# LowQuantFlow · Android-first System

Eigenständig baubarer lokaler Teststand auf der finalen Websitebasis V7 / App 1.4.2 / WorkState 4. Die ursprünglichen 17 Bereiche bleiben erhalten; „Studio · Graph & Skills“ ergänzt Graph-Perspektiven, kombinierte Arbeitsflächen, geprüfte lokale Funktionen und portable Backup-Vorschau.

Aktueller Quellkandidat: **0.5.4-prototype-20261005**, Android-Code **12**. Neue Test- und APK-Nachweise sind erforderlich. Individuelle Hologramm-Darstellungen werden lokal getrennt gespeichert und sind nicht im bisherigen Projektbackup enthalten. Maßgebliche Integrationsübersicht: `docs/INTEGRATION-RESULTS.md`.

## LowQuantFlow · separate Android-Identität

Diese Variante verwendet `de.lowgiga.cuecommandmesh.next` und den sichtbaren Namen „LowQuantFlow“. Sie ist für eine Installation neben `de.lowgiga.cuecommandmesh.preview` vorgesehen. Der ursprüngliche Preview-Quellstand und die bestehende Installation bleiben erhalten; private Appdaten werden nicht automatisch übernommen. Der Java-Namespace bleibt absichtlich `de.lowgiga.cuecommandmesh.preview`; er ist nicht die Installations-ID. Version, Web-Ursprung, Datenbanknamen, Datenverträge, alle 17 Arbeitsbereiche sowie die Skill-, 2D-/3D- und AR-Funktionen bleiben erhalten.

Die Konfiguration ist als Quellnachtrag geprüft. Ein frischer vollständiger Testlauf, Webbuild, Capacitor-Sync, nativer Build, kontrollierte Signierung und reale Geräteabnahme stehen noch aus. Frühere Prüflogs und die gezielten Recovery-Prüfungen ersetzen diese Schritte nicht. Nach `npx cap sync android` müssen die generierte Capacitor-Konfiguration und alle nativen Webasset-Hashes ausdrücklich geprüft werden; ein erfolgreicher Sync-Exit allein genügt nicht. Im fertigen Manifest sind Paket und Provider-Authorities auf die Next-ID zu prüfen.

Die Android-Apps besitzen getrennte private Datenbereiche. Die Systemzwischenablage und bewusst gewählte externe Exportdateien sind gemeinsame Ausgänge. Eine parallele Browservorschau benötigt einen anderen Port oder ein getrenntes Browserprofil; dort trennt die Android-App-ID keine Daten. Beim Neuladen gehen ungespeicherte Entwürfe verloren und ein laufender Prüfschritt wird unterbrochen. Bereits bestätigte Journal-Checkpoints bleiben für eine ausdrücklich gewählte Fortsetzung erhalten; nichts startet automatisch. Betriebssystemfehler, Speicherräumung oder Deinstallation sind davon nicht abgesichert.

Systembackup-Import bleibt reine Vorschau; der ergänzende Legacy-Import ist keine Vollwiederherstellung. Neue Manifest-/Asset-/Signaturberichte müssen als Next-Nachweise separat erzeugt werden; historische Preview-Berichte werden nicht umgeschrieben.


## Änderungsvorschau für vorhandene Aufgaben

Die Aufgabenmatrix zeigt vor dem Speichern konkrete Feldänderungen, belegte direkte/transitive Folgen und notwendige neue Gegenprüfungen. Reviewrücknahmen und Missionsrückgänge sind Teil derselben sichtbaren, revisionsgebundenen Bestätigung; gespeichert wird ausschließlich über den normalen lokalen Command. Unverbundene Aufgaben, historische Freigaben und Projektgedächtnis bleiben erhalten. Keine externe Ausführung oder Prüfung wird behauptet. Der vollständige Auftragskonstruktor bleibt separat. Details und offene Geräteabnahme: docs/TASK-CHANGE-PREVIEW.md.

## Lokales Projektgedächtnis

Studio ergänzt einen explizit gewählten Missionraum als isolierten Projektkontext: Ziel, Entscheidungen, verworfene Ansätze, offene Fragen und nächster Schritt. Vorschläge bleiben unbestätigt, Korrekturen und Ablösungen sind revisionsgebunden. Das Systembackup enthält den neuen Bestand samt reversibel vergessenen Einträgen; ältere Archive werden als ohne Projektgedächtnis gekennzeichnet. Produktiver Restore bleibt nicht implementiert. Details, Speichergrenzen und offene Geräteabnahme: docs/PROJECT-MEMORY.md.

## Aktueller Appname und kommende Ausgaben

Die sichtbare App heißt LowQuantFlow. Die ausdrücklich gewählte technische Installationskennung bleibt de.lowgiga.cuecommandmesh.next; der Java-Namespace bleibt unverändert. Alle 17 Bereiche, Qualitätskorrekturen, Recovery und lokale Diagnose bleiben erhalten. Alte Quellartefakte, historische Namen in Originaldokumenten und Datenkennungen werden nicht rückwirkend umbenannt.

Neu erzeugte Snapshot-, Handoff-, Systembackup-, Prüfergebnis- und Academy-Dateien verwenden LowQuantFlow als vorgeschlagenen Dateinamenpräfix. Ihre Nutzdaten-/Schema-/Producer-IDs bleiben erhalten. Vorhandene Dateien und Journalinhalte werden nicht verändert. Neue Auslieferungsnamen beginnen mit LowQuantFlow; native Buildpfade bleiben technische Ausgabepfade. Details und offene reale Prüfungen stehen in docs/BRANDING-LOWQUANTFLOW.md.

## Wiederhergestellter Import-Zwischenstand

Nach dem Verlust des temporären Entwicklungsarbeitsbereichs wurde dieser Stand aus dem SHA-256-geprüften Originalarchiv 0.5.0 und erhaltenen vollständigen Importpatchtexten wiederhergestellt. Neue Prüfergebnisse stehen in `docs/IMPORT-RECONSTRUCTION-VALIDATION.md`. Frühere Prüflogs im Archiv sind historische Belege und ersetzen keine erneute Prüfung. Die persistente Workflow-Wiederaufnahme ist aus erhaltenen Sourcebelegen und ausdrücklich neu ergänzten Regressionen rekonstruiert. Details und noch offene Prüfungen stehen in `docs/WORKFLOW-RECOVERY.md`. Der Wiederherstellungsnachtrag ist keine APK-Freigabe.

## Was du direkt tun kannst

1. App öffnen und den lokalen Arbeitsstand laden lassen. Ohne persönlichen Export startet der mitgelieferte Beispiel-/Anfangsstand
2. Unter „Arbeitsbereiche“ wie bisher Missionen, Aufgaben, Räume, Quellen, Academy und Einstellungen nutzen. Fünf abgeleitete Academy-Lernstände unterscheiden Quiz, Übungsnotiz und belegten Transfer. Vier zusätzliche Praxislevel führen von 2D-Herkunft und Beziehungen über eine 3D- oder gleichwertige 2D-Übung zum offenen Prüfauftrag; sie geben zusammen höchstens 100 Praxis-XP neben höchstens 100 Quiz-XP. Die fünf Ableitungsstände vergeben keine zusätzlichen XP; sie erteilen keine Rechte oder Zertifizierung. Unter Agenten bleibt der neue Codex/Low-Kooperationsbereich mit explizit unbestätigter Identität und lokalem Briefexport erhalten
3. Unter „Studio“ 2D/3D, Layouts, Filter und Hologramm-Bildschirmstil ausprobieren; „Ansicht speichern“ sichert persönliche Optionen
4. „Skills & Prüfprozesse“ führt vier echte, begrenzte Offline-Funktionen in höchstens acht Schritten aus. Pause nach jedem Schritt einschalten, Ergebnisse lesen, fortsetzen oder stoppen
5. Unter „3D & Lernen“ öffnet „AR-Hinweise öffnen“ den optionalen nativen AR-Einstieg. Erst der separate native Startknopf fragt Kamera bzw. Google-AR-Dienst an. Im Energiesparmodus bleibt AR gesperrt. Eine Kompatibilitätsabfrage erfolgt nur bewusst und kann Google kontaktieren
6. In „Evidenz“ zeigt „Quelle öffnen“ gebündelte Markdown-/JSON-Originaldokumente als Text. „Originaldatei sichern“ nutzt den Dateiadapter, ohne Inhalte auszuführen
7. „Backup & Vorschau“ sichert WorkState, Quellen-JSON, gespeicherte Studio-/Graph-/Workflow-Optionen und erhaltene historische Prüfergebnisse. Eine gewählte Backupdatei kann vollständig geprüft und verglichen werden

## Wichtig

- Persönliche Cloud-Arbeitsdaten sind noch nicht vollständig übernommen. Die App beginnt mit dem gelieferten Quellenstand und lokalen Standarddaten; sie erfindet keinen Cloudimport
- Keine Cloud-Synchronisation, externe Agentenausführung, MCP-Providerverbindung oder neue Loginberechtigung
- Hologramm ist ein Bildschirmstil. 3D ist keine Kamera-AR. Der integrierte Browser-WebXR-Pfad kann Flächen erkennen und nach bewusster Bestätigung platzieren, sofern Browser und Gerät dies unterstützen. Android WebView unterstützt diesen WebXR-Pfad nicht; die Android-App enthält deshalb zusätzlich einen optionalen, experimentellen ARCore-Adapter. Dieser ist noch nicht auf echter Hardware geprüft
- Neue Systembackups sind derzeit nur lesend importierbar: **Vorschau, keine Vollwiederherstellung**. Der ursprüngliche ergänzende Snapshotimport unter Evidenz bleibt separat erhalten
- Prüfergebnisse sind historische Daten, keine neuen Rechte. Ein separates lokales Laufjournal erlaubt eine ausdrückliche Fortsetzung eingebauter reiner Offline-Prüfungen nach erneutem Öffnen. Es startet nichts automatisch; fehlende Web Locks oder veränderte Quelldaten sperren die Fortsetzung. Der Ergebnisverlauf bleibt ohne Replay-Rechte
- Native Speicherung fragt den Zielort ab. Erst ein abgeschlossener Write meldet „gespeichert“. Bei einem Fehler kann eine partielle Datei zurückbleiben. Browserdownloads melden nur die Übergabe an den Browser
- Dieser Teststand ersetzt keine Datensicherung und hat noch keine physische Android-/Samsung-/GPU-/Kamera-AR-Abnahme

## Webkern bauen

Voraussetzungen: Node.js 22 LTS ab 22.18.0 oder Node.js 24 LTS, npm, Internetzugang zu den im Lockfile fest gepinnten offiziellen Paketquellen. Die deklarierte Laufzeitspanne ist ^22.18.0 || ^24.0.0: registerHooks erfordert mindestens Node.js 22.15.0, die Tests ohne Zusatzflag nutzen jedoch das erst ab 22.18.0 standardmäßig aktive Type-Stripping. Die vorliegende Prüfung lief unter Node.js 24.19.0; die Mindestversion 22.18.0 wurde nicht separat ausgeführt.

```sh
npm ci
npm test
npm run build
npm run preview
```

Die lokale Vorschau läuft auf `http://127.0.0.1:4173`. Der Build liegt unter `dist/`. Der Browser speichert den Arbeitsstand in IndexedDB und Studiooptionen/Ergebnisse in einem eigenen, begrenzten IndexedDB-Datensatz mit revisionsgeprüfter Transaktion. Privater Browsermodus, Datenlöschung oder Deinstallation können lokale Daten entfernen. Dateien vorher exportieren. Ältere Studio-localStorage-Daten werden bei leerer neuer Datenbank einmal gelesen und bleiben unverändert erhalten. Eine zweite Sitzung mit veralteter Revision wird vor einem überschreibenden Speichern blockiert.

`npm test` führt Originaltests, Integrationsprüfungen, frühere Reviewerregressionen und die übernommenen Modulsuiten aus. Die Happy-DOM-Tests sind DOM-Simulationen; keine echte Browser- oder Gerätebedienung.

## Android bauen

Voraussetzungen: JDK 21, Android SDK Platform 36, Build Tools 35.0.0 (vom gepinnten Android-Gradle-Plugin tatsächlich verwendet) und akzeptierte SDK-Lizenzen. `ANDROID_HOME` bzw. `ANDROID_SDK_ROOT` müssen auf dein eigenes SDK zeigen. Kein SDK und kein privater Signierschlüssel liegt dem Sourcepaket bei.

```sh
npm ci
npm run build
npx cap sync android
cd android
./gradlew :app:testDebugUnitTest :cue-native-ar:testDebugUnitTest :app:lintDebug :cue-native-ar:lintDebug :app:assembleRelease
```

Die Release-Konfiguration enthält hier keinen privaten Schlüssel und erzeugt ohne separate Signierkonfiguration ein unsigniertes Artefakt. Die Next-Quellkonfiguration setzt die eigene App-ID; nativer Build, Prüfung und kontrollierte Signierung stehen noch aus. Siehe `docs/SIGNING-AND-RECOVERY.md`. Ein anderer Schlüssel kann die vorhandene Preview-Installation nicht direkt aktualisieren. Datenexport und Wiederherstellbarkeit vor Installationsänderungen prüfen; keine Deinstallation als Signatur-Workaround.

Der eigene `CueFiles`-Adapter nutzt Androids Dateidialog. Es gibt keine breite Storage-Berechtigung. Auf einem tatsächlichen Gerät müssen Dateiauswahl, Cancel, Fehler, Lifecycle, große Unicode-Dateien, Clipboard, mobile Bedienung sowie WebGL/AR separat geprüft werden. Details unter `docs/NATIVE-FILES.md`.

## Quellen und Reproduzierbarkeit

- `upstream/`: byteidentischer V7-Quellstand, Commit `3e921804b13e0d7c70d1ff15474f0387e84d70b6`
- `src/`: expliziter lokaler Transport, gemeinsame React-State-Anbindung, Studio und Plattformadapter
- `overlay/`: automatisch erzeugte, eng begrenzte Änderungen an den Originaloberflächen
- `extensions/level-ar/`: unveränderte geprüfte Rev3-Quelle; kompatible Academy-/Graph-/Abortbausteine bleiben erhalten
- `extensions/v7-integration/`: explizite V7-Zusammenführung mit Eingangs-/Zielhashes; neue Browserfunktionen und bisherige Abbruch-/Lifecyclegarantien
- `extensions/domain-fixes/`: geprüftes begrenztes Kit für Löschereignisse, wieder anwendbare Fokusaktionen und transparente Legacy-Importgrenzen
- `vendor/`: überprüfte lokale Module mit Integrationshashes; Graph-Domainimporte verweisen auf den gemeinsamen V7-Kern
- `android/`: gehärtete Capacitor-8.5.2-Hülle, explizites Dateiplugin und optionales ARCore-1.54.0-Modul in `cue-native-ar/`
- `extensions/native-ar/`: gepinnter Revision-6-Vertrag, Lizenzhinweise und Hashmanifest des experimentellen nativen AR-Moduls
- `provenance.json` und `integration-manifest.json`: gepinnte Quell- und Modulinventare
- `docs/build-manifest.json`: SHA-256 der tatsächlich erzeugten Webdateien

`npm run check:drift` prüft Originalquellen; `npm run check:vendors` prüft Module; `npm run check:native-ar` prüft alle 18 unveränderten AR-Moduldateien; `npm run check:domain-fixes` prüft das begrenzte Domain-Kit. Ein Build benötigt keine benachbarten Workspaceordner und keine absoluten Entwicklungspfade. Die Integrationsskripte verweigern unbekannte Originalanker statt still gegen veränderte Quellen zu patchen.

Vollständige Grenzen: `docs/PARITY.md`. Native Datenverträge: `docs/NATIVE-FILES.md` und `extensions/native-ar/docs/BRIDGE.md`. V7-Komposition: `docs/V7-INTEGRATION.md`. AR-/Dokumentintegration und Hardwaregrenzen: `docs/NATIVE-AR-INTEGRATION.md`. Integrationsplan: `docs/superpowers/plans/2026-09-30-system-integration.md`. Ältere Port-Dokumente beschreiben ihre damalige Teilstufe, nicht den gesamten integrierten Stand.
