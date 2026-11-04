# Cue: enges Domain-Fix-Kit, Revision 1

Stand: 01.10.2026. Isolierter Kandidat; keine Änderung an `cue-system`, `cue-v6` oder `cue-v7` durch dieses Kit. Kein Restore-Kit gelesen, geprüft oder integriert. Vollrestore ausdrücklich ausgeschlossen.

## Ergebnis und Umfang

Zwei vorhandene Domainfehler sind im isolierten V6-basierten Android-Port fachlich behoben und geprüft:

1. Jede akzeptierte Aufgabenentfernung erzeugt im selben Zustandsabschluss einen kanonischen `task-updated`-Eintrag mit der entfernten ID (`entityId`) und eindeutigem Titel „Aufgabe entfernt“. Bei mehreren entfernten Aufgaben entsteht ein Eintrag pro ID. Bestehende Sequenzierung, 200-Ereignis-Retention, Typvalidierung, Referenzen, CAS und Schreibbudget bleiben bestehen. Keine Lösch-UI, keine neuen Löschrechte.
2. Zustandsändernde Fokusvorschläge prüfen aktuelle fachliche Anwendbarkeit statt lebenslang den semantischen Schlüssel zu sperren. Nach legaler Phasen-/Aufgabenrückkehr funktioniert eine neue Request-ID. Die Prüfung identischer Request-IDs bleibt unverändert. Reines „Review öffnen“ bleibt einmal je bisherigem semantischen Schlüssel, auch nach späterem Review-Rücksprung. Historie wird nicht gelöscht oder umgeschrieben; keine updatedAt-basierte Zyklusheuristik.

Der aktive Legacy-Import erklärt vor der Auswahl sowie vor dem Zusammenführen:
- Bestehende Raum-IDs bleiben als vollständige Objekte unverändert; neue eingehende Beiträge in diesen Räumen werden übersprungen
- Dateigrenze 3 MiB (3.145.728 Byte), Zielbestand einschließlich kanonischer Ereignisse höchstens 1.750.000 UTF-8-Byte
- Ein erfolgreicher Export garantiert keinen späteren Import

## Portable Integration

Das Kit ist eine explizite Ergänzung, kein vollständiger Ersatz der App. `files/` enthält nur den neuen Generator und Regressionstests. `integration.patch` zeigt fünf kleine Änderungen an vorhandenen Portdateien. Keine Datei unter `upstream/` wird überschrieben. Keine Abhängigkeit wurde hinzugefügt oder aktualisiert.

Bevorzugter Weg in einer separaten, bereits zusammengestellten V7-Android-Kandidatenkopie:

1. `node PATH_TO_KIT/integrate.mjs PATH_TO_CANDIDATE --check`
2. `node PATH_TO_KIT/integrate.mjs PATH_TO_CANDIDATE --apply`
3. Im Kandidaten: `node scripts/build-overlay.mjs`
4. `node --test tests/domain-fixes.test.mjs`
5. `npm test && npm run build && node scripts/check-portability.mjs`
6. Danach die vollständige Provenienzprüfung der finalen V7-Basis sowie Android-Build-/Laufzeitprüfungen der Gesamtintegration ausführen

Der Integrator prüft zuerst acht unveränderliche Domainquellen und alle Textanker, dann schreibt er sieben explizite Portdateien. Er überschreibt keine schon vorhandenen Kitdateien. Ein zweites Anwenden wird abgewiesen. `--check` ist lesend. Manuelle Integration ist über den beigefügten Patch plus `files/` möglich; bei Kontextdrift keinen erzwungenen Patch anwenden.

Die Originalmodule `intelligence.ts`, `intelligence-actions.ts` und `work-updates.ts` werden als getrennte Dateien unter `overlay/lib/` erzeugt. Dabei sind genau zwei fachliche Änderungen enthalten: der fokusspezifische Return-Ausdruck und die zusätzliche Schleife über tatsächlich entfernte Aufgaben. `intelligence-actions.ts` übernimmt ausschließlich den gemeinsamen Overlayselektor. Alle anderen relativen Bibliotheksimporte zeigen weiterhin auf die Originalverträge.

