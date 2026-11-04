# Tatsächlicher Systemzustand

Stand dieser Entwicklungswave: 1.4.2, Referenz `23ae42c2d83d5b31dcc9f61adeefb22bb1e1f03a`. Die unmittelbar vorherige private Produktion war Sites-Version 6 (App 1.4.1). Die 1.4.2-Wave ist lokal abgenommen: 132 Domain-, 195 HTTP- und 114 Browserchecks, Typecheck, Build und Budget PASS. Der genaue aktuelle Live-Commit und terminale Veröffentlichungsstatus sind im Sites-Versionsregister zu lesen; ein Git-Artefakt stellt keinen zukünftigen Deploymenterfolg fest.

- **App:** 17 Bereiche, State-Version 4, eigene vier Arbeitsprofile, CAS-Speicherung, strikt validierte Missions-/Freigabe-/Ereignisstrukturen.
- **Daten:** D1 enthält pro Nutzer eine eigene kanonische Zeile. v2/v3-Leseverträglichkeit und Importversionen 1–4. Ereignisse und akzeptierte Zustandsänderung werden gemeinsam sequenziert gespeichert. Kein Browser-Token wird in Übergaben kopiert.
- **Visualisierung:** SVG-/DOM-Struktur zuerst; Three.js und Renderer werden erst nach Auswahl geladen. Graph maximal 32 sichtbare Knoten, eine Grafikressource. Ursprünge und geplante Kanten sind lesbar beschriftet.
- **Neue AR-Implementierung:** Surface-Modus fordert Hit-Test plus DOM-Overlay; gültige waagerechte Treffermatrix, Zielring, ausdrückliches Platzieren, Größenänderung am gewählten Basispunkt. Free-Modus separat. Die Sitzung wird erst nach einem Klick angefordert; Sitzungsstart und gültiges Tracking sind verschiedene Zustände.
- **Neue Lernimplementierung:** vier Praxislevel in versionierten persönlichen Notizen; 25 XP je einmaligem Abschluss. Bestehende fünf Quizthemen bleiben getrennt. Transferaufgabe, Notiz und optionale Missionsreferenz entstehen in einem CAS-Write.
- **Echtheit:** Three.js-Geometrie und Auswahlshader sind tatsächliche Grafikprogramme. „Hologramm“ beschreibt einen Auswahlstil. Kein physischer Projektor; kein Kamera-/Tisch-Erfolgsnachweis aus einer Software-Browserprüfung.
- **Low:** direkte Identität, Channel und Empfang unbestätigt. Commander listete zwei Offline-Geräte beim letzten in der Registry datierten Abruf. Aktuelle Hermes-Unterlagen enthalten ein manuelles Handoff-Modell, keinen aktiven Zugang. Getrennte Low-Pfade und eigener Branch bleiben reserviert.
- **Add-ons:** Figma-Anmeldung und Shader-Katalog lesend geprüft; erster Partei-Shader `CRT Screen`, Revision `3956ab234e8cc71aa8d9270820091e62aaa361a2`, als Technikreferenz gelesen. Kein Figma-Design geschrieben oder als App-Integration ausgegeben. Visualisierungs-/Three.js-Skills und lokale Playwright-/axe-Werkzeuge werden tatsächlich verwendet.
- **Betrieb:** owner-only Site, kein hinzugefügter Nutzer, kein Scheduler, keine neue Integration oder native Geräteinstallation aus dieser Wave.

Noch offene physische Abnahmen und zukünftige Adapter stehen ausschließlich im Backlog; sie sind kein impliziter Teil eines erfolgreichen lokalen Builds.
