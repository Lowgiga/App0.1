# Code-Health, Verbesserungsmatrix & Innovative Ideen (LowQuantFlow)

Dieses Dokument fasst den aktuellen Zustand der App und des Dokumentationsstands zusammen, identifiziert Stärken sowie Blocker/Risiken, stellt eine priorisierte Verbesserungsmatrix bereit und schlägt innovative Features vor.

---

## 1. Code-Health Bewertung

### Das Gute (Stärken & Positives)
* **Klare Architektur- & Schichten-Trennung**: Die Schichten zwischen WorkState, IndexedDB/CAS-Store, 17 Arbeitsbereichen, Studio und Capacitor Native Adapter sind sauber konzipiert und isoliert.
* **Umfassende Testabdeckung (RAM-Kandidat)**: 264 gezielte Tests in 24 Dateien mit 0 TypeScript-Diagnosen garantieren hohe Stabilität bei Branding, Recovery, Qualität und Diagnose.
* **Hohe Transparenz & Nachweisbarkeit**: Exaktes Dateiinventar (859 Dateien) mit SHA-256 Prüfsummen. Dokumentierte Audit-Trails und Evidenzen verhindern unberechtigte Annahmen.
* **Keine Parallelwelt / Kein Rewrite-Risiko**: Erweiterungen setzen auf dem bestehenden Core auf. Schema-, Skill- und Workflow-IDs bleiben rückwärtskompatibel.

### Das Schlechte (Risiken, Schwachstellen & Blocker)
* **Build-Blocker (Proxy-CONNECT 403)**: Das Herunterladen von offiziellen Library-Speicherhosts schlägt fehl, da der Proxy CONNECT-Anfragen mit 403 ablehnt.
* **Fehlendes JDK 21**: Zwar startet das Compiler-Modul isolated `javac`, aber Gradle 8.14.3 benötigt ein vollständiges JDK 21 für die automatische Toolchain-Erkennung (`Is JDK: false`).
* **Source-Code nicht im Hauptrepo**: Das öffentliche Repository dient derzeit als Dokumentations- und Grafik-Hub; der vollständige App-Quellcode liegt getrennt verwahrt vor.
* **Incomplete Native & AR Verification**: Echte GPU-/Kamera-AR-Performance und Akku-Messungen können erst nach einem erfolgreichen Android-Build auf realen Testgeräten erfolgen.

---

## 2. Priorisierte Verbesserungsmatrix (P0 – P2)

| Priorität | Thema / Bereich | Problem / Ziel | Konkrete Maßnahme |
| --- | --- | --- | --- |
| **P0** | **Build & Environment** | Proxy CONNECT 403 & JDK 21 Blocker | Freigabe der Library-Hosts am Proxy beantragen; vollständiges JDK 21 im Build-Environment installieren. |
| **P0** | **Quellmaterialisierung** | APK-Erzeugung blockiert | Zusammenführung der rekonstruierten 859 Dateien in eine baubare Arbeitsumgebung mit VITE & Capacitor. |
| **P1** | **Native UI & UX** | Back-Button Zurücknavigation | Absicherung der "Dirty-Draft"-Zurücknavigation und Dialog-First Bestätigungen für Mobile-Nutzer. |
| **P1** | **Test-Abdeckung** | Bisher nur gezielte RAM-Tests | Durchführung der vollständigen seriellen Testsuite und Linting-Durchläufe auf frischem Node 24 Build. |
| **P2** | **Performance & Storage** | IndexedDB & CAS Auslastung | Optimierung von Speicher-Snapshots und Pruning alter Historien-Daten zur Ressourcenschonung auf Mobilgeräten. |
| **P2** | **Optional-Module** | 3D-Begleiter & Video-Studio | Sanfte Integration des optionalen 3D-Begleiters ohne Performance-Einbußen im Kern-Renderer. |

---

## 3. Innovative Feature-Vorschläge & Zukunfts-Ideen

1. **KI-gestützter Aufgabenkonstruktor (AI Task Constructor)**:
   * Automatische Zerlegung komplexer Projektziele in konkrete Teilaufgaben und Prüf-Milestones auf Basis des lokalen WorkState.

2. **Schatten-Autopilot (Shadow Autopilot Mode)**:
   * Ein passiver Assistent, der im Hintergrund Benutzeraktionen analysiert, Inkonsistenzen in Dokumenten/Workflows erkennt und diskrete "Reviewkarten" zur Korrektur anbietet.

3. **Projektgebundenes lokales Gedächtnis (Scoped Project Memory)**:
   * Kontextbezogene Speicherung von Entscheidungs-Historien direkt am Projektknoten, völlig offline-fähig und datenschutzkonform.

4. **Interaktiver 3D/AR-Begleiter (Companion & Visualizer)**:
   * Ein optional zuschaltbares 3D-Modell im Studio-Renderer, das den aktuellen Projektfortschritt und Systemgesundheit dynamisch visualisiert.

5. **Erklärende Reviewkarten & Variantenvergleich**:
   * Visueller Diff-Betrachter für Workflows und Datenmodelle, mit dem Benutzer Änderungen vor der Übernahme mit Vorher-Nachher-Gegenüberstellung abnehmen können.
