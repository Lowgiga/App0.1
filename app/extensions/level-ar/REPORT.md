# V5 Lernlevel und Kamera-AR: Befund und isolierter Patch

## Ergebnis

Der Patch ist lokal gebaut und typgeprüft. 111 Domänentests bestanden, davon 30 neue Level-/AR-Regressionstests. Die Originalcodebasis blieb unverändert. Revision 3 enthält die unabhängig gefundenen Korrekturen; finale Hashabnahme und anschließende Integration folgen, **nicht für eine behauptete Android-/Kamera-Hardwareabnahme**.

- Baseline: `2b838b4f574acfaff72013c270a1fa637eb995c6`
- Patch: `level-ar.patch`
- Gepinnte Quelldateien: `source/`; SHA-256 je Datei in `manifest.json`
- Patch-SHA-256: `a1429df18c53d09e2da540d8e4779b83ffc36eb7290a3e1729f0013319b777b9`

## Befund am Bestand

1. **Echtes Bildschirm-3D ist bereits vorhanden.** `app/space-renderer.tsx` baut Three.js-`PerspectiveCamera`, `IcosahedronGeometry`, `BoxGeometry`, `Mesh`, `BufferGeometry` und räumliche Koordinaten auf. Das ist geometrisches 3D. Ein leuchtender Shader, SVG oder Video allein wäre kein gleichwertiger Beleg.
2. **Die Academy hatte noch keinen funktionalen Levelgraph.** Fünf Themen besitzen Quiz, Fallprüfung, Begründungsnotiz und offene Transfer-Aufgaben. Gespeicherte Quiz-Booleans werden in der alten Oberfläche mit 20 XP je Thema dargestellt. Diese Werte werden erhalten; der Patch erfindet keine zusätzlichen XP oder Erfolge.
3. **Der alte AR-Pfad konnte nur ein freies Modell zeigen.** Er forderte `immersive-ar` mit `dom-overlay` an und stellte den Graphen 1,25 Meter vor die Viewer-Pose. Kein `requestHitTestSource`, keine Zielmarkierung und keine Platzierung auf einer erkannten Fläche waren vorhanden.
4. **Die konkrete Ursache am Nutzergerät bleibt unbekannt.** Der Startfehler wurde durch einen allgemeinen Catch verdeckt. HTTPS, Browser-/WebView-Unterstützung, ARCore/Google Play-Dienste für AR, Berechtigungen und eine blockierende Einbettung sind getrennte mögliche Ursachen. Ohne Gerätedaten kann keine davon als tatsächlich eingetreten behauptet werden.
5. **Physische Projektion ist ein anderer Funktionsbereich.** Weder Bildschirm-3D noch Kamera-AR projiziert Licht auf eine Wand oder erzeugt ein freischwebendes Hologramm. Dafür wären geeignete Projektionshardware und deren eigene Ansteuerung nötig.

## Nach unabhängiger Prüfung korrigiert (Revision 3)

- Gemeinsame Voraussetzungen wurden anfangs exponentiell wiederholt. Eine zyklusbewusste, pro Berechnung memoierte DFS mit ID-Index und den vorhandenen 60-Aufgaben-/12-Voraussetzungen-Grenzen macht den Durchlauf linear im gültigen Graphen. Der neue Regressionstest prüft einen gültigen 60er-DAG und höchstens eine Belegauswertung je Knoten. Der unabhängige Prüfer verglich zusätzlich 1.000 deterministische Graphen gegen ein separates Fixed-Point-Orakel.
- Ein Abbruch während ausstehender XR-Browserpromises beendet die App-Operation jetzt sofort; eine verspätet erhaltene Session wird beendet, eine verspätete Hit-Test-Quelle genau einmal freigegeben.
- Ein sichtbarer, antippbarer Abbruch liegt während des Starts innerhalb des DOM-Overlay-Roots. Platzieren und Zoom sind erst nach tatsächlichem Start erreichbar.
- Three.js 0.186 kann nach einem bereits erfolgten Sessionende einen verspäteten `isPresenting`-Wert setzen. Der terminale Zustand wird nur bei `getSession() === null` korrigiert. Eine lebende andere Session wird nicht zurückgesetzt. Pixelratio, Größe, Kamera und vorherige Graphrotation bleiben beim wiederholten Cleanup erhalten.
- Die eigentliche Renderer-Freigabe wartet auf das Ende einer bereits laufenden Three-Bindung. UI, Hit-Test und Session werden beim Unmount sofort beendet. Verspätete alte Generationen ändern keinen neuen Parent-Status.
- Eine gespeicherte Übung führt ehrlich zur erforderlichen erneuten Fallprüfung, statt mit einem Transfer-Aufruf direkt vor gesperrten Buttons zu landen.

## Implementierte Änderungen

### Lernlevel

