> Historisch: dokumentiert die AR-/Dokumentintegration bis V6/Port 0.4. Native AR Revision 6 bleibt unverändert in V7 erhalten. Aktuelle Gesamtintegration: V7-INTEGRATION.md und INTEGRATION-RESULTS.md.

# Native Kamera-AR und gebündelte Quelldokumente

Stand: 0.4.0-native-ar-preview, Websitebasis V6/App 1.4.1. Experimenteller Android-Teststand. Kein tatsächliches Gerät, Kamerabild, Tracking, GPU, SAF-Dialog oder Runtime-Lifecycle wurde hier geprüft.

## Kontrollierter Anschluss

Das separat freigegebene ARCore-Modul Revision 6 liegt unverändert unter `android/cue-native-ar/`. Sein 18-Dateien-Manifest trägt SHA-256 `6cd46e58a998283b5a4044d31b856ac0d39f35d2640f6881e37f49013d29e915`. `npm run check:native-ar` prüft Inhalt und Inventar vor jedem Webbuild. Vertrag, Design, Herkunft und Lizenzhinweise liegen unter `extensions/native-ar/`. Pinned: Capacitor 8.5.2, ARCore 1.54.0, compile/target SDK 36, minSdk 24. Keine Cloud Anchors, Geospatial-Funktionen, Aufzeichnungen oder Graph-Uploads.

- MainActivity registriert `CueNativeARPlugin` vor `BridgeActivity.onCreate`; Back- und Dateiplugin bleiben erhalten
- App-Gradle bindet das Modul ausdrücklich ein. Der zusammengeführte Hostmanifest hat optionale Kamera-/AR-/GLES-Merkmale, private AR-Activity, ARCore optional, Backup und Cleartext ausgeschaltet, keine breite Storage-Berechtigung
- Es gibt keinen automatischen nativen Availability-Aufruf beim Appstart oder Öffnen der normalen 3D-Ansicht. „Kompatibilität prüfen“ ist eine bewusste Aktion; die UI nennt vorher eine mögliche Google-Netzabfrage
- „AR-Hinweise öffnen“ zeigt die native Datenschutzhinweise einschließlich Google-Links. Erst „Kamera-AR starten“ in dieser Activity führt zum Permission-/Installationsschritt. Ablehnung lässt die übrige App nutzbar
- Energiesparmodus sperrt beide AR-Einstiegsaktionen; ein sichtbarer Weg führt zu den App-Einstellungen. Der Adapter übersteuert die Einstellung nicht
- Der native Graph ist statisch, ohne automatische Rotation oder dekorative Animation. Kamera-Tracking und eigene Gerätebewegung sind davon ausdrücklich getrennt. Hologramm bleibt ein Bildschirmstil; die schematische Geometrie ist keine Vermessung

## Gemeinsamer Zustand und Snapshotgrenzen

`NativeARPanel` bekommt den aktuellen, zentral geladenen WorkState und denselben Graphkern wie 2D/3D/Lernlevel. Der gesamte gewählte Bereich bzw. die ausdrücklich gewählte Nachbarschaft wird verwendet; das bestehende 32-Knoten-Limit der Bildschirmansicht wird nicht zusätzlich auf AR angewandt. Bereich, Knoten-/Beziehungsanzahlen und Textverdichtung sind vorher sichtbar.

`src/platform/native-ar.ts` normalisiert die vorhandenen Positionen mit einem gemeinsamen Maßstab nach [-1,1]. Echte IDs, sämtliche Knoten und sämtliche Kanten inklusive paralleler/endpunktgleicher Beziehungen bleiben in Reihenfolge erhalten. Überlagerte Linien werden gezählt und erklärt. Linien haben keine Richtungs-/Relationsbeschriftung; die originalen Knotendetails und Beziehungstexte bleiben in der normalen App erreichbar.

Harte Grenzen: 1–256 Knoten, 0–4096 Kanten, 512 KiB UTF-8, IDs bis 128 UTF-16-Einheiten, Label bis 120 und Details bis 1000. Beschriftungen/Details werden Unicode-sicher verdichtet; Zahl der veränderten Texte wird angezeigt. Identitäten und Kanten werden niemals abgeschnitten. Ungültige oder zu große Bereiche sperren den Start mit konkreter Erklärung und Hinweis auf kleineren Scope.

Die Revision enthält den ungekürzten Graphinhalt und die lokale WorkState-Revision. Auch eine Änderung hinter dem gekürzten Textende macht ein Ergebnis veraltet. Bridge-Aufrufe sind gegen Mehrfachklick serialisiert, Requests werden vor dem Await validiert und kopiert, Antworten strikt geprüft. Nur `closed` plus gleiche aktuelle Revision plus aktuelle Mitgliedschaft kann eine Informationsauswahl übernehmen. Availability führt niemals automatisch zum Öffnen. Ein expliziter active-Vertrag und Intentgeneration invalidieren verspätete Antworten beim Verlassen der Ansicht, auch wenn dieselbe aufbewahrte Komponente vor der Antwort wieder eingeblendet wird. Bei geändertem Zustand, verborgener/unmontierter Oberfläche, Fehler oder unpassender Antwort wird die Auswahl verworfen. Es gibt keine WorkState-Schreibfunktion, Abschlussmarkierung oder automatische Task-/Workflowaktion. `placed` wird nur als native Sitzungsmeldung erläutert, nicht als unabhängiger Erfolgsnachweis.

