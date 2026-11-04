# 2D / 3D / AR · Visualisierungsvertrag

**Frage:** Welche Entität trägt Verantwortung, welche Beziehung führt wohin, was ist Herkunft oder Plan, und wie wird daraus ein konkreter prüfbarer Auftrag?

**Primärroute:** DOM/SVG-Struktur. **Optionale Route:** echtes perspektivisches Three.js für räumliche Erkundung derselben Knoten. **Fallback:** identisches Graphmodell als 2D-Buttons und Knotenliste; kein zweiter GPU-Renderer.

- Maximal eine Szene / ein Kontext; maximal 32 sichtbare Knoten. Quellgraph kann größer sein; Auswahl/Nachbarschaft und Leseliste bleiben funktional.
- Positionen sind stabile semantische Lanes, keine geografisch oder zeitlich gemessenen Entfernungen. Kanten vermitteln beschriftete Beziehungen, keine Bandbreite oder ausgeführte Kommunikation.
- Eigene Herkunft als gefüllte Form, externe/geplante Ursprünge als Drahtform und lesbarer Text; Auswahl skaliert moderat und optionaler GLSL-Shader markiert ausschließlich diesen Knoten. Farben ersetzen keine Herkunftslabels.
- Browserkamera: Orbit, direkter Fokus, Zoom, Reset; eine kontinuierliche Drehung nur nach Nutzeraktion. Shaderphase nach Zeit, nur bei zugelassenem Motion und sichtbarer Szene; ansonsten eingefrorene Geometrie.
- AR: Sessionstart → Tracking → horizontale Flächensuche → Treffer → bewusst platziert. Trackingverlust verbirgt Modell/Reticle und sperrt Platzierung. Treffer >500 ms sind ungültig. Hit-Test-Pose wird als Matrixkopie übernommen, nie als außerhalb des XRFrames benutztes XRPose-Objekt.
- Surface-Pivot ist die Grundfläche des Modells. Skalierung erhält den gewählten Punkt; Neuplatzierung ist explizit. Standarddarstellung etwa 0,6 m Gesamtdurchmesser, Zoom begrenzt auf etwa 0,15–1,2 m. Diese Werte sind Darstellungsskalierung, keine kalibrierte Hardwaremessung.
- Free-AR hat keine Flächenerkennung; Pose etwa vor der Nutzerposition. Kein stiller Wechsel nach fehlendem Surface-Feature.
- Nur gültiger eigener erster Renderframe meldet 3D-ready. Sessionaktivität allein bestätigt weder Viewerpose noch physisches Kamerabild.
- Rendererressourcen werden abgebaut: Animation, Controls, Geometrien, Shader, Texturen, Observer und Hit-Test-Source. Eine Sitzung mit unbestätigtem Ende bleibt als eigener Zustand mit erreichbarem Beenden erhalten; weitere Starts sind gesperrt. Verspätete Grafikbindung nach nativem Ende verwirft den Renderer und kehrt zu 2D zurück.
- Mobile: 390×844 CSS-Pixel im Hochformat; Desktop: 1440×1000. Native Buttons/Selects ≥44px. Wesentliche Herkunft, Modus und nächster Schritt ohne Hover erreichbar. Keine Kamera-/AR-Pflicht zum Lernabschluss.

QA: Domain-Cancellation/Transformation, Software-WebGL-Frame und Pixeländerung bei Fokus/Shader, Motionstopp, Netzwerk-Lazyprüfung, Fehlersimulation, CAS-Lernfluss, axe und echte getrennte Androidabnahme nach `AR_DEVICE_QA.md`.