`lib/learning-levels.ts` leitet fünf Level ausschließlich aus vorhandenen Themen, gespeicherten Lernständen, passenden Übungsnotizen und bestehenden Transfer-Aufgaben ab. Quiz, Übung und Transfer werden separat ausgewiesen. Ein Transfer zählt erst bei `Erledigt`, mindestens zwölf Zeichen Abschlussbeleg, bestätigtem Review und rekursiv vollständig belegten Voraussetzungen. Fehlende, doppelte oder zyklische Abhängigkeiten verdienen keinen Abschluss.

Die Vorwissen-Kanten sind ausdrücklich empfohlene Lernreihenfolge. Keine Altabschlüsse werden gelöscht und kein vorhandenes Thema gesperrt. Bei unbekanntem Arbeitsstand bleiben persönliche Erfolge unbekannt. Die vorhandene V4-Titelkonvention ordnet Transfer-Aufgaben einem Thema zu; umbenannte Aufgaben besitzen ohne Schemaänderung keinen sicheren Themen-Fremdschlüssel und werden daher nicht geraten.

`lib/space-model.ts` liefert identische Levelknoten und Beziehungen an 2D und Three-3D. Der neue Lernbereich ist auf fünf Knoten begrenzt; Tiefenkoordinaten sind stabil und schematisch, keine Erfolgsmetrik. Knoteninspektor und Academy verbinden das ausgewählte Level mit dem passenden Thema und der nächsten Lernphase. Offene Transfers zeigen ihre tatsächliche Aufgabe und öffnen die Matrix. Alte Quizstände können bei der Fallprüfung fortsetzen, ohne neue Fallabschlüsse zu erfinden.

### Kamera-AR

`lib/ar-support.ts` trennt unsicheren Kontext, Richtlinienblockade, fehlende XR-API, nicht unterstütztes Gerät und fehlgeschlagene Capability-Abfrage. Startfehler differenzieren verweigerte Freigabe, fehlenden Hit-Test/DOM-Overlay, SecurityError, ungültige Session und Abbruch. Die Oberfläche zeigt die Erklärung dauerhaft statt nur eines allgemeinen Toasts. Der positive `isSessionSupported`-Befund wird ausdrücklich nicht als erfolgreich gestartete Kamera ausgegeben.

Die Session verlangt `hit-test` und `dom-overlay`. `lib/ar-placement.ts` erstellt eine viewer-basierte Hit-Test-Quelle für reale Flächen. Pro XR-Frame wird die aktuelle Trefferpose übernommen. Eine Three-Ring-Zielmarkierung zeigt die Fläche; „Hier platzieren“ bestätigt sie explizit. Ohne aktuellen Treffer bleibt das Modell verborgen und Platzieren gesperrt. „Neu platzieren“ verwirft den alten Treffer. Zoom hält die bestätigte Position. Die UI sagt ausdrücklich: Flächenplatzierung in dieser Sitzung, kein dauerhafter Raumanker.

Hit-Test-Quellen werden bei Sessionende, Fehler, verspätetem asynchronen Abschluss und Unmount freigegeben; Reticle-Geometrie und Material besitzen denselben Renderer-Lebenszyklus. Der alte Kamera-/Orbit-Zustand wird nach XR wiederhergestellt. Ein nicht unterstützter AR-Start wird nicht als erfolgreiche AR-Ansicht durch einen kosmetischen Inline-Ersatz kaschiert.

## Verifikation

| Prüfung | Ergebnis | Beleg |
|---|---|---|
| Test-first: fehlende Level-/AR-Funktionen | Erwartete Assertion-Fehler vor Implementierung | `RED.log` |
| Renderer-Vertrag vor Hit-Test-Anbindung | Erwarteter fehlender Hit-Test-Vertrag | `RED-renderer.log` |
| Hilfetext vor Aktualisierung | Erwartete Abweichung alter AR-Steuerung | `RED-help.log` |
| Alle Domänentests | **111/111 PASS** | `all-domain.log` |
| Neue Tests | **30 PASS**, enthalten in Gesamtlauf | `tests/level-ar-domain.mts` |
| Bestehende Spatial-/Academy-Domäne | **27 PASS** | `existing-spatial.log` |
| Renderer-/XR-Lifecycle mit echtem installiertem Three-WebXRManager | **18 harte Szenarien PASS**, DOM/GPU/XR-Grenzen als Testdoubles | `GREEN-lifecycle.log`, `tests/level-ar-renderer.mjs` |
| TypeScript inkl. noUnusedLocals/noUnusedParameters | **PASS** | `typecheck.log` (leer bei Erfolg) |
| Produktionsbuild | **PASS**; bestehende Warnung großer Chunks bleibt | `build.log` |
| Neue Domainmodule und alle drei neuen Testdateien: ESLint | **PASS** | `lint-new.log` |
| Drei bestehende UI-Dateien: ESLint | **5 bekannte Bestandsverstöße verbleiben**, Baseline hatte 6; keine neuen Regelarten | `lint-comparison.json` |
| Patch gegen unveränderte Baseline | **git apply --check PASS** | vor Übergabe ausgeführt |
| Gerenderter Browserlauf | **BLOCKIERT vor Seitenstart**, 0 UI-Checks | `browser.log`, `browser/SPATIAL_BROWSER_AUDIT.json` |
| Android, physische GPU, Kamera, Tracking | **NICHT AUSGEFÜHRT** | keine geeignete Hardware vorhanden |

