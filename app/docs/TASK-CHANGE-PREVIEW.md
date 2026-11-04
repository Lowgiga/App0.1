# Deterministische Aufgaben-Änderungsvorschau

## Begrenzter, vollständig lokaler Schnitt

WRK-02/REV-01 erhalten eine Vorschau für Änderungen an genau einer bereits gespeicherten Aufgabe. In der Aufgabenmatrix öffnet „Änderung prüfen“ einen reinen Viewer. Er zeigt konkrete Vorher-/Nachherwerte, belegte Abhängigkeitspfade, erneute Gegenprüfungen, betroffene Missionen und unveränderte Aufgaben. Die Abnahmekriterien und bisher hinterlegten Belege stehen bei den betroffenen Aufgaben. Eine Beschreibung ist kein ausgeführter Test.

Neue Aufgaben behalten den bestehenden Anlageweg. Der vollständige Auftragskonstruktor, Variantenvergleich und externe Auswirkungsanalysen sind nicht Bestandteil dieses Schnitts. Projektgedächtniseinträge sind keine erfundenen Abhängigkeitskanten.

## Wiederverwendbarer Vertrag

- `src/task-change-preview.ts`: `planTaskChange(current, draft, knownSources, now)` ist rein und deterministisch für dieselben Eingaben. Der Plan enthält die gesamte Basis, den geprüften Entwurf, Basisrevision, explizite Prüfzeit, bekannte Quellen-IDs, eine Kandidatenkopie sowie erklärte Aufgaben-/Missionsfolgen und Blocker. Weder IndexedDB noch Transport, Netz oder Dateisystem werden angesprochen.
- `taskChangeCandidate(plan, current, draft, knownSources, now)` berechnet den kompletten Plan erneut und vergleicht ihn mit der angezeigten Fassung. Abweichender Entwurf, Revision, sonstiger Basisinhalt, Quellenbestand oder manipulierte Planfelder werden abgewiesen. Der Kandidat wird erneut durch dieselbe normale Domainpipeline geprüft. Identische Entwürfe haben nichts zu übernehmen.
- `src/task-review-impact.ts`: Die bereits vorhandene R2-Regel ist als gemeinsame Hilfsfunktion extrahiert. Der normale Validator und die Vorschau verwenden dieselbe Regel. Originalverträge und eingefrorene Upstream-Dateien bleiben unverändert.
- `src/TaskChangePreview.tsx`: reiner Viewer ohne Store, Transport und Schreibcallback. Bestätigen und Zurück liegen in der bestehenden Editorsteuerung.

Ein späterer Konstruktor kann diese Funktionen für vorhandene Aufgaben wiederverwenden. Der Vertrag erlaubt weder neue Tasks noch beliebige WorkState-Mutationen durch die Hintertür.

## Tatsächlich verwendete Beziehungen

Eine Kante existiert nur, wenn die nachfolgende Aufgabe die vorangehende ID in ihrem gespeicherten Feld `dependencies` führt. Die Analyse läuft von der geänderten Voraussetzung zu den abhängigen Aufgaben; eine deterministische Breitensuche zeigt je betroffener Aufgabe einen kürzesten belegten Pfad. Diamanten werden dedupliziert. Selbstbezüge, Zyklen, doppelte IDs, fehlende Aufgaben, Quellen und Missionsreferenzen sind blockierende Befunde, keine Aufforderung zur automatischen Bereinigung.

`mission.taskIds` ist die einzige Zuordnung von einer Aufgabe zu einer Mission. Gemeinsam verwendete Aufgaben können deshalb mehrere Missionskontexte betreffen. Eine lediglich im gleichen Raum oder Projekt befindliche unverbundene Aufgabe/Mission wird nicht geändert. Quellen, Räume, Notizen, Einstellungen, Lernfortschritt, Freigaben und Projektgedächtnis werden weder ergänzt noch gelöscht oder als neue Kanten interpretiert.

## Rücknahme alter Gegenprüfungen

R2 bindet bestehende Aufgabenreviews an Titel, Owner, Abnahmekriterium, Beleg und Abhängigkeiten sowie an die gespeicherte Voraussetzungskette einschließlich deren Status-/Reviewzuständen. Priorität, Kategorie und Archivierung sind reviewneutral. Die unveränderte Regel wird für bestehende Reviewmerker verwendet; die Vorschau erfindet keine neuen Freigaberechte.

