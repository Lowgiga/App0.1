# LowQuantFlow
### Deine lokale Werkstatt für Projekte, Wissen und nächste Schritte

![LowQuantFlow: animierte Konzeptgrafik](docs/assets/lowquantflow-hero-animated.svg)

[Statische Ansicht](docs/assets/lowquantflow-hero-static.svg) · [Appquelle](app/) · [Aktueller Entwicklungsnachweis](docs/29-k3-quality-adoption.md) · [Dokumentation](docs/README.md) · [Anforderungsabdeckung](docs/16-acceptance-matrix.md) · [Arbeitslos K1](docs/25-context-continuation-work-package.md)

Die Grafik ist ein eigenes Designkonzept, kein App-Screenshot und kein Leistungsnachweis.

LowQuantFlow verbindet **17 Arbeitsbereiche**, ein visuelles **2D-/3D-Studio**, lokale **Skills und Prüfprozesse**, einen optionalen **3D-Begleiter** und kontextbezogene **Assistenz** in einer Android-first-App. Projekte, Quellen und Entscheidungen bleiben nachvollziehbar; Änderungen werden bewusst geprüft und bestätigt.

> **Laufende 0.5.4-Entwicklung, keine neue Ausgabe.** Assistant-Host, Mobile-Multitouch, lesende K1-Fortsetzung, gezieltes K2-Entwurfsöffnen mit Änderungsvorschau sowie K3-Ergebnisnavigation und Tab-/History-Routing sind im unabhängig geprüften Webgesamtstand enthalten. Die Beratung bleibt eine Offline-Simulation; es ist keine echte LLM-Engine verbunden. Keine Versionsanhebung, kein Nutzerpaket oder APK-Release. Native-/Gerätegates bleiben offen.

## Was in der App steckt