Browserpfad: der separate Browser-Plugin-Skill ist hier nicht verfügbar; der vorhandene Projekt-Playwright-Test wurde mit der bereits installierten Laufzeit versucht, ohne Installation. Chromium scheiterte vor Navigation an `socket() failed: Operation not permitted` in der Sandbox (zusätzlich Crashpad-Konfigurationsfehler). Es wurde keine zusätzliche Berechtigung angefordert. Folglich gibt es keine neuen Screenshots, keinen gemessenen mobilen Layoutnachweis und keinen gerenderten 3D-Nachweis für diesen Patch. Die bestehende QA-Historie wird nicht als neue Abnahme ausgegeben.

`tests/level-ar-browser.mjs` erweitert den bestehenden Browserlauf um Lernfilter, passende nächste Aktion, Legacy-Fortsetzung und einen echten Canvas im Lernmodus. Er ist vorbereitet, aber wegen des Startblockers nicht durchgelaufen. Die AR-Domänentests verwenden kontrollierte XR-Testdoubles nur an der hardwareabhängigen Browsergrenze; sie beweisen Ressourcen-/Zustandslogik, keine reale Oberflächenerkennung.

## Verwendete Entwicklungswerkzeuge und Grenzen

- Vorhandene Three.js-Geometrie, React, TypeScript, Node-Testläufe und Produktionsbuild. Keine neuen Abhängigkeiten, Konten, Rechte oder kostenpflichtigen Jobs
- Build Web Data Visualization: semantischer Level-/Vorwissengraph, gemeinsames Datenmodell für 2D/3D, direkte Statuslabels und sichtbare Unsicherheiten
- Frontend Testing/Debugging: definierter Benutzerpfad und überprüfbare Browserchecks; Sandboxblocker offen dokumentiert
- Frontend Mobile Development: abgeleitete Daten statt zusätzlicher widersprüchlicher Persistenz; lokaler Komponentenstatus bleibt lokal
- Superpowers: Bestand zuerst analysiert, begrenztes Design abgestimmt, fehlende Verhaltensverträge zuerst getestet und Abschluss erst nach frischen Prüfungen
- Generierte Bilder, Videos oder Figma-Effekte sind für diese funktionale Korrektur nicht nötig und wurden nicht als 3D-/AR-Ersatz eingesetzt

## Aktuelle offizielle Quellen, abgerufen 30.09.2026

- [Google: WebXR requirements](https://developers.google.com/ar/develop/webxr/requirements): sicherer Kontext, kompatibler Browser, ARCore-Gerät und aktivierte Google Play-Dienste für AR. Diagnose sollte zunächst die originale HTTPS-Seite direkt prüfen
- [Google: Hello WebXR](https://developers.google.com/ar/develop/webxr/hello-webxr): Session mit `hit-test`, `requestHitTestSource`, viewer space, Frame-Ergebnisse und bewusste Platzierung
- [W3C Immersive Web: Hit Test Module](https://immersive-web.github.io/hit-test/): aktuelle Schnittstellen für Quelle, Frame-Ergebnisse, Pose und `cancel`; keine veraltete `requestHitTest`-API
- [Google: WebXR compared to ARCore](https://developers.google.com/ar/develop/webxr/arcore-comparison): WebXR in Chrome auf unterstützten Android-Geräten nutzt ARCore; native ARCore-App und WebXR bleiben unterschiedliche Integrationswege
- [Android: Build web apps in WebView](https://developer.android.com/develop/ui/views/layout/webapps/webview): eingebettete WebView ist eine eigene Laufzeit, kein Beleg für die Featuregleichheit mit dem vollständigen Browser
- [Capacitor: InAppBrowser](https://capacitorjs.com/docs/apis/inappbrowser): unterscheidet WebView, Systembrowser und externen Browser. Eine Capacitor-Hülle allein schaltet keine Flächenerkennung frei. Der Patch installiert keinen Browser- oder nativen AR-Plugin
- [Three.js: AR Hit Test example](https://threejs.org/examples/webxr_ar_hittest.html): geometrischer Referenzpfad für Zielmarkierung und Hit-Test

## Noch erforderliche Geräteabnahme

Auf ARCore-kompatiblem Androidgerät die originale HTTPS-Seite direkt in aktuellem Chrome öffnen. Capability-Befund, Rechteabfrage, Abbruch, fehlender Treffer, Trefferverlust, Platzierung, Zoom, Neupositionierung, Exit, Android-Zurück, erneuten Start und Navigation während Sessionstart prüfen. Danach denselben Einstieg in der Capacitor-WebView getrennt prüfen. Bei fehlender XR-Unterstützung dort die ehrliche Browser-/Native-Grenze beibehalten. Persistente Anchors, Tiefen-Occlusion, reale Maßhaltigkeit und Projektionhardware sind nicht Teil dieses Patches.
