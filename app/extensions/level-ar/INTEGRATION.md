# Integrationsvertrag

1. Revision 3 ersetzt den zuerst gelieferten Patch. Nur nach unabhängiger finaler Hashabnahme übernehmen. Baseline-Commit: `2b838b4f574acfaff72013c270a1fa637eb995c6`.
2. `manifest.json` enthält für jede Datei den erwarteten Baseline-SHA-256 und den eingefrorenen Ziel-SHA-256. Alle Dateien unter `source/` müssen vor Verwendung ihren Zielhash erfüllen. Neue Dateien haben `baselineSha256: null`.
3. Auf einem getrennten V5-Checkout: `git apply --check /absoluter/pfad/level-ar.patch`, danach bei bewusster Übernahme `git apply /absoluter/pfad/level-ar.patch`. Die Read-only-Baseline selbst wurde nicht geändert.
4. Für `cue-system`: die manifestgeprüften Dateien als gepinnte zweite Quellschicht übernehmen, dann die vorhandenen Plattform-Transformationen anwenden. **Keine Dateien hier wurden direkt in cue-system geschrieben.**
5. Der ursprüngliche Clipboard-Block in `app/mesh-space.tsx` ist unverändert. Der Workbook-Blob-/Downloadblock in `app/academy-panel.tsx` ist unverändert. Die vereinbarten `copyPlatformText`-/`saveTextFile`-Transformationen können weiterhin dort ansetzen. Zusätzlich aktualisiert: `app/help-panel.tsx`, damit Hilfe keine freie Szene ohne Flächenerkennung mehr beschreibt.
6. Neue Imports: `lib/learning-levels.ts` (Academy/SpaceModel), `lib/ar-support.ts` (MeshSpace/Renderer), `lib/ar-placement.ts` (MeshSpace/Renderer). Keine Paket-, State-Schema-, DB- oder API-Migration.
7. Renderer-Interface erweitert: `SpaceControls.placeAR()` und `cancelAR()` und Prop `onPlacement(status)`. Vorhandenes `centerAR()` bedeutet jetzt explizit neu platzieren, nicht vermeintlich an Fläche zentrieren. Academy erhält optional `controls` mit `openLesson(id)`; die React-Ref-Verbindung ist nur für explizite Nutzerauswahl.
8. Domänentests ausführen: `node --test tests/*domain.mts`; anschließend `node tests/level-ar-renderer.mjs` für 18 harte Lifecycle-Szenarien mit echtem installiertem Three-XRManager. Dann TypeScript mit `--noEmit --incremental false --noUnusedLocals --noUnusedParameters`, anschließend Produktionsbuild. Neue Domainmodule linten separat sauber; die fünf verbleibenden UI-Lintfehler sind Bestandsregeln, siehe Vergleich.
9. Gerenderten Browserlauf erst in einer zugelassenen lauffähigen Browserumgebung ausführen. Das Script unterstützt `MESH_PLAYWRIGHT_MODULE`, `MESH_PNG_MODULE`, `MESH_CHROMIUM_EXECUTABLE`, `MESH_BROWSER_AUDIT_OUTPUT`; axe-core wird aus den vorhandenen App-Abhängigkeiten geladen. Browserprüfung startet eine isolierte lokale D1 mit synthetischer Testidentität, keine Produktionsanmeldung.
10. Vor Produktfreigabe Android-Kamerapfad nach `REPORT.md` abnehmen. Browser- oder Domänentests ersetzen das nicht. Keine AR-, Hologramm- oder Verankerungsbehauptung aus Inline-Canvas oder Shaderbildern ableiten.

## Unabhängiger Reviewfokus

- Sessionende während `requestReferenceSpace`, `requestHitTestSource` und `renderer.xr.setSession`; verspätete Ressource muss genau einmal freigegeben werden
- Benutzer kann Start abbrechen/Session verlassen; kein AR-Status ohne tatsächliche XR-Presentation
- Letzte gültige Trefferpose darf nach Trefferverlust nicht versehentlich platziert werden
- Bedienelemente und Overlay in Kameraansicht praktisch prüfen; sichere Wiederherstellung der Inlinekamera nach Exit/Fehler
- Alte Quizabschlüsse und XP unverändert; Transfer nur aus Beleg/Review/vollständiger Abhängigkeit, keine neuen Kompetenzbehauptungen
- Lernfilter, Auswahl-Link, nächste Lernphase, Keyboard-/Mobilverhalten und bestehende Clipboard-/Exportadapter zusammen prüfen

## Gepinnte Lebenszyklusannahme

Three.js bleibt auf 0.186.1. Die gezielte terminale isPresenting-Korrektur ist nur für eine managerseitig bereits entfernte Session erlaubt. Bei Three-Upgrades diese Annahme und den vollständigen Rendererharness erneut prüfen. Die DOM-/GPU-Doubles ersetzen keine Kamera- oder Layoutabnahme.
