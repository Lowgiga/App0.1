# V7-Komposition · 0.5.0-v7-integrated-preview

Kanonische Basis: **Sites V7 / App 1.4.2 / WorkState 4**, Commit `3e921804b13e0d7c70d1ff15474f0387e84d70b6`, **226 byteidentische Originaldateien**. Vorherige V5/V6-Provenienz und getrennte geprüfte Archive bleiben erhalten. Kein Ursprungscheckout wurde verändert oder veröffentlicht.

## Lernpfade aus einem Zustand

Die fünf bisherigen Academy-Themen und deren abgeleitete Zustände bleiben erhalten: Quiz, Übungsnotiz und validierter Transfer werden getrennt ausgewertet. Ihre fünf `lesson:`-Knoten, empfohlene Reihenfolge, nächster Schritt und `Academy.openLesson` sind weiterhin über 2D/3D erreichbar. Diese Ableitungen vergeben keine zusätzlichen XP.

V7 ergänzt vier persönliche Praxisnachweise: Herkunft, gerichtete Beziehung, Perspektive/Kamera und offener Prüfauftrag. Sie verwenden denselben erweiterten SpaceGraph und denselben tatsächlich geladenen WorkState. Auch ein Academy-Knoten oder eine `recommended-before`-Kante kann Gegenstand der Übung sein. Vier Praxislevel ergeben einmalig höchstens 100 Praxis-XP neben höchstens 100 Quiz-XP. Die gleichwertige 2D-Alternative benötigt keine Kamera oder funktionierende GPU. Native ARCore- und Browser-WebXR-Sitzungen werden im Lerntext ausdrücklich unterschieden. Praxisnotizen sind keine signierten Kompetenz-, Geräte- oder Ausführungsnachweise.

Die letzte Praxisübung speichert Lernnotiz und offene, ungeprüfte Aufgabe gemeinsam über den bestehenden CAS-Pfad; optional wird dieselbe Aufgabe zu einer zulässigen Mission hinzugefügt. Weder ein Worker noch eine Freigabe wird automatisch gestartet. Vollständige Systembackups enthalten die Praxisnotizen und Aufgaben ohne zusätzliches paralleles Lernspeichersystem.

## Browser-3D, Shader und AR

Der V7-Renderer bleibt die Funktionsbasis: abschaltbarer echter Auswahlshader, statischer Zustand bei Motion aus, Reduced Motion und Energiesparbegrenzung, 2D-Rückweg bei Initialisierungs-/Kontextfehlern. Der Shader-Schalter bleibt eine lokale Ansichtsentscheidung, überschreibt keine gespeicherten Einstellungen und wird nicht als Aktivität eines externen Agenten dargestellt.

Surface-WebXR verlangt Hit-Test und DOM-Overlay; nur aktuelle waagerechte Treffer erlauben bewusstes Platzieren. Trackingverlust blendet das Modell aus. Skalierung erhält den Auflagepunkt. Der gesondert gewählte Freimodus fordert keinen Flächentreffer an: Das Modell wird vor der Kamera ausgerichtet und bleibt anschließend im lokalen XR-Bezugsraum, bis „Vor mir zentrieren“ oder eine Größenänderung neu ausrichtet. Es folgt der Kamera nicht ständig und besitzt keinen Flächenanker. Kein semantischer Tischdetektor oder physisches Hologramm wird behauptet.

Die V7-Phasen und genauen Diagnosen bleiben erhalten, einschließlich `end-unknown`. Ergänzt sind die geprüften Rev3-Schutzinvarianten: sofort beobachtbarer Abbruch bei pending Request/Viewer/Hit-Source/Three-Bindung, generationstreue Rückwege, Freigabe verspäteter Ressourcen, raw Binding-/End-Gates vor Renderer-Dispose und terminale Reparatur des installierten Three-XRManagers. Native Endereignisse zählen auch bei später abgelehntem oder nicht auflösendem End-Promise als tatsächliches Ende. Ohne bestätigtes Ende bleibt der Sitzungsbesitz erhalten; es gibt keinen automatischen Retry oder stillen Freimodus-Fallback.

Die frühere Camera-/Surface-Implementierung wird nicht einfach über V7 kopiert. `extensions/v7-integration/manifest.json` bindet die drei zusammengeführten UI-/Rendererdateien an ihre exakten V7-Eingänge und ihre Ausgänge. Die unveränderten Rev3-Quellen bleiben separat; nur kompatible Academy-/Graph-/Abortbausteine werden wiederverwendet. Vite, TypeScript und Testloader verwenden dieselben expliziten Module.

## Native AR und lokale Plattformpfade

Android WebView bietet kein Browser-WebXR. Dieser Befund hat im Preflight Vorrang vor Policy, HTTPS oder einem widersprüchlichen XR-Stub. Die separat integrierte native ARCore-Funktion Revision 6 bleibt ein eigener optionaler, experimenteller Einstieg. Browser-Surface/Free schaltet den nativen Viewer nicht um. Native Availability bleibt bewusst, Datenschutz-/Startschritte bleiben erhalten und Auswahlrückgaben bewirken keine WorkState-Schreibaktion.

Neue Diagnosekopien sowie alle bisherigen Exporte verwenden die geprüften Clipboard-/Dateiadapter. Die vier gebündelten Textdokumente werden weiterhin exakt und inert im vorhandenen Sheet gezeigt; V7 aktualisiert deren Originalbytes kontrolliert über Provenienz. Screenshotpfade bleiben erhalten.

## Begrenzte Domainkorrekturen

Geprüftes Domain-Kit Revision 1, Freeze SHA-256 `b2f5060c4e69db765f23f9a316ecc17650cc6a03f1abefd19a6b6869d7a5f82e`. Vor Übernahme wurde ein getrennter V7-Zwischenstand gesichert. Der Preflight bestätigte die acht unveränderten Domain-Eingänge und sämtliche Zielanker.

- Entfernte Aufgaben erzeugen ein kanonisches Ereignis in derselben lokalen Schreibtransaktion
- Zustandsändernde Fokusaktionen werden nach zulässigem Rücksprung erneut auf den aktuellen Zustand geprüft; CAS, Request-Deduplizierung, Ereignisgrenzen und einmaliger Open-Review-Vertrag bleiben erhalten
- Legacy-Import erklärt unverändert gewinnende Raum-IDs einschließlich ausgelassener neuer Beiträge, das 3-MiB-Dateilimit und das Zielbudget von 1.750.000 UTF-8-Byte einschließlich Ereignissen
- Keine Vollrestore-Implementierung, neue Rechte, Anmeldung oder Cloud-/D1-/Provider-Synchronisation

## Prüfbedeutung

Node-/DOM-/Bridge-/Renderer-Doubles und JVM-Tests prüfen Codeverhalten. Sie beweisen keine Pixel, echte Kamera, GPU, Tracking, Android-Runtime oder Samsung-S25-Tauglichkeit. Die finale APK-/Signatur-/Assetprüfung und physische Gerätecheckliste sind eigene Gates. Vollrestore bleibt ausdrücklich Vorschau; der ursprüngliche begrenzte Legacy-Merge bleibt verfügbar.
