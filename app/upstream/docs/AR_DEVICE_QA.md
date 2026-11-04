# Physische AR-Abnahme · Auftrag für Low / erreichbares Gerät

Status: **NOT RUN**. Diese Datei beschreibt die fehlende Geräteabnahme; sie ist kein Testergebnis. Der vom Nutzer benannte Low-Kanal ist noch nicht verifiziert.

1. Private App direkt im tatsächlich unterstützten Browser öffnen, Eigentümerkonto selbst anmelden. Gerät/Browser/OS-Version und Zeitpunkt dokumentieren; keine Cookies oder Tokens teilen.
2. `3D & Lernen` → `Räumliches 3D`: sichtbare echte Geometrie, Fokusauswahl, Zoom und gleicher Knoten in 2D. Wenn WebGL scheitert, den Fehler und funktionalen 2D-Fallback dokumentieren.
3. `AR-Modus & Diagnose` → waagerechte Fläche / Tischmodus → `In AR ansehen`. Erst der Klick fordert eine Sitzung an. Bei Fehler Name, Phase und Browsermeldung im Bericht übernehmen. Keine Berechtigungen umgehen.
4. Nach tatsächlicher Kamera-/AR-Freigabe Kamera-Passthrough visuell prüfen. Langsam über eine gut beleuchtete strukturierte Tischfläche bewegen. Kein Modell ohne gültiges Tracking als erfolgreich bewerten.
5. Sichtbaren Zielring prüfen. `Hier platzieren` drücken oder eine Fläche außerhalb des DOM-Overlays antippen. Prüfen, dass versehentliche Berührung der DOM-Bedienelemente nicht gleichzeitig XR-Platzierung auslöst.
6. Gerät bewegen: Modell bleibt am gewählten Punkt. Größenänderung hält den Auflagepunkt; `Neu platzieren` sucht erneut eine Fläche. Kein Behaupten semantischer Tischidentifikation oder dauerhafter Anchors.
7. Tracking vorübergehend verlieren: Modell ausblenden, Treffermeldung entfernen, Platzieren gesperrt. Nach Wiederkehr neu/weiter prüfen. Browser abbrechen und Sitzung beenden; normale Kameraansicht und Steuerung wiederhergestellt.
8. Explizit den Free-Modus separat testen und als frei platziertes Modell ohne Hit-Test bezeichnen. Ein Free-Erfolg ersetzt keinen Surface-Erfolg.
9. Reduced Motion / Energiesparen / 390px-Touchbedienung prüfen. Lernlevels und 2D-Alternative ohne Kamera durchlaufen. Alte Quizstände bewahren.

Rückgabe: ein LowReport mit Briefbindung, Source-HEAD, tatsächlichen Aktionen, Erfolg/Fehler/Blockern und Belegstatus. Gerätescreenshots nur nach bewusster Nutzerauswahl und ohne private Kamerainhalte. Keine Installation, Systemflags, öffentlicher Versand oder dauerhaftes Monitoring aus diesem Auftrag.
