# LowQuantFlow · Prototyp 0.5.3 · 5. Oktober 2026

VersionCode: **11**. Android-Paket: `de.lowgiga.cuecommandmesh.next`. Dieser geprüfte Quell- und Webstand ist die Grundlage der getrennt erzeugten Test-APK; die APK wurde separat geprüft (siehe Nachtrag); das Verhalten auf dem S25 benötigt weiterhin eigene Nachweise.

## Enthalten

- Der Assistent verwendet nachvollziehbaren lokalen Projektkontext. Seine Beratung ist als deterministische Simulation gekennzeichnet. Konfigurationsvorschläge zeigen den tatsächlichen Unterschied; erst die bewusste Bestätigung schreibt. Erfolg erscheint erst nach separatem Quittungsabruf. Unklare Schreibantworten werden lesend geklärt.
- Persönliche Gedächtnisentwürfe werden lokal gesichert. Ein wiedergefundener Entwurf wird ausdrücklich geöffnet. Projektwechsel, Navigation, spätere Antworten und Speicherkonflikte sind abgesichert; ein Entwurf wird nicht automatisch zum Projektvorschlag.
- Lokale Kontexthinweise erklären die konkrete Graphauswahl. Häufigkeit, Detailgrad und Abschalten verwenden den bestehenden Einstellungsspeicher. Hinweise verändern weder Arbeitsdaten noch Entwürfe.
- Vier konfigurierbare mobile Navigationsplätze, kompakte Bereichshilfe und das platzsparende App-Menü ergänzen die bestehenden Bereiche. Neuladen bleibt ausdrücklich und nennt gesicherte sowie noch ungesicherte Eingaben korrekt.
- Die Budgeteingabe erlaubt auch leeren Zwischenstand und vollständiges Ersetzen; ungültige Eingaben werden nicht heimlich geklemmt oder gespeichert.
- Der optionale lokale Begleiter und begrenzte Übergänge reagieren auf echte UI-Ereignisse. Bewegungsauswahl, Energiesparen, reduzierte Bewegung und ausgeblendete Ansichten begrenzen die Darstellung. Es wird keine laufende Modellaktivität vorgetäuscht.
- Native AR zeigt konkrete Tracking- und Platzierungshinweise. Knoteninformation, Beziehungen und Einstellungen sind gezielt erreichbar; veraltete Rückgaben oder Fokusaufträge werden verworfen. Native Knoten erhalten eine neue räumliche Darstellung mit begrenzter Bewegung. Ein terminaler Fehler bleibt ein Fehler und kann durch spätere Detailaktionen nicht zum Erfolg werden.
- Ein lokaler Qualitätsvertrag bindet den angenommenen Stand an Quellen, vorhandene Tests und konkrete Verhaltensnachweise. Fehlende Quellen, ungeprüfte Änderungen geschützter Dateien, deaktivierte Tests, falsche Prüfsummen, fehlgeschlagene Prüfungen und neue Quelldrift blockieren den neuen Prüfbefehl.

## Tatsächliche Prüfung

- Vollständiger `verify:quality`-Lauf: **1.324 Host-Testfälle** bestanden, davon 50 Gate-Fixtures und 1.274 Produkt-/Integrationstests
- Zusätzlich 18 Renderer-Szenarien sowie TypeScript-, Herkunfts-, Generator- und Webbuild-Prüfungen bestanden
- Echter Offline-Gradle-Lauf: **62 native Unit-Tests**, keine Fehler oder übersprungenen Tests; AR-Lint ohne Befund
- Unabhängig bestätigt: 984 Quelldateien, 57 frische Webbuilddateien, alle fünf Gatephasen und unveränderte Quellen vor/nach dem Prüflauf

Der Qualitätsvertrag ist ein lokaler prüfbarer Prozess mit unabhängig bestätigtem Ausgangsstand. Er ist kein manipulationssicherer Selbstnachweis und kein bereits eingerichteter verpflichtender GitHub-Branchschutz. Ein vertrauenswürdiger Host muss akzeptierten Prüfer und Vertragspin verwenden.

## Offene Grenzen

