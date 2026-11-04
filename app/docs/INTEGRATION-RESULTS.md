# Prototyp-Nachtrag 0.5.3 vom 5. Oktober 2026

Aktueller Quellkandidat: `0.5.3-prototype-20261005`, Android-Versionscode `11`. Ausführungs- und Geräteabnahmen sind im gesonderten aktuellen Prüfbericht ausgewiesen; die Versionsnummer ist keine Produktionsfreigabe. Neue Funktionsbeschreibung und offene Abnahmen: [WORKFLOW-RECOVERY.md](WORKFLOW-RECOVERY.md). Die folgende Übersicht ist als historischer Bericht des ausdrücklich genannten 0.5.0-Standes erhalten; ihre Testzahlen, Hashes und Aussagen zur Sitzungspersistenz sind keine Freigabe des neuen Kandidaten.

# Aktuelle Integrationsübersicht

**Port 0.5.0-v7-integrated-preview · Sites V7 / App 1.4.2 · WorkState 4**

Originalcommit: `3e921804b13e0d7c70d1ff15474f0387e84d70b6`. Alle **226 Originaldateien** unter `upstream/` sind byteidentisch. Die ursprüngliche Website wurde nicht verändert oder veröffentlicht. Historische V5/V6-Berichte beschreiben ihre damaligen Zwischenstände, nicht diese Endkomposition.

## Integriert

- Alle 17 ursprünglichen Bereiche; ein zentral geladener WorkState für ursprüngliche UI und Studio
- V7-Praxislevel und Auswahlshader, gleichwertige 2D-Alternative, getrennte fünf Academy-Ableitungen ohne Doppel-XP
- Browser-WebXR mit bewusstem Surface-/Free-Modus, Diagnose, Abbruch, End-unknown und bewahrten Three-Lifecyclegarantien
- Optionales experimentelles natives ARCore-Modul Revision 6, 18 hashidentische Dateien; keine automatische Availability-Abfrage, ausdrückliche Datenschutz-/Kamerastarts, Energiespar-Sperre und reine Auswahlrückgabe
- Geprüfte Graph-, Skills-, Workflow- und adaptive Module; eigene Ansichtsoptionen revisionsgeschützt, Verlauf historisch ohne Replay-Rechte
- Native Datei-/Clipboardadapter und vier unveränderte Textdokumente als inert gerenderter Originaltext im vorhandenen Sheet
- Begrenzte Domainkorrekturen für Aufgabenentfernung, erneut zulässige Fokusaktionen und sichtbare Legacy-Importgrenzen
- Vollständiges JSON-Systembackup einschließlich gespeicherter Studiooptionen, Prüfhistorie und Praxisnotizen; Import dieses Formats bleibt **Vorschau, keine Vollwiederherstellung**

## Tatsächlich ausgeführte Prüfungen

| Prüfung | Ergebnis |
|---|---|
| Node-/DOM-/Domänen-/Modultests | 550 bestanden: 188 Basis/V7/Domainfix, 86 Integration, 19 frühere Regressionen, 220 Module, 30 Level-Domain, 7 neue Renderer-Vertragsfälle |
| Zusätzlicher Renderer-Lifecycleharness | 18 Fälle mit installiertem Three-XRManager und Browser-/GPU-Doubles bestanden |
| TypeScript und Webbuild | Bestanden |
| Frische versetzte Installation/Build | `npm ci --ignore-scripts`, Pfad mit Leerzeichen, byteidentischer Webbuild |
| Android-Hostquellen | Compile, 4 App- und 27 native AR-JVM-Tests, Lint bestanden; 13 bestehende Scaffoldwarnungen, AR-Modul 0 Issues |
| Buildumgebung | JDK21, AGP8.13.0, Gradle8.14.3, SDK36; tatsächlich aufgelöste Build Tools35.0.0 |
| Android-Cap-Sync | In getrennter Buildkopie ausgeführt; finale Assetwerte im Freezebericht |
| Physisches Gerät/GPU/Kamera/Tracking/Dateidialog | Nicht ausgeführt |

Web-SHA-256: `c53689e45bb05ec1601611c5db4ea4fcc7773540ef29892b8c3895474f3a9c61`. Maßgebliche Einzeldateien: `build-manifest.json`. Maßgeblicher Quellenbestand: `integration-source-manifest.json`. Ein Hash bestätigt Bytegleichheit, keine Gerätefunktion oder Authentizität fremder Behauptungen.

Logs: `v7-final-verification.txt`, `v7-renderer-features.txt`, `v7-renderer-merge-check.txt`, `v7-practice-check.txt`, `v7-domain-fixes.txt`, `v7-portable-install.txt`, `v7-portable-build.txt`, `v7-portable-sync.txt`, `v7-native-host-build.txt`, `v7-build-tools-check.txt`. Der endgültige unabhängige V7-/APK-Abnahmebericht gehört zum abschließenden Lieferpaket; dieses Dokument ersetzt ihn nicht.

## Ehrlich offen

- Persönlicher vollständiger Cloudexport fehlt; Beispiel-/Anfangsstand bleibt gekennzeichnet
- Keine Sites-Anmeldung, Cloud-/D1-Synchronisation, MCP-Providerverbindung oder externe Agentenausführung
- Keine Vollrestore-Aktion; bestehender Legacy-Merge ist begrenzt und erklärt kollidierende Räume sowie Größenlimits
- Native AR bleibt experimentell ohne Samsung-/Android-/Kamera-/GPU-Abnahme. Hologramm bleibt Bildschirmdarstellung; räumliche Maße sind schematisch
- Finale APK, Signatur, Alignment und enthaltene Assets werden separat geprüft; ein Quell-/JVM-/DOM-PASS ist kein Installations- oder Hardware-PASS

Details: `V7-INTEGRATION.md`, `PARITY.md`, `NATIVE-FILES.md`, `NATIVE-NAVIGATION.md` sowie `extensions/native-ar/docs/BRIDGE.md`.
