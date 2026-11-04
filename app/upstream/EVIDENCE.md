# Evidenzregister

## Baseline
- App-Source vor dieser Wave: `23ae42c2d83d5b31dcc9f61adeefb22bb1e1f03a` (1.4.1), privat veröffentlichte Sites-Version 6.
- Vorherige lokale Abnahme: 103 Domain + 174 HTTP + 27 Kooperation-Browser + 44 Spatial-Browser = 348 Checks. Details: `QA.md`, `docs/COLLABORATION_AUDIT_V1_4_1.json`, `docs/SPATIAL_ACADEMY_AUDIT_V1_4.json`.

## Aktuelle Wave
Prüfbericht: `docs/AR_SPATIAL_AUDIT_V1_4_2.json`. Domainfälle für Featureanforderung, genaue Fehlerursachen, Cancellation, Quellenfreigabe, Surface-Transformation, Lernintegrität, IDs, Grenzen und Snapshot. Browserfälle verwenden die tatsächlich kompilierte lokale App, isolierte D1 und Software-WebGL. Simulierte XR-Ablehnungen sind gezielte Fehlertests, kein realer Kameratest.

## Verifizierte Technikreferenzen
Abruf am 01.10.2026 Europe/Berlin; Inhalte unabhängig von Nutzerzitaten gelesen:
- W3C [WebXR Hit Test](https://www.w3.org/TR/webxr-hit-test-1/): plane entity types, Viewerraum, Pose relativ zum Referenzraum, aktive Frames, explizite Hit-Test-Source-Freigabe.
- Three.js [WebXRManager](https://threejs.org/docs/pages/WebXRManager.html): echte XR-Rendererbindung und eigener Sitzungszustand.
- Google [ARCore WebXR](https://developers.google.com/ar/develop/webxr): tatsächliche Browser-/Geräteunterstützung für WebXR.
- [A2UI Roadmap](https://a2ui.org/roadmap/): zum Abruf v0.9.1 current/stable, v1.0 candidate. Kein Nachweis einer lokalen Integration.
- [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview) und [offizielles Repository](https://github.com/modelcontextprotocol/ext-apps): hostkontrollierte Sandbox und UI-Dialekt; getrennt vom normalen Tool-MCP.
- [AG-UI](https://docs.ag-ui.com/introduction): Agent-/Oberflächen-Ereignisprotokoll; kein Ersatz für Auth, Persistenz oder Execution-Policy.

## Werkzeuge / Claims
- Figma `whoami`, `list_shaders`, `get_shader` für CRT Screen erfolgreich. Account meldet View-Sitz auf Starter-Plan. Quellreferenz ist ein 2D/WebGPU-Effekt; App-Shader ist eigener GLSL-Auswahlmarker auf echter 3D-Geometrie, keine automatisch übertragene Figma-Animation.
- Remote Commander: zwei Geräte offline beim Registry-Zeitpunkt. Kein eigener physischer Low-/Hermes-Abnahmenachweis.
- Vorhandene Hermes-Masterplanmappe gelesen: manuelle separate Klone und Handoffs, keine bestätigte direkte Low-Session.

## Offene Grenzen
Physisches Android/WebXR/ARCore, Kamera-Passthrough, reale Fläche, Drift, Screenreader auf Gerät, Produktions-Disaster-Recovery, echte Nutzerstudie und Live-Integrationen bleiben unbestätigt. Veröffentlichung allein validiert sie nicht.


## Abgeschlossene lokale Abnahme 1.4.2
132 Domain + 195 HTTP + 43 neue AR/Praxis-Browser + 44 Spatial-Regression + 27 Kooperation-Browser = **441**. Alle Suites mit Exit 0 und vollständigem Abschlussnachweis. Tatsächliche Browser-Prüfnamen, lokale Last-/Neustartwerte und gemessene Buildbytes stehen im Audit. Source-Review durch `/root/initialization_review` PASS, ausschließlich statisch. Scope und geschützte Dateigrenzen werden vor Release gesondert überprüft.

Die private Veröffentlichung gehört in das native Sites-Versionsregister: voller gepushter Source-SHA, saved version, deployment ID, terminaler Status und bestehendes Owner-only-Publikum. Ohne diese Zielsystemevidenz ist kein Release behauptet. Physische AR- und externe Low-Abnahme bleiben separat offen.
