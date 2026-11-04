> Historischer FINAL984-/0.5.3-Nachweis. Die damalige Quelle ist im [Commit 031065c](https://github.com/Lowgiga/APP/tree/031065c05bf098ee641143a99a8c0872f98cd4ea/app) erhalten. Der aktuelle Entwicklungsbranch enthält den [webgeprüften 0.5.4-Stand](24-appearance-054-web.md); dessen native/APK-Gates bleiben getrennt offen.

# FINAL984 · geprüfter Prototyp 0.5.3

Stand: 5. Oktober 2026. Android-Versionscode 11, Paket `de.lowgiga.cuecommandmesh.next`.

## Exakter Repository-Umfang

Der geprüfte lokale Finalstand wird unverändert nach `app/` übernommen. Gegenüber [Freeze 949](22-source-freeze-949.md) sind 35 Dateien neu und 33 geändert; keine Quelldatei wurde gelöscht. Die bestehende Repository-Dokumentation und die 949-Nachweise bleiben erhalten.

- 984 Quelldateien, 13.296.294 Bytes
- Source-SHA-256: `8be6face68bfa3307c92deb86d386850215c7d41e2fe781ac2206278a54dd7ea`
- Git-Tree von app/: `f8080983412f4b2ca3693112dbfef8f954ee352c`
- Alle 984 Remote-Pfade, Git-Blob-SHAs und Dateimodi stimmen mit dem manifestgebundenen lokalen Finalstand überein
- Webbuild: 57 Dateien, 5.940.515 Bytes
- Buildinventar-SHA-256: `1f21d2c73d306e9feb35e5b4b6a23587f0c8527b33a2ce767c4ed16c49cc682a`

Die Whitelist [FINAL-files.sha256](reference/final984/FINAL-files.sha256) bestimmt ausschließlich die 984 Quelldateien. Lokale Gradleausgaben, temporäre Dateien und node_modules gehören nicht zum Quellstand.

## Funktionales Delta

Enthalten sind das kompakte System-/App-Menü, begrenzte Assistentenbewegung, native AR-Tracking-/Detailzustände, räumliche Knotendarstellung und Bewegungsschutz, Versionsmetadaten 0.5.3/11 sowie ein bewusst angenommener lokaler Qualitätsvertrag mit Tests.

Bestehende Assistenz, Begleiter, persistente persönliche Entwürfe, Kontexthinweise, 17 Arbeitsbereiche und 2D-/3D-/AR-Wege bleiben erhalten. Native Terminalfehler werden nicht durch spätere Detailaktionen als Erfolg umgedeutet.

Die Paket-Lockdatei ändert nur die zwei Versionsfelder des Wurzelpakets; keine Abhängigkeit wurde für diesen Übergang ausgetauscht.

## Belegte Prüfungen

[Prüfbeleg](reference/final984/FINAL-Pruefbeleg.json), [vollständiges Hostlog](reference/final984/984-verify-quality.log), [Qualitätsbericht](reference/final984/984-quality-report.json), [native Ergebnisse](reference/final984/984-native-results.json) und [Gradlelog](reference/final984/984-native-offline.log):

- `verify:quality`: Exit 0, 1.324 bestandene Host-Testfälle = 50 Gate-Fixtures + 1.274 Produkt-/Integrationstests
- 0 Fehler, 0 übersprungene Tests, 0 act-Warnungen; zusätzlich 18 Renderer-Szenarien
- TypeScript, Drift-, Generator- und Webbuildprüfungen bestanden; alle fünf Gatephasen bestanden, keine Quelldrift
- Separater tatsächlicher Offline-Gradle-Lauf: 62 native Unit-Tests = 58 AR + 4 App; keine Fehler oder übersprungenen Tests, AR-Lint ohne Befund
- Unabhängige Gegenprüfung von 984 Source- und 57 Builddateien, Vertragspin, Gatephasen sowie Host-/Native-Nachweisen: PASS

Angenommener externer Vertragspin: `09e370e0db63c6b420adcac7ac5594b8d4721ced73d46a65759d5b0a22ca56a3`. Der lokale Qualitätsvertrag ist kein manipulationssicherer Selbstnachweis und kein bereits eingerichteter verpflichtender GitHub-Branchschutz.

Diese Veröffentlichung wiederholt keine Tests und verändert keine Quelldateien: Sie übernimmt den identischen geprüften Finalstand und gleicht dessen Remote-Inhalt ab. Die GitHub-CI ist gesondert vom vorliegenden lokalen Nachweis zu betrachten.

## Separat gelieferte APK

Der [Release-Nachtrag](reference/final984/FINAL-Release-Notes.md#nachtrag-separat-geprüfte-android-test-apk) dokumentiert die separat geprüfte und gelieferte debug-signierte Test-APK 0.5.3 / Code 11. Die APK und Signierschlüssel werden nicht in dieses Repository übertragen.

Der Integrator-Prüfbeleg hält zutreffend fest, dass der Integrator selbst keine APK gebaut hat. Der nachfolgende separate APK-Nachweis steht in den Release Notes. Er bestätigt unter anderem 57 passende Webassets, denselben Signierer wie bei der vorherigen Test-APK und 13 dokumentierte App-Lint-Warnungen. AR-Lint war ohne Befund.

## Offene Grenzen und Schutz

Keine reale Browser-Pixel-, S25-/Touch-/Kamera-/Tracking-/GPU-Abnahme, keine gemessene Bildrate oder Akkulaufzeit. Vite-Chunk-, Gradle-Deprecation- und bestehende npm-Umgebungswarnungen bleiben dokumentiert. Keine Produktionsfreigabe oder Fehlerfreiheit behauptet.

Keine APK, privaten Signierschlüssel/Keystores, .env-Dateien, lokale SDK-Konfiguration, node_modules, Gradle-/dist-Ausgaben oder gesonderte private Referenzfotos hochgeladen. Der Delta enthält keine neuen Hosting-/Deploymentkennungen; die bereits ausdrücklich freigegebene ursprüngliche Projektmetadokumentation bleibt unverändert.

Originaldokumente und frühere Prüfstände sind historisch erhalten. Die eigenständige HTML-Zukunftsvorschau ist eine Designstudie und kein Nachweis zusätzlichen Funktionsumfangs dieser App.
