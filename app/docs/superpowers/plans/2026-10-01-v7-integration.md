# Kontrollierte V7-Zusammenführung

Parent-Freigabe: V7-Funktionsbasis, fünf Academy-Ableitungen getrennt von vier Praxisnachweisen, gemeinsamer Graphvertrag, native ARCore-Diagnose und bisherige Lifecycleinvarianten. V6/R6-Archiv bleibt unverändert als Rückfallquelle. Nur cue-system wird beschrieben; Ursprung bleibt read-only.

## Layer und Eigentum

1. Kanonischen V7-Commit 3e921804b13e0d7c70d1ff15474f0387e84d70b6 samt neuem Quelleninventar importieren; vorherige Provenienz sichern
2. Unverändert kompatible Rev3-Bausteine behalten: learning-levels, space-model, Academy-Controller und deren Domänentests. Kein blindes Anwenden der alten MeshSpace/Renderer/Hilfe-Hunks
3. V7 MeshSpace/Renderer/Hilfe als neue Funktionsbasis, explizite eng gebundene Integrationsschicht für Academy-Navigation, nativen AR-Einstieg, Diagnostik/Clipboard und sofortigen Abbruch/late-Binding-Cleanup
4. V7 SpatialLevels und spatial-learning verwenden denselben erweiterten SpaceGraph und WorkState. Keine weiteren XP für abgeleitete fünf Academy-Knoten. Browser-/native AR-Lerntext präzisieren; 2D-Praxis erhält gleichwertigen Weg
5. Browser-AR bleibt optional surface/free; Freimodus erkennt keine Fläche. End-unknown hält Exit-Besitz, kein automatischer Retry. AbortController/withAbort, terminale Three-Reparatur, Dispose-Gates und synchroner Parentreset bleiben nachgewiesen
6. Native AR r6, Sicherheits-/Dateiadapter, Historie/Preferences und Backup-Preview bleiben unverändert. Neuer Quellenstand wird im Backup und lokalen Brief korrekt benannt

## Abnahme

- Originale V7-Domainprüfungen plus bisherige Basis-/Modul-/DOM- und Rendererfälle erhalten
- Zusätzliche Praxis-UI/CAS/Backup-, gemeinsamer Graph/Typalias-, Shader/Motion/Energie/2D-Fallback-Prüfungen
- Lifecycle-Repros gegen tatsächlich gerouteten Renderer, insbesondere pending request/viewer/hit-source/setSession/makeXRCompatible, Abbruch, native End-Events, fehlgeschlagenes Ende, Wiederstart und Unmount
- Plattformdiagnose/Exports, relative Schriftgrößen, keine versteckten Portale und keine tatsächlichen Hardwarebehauptungen
- Hash-/Kontextgebundene Generatoren, portabler frischer Build, Sourcefreeze und unabhängiger V7-Retest vor finalem APK

Separates Domainfix-Kit wird erst nach eigener Freigabe aufgenommen; Vollrestore bleibt deaktiviert.