Browser-Pixelabnahme, S25-Touch-/Kameraabnahme, Instrumentierung auf einem Gerät, GPU-Leistung, Bildrate und Batterieverbrauch wurden für diesen Gesamtstand **nicht gemessen**. Bekannte große Vite-Chunks, Gradle-Deprecations und die vorhandene npm-Umgebungswarnung bleiben dokumentiert. Eine Produktionsfreigabe oder Fehlerfreiheit wird nicht behauptet.

Die Beratung hat keinen angebundenen Live-Modellserver. Persönliche Entwürfe, Gerätekonfiguration und Workflow-Wiederaufnahme haben unterschiedliche Speicher-/Exportgrenzen. Der vorhandene Systembackup-Pfad ist kein vollständiger Restore. Die zehn ursprünglichen Zielpakete sind ein fortlaufender Ausbau, keine pauschal abgeschlossene Liste.

Historische Testauffälligkeiten bleiben im Prüfbeleg sichtbar: eine eng korrigierte React-`act`-Wartegrenze, ein aktualisierter Selektor nach einer bewussten Beschriftungsänderung und der anschließend unabhängig geschlossene native Terminalstatusbefund. Keine fachliche Assertion wurde zur Grünfärbung entfernt.

## Identität und Nachprüfung

- Quellinventar: `FINAL-files.sha256`, 984 Dateien, 13.296.294 Bytes
- SHA-256 des Quellinventars: `8be6face68bfa3307c92deb86d386850215c7d41e2fe781ac2206278a54dd7ea`
- Webinventar: `FINAL-build-files.sha256`, 57 Dateien, 5.940.515 Bytes
- SHA-256 des Webinventars: `1f21d2c73d306e9feb35e5b4b6a23587f0c8527b33a2ce767c4ed16c49cc682a`
- Unabhängig angenommener Vertragspin: `09e370e0db63c6b420adcac7ac5594b8d4721ced73d46a65759d5b0a22ca56a3`

Mit den vorhandenen, lockgebundenen Abhängigkeiten im Projektverzeichnis:

```sh
npm run verify:quality -- --contract-sha256 09e370e0db63c6b420adcac7ac5594b8d4721ced73d46a65759d5b0a22ca56a3
```

Der vollständige Prüfbeleg, die neue Baselineannahme und die frischen Builddaten liegen getrennt vom Quellinventar. Alte eingebettete Buildberichte bleiben ausdrücklich historische Dokumente. Kein privater Signierschlüssel ist Bestandteil dieser Übergabe.

## Nachtrag: separat geprüfte Android-Test-APK

Dies ist ein **debug-signierter Testprototyp**, keine Produktionsfreigabe.

- Datei: `LowQuantFlow-0.5.3-prototype-20261005-debug.apk`
- Größe: 8.585.082 Bytes
- SHA-256: `06ec3b1abf5d98b57c21d99442a2cb950ed337d13719790a2015194512ec5e0f`
- Paket: `de.lowgiga.cuecommandmesh.next`, VersionCode 11, VersionName `0.5.3-prototype-20261005`
- Separater Gradle-Build erfolgreich, Exit 0; 62 native Unit-Tests ohne Fehler oder übersprungene Tests
- Signatur geprüft: derselbe Signierer wie bei der zuvor gelieferten 930-Dateien-Test-APK
- 57 Webassets bytegenau mit dem angenommenen Webbuild identisch; zusätzliche Capacitor-Dateien `cordova.js` und `cordova_plugins.js`
- AR-Lint ohne Befund; App-Lint mit 13 dokumentierten Warnungen, keine Warnungsfreiheit behauptet
- 16-KiB-ZIP-Alignment geprüft; dies ist kein Hardware-Kompatibilitätsnachweis

Die APK ist als Update für die zuvor gelieferte `.next`-Testapp vorgesehen. Bei einem Installationskonflikt die vorhandene App nicht deinstallieren: Eine Deinstallation kann lokale Daten löschen. Stattdessen den genauen Fehler prüfen. Die ältere APK bleibt separat aufbewahrt; ein problemloses Downgrade oder eine vollständige Datenwiederherstellung wird nicht versprochen.

Keine neue S25-, Touch-, Kamera-, Tracking-, GPU-, Bildraten- oder Akkuabnahme wurde durchgeführt. Die eigenständige HTML-Zukunftsvorschau ist eine Designstudie und kein Beleg, dass sämtliche dort gezeigten Ansichten in dieser APK enthalten sind.
