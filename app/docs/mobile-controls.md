# Mobile App-Bedienung, Mobile UX (M)

Basis: unveränderter C-Checkpoint vom 05.10.2026, 891 Dateien / 11.889.175 Bytes. Baum-SHA256: `3842de48421bb2ad58f12f0ac57e7942b800998d7bb56e5ba21b9e77f09623a8`.

## Implementierter Umfang

- Bis zu vier individuell belegbare App-Schnelltasten. Leere Slots verschwinden; vier leere Slots blenden die Leiste vollständig aus
- Allowlist mit allen 17 bestehenden Arbeitsbereichen und sechs Studiozielen. Es werden ausschließlich Ansichten geöffnet, keine Freigaben erteilt, Läufe gestartet, Daten gelöscht oder Berechtigungen geändert
- Die aktuelle Auswahl kommt aus der bestehenden Browser-URL. Das zusätzliche `cue:route-changed`-Signal enthält keine Nutzdaten oder Ausführungsanweisung. Es aktualisiert nur die Anzeige nach bestehenden URL-Änderungen
- Studio-Tabs verwenden `studio=1&studioTab=...` und normale Browser-History. Keine Überschreibung von Android-Zurück, Home oder App-Wechsel
- Bereichsbeschreibungen sind native, standardmäßig geschlossene `details` und wechseln mit dem gewählten Bereich
- Native Buttons/Selects, benannte Navigation, `aria-current`, Fokusrahmen, optionale Pfeil-/Home-/End-Fokusnavigation ohne Tab-Falle, Fokus-Rückgabe an die Einstellungs-Summary bei Abbrechen
- Während Texteingabe wird die feste Leiste auch ohne VisualViewport ausgeblendet. Vorhandenes VisualViewport meldet zusätzlich Verdeckung und unteren Versatz; Pinch-Zoom wird nicht als Tastatur interpretiert
- Gemessene Leistenhöhe reserviert Platz. Safe-Area links/rechts/unten und Textumbruch sind berücksichtigt. Das Touchziel beträgt 48 CSS-Pixel, keine Behauptung einer nativen dp-Gleichheit
- Root-Schriftmaß, bestehendes Theme und CSS-Variablen bleiben maßgeblich. Kein Eingriff in Dichte, Widgets, Startseite, Motion oder PowerSaver. Keine Animation, neue Framework-Abhängigkeit, Netzwerkverbindung oder Android-Permission

## Gemeinsamer Preferences-Vertrag

`SystemState.mobile` ist ein additives optionales Feld von `cue.system-state/v1`:

    { "slots": ["view:overview", "view:missions", "studio:assistant", "view:settings"] }

Die vier Positionen sind jeweils ein erlaubtes Ziel oder `null`; gleiche zugewiesene Ziele sind verboten. Unbekannte Felder, Aktionen, zusätzliche Slots und vorhandenes `null`/`undefined` an Stelle des Objekts werden abgelehnt.

Fehlt das Feld in einem alten Datensatz, wird nur für die Darstellung eine neue Standardbelegung erzeugt. Der gespeicherte Datensatz und sein parse-Ergebnis bleiben unverändert. Erst bewusstes Speichern setzt das Feld. Kein Versionssprung oder destruktiver Migrationsschritt ist nötig. Bereits beschädigte Werte werden niemals durch Defaults ersetzt.

Es gibt keinen zusätzlichen Store. Laden, Schreiben, Revision, Konfliktsperre und Transaktion laufen über den bestehenden `PreferencesStore`/`SystemPreferencesProvider`. Die bestehende 1-MiB-Grenze bleibt erhalten. Studio-Graph, Layout, Workflow und Historie werden per funktionalem Update erhalten. Gleichzeitige Änderungen respektieren dieselbe CAS-Revision. Korruptions-/Ladefehler werden auch außerhalb des Studio sichtbar angezeigt.

Der neue Wert wird vom vorhandenen Backup-Export und dessen Vorschau mitgenommen. `restoreAvailable` bleibt `false`; kein Restore hinzugefügt. Die ältere C-Anwendung mit striktem Validator kann ein neu gespeichertes `mobile`-Feld nicht lesen und lehnt es ab. Daher keine Downgrade-Zusage und keine automatische Entfernung des Feldes. Bestehenden Export vor einem bewussten Versionswechsel sichern.

