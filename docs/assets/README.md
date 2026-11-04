# Eigene Konzeptgrafiken und Prüfnachweis

Stand: 4. Oktober 2026. Diese Vektoren wurden eigens für LowQuantFlow gestaltet. Sie zeigen eine visuelle Identität und einen konzeptionellen Arbeitsweg, keine App-Screenshots, kein laufendes System und keine Releasefreigabe.

## Dateien

| Datei | Format / Maße | Umfang | Zweck |
| --- | --- | --- | --- |
| [lowquantflow-hero-animated.svg](lowquantflow-hero-animated.svg) | SVG, 960 × 600 | 8.917 Bytes | Wortzeichen, räumliche Projektknoten und leuchtende Datenwellen; einmalige CSS-Sequenz |
| [lowquantflow-hero-static.svg](lowquantflow-hero-static.svg) | SVG, 960 × 600 | 7.221 Bytes | Vollständige ruhende Alternative ohne CSS oder Animationselemente |
| [workshop-flow.svg](workshop-flow.svg) | SVG, 560 × 1.310 | 6.109 Bytes | Hochkant lesbarer Konzeptablauf; optionale Module ausdrücklich als geplant markiert |

Gesamtumfang der drei SVG-Dateien: **22.247 Bytes**.

Alle Motive bestehen aus eigenen Vektorformen und Text. Keine fremden Logos, kopierten Bilddateien, eingebetteten Screenshots, Skripte, externen Fonts oder externen Requests. Schriftfamilie: Arial, Helvetica, sans-serif mit lokalen System-Fallbacks. Das Erscheinungsbild kann sich dadurch zwischen Systemen leicht unterscheiden.

## Inhalt auch als Text

**LowQuantFlow – Ideen verbinden. Klar weiterbauen.**

Der Arbeitsweg ist ein **Konzept und Zielbild**, keine Aussage über bereits ausgelieferte Funktionen:

1. **Idee:** Ziel erkennen; Fragen und Quellen sammeln
2. **Auftrag:** Umfang begrenzen; Schritte und Abnahme klären
3. **Prüfen:** Wirkung verstehen; Annahmen und Varianten prüfen
4. **Review:** Befunde belegen; Entscheidungen bewusst treffen
5. **Ergebnis:** Nächsten Schritt festhalten; freigegebene Resultate nutzen

**Optional und geplant:** ein abschaltbarer 3D-Begleiter und ein separater Medienarbeitsbereich namens Video-Studio. Der Implementierungs- und Auslieferungsstand steht im [Statusnachweis](../17-status-evidence.md).

## Bewegungsverhalten

Das Hero enthält sechs CSS-Animationstypen: wandernde Lichtsegmente auf zwei Wellen, Datenpakete entlang der Verbindung, Projektknotenimpulse, Kernimpuls und ein leicht ausweitender Ring.

- Jeweils **4 Sekunden, genau ein Durchlauf, keine Startverzögerung**
- Keine Endlosschleife, kein JavaScript, kein SMIL
- Der Grundzustand ist bereits das vollständige Endbild
- Alle End-Keyframes entsprechen den Grundwerten; nach Ende fällt die Darstellung auf diese Werte zurück
- `prefers-reduced-motion: reduce` und Druckausgabe deaktivieren sämtliche Animationen mit `animation: none !important`
- Eine vollständige [statische Alternative](lowquantflow-hero-static.svg) ist unabhängig erreichbar
- Die Grafik lässt keinen Text einfliegen, rotieren oder verschwinden; Wortzeichen und Unterzeile bleiben unbewegt

Damit ist ein kurzer Bewegungsentwurf implementiert. Das tatsächliche zeitliche Verhalten im GitHub-Bildkontext sowie die Übertragung der Systemeinstellung zur Bewegungsreduktion wurden hier **noch nicht im Browser verifiziert**. Die vorhandenen Source-Regeln ersetzen diesen Test nicht.

## Tatsächlich ausgeführte Prüfungen

### Struktur

- Alle drei SVGs erfolgreich als XML geparst
- Sämtliche internen `href`- und `url(#…)`-Referenzen auf vorhandene IDs aufgelöst
- Keine Skripte, externen Bild-/Fontverweise, `foreignObject`- oder SMIL-Animationselemente
- Jede Datei besitzt `title`, `desc`, `role="img"` und `aria-labelledby`
- Animiertes Hero nach Entfernung seines Style-Blocks **bytegleich** mit der statischen Hero-Datei
- Die sechs Animationsdeklarationen und beide Abschaltregeln separat kontrolliert

### Echtes Rasterrendering

Renderer: **Sharp 0.35.4 / librsvg 2.62.91 / libvips 8.18.6**. Es wurden echte Bilder erzeugt; diese Engine beweist das statische Aussehen, führt aber die CSS-Zeitsequenz nicht als Browserabnahme aus.

| Grafik | Gerenderte Breiten | Sichtprüfung |
| --- | --- | --- |
| Hero, statisch | 320, 360, 768, 960 px | Alle vier Größen in einem Kontaktbogen geprüft |
| Hero, animierte Quelldatei | 320, 360, 768, 960 px | Statische Rasterdarstellung erfolgreich; keine zeitliche Abnahme |
| Hochkantablauf | 320, 360, 560, 768, 960 px | 320 und 360 px im Kontaktbogen geprüft; größere Exporte technisch erzeugt |

