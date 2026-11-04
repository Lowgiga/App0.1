> Aktueller Repository-Nachweis vom 5. Oktober 2026: [FINAL984 / Prototyp 0.5.3](23-source-final984.md). Der [949-Zwischenschritt](22-source-freeze-949.md) bleibt historisch erhalten. Die folgenden Angaben vom 4. Oktober beschreiben die damalige Umgebung und sind kein aktueller Buildblocker.

# Status, Evidenz und Blocker

Stand: **4. Oktober 2026, 12:30 UTC**. Diese Seite beschreibt Quelle und Prüfstatus; sie ist kein APK-Release.

## Kurzstand

| Gegenstand | Belegt | Nicht belegt |
| --- | --- | --- |
| Original 0.5.0 | Vorhandener installierbarer Altstand und gesicherte Quelle | Neue LowQuantFlow-Funktionen in dieser APK |
| Import V2 | Exakter gehärteter Importnachtrag; begrenzte gezielte Prüfungen | Vollständige neue native Abnahme |
| Recovery + Next | Exakte rekonstruierte Kandidatenkette, 98 gezielte Tests und Typecheck 0 | Neuer nativer Build, automatische Datenmigration |
| Quality | Freeze, 226 gezielte Tests in 19 Dateien, Typecheck 0, unabhängige Gegenprüfung | Frische Viteinstallation und vollständiger Release |
| Lokale Diagnose | Vier neue Dateien plus Studioänderung; 49 gezielte Tests; Quality+Diagnose separat 76; Typecheck jeweils 0 | Liveprobes, Telemetrie, Export, Geräteabnahme |
| Finale Brandingkombination | **264 gezielte Tests in 24 Dateien**, Typecheck **0**, unabhängiger Review ohne offene Brandingbefunde | Gesamtsuite, Web-/Android-Neubuild, Signierung, neue APK |
| Dokumentationsrepository | Projektstruktur, Verträge, Plan, Status und eigene Konzeptgrafiken | Appsource, Source-ZIP, Schlüssel oder APK |

## Finaler kombinierter Quellkandidat

Reihenfolge: Original → Import V2 → Recovery → Next → Quality → Diagnose → Branding.

- Version: `0.5.2-v7-workflow-recovery-reconstructed`
- applicationId: `de.lowgiga.cuecommandmesh.next`
- Java-/Android-Namespace: `de.lowgiga.cuecommandmesh.preview`
- versionCode: 10
- Finales Quellinventar: **859 Dateien**
- Baum-SHA256: `072109be22c43ded70cc0b6df229c04252d2cede90848e14b2e969fc02d4a646`
- Brandingpatch: **20 Pfade**, 17 geändert und drei neu
- Brandingpatch-SHA256: `4d504455551eb52b1a980645d9aac36c6a14144b024190fa9d7ef8cc4defff66`
- Brandingbericht: 180.851 Byte; SHA256 `1367032a6af0b596487d8f3a35960de4dcb810b77d541350f56ca96a8b45f8a3`

Baumhashformat: SHA-256 über lexikografisch nach relativem Pfad sortierte UTF-8-Zeilen aus Datei-SHA256, zwei Leerzeichen, relativem Pfad und LF. Dies ist kein Git-Tree-SHA.

Alle **226 Upstreamdateien**, **18 nativen AR-Moduldateien** und **sechs AR-Erweiterungsdateien** bleiben bytegleich. Vier UI-Overlays werden über ihren Generator regeneriert; originale Upstream-UI wird nicht umgeschrieben. Datenkeys, Backup-Producername, Schema-/Skill-/Workflow-/Journal-IDs und historische Dokumente bleiben erhalten. Neue sichtbare Labels und Exportnamenvorschläge benutzen LowQuantFlow.

## Prüfzahlen nicht addieren

Die 264 Tests sind der bezeichnete kombinierte Umfang: 226 Quality-/Recovery-/Importfälle, 22 Diagnosefälle, sechs Brandingfälle und zehn AR-Bridgefälle. Diagnose 49 und Quality+Diagnose 76 sind andere, überlappende Zuschnitte. Die unabhängige Brandingprüfung wurde separat bestätigt; ihre Wiederholungen werden nicht zu einer größeren künstlichen Gesamtsumme addiert.

Historische 664 Tests, frühere Importprüfungen und Renderer-Simulationen bleiben historische beziehungsweise gesonderte Evidenz. Kein Badge „App build passing“ wird daraus abgeleitet.

## Ausführungsumgebung und Beweiskraft

Gezielte Kandidatenprüfung unter Node 24.19.0, happy-dom und fake-indexeddb mit exakt gehashten Kandidatenbytes im RAM. TypeScript verwendet dieselben Kandidatenquellen. Generatoren werden separat gegen die erwarteten Ausgabebytes geprüft.

