# Code-Health, Blocker-Analyse, Verbesserungsmatrix & Innovative Ideen

## 1. Übersicht & Code-Health Assessment (Das Gute & Das Schlechtes)

### Das Gute (Stärken & Architektur-Highlights)
* **Saubere Entkopplung durch Overlay-Prinzip:** `upstream/` bleibt unverändert geschützt; Modifikationen erfolgen deterministisch über Generatoren in `overlay/` und `src/`.
* **Hohe Testabdeckung für die Kern-Rekonstruktion:** 264 gezielte Tests in 24 Testdateien mit 0 TypeScript-Diagnosefehlern für die finale Quality-/Diagnose-/Branding-Kombination (Version `0.5.2-v7-workflow-recovery-reconstructed`).
* **Strenge Sicherheits- & Datengrenzen (Offline-First):** Kein automatisches Senden lokaler Daten; expliziter Dateidialog für Import/Export; lokale Transaktionen via IndexedDB und Content-Addressable Storage (CAS); vollständige Herkunftsnachweise (`provenance.json`).
* **Deterministische Offline-Skills & Workflow Recovery:** Integrierte Offline-Skill-Handler und persistente Wiederaufnahme von Abläufen über ein dediziertes `workflow-journal`.
* **Klares Abnahmegerüst:** Strukturierte Abnahmematrix mit 27 präzisen Anforderungen aufgeteilt auf 7 Qualitäts-Gates.

### Das Schlechtes (Schwachstellen & Technische Schulden)
* **Trennung von Dokumentations- & Anwendungs-Repository:** Das vorliegende Repository ist ein reines Dokumentations-Repository (enthält Verträge, Spezifikationen, Grafiken), aber derzeit keine App-Sourcedateien (`src/`, `package.json`, `android/`), weshalb direkt aus diesem Repository kein Build ausgeführt werden kann.
* **Build- & Toolchain-Blocker:** Ein frischer Library-Download scheitert in der Build-Umgebung aufgrund einer Proxy-CONNECT-403-Sperre; zudem fehlt dem vorhandenen Java-Compilermodul die reguläre JDK-Dateistruktur (`bin/javac`, `lib/ct.sym`), was Gradles Toolchain-Erkennung fehlschlagen lässt.
* **Ungewissheiten bei nativer Navigation:** Dialog-first und Dirty-Draft-Zurücknavigation auf echten Android-Endgeräten sind noch nicht vollständig validiert.
* **Fehlender frischer Web-Build & Hardware-Abnahme:** Frisches Vite-Bundling sowie reale GPU-, Kamera- und ARCore-Messungen auf physischer Hardware stehen noch aus.
* **Keine automatische Datenmigration:** Zwischen den Identitäten Preview (`de.lowgiga.cuecommandmesh.preview`) und Next (`de.lowgiga.cuecommandmesh.next`) existiert keine automatische Datenmigration.

---

## 2. Detaillierte Analyse der Build-Blocker (Root Causes)

1. **Proxy-CONNECT Ablehnung (HTTP 403):**
   * **Symptom:** Downloads von offiziellen Library-Speicherhosts und JDK-Quellen brechen ab.
   * **Ursache:** Der HTTPS-Tunnel über den bestehenden Proxy wird von der Netzwerk-Richtlinie mit 403 Forbidden abgelehnt.
   * **Lösung:** Gezielte Whitelist-Freigabe der beiden benötigten Library-Hosts sowie der JDK-Downloadquelle.

2. **Unvollständige JDK 21 Umgebung für Gradle:**
   * **Symptom:** Gradle 8.14.3 meldet `Is JDK: false` und findet keine passende Compiler-Toolchain.
   * **Ursache:** Das vorhandene Java-Modul kann zwar `javac` programmatic starten, es fehlen jedoch physische Binaries (`bin/javac`) und Metadaten (`lib/ct.sym`), die Gradle für die Validierung benötigt.
   * **Lösung:** Vollständige Installation eines JDK 21 Pakets im System.

3. **Materialisierung des Quellbaums:**
   * **Ursache:** Da das vorliegende Git-Repo nur Dokumentation speichert, muss der rekonstruierte Quellcode-Kandidat (`0.5.2-v7-workflow-recovery-reconstructed`, 859 Dateien) im Runner-Dateisystem bereitgestellt werden.