## Textdokumente im bestehenden Source-Sheet

Die bisherigen .md/.json-Links verwendeten `target=_blank` und generische native MIME-Erkennung. Ein konkretes Blankfenster oder Downloadproblem wurde nicht auf Hardware reproduziert; deshalb wird nur der Codepfad als ungesichert bezeichnet.

`scripts/build-document-overlay.mjs` bindet genau vier unveränderte Originaltexte statisch ein: cue-team-initialisierung.md, cue-handoff.md, low-handoff.md und make-pruefung.json. Die Laufzeit akzeptiert nur exakte `/documents/...`-Schlüssel. Externe URLs, Pfadtraversierung, Encodings, Queries und Fragmente werden abgewiesen. Keine URL-Fetches, iframes oder HTML-/Markdown-Ausführung. React rendert den vollständigen Originaltext. „Originaldatei sichern“ verwendet den vorhandenen Plattformadapter mit ursprünglichen Bytes und passendem MIME. Abbruch, Fehler und bestätigtes Speichern bleiben getrennt. Screenshotzweig und vorhandenes Sheet-Schließen bleiben erhalten. low-handoff.md besitzt im gelieferten Quellenkatalog keinen eigenen Link; der begrenzte Adapter unterstützt es, ohne einen persönlichen Auftrag daraus zu erzeugen.

## Prüfnachweise

- `native-ar-final-tests.txt`: 490/490 Tests (137 Basis/V6, 84 Integration, 19 frühe Reviewregressionen, 220 Module, 30 Level-Domain) plus 18 Renderer-Lifecyclefälle. `native-ar-system-verification.txt`: zusätzlich TS und Webbuild. DOM- und Bridge-Doubles sind keine Geräteprüfung
- `native-ar-host-build.txt`: Offline-Hostkompilierung, 152 ausgeführte Gradle-Tasks, App 4 und AR-Modul 23 JVM-Tests. App-Lint 0 Fehler/13 bekannte Scaffoldwarnungen; AR-Lint 0 Issues
- `native-ar-host-summary.json` und `native-ar-host-manifest.xml`: echte kompilierte Manifestmerkmale und Hashes, Grenzen maschinenlesbar
- `native-ar-cross-language-fixtures.txt`: durch den Produktions-JS-Konverter erzeugte 23/24- und 256/4096-Snapshots wurden mit dem tatsächlichen Java-GraphSnapshot-Parser und gepinntem JSON-java akzeptiert; alle Kanten erhalten. Das ist eine Sprachgrenzenprüfung, kein Android-UI-Lauf
- Permanenter DOM-Test öffnet Dokumente im Original-Source-Sheet, schließt sie, prüft den unveränderten Screenshotzweig und den Wechsel zu Studio ohne verstecktes Dialogportal

Die finale unabhängige Delta-Prüfung, ein isolierter APK-Build mit Nachweis aller gebündelten Webassets und die Hardwarecheckliste aus `extensions/native-ar/docs/BRIDGE.md` bleiben getrennte Abnahmen. Vollrestore bleibt Vorschau; der isolierte Restore-Entwurf ist nicht integriert.

Versetzter Build mit Leerzeichenpfad byteidentisch: `bee97f69820fb370a122b0b23ee520b98dc8bf251b578afc07982eb42c71fa6e`. In dieser getrennten Buildkopie erhält `cap sync android` die manuelle Modulregistrierung/-abhängigkeit und kopiert alle 54 Webdateien einschließlich der vier bytegleichen Textdokumente. Das bestätigt die generierte Assetgrundlage, noch keine gebaute oder installierte APK.

## Eng begrenzte Revision 6: native Buttonkontraste

Die vorhandene Material-Dark-Buttonfarbe war nicht zum expliziten dunklen Text passend. Revision 6 ergänzt ausschließlich eine explizite opaque Button-/Textpalette mit StateLists für aktiv und deaktiviert, samt vier JVM-Regressionsmethoden. Sechs native Buttons verwenden diesen gemeinsamen Pfad. Berechneter Farbkontrast aktiv 12,82:1, deaktiviert 5,87:1; Ripple-/Fokusdrawable und 48-dp-Ziel bleiben erhalten. Keine API-, Snapshot-, Geometrie- oder Lifecycleänderung. Das ist ein geprüfter Farb-/Sourcefix, keine neue Hardware-/Screenshotabnahme. Die ursprünglichen Review-/Buildnachweise oben betreffen den damaligen Revision-5-Freeze; aktuelle Nachweise stehen in `native-ar-revision6-summary.json` und `native-ar-revision6-host-build.txt`.
