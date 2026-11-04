> Historisch: geprüfter V6-Zwischenstand. Aktueller Endstand: V7, siehe V7-INTEGRATION.md und INTEGRATION-RESULTS.md.

# Kontrollierte V6- und Level-/Browser-AR-Übernahme

V6 / App 1.4.1 wurde read-only vom vollständigen, sauberen Commit `23ae42c2d83d5b31dcc9f61adeefb22bb1e1f03a` als neuer kanonischer Snapshot übernommen. Alle 208 Dateien stimmen mit `provenance.json` überein. Das ursprüngliche V5-Inventar bleibt unter `provenance/v5-upstream.json`; der zuvor unabhängig freigegebene V5-Integrationssnapshot ist gesondert archiviert.

AGENTS.md und COLLABORATION.md der neuen Kooperationswave wurden gelesen. Diese Integration verändert keinen Ursprungscheckout, erstellt keine fremde Arbeitsinstanz und veröffentlicht nichts. Low ist kein Codex-Subagent. Verbindung, Identität, Zustellung und Annahme bleiben unbestätigt.

Der neue Kooperationsbereich bleibt unter Agenten verfügbar. JSON-Dateien und Kopieren gehen über die expliziten Plattformadapter. Vor einer ersten lokalen WorkState-Speicherung wird kein persönlicher Brief aus dem Beispielzustand exportiert. Der Bereich bezeichnet seine Grundlage ausdrücklich als lokale Installation; ein verifizierter persönlicher Cloudimport ist nicht belegt. Diese Aussage liegt auch im portablen Artefakt selbst vor, nicht nur in der UI. Eine Berichtnotiz bleibt ungeprüfte Historie und bewirkt keine Ausführung.

## Geprüfte Level-/AR-Schicht

- Revision 3, unveränderte 11 gelieferten Quelldateien
- Patch SHA-256: `a1429df18c53d09e2da540d8e4779b83ffc36eb7290a3e1729f0013319b777b9`
- Manifest SHA-256: `6600c0f710dc00a199c0715173d9e05af1d15ee60642129ec658654cdd65b190`
- `scripts/build-level-overlay.mjs` prüft die Eingangshashes, wendet Hunks nur bei genau passendem Kontext an und prüft die vollständigen Zielhashes
- Die einzige bewusste zusammengesetzte Zieldatei ist Hilfe: genau der zusätzliche V6-Kooperationseintrag bleibt neben den geprüften Lern-/AR-Änderungen erhalten. Jede weitere Abweichung bricht die Generierung ab
- Vier Domainmodule liegen als explizite generierte Overlays vor; WorkState, Validatoren und Ereigniskern werden nicht dupliziert oder verändert
- Native Diagnose des Browser-AR-Moduls ist an die verifizierte WebView-Grenze angepasst. Der APK-https://localhost-Ursprung ist kein extern erreichbarer Webserver und wird nicht als Chrome-Ausweichlink angeboten
- Ursprüngliche Clipboard-/Workbook-Pfade erhalten nach der Levelschicht dieselben sicheren Plattformtransformationen

## Eigene Verifikation

460 Node-/DOM-Tests bestanden: 137 Basis/V6, 54 Integration, 19 frühere Reviewerregressionen, 220 Modultests, 30 Level-/AR-Domänentests. Zusätzlich bestehen 18 Renderer-Lifecyclefälle mit installiertem Three-XRManager und kontrollierten Browser-/GPU-Doubles. TypeScript und Webbuild sind grün. V6-/Level-Integrationsreview und finaler nativer Build folgen getrennt.

Keine echte Kamera-, Tracking-, GPU- oder Geräteprüfung wird dadurch behauptet. Der geprüfte Browser-Hit-Test läuft nicht allein durch CAMERA-Permission in Android WebView. Primärbeleg: https://github.com/chromium/chromium/blob/main/android_webview/browser/aw_field_trials.cc . Ein separat reviewter ARCore-Adapter ist dafür erforderlich.

## V6-Delta-Reviewkorrekturen

Zwei unabhängig reproduzierte Befunde wurden gezielt behoben:

1. Die ursprüngliche Briefansicht warnte lokal, der exportierte Inhalt verlor jedoch diese Herkunft. `src/local-collaboration.ts` erzeugt jetzt einen deterministischen lokalen Brief mit `device-local`, `local-installation`, `personalCloudImport: not-verified` und `personalWebsiteAssignment: not-established`. Der Transport ist manuelle Weitergabe ohne automatische Zustellung oder Cloudsync; der Website-MCP-Leseweg ist ausdrücklich ein separater Cloudstand und bindet diesen lokalen Brief nicht. Alle Felder liegen innerhalb des semantischen Hashs. UI-Vorschau, JSON, Markdown/Clipboard und Reportzuordnung verwenden denselben Adapter. Ein Websitebericht zum ansonsten gleichen Zustand passt nicht zur lokalen Bindung. Der bestehende strikte Reportparser einschließlich Dateigrenzen bleibt unverändert. `generatedAt` bleibt aus dem Hash ausgeschlossen; der Hash ist keine Signatur und kein Identitätsnachweis
2. Die gesicherte Android-WebView-Grenze hat im Browser-AR-Modul Vorrang vor Policy-/HTTPS-Fehlerzweigen. Selbst ein widersprüchlicher XR-Stub im nativen Kontext löst keinen Browser-WebXR-Probe aus. Native AR ist damit nicht implementiert, sondern korrekt diagnostiziert

Nachweis vor Korrektur: `v6-review-before-fixes.txt` mit beiden tatsächlichen Fehlern. Regressionen: eigene Artefakt-/Hash-/Report- und DOM-Datei-/Clipboardtests sowie Native-Diagnosematrix. Vollprotokoll: `v6-review-fixed-verification.txt`. An Storageverträgen, Restore oder nativen Javaquellen wurde nichts geändert.

Erneuter versetzter Build (Pfad mit Leerzeichen) ist byteidentisch: `2eeecc7cd81604f0f098b45fefa451050643ddece47fa4c8fdc7886476e5b4b6`; Protokoll `v6-review-fixed-space-build.txt`. Die nativen Javaquellen behalten ihre bereits separat geprüften Hashes (CueFilesPlugin `6fe4ac59…`, MainActivity `3c1a4c2c…`). Eine erneute Native-Integration oder ein APK wird hierdurch nicht freigegeben.