Der ursprüngliche Quellbaum blieb unverändert. Diese Methode prüft konkrete Produktionsfunktionen und Regressionen, ersetzt aber keine frische Paketinstallation, Vite-Bundleerzeugung, native Toolchain oder reales Gerät.

## Noch offen

1. Vollständige Kandidatenquelle materialisieren
2. Vollständiges JDK 21 bereitstellen, reguläre Gradle-Toolchain-Erkennung prüfen und die gepinnten Appabhängigkeiten frisch installieren
3. Vollständige Standard-/serielle Suite und frischer Webbuild
4. Native Dialog-first-/Dirty-Draft-Zurücknavigation gesondert klären
5. Capacitor-Sync und kompletter Hashvergleich aller eingebetteten Webassets
6. Android-UnitTests, Lint, Build und gemergtes Manifest
7. Signatur, Zertifikat, Alignment und sichere nutzerkontrollierte Schlüsselverwahrung mit zweiter geprüfter verschlüsselter Kopie
8. Parallele Preview-/Next-Installation und reale Browser-/WebView-/Gerätebedienung
9. Tatsächliche GPU-/Kamera-AR-/Akkumessung für entsprechende Aussagen
10. Geplante Werkstattfunktionen und optionale Module nach eigener Abnahme

## Korrigierter Umgebungsbefund: 12:30 UTC

Die frühere pauschale DNS-/Netzblockerdiagnose beruhte auf direkten DNS-Proben ohne Prüfung des regulären HTTPS-Wegs über den vorhandenen Proxy. Sie ist **überholt**: Google und npm lieferten über diesen bestehenden Weg HTTP 200. Keine Netz- oder Sicherheitseinstellungen wurden geändert. Der zuvor gemeldete bwrap-Prozessstartfehler betrifft die ursprüngliche Umgebung; die neue Cloudumgebung kann schreiben und Prozesse ausführen.

**Erfolgreich vorbereitet:** Android SDK 36, Build Tools 35.0.0 und Gradle 8.14.3 sind installiert und ihre Archivprüfsummen bestätigt. Gradle, aapt2 und apksigner starten. Node 24 ist vorhanden.

**Quelltransfer blockiert:** Ein frischer offizieller Library-Downloadversuch des Originalquellartefakts endet weiterhin mit „download failed“ ohne verfügbaren HTTP-Status. Separate reguläre HTTPS-HEAD-Anfragen an beide benötigten Library-Speicherhosts ergaben am 4. Oktober 2026 um 12:26:56 UTC „Tunnel connection failed: 403 Forbidden“. Das ist eine **Proxy-CONNECT-Ablehnung**, keine Azure-HTTP-Antwort. Die konkrete Richtlinienregel und Antwortheader sind nicht verfügbar. Eine gezielte Freigabe dieser beiden Speicherhosts sowie zusätzlich der geprüften offiziellen JDK-Bezugsquelle ist angefordert; ohne geänderte Voraussetzung erfolgen keine neuen Transfers oder Umgehungsversuche.

**Java-Inventar präzisiert:** Die javac-Startdatei fehlt, das vorhandene Modul jdk.compiler startet aber javac 21.0.12.1 über Java. Die inzwischen abgeschlossene minimale Offline-Gradle-JavaCompile-Probe scheitert jedoch. Gradle 8.14.3 meldet Is JDK: false und findet keine passende Compiler-Toolchain. bin/javac und lib/ct.sym fehlen; Modulkompilierung mit --release 21 scheitert. -source 21 -target 21 über das Modul funktioniert und die JavaCompiler-API ist verfügbar, genügt aber nicht für Gradles reguläre Toolchain-Erkennung. Eine vollständige JDK-21-Installation wird benötigt. Die erfolgreiche direkte Modulkompilierung erzeugte nur eine isolierte .class-Datei als Diagnoseartefakt; die reguläre Gradle-Probe scheiterte. Keine App wurde kompiliert. Eine zuvor geprüfte offizielle JDK-Bezugsquelle wurde ebenfalls bereits beim Proxy-Tunnel mit 403 abgewiesen; daraus folgt kein nachgewiesener Vendor-HTTP-Fehler.

**Keine neue Buildfreigabe:** Noch kein Appbuild und keine neue APK. Startende Werkzeuge und eine isolierte Compilerprobe bestätigen nicht die erfolgreiche Kompilierung, Prüfung oder Signierung der App.

## Abgrenzung zur nächsten Lieferung

Die erste neue Kern-APK soll die gesicherte weiterentwickelte Basis liefern. Aufgabenkonstruktor, Wirkungsanalyse, Projektgedächtnis, Variantenvergleich, Reviewkarten, Shadow, Autopilot, neue Ansichten, Begleiter und Video-Studio bleiben im [Gesamtplan](15-roadmap.md). Ihre offene Umsetzung wird durch den Dokumentationsabschluss nicht geschlossen.

[Quellenregister](reference/evidence-register.md) · [Freigabegates](16-acceptance-matrix.md)