Befund: Im geprüften Hero bleiben Marke und Unterzeile innerhalb der Bildfläche. Bei 320 px Bildbreite beträgt die nominelle Unterzeile 12 px. Im Ablauf bleiben Reihenfolge, Beschreibungen und die Kennzeichnung **OPTIONAL · GEPLANT** bei 320 und 360 px sichtbar, ohne beobachtete Überlappung oder abgeschnittene Wörter. Die kleinste Ablauftextgröße beträgt bei 320 px Bildbreite nominell etwa 13,7 px. Die README soll den vollständigen Inhalt weiterhin als normalen Text enthalten.

Ein beim ersten Render sichtbarer Fehler an einem vertikalen Verlaufsstrich wurde vor dem finalen Export behoben: Linienverläufe benutzen jetzt ausdrücklich `gradientUnits="userSpaceOnUse"`.

### Kontrast-Stichproben

Berechnet nach relativer sRGB-Luminanz für die jeweils angegebenen Vollfarben:

- Hero-Unterzeile `#b5c9e4` gegen Navy `#0b1631`: **10,60:1**
- Ablaufbeschreibung `#c5cce0` gegen Panel `#13243e`: **9,70:1**
- Modulbeschreibung `#d0c8e3` gegen `#1c1937`: **10,50:1**
- Cyan-Kopfzeile `#81edff` gegen `#071123`: **13,91:1**

Dies sind nachvollziehbare Farb-Stichproben, keine vollständige WCAG-Zertifizierung. Dekorative Glows, Raster und Wellen sind bewusst teilweise kontrastarm; sie tragen keine alleinige Status- oder Handlungsinformation.

## Noch offene Hostingprüfung

Ein lokaler Headless-Chromium-Start war wegen eines schreibgeschützten temporären Verzeichnisses nicht möglich. Die lokale Vorschauadresse war im Cloud-Browser nicht erreichbar. Deshalb wurde das statische Aussehen mit der vorhandenen Rasterengine geprüft.

**Offen:** Rendering im authentifizierten privaten GitHub-Repository, sichtbare Bewegung zwischen 0 und 4 Sekunden, sicher ruhendes Bild nach 4 Sekunden, echte Betriebssystem-/Browser-Einstellung für Reduced Motion sowie GitHub-Hell-/Dunkelansicht. Keine Anmeldung oder Hostingfreigabe wird aus dem erfolgreichen XML-/Rastertest abgeleitet.

Empfohlene Abnahme nach Veröffentlichung:

1. README auf GitHub öffnen und sicherstellen, dass alle drei Bilder geladen werden
2. Hero neu laden: Lichtsegmente müssen innerhalb der ersten vier Sekunden wandern; anschließend darf keine Bewegung verbleiben
3. Mit aktivierter Systemeinstellung für weniger Bewegung neu laden; es soll sofort das ruhende Bild erscheinen
4. Statischen Link öffnen und mit dem ruhenden Hero vergleichen
5. README mit 320-/360-px-Bildbreite und in beiden GitHub-Themen prüfen; bei engerem Textbereich den normalen Markdowntext verwenden

## Einbindung

Das Hero kann als normales Bild eingebunden werden; der Alternativlink sollte direkt daneben stehen. Der Bewegungsstatus ist keine README-HTML- oder JavaScriptfunktion.

Empfohlener Hero-Alttext: **„LowQuantFlow – Ideen verbinden. Klar weiterbauen. Eigene Konzeptgrafik mit leuchtenden Projektknoten und Datenwellen.“**

Empfohlener Ablauf-Alttext: **„Konzept: Idee → Auftrag → Prüfen → Review → Ergebnis. 3D-Begleiter und Video-Studio sind optional und geplant.“**

Titel und Beschreibung innerhalb eines SVG werden nicht in jedem Bild-/Screenreader-Kontext gleich ausgewertet. Deshalb ergänzen verständlicher Markdown-Alttext, normaler Textinhalt und der direkte statische Link die SVG-Metadaten.

## Technische Quellen

Die Quellen erklären die technischen Grenzen und Gestaltungsentscheidungen; sie liefern keine übernommenen Grafikdateien.

- [MDN: SVG als Bild](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_image): eingebettete SVGs haben einen eingeschränkten Kontext; selbst enthaltene Inhalte vermeiden externe Abhängigkeiten
- [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion): Systemeinstellung zur Reduktion nicht wesentlicher Bewegung
- [W3C: Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html): Anforderungen an automatisch bewegte Inhalte; die einmalige Sequenz wird zusätzlich kurz gehalten
- [GitHub-Markup](https://github.com/github/markup): GitHub sanitisiert gerendertes HTML; beliebige README-Skripte sind keine zugesicherte Möglichkeit

## SHA-256 der finalen SVG-Dateien

- `lowquantflow-hero-animated.svg`: `df12eb342bb36a7a6407a901ce3be3b008363f748aaa817a1e89e7a9a1cf1e9d`
- `lowquantflow-hero-static.svg`: `3d3713c78d765d43afffe4b4dd3d8d46700cd9d60788d8f1e0177c44c453943d`
- `workshop-flow.svg`: `6f17319b18205ff622226772d01c7cec8a915e649373b7fe1b141cbbda7c2008`

[README-Design](../21-readme-design.md) · [Produktziel](../01-product.md) · [Zur Dokumentation](../README.md)