Wirksame Auflösung:
- Vite: exakter Alias `@/lib/intelligence` (mit/ohne `.ts`) vor dem allgemeinen `@`-Alias
- Node-Testloader: derselbe exakte Alias vor der allgemeinen `@/`-Auflösung
- TypeScript: expliziter `paths`-Eintrag
- Lokaler Schreib-/Actionpfad: `src/local-domain.ts` importiert Ereignisse, Actiondomain und Selektor explizit aus `overlay/lib`
- UI: unverändertes `NeuroPanel` und dessen Verlaufsbuttons verwenden über ihren bestehenden Alias denselben Selektor
- Hauptgenerator: Domain-/Textgenerator läuft zuletzt, nach den vorhandenen UI-Generatoren; erneutes vollständiges Generieren bleibt reproduzierbar

Die V7-Erweiterungen `spatial-learning`/`ar-runtime` und andere vorhandene Aliase bleiben beim Integrator vollständig erhalten. Der Patch wurde auf V7-Portkontext angepasst; der hier vollständig getestete isolierte Kandidat bleibt absichtlich auf seiner unveränderten V6-Basis. Endgültige V7-Kombination ist erst durch den Integrator/Reviewer nachzuweisen.

## Ausgeführte Nachweise

- Test-first RED vor Implementierung, erneut mit exakt finaler Testdatei im zurückgesetzten isolierten Basiskandidaten bestätigt: 22 Tests, 13 erwartete Fehler, 9 bestehende Schutztests bestanden (`reports/red.tap`)
- GREEN: 22/22 einschließlich echter React-NeuroPanel-Ausführung im simulierten DOM und LocalWorkStore/Fake-IndexedDB-Transaktion (`reports/green.tap`)
- Vollständiges `npm test`: 159 Basis-, 84 Integrations-, 19 Reviewer-, 220 Vendor- und 30 Level-Domaintests, insgesamt 512/512; dazu bestehende Renderer-Szenarien grün (`reports/full-tests.txt`)
- TypeScript: `tsc --noEmit`, Exit 0 (`reports/typecheck.txt`)
- `npm run build`, Exit 0 einschließlich Quell-/Vendor-/Native-AR-Driftprüfungen, Overlaygenerierung, TypeScript und Vite (`reports/build.txt`)
- Portabilitätsprüfung Exit 0 (`reports/portability.txt`)
- V6-Kandidatenprovenienz: 208 Originaldateien byteidentisch, `23ae42c2d83d5b31dcc9f61adeefb22bb1e1f03a` (`reports/provenance.txt`)
- Finale V7-Originalquelle: `3e921804b13e0d7c70d1ff15474f0387e84d70b6`; acht hier relevante Domaindateien bytegleich, Eingangshashes in `input-contract.json`

Die ursprüngliche RED-Suite wurde vor jedem Produktivpatch ausgeführt. Beim Testharness wurde der Größenfall auf kanonisch geordnete gespeicherte Objekte korrigiert: Andernfalls erzeugte schon die unveränderte Raum-Kanonisierung ein vorhandenes Workspace-Ereignis und verdeckte die konkrete Entfernungslücke. Der dokumentierte finale RED-Lauf bestätigt, dass allein die fehlenden Löschereignisse den Budgetfall durchließen.

## Grenzen / offene Gesamtintegration

Keine Android-Geräte-, WebView-, Kamera-, GPU-, echte IndexedDB-/Dateiimport- oder Produktionsdatenabnahme in diesem Kit. Kein neuer Server, keine Live-Synchronisierung und keine externe Aktion. V7-Gesamtintegration, finale V7-Provenienz und das zugehörige APK müssen separat geprüft werden. Das Kit allein ist kein installierbares APK.

Die bestehenden Warnungen zu NPM-Umgebungsschlüssel `http-proxy` und Vite-Chunks über 500 kB sind keine neuen Laufzeitfehler; sie bleiben im Buildlog sichtbar. Die unveränderte 120-Interaktionsgrenze kann weitere Fokusaktionen nach vielen echten Schritten blockieren. Ein Reviewformular kann weiter manuell geöffnet werden; nur der protokollierende Fokusshortcut bleibt einmalig. Nicht jede theoretische Überbelegung wurde geprüft. Grenzen und Fehler werden nicht als pauschale Gerätefreigabe oder als „beliebige Exporte wiederherstellbar“ umgedeutet.

`freeze.json` und `SHA256SUMS` beschreiben die ausgelieferten Dateien. `.validation/` ist ein lokaler, nicht ausgelieferter Prüfarbeitsbereich. Die minimale Auslieferung enthält keinerlei absolute Entwicklungs-/SDK-Pfade.