---

## 3. Priorisierte Verbesserungsmatrix (P0–P2)

| Priorität | Bereich | Maßnahme / Ticket | Beschreibung & Ziel |
| --- | --- | --- | --- |
| **P0 (Kritisch)** | Build & Toolchain | **P0-1: Proxy-Freigabe** | Whitelisting der Library- & JDK-Hosts für HTTPS CONNECT |
| **P0 (Kritisch)** | Build & Toolchain | **P0-2: JDK 21 Installation** | Vollständiges JDK 21 mit `bin/javac` für Gradle bereitstellen |
| **P0 (Kritisch)** | Build & Release | **P0-3: Quellmaterialisierung & Vite Build** | Quellkandidat einspielen, `npm test` & Vite Production Bundle erzeugen |
| **P0 (Kritisch)** | Sicherheit | **P0-4: Schlüsselverwahrung** | Zweite verschlüsselte Kopie des Android-Signierschlüssels sichern |
| **P1 (Hoch)** | Werkstatt-Kern | **P1-1: Aufgabenkonstruktor** | Modul `WRK-01` für präzise Auftragskonstruktion & Grenzen integrieren |
| **P1 (Hoch)** | Werkstatt-Kern | **P1-2: Wirkungsanalyse** | Modul `WRK-02` für deterministische Auswirkungsanalyse integrieren |
| **P1 (Hoch)** | Gedächtnis & Config | **P1-3: Projektgedächtnis & Settings** | Modul `MEM-01` (Gedächtnis) & `CFG-01` (4 Einstellungsbereiche) umsetzen |
| **P1 (Hoch)** | Arbeitsweise | **P1-4: Shadow-Modus & Review** | Modul `SIM-01` (isoliertes Testing) & `REV-01` (Revisionskarten) einbetten |
| **P2 (Medium)** | Innovation / Visual | **P2-1: 3D-Begleiter (Companion)** | Modul `MOD-01`: Abschaltbarer Actor im Three-Renderer ohne Zusatz-Renderer |
| **P2 (Medium)** | Innovation / Media | **P2-2: Lokales Video-Studio** | Modul `MOD-02`: Storyboard- & Shotplaner auf lokalem Projektzustand |
| **P2 (Medium)** | UX & Layouts | **P2-3: Werkstatt-Layouts** | Umschaltung zwischen Mobiler Fokus, Technische Werkbank & Ausgabestudio |
| **P2 (Medium)** | Daten & Migration | **P2-4: Isoliertes Backup/Restore** | Gehärteter Import/Export und nachvollziehbarer Restore-Prozess |

---

## 4. Innovative Feature-Vorschläge (Innovative Ideen)

1. **Deterministische Wirkungsanalyse-Engine (Impact Engine):**
   * *Konzept:* Vor der Ausführung einer Änderung berechnet ein lokaler Graph alle direkten und transitiven Abhängigkeiten. Unbekannte oder unvollständige Pfade werden explizit als Risiko markiert.

2. **Shadow-Mode Ausführungsumgebung (Isolated Preview Execution):**
   * *Konzept:* Testen von Befehlen oder Workflows auf einem gekontakten, isolierten In-Memory `WorkState`. Keine schreibenden Auswirkungen auf den aktiven Produktionsspeicher.

3. **Integrierter 3D-Begleiter (Interactive 3D Companion Actor):**
   * *Konzept:* Ein visueller Akteur direkt im bestehenden Three.js/Canvas-Viewport. Zeigt Systemzustände, Fehlermeldungen oder Ausführungsfortschritte dynamisch an – vollständig optional und performant.

4. **Projektgebundenes Gedächtnis & Evidenz-Tresor (Project-Bound Evidence Vault):**
   * *Konzept:* Unveränderliches Logbuch für Entscheidungen, Begründungen, Autor und Referenzen, direkt an die jeweilige Git/Revisions-SHA256 gekoppelt.

5. **Bereinigtes Ausgabestudio (Sanitized Presentation Studio):**
   * *Konzept:* Export- und Präsentationsmodus, der technische IDs, Debug-Protokolle, Tokens oder private Pfade automatisch herausfiltert und ein sauberes, vorzeigbares Dokument generiert.