Ein Plan nimmt nach dieser Regel veraltete eigene und abhängige Reviewmerker zurück. Betroffene erledigte Aufgaben werden ausdrücklich zu `Review` zurückgesetzt. Liegt eine dadurch berührte Mission in `Approved` oder `Done`, zeigt derselbe Plan ihre Rückkehr zu `Review` mit `reviewed:false`. Andere Missionsphasen bleiben unverändert. Das gesamte Paket wird erst mit „Gezeigte Änderung übernehmen“ als ein normaler Save bestätigt. Es ist weder ein neues Review noch eine Genehmigung externer Aktionen.

Historische Freigabekarten bleiben bytegetreu erhalten, auch bereits entschiedene oder abgelaufene Karten. Vor einer späteren externen Handlung ist deren konkrete Gültigkeit und Inhaltsbindung separat zu prüfen; der Plan erneuert keine Freigabe. Hinterlegte Belege bleiben als bisherige Dokumentation erhalten und werden nicht als erneute Prüfung ausgegeben.

## Speicherung, Konkurrenz und Abbruch

Es gibt keinen zusätzlichen Endpunkt und keinen zweiten Mutationspfad. Die Editorsteuerung übergibt ausschließlich die bestätigte Kandidatenkopie an das bestehende `save`/`changeWork`. Danach gelten unverändert Konflikt-Gate, normaler `PUT /api/state`, `applyLocalWrite`, Schema-/Referenz-/Reviewprüfung, Größenbudget und atomarer IndexedDB-CAS. Genau ein konkurrierender Commit auf dieselbe Revision kann gewinnen.

Die Vorschau enthält noch keine neuen App-Ereignisse oder Speicherzeit. Für eine exakte Größenprüfung durchläuft eine Wegwerfkopie die normale kanonische Pipeline mit deterministischen, gegen bestehende IDs abgeglichenen Sizing-IDs. Diese IDs verlassen die Prüfung nicht. Beim Commit erzeugt der normale Speicherpfad die echten App-Ereignisse und Revision; alle fachlichen Zustandswerte entsprechen der Vorschau.

Der beim Öffnen des Editors geladene Basisstand bleibt an den Entwurf gebunden. Auch nach einer Rückkehr aus der Vorschau wird ein veralteter Entwurf nicht still auf neuere Daten umgebogen. Nach paralleler Änderung: Entwurf sichern und Aufgabe neu öffnen. Zurück, Escape oder Schließen vor Übernahme schreibt nichts. Arbeitsplatzwechsel verbirgt das Portal und verwirft die Vorschau, erhält aber den Entwurf. Ein bereits versendeter normaler Schreibbefehl wird durch Schließen nicht sicher rückgängig gemacht; die Oberfläche sagt das während des Speicherns ausdrücklich. Späte Antworten dürfen einen neueren Editor weder schließen noch überschreiben. Doppelklicks senden nur einen Befehl.

Beim bloßen Zurücksetzen einer ungespeicherten Inhaltsänderung auf den Originalwert wird die automatisch zurückgenommene Review-/Statusanzeige wiederhergestellt. Eine zwischenzeitlich ausdrücklich getroffene Status-/Reviewentscheidung wird dabei respektiert. Der serverlose lokale R2-Validator bleibt unabhängig davon die letzte Schranke.

## Darstellung und offene Geräteabnahme

Der Viewer nutzt die bestehende modale Aufgabenoberfläche, native Buttons/Details, Fokus auf die Vorschauüberschrift, eine sichtbare Fehlerregion, umbrechbare Werte und mindestens 44 px hohe Aktionsflächen. Der Rückweg erhält den Entwurf. Bestehende 17 Arbeitsbereiche, Studio sowie 2D/3D/AR-Pfade bleiben erhalten.

Gezielte Tests laufen im dokumentierten RAM-Overlay auf der exakten rekonstruierten Quelle. Sie sind kein Browser-Pixelnachweis und kein Web-/Android-Vollbuild. Reale kleine Viewports, vollständige Tastatur-/Screenreader-Bedienung, Hardware-AR, ein frisches Bundle, APK, Signierung und Geräteabnahme bleiben separat zu prüfen. Keine KI-, Cloud-, Repository- oder Anbieterprüfung wird durch diese Vorschau simuliert oder als erfolgt behauptet.
