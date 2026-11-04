# 2D, 3D, AR und Lernen

## Gemeinsame Graphsicht

`vendor/mesh-extensions/src/model.ts` und die bestehende Raum-/Graphdomain leiten Beziehungen aus WorkState und Quellen ab. `GraphExplorer.tsx` verbindet Layout, Filter, Auswahl und Inspector. `SvgView.tsx` und `ThreeView.tsx` sind unterschiedliche Ansichten desselben fachlichen Graphen.

`three-controller.ts`, `three-scene.ts`, `motion.ts` und `src/graph/view-policy.ts` betreffen Renderer/Lifecycle/Bewegung. Eine 3D-Auswahl darf nicht auf ein anderes Objekt zeigen als dieselbe 2D-Auswahl. Ansichtswechsel darf keinen neuen Ausführungszustand erzeugen.

## Begriffe sauber trennen

- **2D:** SVG-/flache Graphdarstellung und gleichwertiger Bedien-/Lernpfad
- **3D:** Bildschirmbasierte Three-Darstellung, keine Kamera-AR
- **Hologramm:** Visueller Bildschirmstil, kein physisches Hologramm
- **Browser-WebXR:** Geräte-/browserabhängiger AR-Pfad; vorhandener Android-WebView-Pfad unterstützt ihn nicht
- **Native AR:** Optionales experimentelles ARCore-Modul in der Android-Hülle
- **3D-Begleiter:** Gewünschter späterer Actor im vorhandenen Renderer; noch keine freigegebene Integration

## Native AR-Grenze

Quellen: `src/NativeARPanel.tsx`, `src/platform/native-ar.ts`, `native-ar-runtime.ts`, `android/cue-native-ar/`, `extensions/native-ar/docs/BRIDGE.md`.

Der Bridgevertrag prüft Version, Snapshotrevision, Titel, Knoten, Kanten und Rückgabe strikt. Bestehende Grenzen: höchstens 256 Knoten, 4096 Kanten und 512 KiB Snapshot. Knoten-IDs müssen eindeutig sein; Koordinaten endlich und normalisiert. Verweise auf fehlende oder identische Endpunkte werden abgelehnt.

Texte können für die Anzeige gekürzt werden; die Revision berücksichtigt weiterhin die vollständige Semantik. Die Rückgabe darf nur ein zum unveränderten Snapshot gehörendes Objekt auswählen.

AR startet erst nach bewusster Handlung. Kompatibilitätsabfragen können den Google-AR-Dienst kontaktieren. Energiesparen sperrt AR. Fehlende Unterstützung, verweigerte Kamera, Cancel, Fehler und Lifecyclewechsel benötigen echte Geräteabnahme.

**Kein Hardwarebeleg:** Vorhandene Tests und Bridgefixtures ersetzen keine Prüfung von Kamera, GPU, Platzierung, Wärmeentwicklung oder Akku auf einem tatsächlichen Gerät.

## Lernen

Vorhandene praktische Stufen:

1. Herkunft in 2D
2. Verbindung verfolgen
3. Tiefe und Kamera
4. Übertragung in Arbeit

Die separate Lernprojektion unterscheidet Quiz offen, Quiz gespeichert, Übung dokumentiert, Transfer offen und Transfer in der App belegt; bei ungeladenem Stand gilt „Stand unbekannt“.

Quellen: `upstream/lib/academy.ts`, `upstream/lib/spatial-learning.ts`, `overlay/lib/learning-levels.ts`. Die praktische Reihe kann höchstens 100 Praxis-XP, Quiz höchstens 100 Quiz-XP ergeben. Abgeleitete Zustände erzeugen keine zusätzlichen XP. Wiederholung darf nicht unbegrenzt Punkte erzeugen.

Lernfortschritt, XP und Transferbeleg erteilen keine technischen Rechte, Zertifizierung oder Gerätefreigabe. 2D bleibt ein gleichwertiger Ersatzpfad.

## Geplanter Begleiter

Die Integration wird erst nach Assetinventar, Bytes-/Hashprüfung und Lizenzprüfung entschieden. Ziel: optionaler Actor mit Textblase, vorhandene Three-/Rendererinstanz, reale Objekt-/Pipeline-IDs und tatsächliche Zustände als Eingang. Keine zweite HTML-/CPU-3D-App einbetten.

Abnahme: abschaltbar, Reduced Motion, Energiesparen, 2D-Fallback, Ressourcenfreigabe, verständliche Hinweise und reale GPU-/Akkumessung. Ein untrusted Event mit dem Text `source:app` ist kein vertrauenswürdiger Zustandsnachweis.

[UI](06-ui-navigation.md) · [Anforderungen MOD-01 / QA-01](16-acceptance-matrix.md)