| Bereich | Vorhandener Umfang | Quelle und Grenzen |
| --- | --- | --- |
| **2D · Überblick** | Graph-Perspektiven, Beziehungen, Filter und kombinierte Arbeitsflächen | [Studio und Bedienung](app/README.md#was-du-direkt-tun-kannst) |
| **3D · Raum** | Räumliche Graphansicht, Auswahlshader und Hologramm-Bildschirmstil; zugängliche 2D-Alternativen | [Level-/AR-Module](app/extensions/level-ar/) |
| **AR · bewusst starten** | Browser-WebXR und optionaler experimenteller nativer ARCore-Adapter | [Native AR](app/docs/NATIVE-AR-INTEGRATION.md); reale Kamera-/Geräteabnahme offen |
| **Begleiter · Präsenz** | Lokales 3D-Modell mit Walk, Idle, Think, Celebrate, Idea und Caution; Text-/SVG-Ausweichansichten | [Begleiter, Attribution und Grenzen](app/src/companion/README.md) |
| **Assistenz · Kontext** | Lokale Kontexthinweise, Graphhilfe, Projektgedächtnis und persönliche Entwürfe | [Kontextassistenz](app/docs/context-assistance.md) · [Projektgedächtnis](app/docs/PROJECT-MEMORY.md) |
| **Mobile · Android-first** | Native Dateidialoge, mobile Steuerung, getrennte Android-Identität | [Mobile Bedienung](app/docs/mobile-controls.md) · [Dateien](app/docs/NATIVE-FILES.md) |

### Bewegung und Effekte

Der Begleiter verwendet einen begrenzten, sichtbarkeitsgesteuerten Animationsloop. Reduced Motion, Energiesparen und Pause werden berücksichtigt; bei fehlender Grafikfähigkeit bleiben Text-/SVG-Wege verfügbar. Seine Statusdarstellung führt selbst keine Aufträge aus.

Die animierte README-Grafik zeigt die gestalterische Richtung. Der aktuelle Stand enthält das kompakte App-Menü, begrenzte Assistentenübergänge, native AR-Status-/Detailkorrekturen und räumliche AR-Knotendarstellung. Ein lokaler Qualitätsvertrag prüft den bewusst angenommenen Quell- und Teststand. Animationen und Softwaretests belegen keine GPU-, Akku- oder Geräteperformance.

## Vom Überblick zur bewussten Aktion

```mermaid
flowchart LR
    A["Projekt und Quellen"] --> B["2D / 3D Studio"]
    B --> C["Lokale Kontexthinweise"]
    C --> D["Entwurf und Vorschau"]
    D --> E["Bewusste Bestätigung"]
    E --> F["Lokaler Arbeitsstand"]
    F --> G["Export und Backup-Vorschau"]
    F --> A
```

[![Werkstattablauf als Konzeptdiagramm](docs/assets/workshop-flow.svg)](docs/assets/workshop-flow.svg)

Das Diagramm beschreibt den lokalen Arbeitsablauf. Externe Agentenausführung, Cloud-Synchronisation und produktive Vollwiederherstellung sind damit nicht zugesagt.

## Individuelle Darstellung in 0.5.4

- Drei Farbkanäle, Form und Größe für die unterstützten Knoten-/Raumdarstellungen bearbeiten
- Änderungen zunächst als Vorschau sehen; Abbrechen stellt den vorherigen Zustand wieder her
- Gespeicherte individuelle Raumdarstellung bleibt dem gewählten Raum zugeordnet
- Rotation und projizierte Beschriftungen bleiben beim Bearbeiten stabil; Labelsichtbarkeit folgt der tatsächlichen Szene
- Späte WebGL-/XR-Fehler behalten einen terminalen Fehlerzustand und vorhandene XR-Abschlussverantwortung
- Assistentenvorschauen schützen auch den geprüften asynchronen Race-Fall

Individuelle Darstellungen werden lokal getrennt gespeichert und sind **nicht im bisherigen Projektbackup enthalten**. Eine Reset-Vorschau ist noch kein gespeicherter Reset. [Darstellungsquelle](app/src/appearance/) · [Web-Releasehinweise](docs/24-appearance-054-web.md)

## Beratung nachvollziehbar, Bedienung sicher unterbrochen

- Unbestätigte Vorschläge und externe Aussagen sind getrennt von der bestätigten Hostgrundlage sichtbar
- Herkunft und Quellen werden ausgewiesen; fehlende Quellen bleiben ausdrücklich erkennbar
- Die vorhandene projektbezogene Kompakt-/Detail-Einstellung steuert die Quelldetails
- Abbruch, Projektwechsel, überholte Anfragen und inzwischen veraltete Arbeitsstände lassen keine alte Beratung als aktuell stehen
- Offene Adapteraufrufe und lokal verworfene Ergebnisse bleiben getrennte Zustände; ein Abbruch behauptet kein bestätigtes Ende einer fremden Engine
- Die mobile Aktionsleiste bleibt während einer gehaltenen Eingabe und mehrerer beteiligter Zeiger aus dem Weg; sie kehrt erst nach deren Ende zurück

Der produktive Adapter ist weiterhin der Simulator. Vorschlagstext erhält keine Schreibrechte und ersetzt keine Bestätigung. [Hostgrenzen und Testumfang](app/docs/assistant-advisory-host.md) · [Geprüfter Entwicklungsnachtrag](docs/25-assistant-host-mobile.md)

## K1: bewusst beim richtigen Projekt fortsetzen

Die Fortsetzungskarte zeigt einen bestätigten nächsten Schritt und die tatsächlich gespeicherten Entwurfsmetadaten des gewählten Projekts: Status, Revision, Art und Speicherzeit. Veraltete Grundlagen sowie aktive, übernommene, verworfene und fehlende Entwürfe bleiben unterscheidbar. Entwurfstext und ungesicherte Eingaben gehen nicht in die Beratung ein.

„Projekt fortsetzen“ prüft die Grundlage erneut und navigiert bewusst zum bestehenden Projektgedächtnis derselben Projektinkarnation. Es öffnet oder übernimmt keinen Entwurf automatisch, bestätigt keinen Inhalt und startet keinen Workflow. Der vorhandene Editor behält seine eigene Autosicherung und Konfliktbehandlung.

[K1-Nachweis und Grenzen](docs/26-k1-continuation.md) · [Implementierte Verträge](app/docs/assistant-continuation-k1.md)

## K2: gewählte Revision öffnen, Änderung prüfen, bewusst übernehmen

K2 öffnet die ausdrücklich gewählte gespeicherte Entwurfsrevision im bestehenden Editor. Projektinkarnation, Revision und Navigation werden geprüft. Historywechsel entwerten alte Wechselentscheidungen auch bei Rückkehr zur gleichen URL; eine kontrollierte interne Rückkehr nach gescheiterter Sicherung erhält dagegen die noch offene Entscheidung.

„Änderung prüfen“ sichert den persönlichen Entwurf über die vorhandene Sicherung und liest ihn erneut. Die Vorschau zeigt Projekt, Revision, Grundlage, Art, Herkunft und den konkreten Text; bei einer Korrektur zusätzlich den bisherigen Eintrag. Erst „Geprüften Vorschlag übernehmen“ erzeugt aus exakt dieser Fassung einen unbestätigten Vorschlag. Die separate Bestätigung bleibt erforderlich.

Neue Eingaben, Laden, Öffnen, Rebase, Verwerfen, Projekt-/Tab-/Historywechsel entwerten die Vorschau. Fremde Änderungen werden durch die bestehenden atomaren Revisions-/Basisprüfungen abgewehrt; Abbrechen erhält den Entwurf. Eine verlorene Schreibantwort löst kein automatisches zweites Schreiben aus. Dies ist Nutzersichtprüfung mit lokalen Vertragsprüfungen, keine fachliche Modellprüfung oder autonome Ausführung.

[Produktkontext und geprüfte Grenzen](docs/27-product-continuation-context.md) · [K1/K2-Verlauf](docs/25-context-continuation-work-package.md)

## K3: übernommenen Vorschlag wiederfinden und bestätigt fortsetzen

Nach einer bewussten Übernahme lässt sich der genaue gespeicherte Vorschlag in der vorhandenen Memoryansicht wiederfinden, auch wenn Such-/Historienfilter ihn verdeckt haben. Der Sprung liest den Stand erneut, prüft Identität, Revisionen und Route, setzt passende Filter zurück und fokussiert die bestehende Eintragskarte. Er bestätigt nichts automatisch und errät keine Identität aus gleichem Text.

Bestätigen, Korrigieren, Vergessen und Wiederherstellen prüfen synchron die aktuelle Ansicht, Schreibfähigkeit, Eintrags-/Memoryrevision und Navigationsgeneration. Alte Callbacks bleiben nach Navigation ungültig; neu gerenderte Aktionen nach Rückkehr bleiben nutzbar.

Der reguläre Memory→Assistant→Reload-Weg verwendet eine gültige Assistenten-URL ohne Memoryparameter. Die validierte Memory-Inkarnation bleibt im passenden Browser-History-Eintrag und wird nur beim bewussten Memory-Tabwechsel wiederhergestellt. Entwurfsdaten und Freigaben werden nicht in History abgelegt. Vorhandene Autosave-/Flush-/Cancel-Grenzen bleiben erhalten.

[K3-Flow und Routing](docs/28-memory-result-continuation.md) · [Angenommener gemeinsamer Nachweis](docs/29-k3-quality-adoption.md)

## Belegter Web-Prüfstand

**Quality-Scope: 1.025 Dateien**, unverändert aus dem unabhängig angenommenen Gesamtstand. Im vollständigen app/-Baum bleiben zusätzlich zwei historische, vom Quality-Scope ausgeschlossene Dokumentationsmanifeste erhalten: **1.027 Dateien**.

- 1.492 Node-Laufzeittests und 50 Qualitytests bestanden
- Alle fünf Gatephasen PASS: preflight, qualityTests, verifySerial, postflight, sourceStability
- TypeScript, Generatoren, Rendererprüfung und Webbuild erfolgreich; keine Quelldrift
- 61 Webassets mit Inhaltshash `94d581a5f55d3ebf827ecf8296363c84fa2dcf3197d0d6dd2674a50c01fd92eb`
- Gebundene Desktop-/Mobilbrowsernachweise zu K3-Ergebnisnavigation, Eintragsaktionen und echtem Tab-/Reload-/History-Routing und erhaltene Assistant-/Mobile-Regressionsbelege; genaue Grenzen im Entwicklungsnachtrag
- Native Android-/APK-/physische Geräteabnahme: weiterhin offen

Quality-Source-SHA-256: `96464ab1bf3e43e2c9fd3f611605d54e104062447262858ccb4df3113366ed03`

[Sourceinventar](docs/reference/k3-routing/source-adopted.json) · [Prüfzusammenfassung](docs/reference/k3-routing/verification-summary.json) · [Adoptionsnachweis](docs/reference/k3-routing/adoption.json) · [Vollständiges Prüflog](docs/reference/k3-routing/verify-quality.log)

Die Browserbelege stammen vom identischen Appcode vor der abschließenden reinen Qualitymetadaten-Adoption. Alle 61 Buildassets sind identisch. Vorhandene ReadPixels-/GPU-Stall-Warnungen bleiben sichtbar; daraus wird keine Hardware-, FPS- oder Akkuleistung abgeleitet. Die frühere Appearance-/Room-Prüfung bleibt mit ihrem ursprünglichen Befund und erfolgreichem Wiederholungslauf als Historie dokumentiert. Der aktuelle K3-/Routing-Build ist identisch zur unabhängig geprüften Browserfassung; kein erneuter Browserlauf durch die reine Qualityadoption oder Veröffentlichung behauptet.

## Lokal prüfen und starten

Voraussetzungen: Node.js 22.18+ innerhalb 22 LTS oder 24 LTS und npm.

```sh
cd app
npm ci
npm run verify:quality -- --contract-sha256 e044726fd302fba23b5007eb036be3642348fffc19d4583d719daea218bc4d5d
npm run preview
```

Der Pin wurde außerhalb des Kandidaten unabhängig angenommen. Baseline und Vertrag wurden bewusst geprüft; keine automatische Selbstadoption, keine Ausnahmen und keine abgeschwächten Tests. Ein vertrauenswürdiger Host muss den akzeptierten Prüfer und Pin verwenden. Das lokale Gate ersetzt keinen verpflichtenden GitHub-Branchschutz.

Die Vorschau läuft nach Standardkonfiguration auf http://127.0.0.1:4173. Der Quality-Scope und seine festen Ausnahmen sind in [quality/README.md](app/quality/README.md) beschrieben. Ältere eingebettete Buildmanifeste bleiben historische Herkunftsdateien; aktuelle APP-Provenienz bestimmen Git-Commit und das neue Sourceinventar.

## Android und Daten

Installations-ID: `de.lowgiga.cuecommandmesh.next`. Der Java-Namespace bleibt `de.lowgiga.cuecommandmesh.preview`. Die vorherige Preview-Installation und ihre privaten Daten werden nicht automatisch übernommen.

Für 0.5.4 liegt hier **keine native oder APK-Freigabe** vor. Voraussetzungen und Signiergrenzen stehen in [app/README.md](app/README.md#android-bauen) und [Signing & Recovery](app/docs/SIGNING-AND-RECOVERY.md). Private Schlüssel, APKs und lokale SDK-Konfiguration werden nicht ins Repository aufgenommen.

- Exporte bleiben nötig; Deinstallation oder Speicherräumung kann lokale Daten löschen
- Systembackup-Import bleibt eine lesende Vorschau, keine produktive Vollwiederherstellung
- Persönliche Entwürfe, Darstellungsoptionen und Workflow-Wiederaufnahme haben unterschiedliche Speicher-/Exportgrenzen
- Hologramm ist ein Bildschirmstil; 3D und Kamera-AR haben unterschiedliche Voraussetzungen
- Keine neue physische S25-/Touch-/Kamera-/Tracking-/GPU-, Bildraten- oder Akkuabnahme behauptet

## Quelle, Nachweise und Historie

- **app/**: vollständiger Entwicklungsquellstand mit Tests und bewusst angenommenen Qualitymetadaten
- **docs/29-k3-quality-adoption.md**: aktueller gemeinsamer Qualitätsnachweis
- **docs/28-memory-result-continuation.md**: K3-Ergebnisnavigation und Routing
- **docs/27-product-continuation-context.md**: erhaltener Produktkontext und offene Grenzen
- **docs/26-k1-continuation.md**: unverändert erhaltener K1-Nachweis
- **docs/25-assistant-host-mobile.md**: vorheriger Assistant-/Mobile-Nachtrag
- **docs/24-appearance-054-web.md**: vorheriger Appearance-Webstand
- **docs/reference/k3-routing/**: aktuelle K3-/Routing-Prüfbelege
- **docs/reference/k2-preview/**: erhaltene K2-/Vorschau-Prüfbelege
- **docs/reference/k1-continuation/**: unverändert erhaltene K1-Prüfbelege
- **docs/reference/assistant-host-mobile/**: erhaltene Assistant-/Mobile-Prüfbelege
- **docs/reference/appearance-054/**: erhaltene Belege des vorherigen Appearance-Stands
- **docs/23-source-final984.md** und **docs/reference/final984/**: vorheriger 0.5.3-Stand
- **docs/22-source-freeze-949.md** und **docs/reference/freeze-949/**: früherer Integrationsschritt
- **docs/assets/**: eigene Konzeptgrafiken mit statischen Alternativen

[Produkt](docs/01-product.md) · [Architektur](docs/02-current-architecture.md) · [Datenmodell](docs/04-data-model.md) · [Skills](docs/08-skills-workflows.md) · [Sicherheit](SECURITY.md) · [Designkonzept](docs/21-readme-design.md)

Dieser Entwicklungsbranch ist ein gestapelter Reviewstand. main und der separate FINAL984-Branch werden durch diese Veröffentlichung nicht zusammengeführt oder überschrieben.
