# README-Design und Grafiksystem

## Gestaltungsziel

LowQuantFlow erhält eine eigenständige futuristische Bildsprache: leuchtende Datenströme, verknüpfte Projektknoten, Wellen, räumliche Tiefe und bewusst sichtbare Animation. Die Grafik darf intensiv wirken; Navigation, Status und Einschränkungen bleiben als gut lesbarer Markdowntext außerhalb des Bildes verfügbar.

Alle hier erstellten Motive sind **Konzeptgrafiken**. Sie sind keine Screenshots einer fertigen App und kein Nachweis einer nativen Funktion.

## GitHub-Grenzen

GitHub sanitisiert README-HTML; beliebiges JavaScript, Inline-Styles und Appinteraktivität werden nicht als READMEfunktion versprochen. GitHub unterstützt Mermaid-Diagramme und Bilder. Selbstenthaltene animierte SVG können als eingebundene Bilder funktionieren; dies ist ein anderer Kontext als CSS/JS direkt im Markdown.

Die direkte private GitHub-Hosting-/Rendererprüfung bleibt offen. Dateiinhalt, Hashes und Verweise werden nach Veröffentlichung erneut geprüft. Eine Animation auf einer fremden Referenz beweist nicht automatisch das Rendering jeder eigenen Datei. Die eigenen Grafiken werden separat visuell geprüft; statische Alternative, Alttext und vollständiger Textinhalt bleiben vorhanden.

## Grafikvertrag

- Eigene Vektoren ohne fremde Markenlogos, Fonts, Skripte oder externe Requests
- Animiertes Hero mit kurzer einmaliger Sequenz und ruhendem Endbild
- Statisches Hero als direkt erreichbare Alternative
- Keine unpausierbare dauerhafte Animation oder Flackern
- Reduced-motion-Regel im SVG; tatsächlicher Renderingbefund im [Assetregister](assets/README.md)
- Architektur-/Arbeitsflussgrafik separat und lesbar
- Wichtige Aussagen nicht nur über Farbe oder Bewegung
- Hero ist Dekoration/Orientierung; Source-, Build- und Teststatus stehen im Text

## Lesbarkeit

360-/768-px- und Desktopdarstellung prüfen. Wesentliche Statusangaben stehen nicht in winziger Bildschrift. GitHub Hell/Dunkel, Dateilinks und Bildrendering kontrollieren. Normaler Text orientiert sich an 4,5:1 Kontrast; relevante grafische Informationen an 3:1. Starker Glow darf Kanten und Text nicht verwischen.

## Recherchierte Vorbilder

Es werden Prinzipien übernommen, keine fremden Dateien, Logos oder READMEtexte kopiert:

- [Excalidraw](https://github.com/excalidraw/excalidraw): klare Trennung von Bibliothek, gehosteter App und lokalem Einstieg
- [xyflow](https://github.com/xyflow/xyflow): verständliche Knoten-/Paket-/Architekturkommunikation; kein Anlass, React Flow zusätzlich einzubauen
- [react-three-fiber](https://github.com/pmndrs/react-three-fiber): Plattform-/Versionsgrenzen neben konkreten Beispielen; kein beschlossener Rendererwechsel
- [Bubble Tea](https://github.com/charmbracelet/bubbletea): markante Identität mit direktem praktischem Einstieg

Die genannten Projekte tragen eigene Lizenz- und Markenbedingungen. Konzeptionelle Inspiration ist keine pauschale Assetlizenz.

## Primärquellen und technische Referenz

- [GitHub-Markup und Sanitizing](https://github.com/github/markup)
- [GitHub-Diagramme mit Mermaid](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams)
- [GitHub-Bilder und picture](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#the-picture-element)
- [Beobachtetes Beispiel eingebundener SVG-Animation](https://github.com/russmckendrick/terminal-svg#recording-animated-svgs)
- [GitHub: zugängliche Profilseiten](https://github.blog/developer-skills/github/5-tips-for-making-your-github-profile-page-accessible/)
- [W3C: Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide)
- [W3C: prefers-reduced-motion](https://www.w3.org/WAI/WCAG22/Techniques/css/C39)
- [W3C: Textkontrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [W3C: Nicht-Text-Kontrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)

## Ausbau

Echte Appaufnahmen erst aus einem tatsächlich geprüften Lauf mit anonymisierten Fixtures, Sourcehash, Plattform und Datum. Für längere Demos ein statisches Poster mit nutzergesteuertem Video verwenden; keine pauschale Inlinevideo-Garantie für Markdown behaupten. Kein Livecounter oder falscher Buildbadge nur für optische Wirkung.

[Grafiken](assets/README.md) · [Power-User-Methodik](20-power-user-method.md)