Ungespeicherte Belegungsentwürfe bleiben beim Wechsel zwischen Studio und Arbeitsbereichen erhalten; unsichtbare Controls sind `hidden` und `inert`. Verändert eine andere Quelle die Belegung während eines Entwurfs, bleibt er sichtbar und kann den neuen Stand nicht still überschreiben.

## Ursprüngliche C-only-Grenze und serielle Integration mit Paket E

Die reine C-Basis enthält noch kein AssistantPanel. Deshalb ist `STUDIO_ASSISTANT_AVAILABLE` in `src/mobile/mobile-navigation.ts` hier `false`. Die entsprechende Schnelltaste ist deaktiviert; direkte assistant-URLs werden für Inhalt, Kurzinfo und Auswahlmarkierung konsistent wie ein nicht verfügbares Tabziel auf Graph abgebildet. Es wird kein interaktiver Dummy als Assistent ausgegeben.

Beim Zusammensetzen mit dem echten E-Panel:

1. Die E-Importe für `AssistantPanel`, seine Navigation und sein echtes Panel-Rendering beibehalten
2. Die E-Signatur `Studio({data,active=true}:{data:any;active?:boolean})` und `active && tab === 'assistant'` beibehalten
3. Den bisherigen lokalen Studio-Tab-State durch `const route=useMobileRoute(), tab=route.studioTab, setTab=navigateStudioTab` aus D ersetzen. E benutzt denselben Identifier `assistant`; `onOpenMemory={()=>setTab('memory')}` bleibt gültig
4. In `SystemApp` E's `<Studio data={data} active={studio}/>` mit D's MobileShell/Kurzinfo/Route-Signal zusammenführen
5. Erst mit tatsächlich importiertem und renderbarem E-Panel den zentralen `STUDIO_ASSISTANT_AVAILABLE` auf `true` setzen
6. Overlay aus dem kombinierten Generator neu erzeugen und die Pin-/Driftprüfungen unverändert ausführen

Mobile enthält keine Companion- oder Assistentenkonfigurationsfelder. Der C-Assistenten-Configstore, WorkState-Verträge, Android-Quellen und alle Dependency-/Lock-Dateien sind unverändert.

## Verifikation und Grenzen

- 30 neu ergänzte Mobile-Tests; zusammen mit dem vorhandenen Mobile-CSS-Test 31/31 grün
- Komplette `tests/system`-Suite: 559/559 grün; Code-/DOM-/IndexedDB-Simulation, keine Geräteprüfung
- TypeScript, Pin-/Drift- und Portabilitätsprüfung grün
- Unabhängiges Review: vier konkrete Befunde behoben und nachgetestet (CSS-Spezifität 44/48 px, nicht verfügbarer Assistant-Deep-Link, unsichtbarer Ladefehler, verworfener Entwurf beim Moduswechsel)
- Vollständiger `test:serial`-Lauf unter Read-only-Sandbox an unveränderten `/tmp`-Fixture-Schreibtests blockiert; daraus wird kein Gesamtpass abgeleitet
- Webbuild: vorgelagerte Drift-, Vendor-, NativeAR- und Domain-Prüfungen grün; Overlay-Schreibschritt mit EROFS blockiert. Reguläre genehmigte Eskalation startet zeitweise nicht wegen des bwrap-Mountfehlers. Kein Umgehen der Einschränkung
- Reale Browser-Screenshots, Portrait/Landscape, echte 200%-Großschrift, TalkBack, Android-IME/Gestennavigation und S25-Hardware: NOT RUN. Vorhandener Cloud-Chromium-/CUA-Zugriff wurde in der parallelen Paketprüfung als blockiert festgestellt; keine Flags, Tunnel oder Hostwechsel zur Umgehung

Die Browser-/Geräteabnahme muss daher nach serieller Integration nachgeholt werden. Besonders native Select-Beschriftungen, Systemtastatur, Safe-Area und tatsächliche Touchgeometrie sind auf dem Zielgerät zu prüfen.

## Integrierter Prototyp

Mobile UX (M) ist nicht Architekturpaket D. Persönliche Fortsetzung und persistente Drafts aus dem ursprünglichen Architekturplan bleiben unimplementiert. Im integrierten Stand ist der echte E-Assistent angeschlossen und der zentrale Availability-Guard true; URL-Navigation und aktiver Studio-Cleanup sind gemeinsam geprüft. Das optionale Companion-Sichtbarkeitsfeld ist ausschließlich lokaler React-Ansichtszustand und fügt diesem Preferences-Vertrag nichts hinzu.
