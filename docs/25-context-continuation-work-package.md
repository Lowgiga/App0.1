# Arbeitslos K1: belegte Kontextberatung zur Projektfortsetzung

**Status: im bezeichneten lesenden Webumfang implementiert und unabhängig geprüft.** Die bewusst angenommene Quelle ist `09739de34172b88d8e6907a24108a926439d5fc296226286bc395cda83dabd49`; der externe Pin lautet `af5f825b4e59a98a8af25015680fb577530c8cefed439096c2d33b06c5ac650f`. [Aktueller K1-Nachweis](26-k1-continuation.md). Keine autonome Fortsetzung, pauschale Anforderungsabnahme, native Ausgabe oder physische Gerätefreigabe.

## Historische Planung vor der Umsetzung

Die folgenden Problem- und Planbeschreibungen beziehen sich auf den vorherigen f57200cd-Stand. Insbesondere die damalige draft:null-Lücke ist im geprüften K1-Teilumfang geschlossen; verbleibende physische/native Abnahmen sind weiterhin offen.

## Konkretes Problem und gewünschter Weg

Ein Nutzer kehrt zu einem Projekt mit gespeichertem persönlichem Entwurf und bestätigtem nächsten Schritt zurück. Die Gedächtnisfläche kann diesen Entwurf bereits bewusst öffnen. Der Assistant liest dagegen in `snapshot()` aus [use-assistant-session](../app/src/assistant/use-assistant-session.ts) bislang **`draft:null`**. Die vorhandenen Entwurfsmetadaten in [assistantSnapshotContract/buildAssistantContext](../app/src/assistant/contracts.ts) werden vom Produktionshost also noch nicht befüllt. Eine vorhandene Simulatorregel für veraltete Drafts ist kein Beleg für diesen Nutzerweg.

Nach K1 soll der Assistant auf ausdrückliche Projektauswahl/Laden erklären können: Welcher nächste Schritt ist bestätigt? Gibt es einen bestätigten gespeicherten aktiven Entwurf, auf welcher Basis, ist diese veraltet oder unbekannt? Ein bewusster Navigationsknopf öffnet das bestehende Projektgedächtnis der exakt gleichen Inkarnation. Dort bleiben Entwurf öffnen, vergleichen, neu basieren und als Vorschlag übernehmen getrennte Nutzeraktionen. **„Projekt fortsetzen“ startet keinen Workflow und bestätigt keinen Inhalt.**

## Bestehende Bausteine wiederverwenden

| Baustein | Aktueller Vertrag | Konsequenz für K1 |
| --- | --- | --- |
| [personalContinuationResponseContract](../app/src/personal-continuation.ts) | read liefert Draft, Gedächtnis, Workrevision und active/archived/missing; Projekt-ID plus createdAt | Tatsächliche lokale read-Route verwenden, keine zweite Datenbank oder automatische Zuordnung |
| [personalContinuationTransaction](../app/src/personal-continuation-transaction.ts) | Lesen ist read-only; Schreiben hat CAS und eigene Operationen | Keine save-draft/rebase-draft/apply-draft/remember-Aufrufe aus der Beratung |
| [buildAssistantContext](../app/src/assistant/context.ts) | bestätigte Grundlage und unbestätigte Claims getrennt; Draft nur als Metadaten | Kein Composertext, keine URLs aus Text, kein versteckter Schreibtransport an Adapter |
| [createAssistantSession](../app/src/assistant/use-assistant-session.ts) | Vor-/Nachprüfung der Basis, Generation/Abort, bekannte STALE-Basis entwertet Ergebnis | Draftrevision in tatsächlichen Vergleich aufnehmen; WorkState.updatedAt allein genügt nicht |
| [continuationMemoryHref/readContinuationContext](../app/src/personal-continuation-navigation.ts) | kanonischer Projektlink, aktuelle Navigation gewinnt, keine Texte in URLs | Bestehenden navigierenden Hostpfad mit explizitem Kontext ergänzen; kein bloßer Tabwechsel in möglicherweise anderes Projekt |
| [ProjectMemoryPanel](../app/src/studio/ProjectMemoryPanel.tsx) | gesicherter Draft wird erst bewusst geöffnet; versteckter Mount erhält Texte | Editor weder remounten noch überschreiben, wenn ungelesener/ungesicherter anderer Kontext betroffen ist |
| [Simulator/Factory](../app/src/assistant/adapter-factory.ts) | Produktion weiterhin deterministische Offline-Simulation | Keine Enginewahl, Modellinstallation, Provideradresse oder Policyfreischaltung |

## Arbeitsumfang in einer zusammenhängenden Änderung

1. **Rote Regression auf echtem lokalen Store.** Projekt A: bestätigter nächster Schritt plus aktiver gespeicherter Draft; Projekt B: anderer Draft. Assistant muss A lesen, ohne B oder private Textinhalte an die Beratung weiterzugeben. Der aktuelle Host liefert noch null; daraus entsteht der konkrete Red-Fall.
2. **Read-only-Projektion und Identität festlegen.** Nur bestätigten gespeicherten Draftstatus verwenden; ungesicherter Editorinhalt bleibt beim Editor. Geplant: Projektinkarnation, Draftrevision, ursprüngliche Work-/Memorybasis und status. Fehlend, angewandt, verworfen, archiviert, veraltet und nicht lesbar unterscheiden. Kein Fehler→„kein Entwurf“-Default.
3. **Kohärente Sammlung und Invalidierung.** Config lesen → persönlichen Kontext mit Gedächtnis lesen → Config und persönlichen Kontext nochmals abgleichen. Werte nur verwenden, wenn Inkarnation, Work-/Memory-/Config- und Draftrevision zusammenpassen. Dies sind abgeglichene Lesezugriffe, keine behauptete gemeinsame atomare Transaktion über alle Reads. Vor/nach Beratung dieselbe Basis prüfen; eine separate Draftänderung bei unverändertem WorkState muss alte Beratung entwerten. Keine beliebige Retryschleife.
4. **Deterministische Hostkarte.** Bestätigten `nextStep` anhand `memoryKinds`/Status/Eintragsreferenz auswählen, nicht aus freiem Text erraten. Kein bestätigter Schritt → ausdrücklich unbekannt/noch nicht bestätigt. Aktiver Draft auf alter Basis → „zuerst vergleichen“, niemals automatisch neu basieren. Die Produzentenkennzeichnung bleibt Offline-Regeln/Simulation; Beratung, echter lokaler Speicherbeleg und tatsächlich ausgeführter Test bleiben verschieden.
5. **Bewusste Navigation zur vorhandenen Bearbeitung.** Projektidentität im Link/Hostcallback mitführen. Nach Zielwechsel alte Antwort/Navigation verwerfen. Navigation schreibt keine Fachwerte, startet keinen Runner und öffnet einen gespeicherten Draft nicht automatisch. Bereits vorhandene Dirty-/Konfliktbehandlung des Editors bleibt zuständig.
6. **Gemeinsame Regression und Review.** Neue Contract-/Session-/UI-Fälle plus bestehende persönliche Fortsetzung, Memory, Navigation, Mobil, Companion, Receipt/CAS und Qualityprüfungen. Unabhängiger Review muss die neuen Basis- und Identitätsregeln beurteilen; Qualitybaseline erst danach separat adoptieren.

### Kleiner, aber zwingender Identitätspunkt vor dem Code

`personalDraftContract` besitzt **keine eigene Draft-UUID**: Es gibt höchstens einen Datensatz je Projektinkarnation. Der bisherige Assistantvertrag erwartet dagegen `draft.id` als UUID. Keinen zufälligen Bezeichner beim Lesen erzeugen und keine neue persistierte UUID still migrieren.

Vorgeschlagene kleinste Bindung für diesen Einzelentwurfsvertrag: vorhandene `contextId` als ausdrücklich **abgeleiteten Referenzbezeichner** im Typ `kind: draft` verwenden, immer zusammen mit der bereits geprüften `contextCreatedAt` und Draftrevision. Keine Behauptung einer separat gespeicherten Draft-ID. Die Projektion und Quellenanzeige müssen diese Bedeutung dokumentieren; gleiche UUID mit anderer Erstellzeit darf keine Referenz übernehmen. Dies ist vor Implementierung anhand der bestehenden Validatoren zu prüfen und im Review zu bestätigen. Passt die Bindung nicht vollständig, den Vertrag ausdrücklich ändern und reviewen; kein ungeprüftes Feld am strikten Schema vorbeischleusen. Mehrere Drafts je Projekt sind nicht Teil dieses Arbeitsloses.

## Geplante Dateiverantwortung, keine bereits vorhandene Implementierung

| Bereich | Bestehende Anker / geplanter Eingriff |
| --- | --- |
| Read-/Revisionseigentum | `app/src/assistant/use-assistant-session.ts`: snapshot/unchanged, Lebenszyklus; vorhandenen LocalWorkStore read verwenden |
| Strikte, reine Metadatenprojektion | `app/src/assistant/context.ts` und gegebenenfalls `contracts.ts`; bei Bedarf kleine neue Hostprojektion, kein neuer Store |
| Anzeige und Navigation | `app/src/studio/AssistantPanel.tsx`, `Studio.tsx`, `personal-continuation-navigation.ts`; vorhandene Memoryfläche als Ziel |
| Nachweise | `assistant-context.test.ts`, `assistant-session.test.ts`, `assistant-ui.test.tsx`, `personal-continuation-navigation.test.tsx`; neue bindbare Fälle mit literalen Testnamen |
| Dokumentation | Abdeckung MEM-01/DEV-01 nach tatsächlichem Review aktualisieren; Grenzen in bestehender Memory-/Assistant-Doku synchronisieren |

Nicht automatisch ändern: Upstream/Vendor, CSP/Netzwerk, Androidhost, Dependencylock, Enginepolicy, Transaktion für Configfreigaben, Backupformat, Recoveryjournal, Speicherprofile oder Quellenkatalog.

## Abnahmefälle für genau K1

| Fall | Erwartetes Ergebnis |
| --- | --- |
| A mit bestätigtem nextStep und aktivem gespeichertem Draft | Echte Referenzen/Revisionen sichtbar; gleiche Eingabe ergibt gleiche Aussage; kein freier Modellfakt |
| Kein Draft / applied / discarded | Kein aktiver Entwurf behauptet; fehlend und abgeschlossen korrekt unterschieden |
| Separater Draftsave bei gleicher Work-/Memoryrevision | Alte Beratung als veraltet entwertet; verspätete vorherige Antwort nicht sichtbar; Reload liest neue Revision |
| Memory-/Configänderung bei gleicher Workrevision | Bestehende STALE-Regressionsfälle bleiben grün; auch zwischen einzelnen Reads keine Mischbasis |
| Archivierung, Löschung, wiederverwendete UUID | Lesender bzw. blockierter Zustand; keine Zuordnung zur neuen Inkarnation, kein fremder Draft |
| B wird geöffnet, während A noch liest/berät | A darf weder B befüllen noch nachträglich dorthin navigieren; Abort/Generation korrekt |
| Reine Beratung, Projektauswahl, Navigation | Datenbankvergleich zeigt keine Config-/Memory-/Draft-/Journalmutation und keine externe Anfrage; explizites Merken eines Arbeitspunkts nur über den bisherigen bewussten Hostweg |
| Unbekannter Speicherausgang/Korruption | Nicht als leer/gesichert anzeigen; kein Schreibretry; vorhandener Editortext bleibt erhalten |
| Veralteter Draft | Navigation zum Vergleich möglich, aber kein automatisches Rebase/Apply und keine Inhaltsbestätigung |
| Mobile390px und Desktop | Touch/Fokus/Back und Projektlink korrekt; vorhandener Multitouchschutz bleibt wirksam; Scrollen ersetzt keinen fehlenden Klick |
| Reset/Abbruch/Unmount, StrictMode | Keine versteckten Listener-/Timer-/Readbesitzer; keine Wiederaufnahme aus alter Sitzung |
| Auskunft über Ausführung | „Beratung“ bedeutet keine Prüfung/Ausführung; Stop verwirft Ergebnis, behauptet kein Engine-Ende |

Prüfweg: gezielte vorhandene Testgruppen → `npm run verify:serial` → Browser auf fertigem Produktionsbuild mit zwei Projekten/zwei Tabs → unabhängiger Diff-/Datenreview → bewusst separat angenommener Qualitypin. Solange Appsource von f57200cd… abweicht, ist der alte angenommene Quellstand erwartbar nicht automatisch auf neue Bytes übertragbar. Keine eigene Baselineaktualisierung nur zum Grünwerden.

## Ergebnis, Rückweg und nachfolgende Arbeit

Liefergegenstand ist ein kleiner reviewbarer Apppatch mit gebundener Quelle, Red/Green-Nachweisen und Browserfällen. Kein neues Modell und kein autonomer Auftrag. Ohne neue persistente Felder kann die neue lesende Projektion zurückgenommen werden, während bestehende persönliche Entwürfe/Gedächtnisdaten erhalten bleiben. Wird doch eine Migration nötig, ist diese vor Umsetzung ein neuer Reviewpunkt.

Nach K1 separat entscheiden: appweite semantische Objektadapter; frei verfasste Hinweisregeln; benutzerseitige Resume-Startpräferenz; dann gegebenenfalls LLM-Evaluationsvertrag. Aufgabenmigration, allgemeiner Konstruktor/Shadow/Autopilot, Sprachen, Embleme und Video-Studio bleiben eigenständige kleine Schritte aus der Matrix. Keine dieser Arbeiten ist durch K1 implizit gestartet.

## K2: gespeicherten Entwurf gezielt im vorhandenen Editor öffnen

**Abgegrenzter Folgepfad, implementiert und unabhängig geprüft; Qualityadoption ausdrücklich freigegeben.** Eingang ist die bewusst angenommene K1-Quelle `09739de34172b88d8e6907a24108a926439d5fc296226286bc395cda83dabd49`. K1 belegt die lesende Projektfortsetzung und bewusste kontextgebundene Navigation; weitergehende Entwicklungsbegleitung bleibt offen.

Die Untersuchung vor K2 fand zwei konkrete Lücken: Die Fortsetzungskarte übergibt noch keine einmalige Öffnungsabsicht für eine konkrete gespeicherte Draftrevision. Die vorhandene Funktion `open()` in [use-personal-memory](../app/src/use-personal-memory.ts) übernimmt lediglich den geladenen Snapshot ohne erneutes Lesen. Die vorhandenen Vergleichs-, Rebase-, Apply- und Konfliktwege in [ProjectMemoryPanel](../app/src/studio/ProjectMemoryPanel.tsx) werden wiederverwendet, nicht ersetzt.

K2 ergänzt den ausdrücklichen Knopf „Entwurf öffnen“ an der Fortsetzungskarte. Projekt-ID, Projekt-Erstellungszeit und gespeicherte Draftrevision werden beim Assistant und vor dem Öffnen im Editor erneut geprüft. Eine flüchtige, abbrechbare Öffnungsabsicht bleibt ausschließlich beim UI-Host; sie wird nicht in URL, History, Startpräferenz oder Datenbank gespeichert. Back/Forward oder eine spätere Navigation dürfen sie nicht wiederholen. Drafttext gelangt weiterhin ausschließlich in den bestehenden Memory-Editor, niemals neu in den Modellkontext.

Die bestehende Öffnungsfunktion liest den exakt angeforderten aktiven Entwurf erneut, erhält vorhandene lokale Eingaben und verlangt die bestehende bewusste Ersetzungsentscheidung bei schmutzigem oder konfliktbehaftetem Editor. Nach einer solchen Entscheidung wird der gespeicherte Stand erneut geprüft. Neuere Eingabe, andere Draftrevision, verlorene Projektinkarnation, Archivierung, Lesenfehler, Abbruch oder überholte Navigation verwerfen die Öffnung. Der alte lokale Text bleibt erhalten. Ein veralteter Entwurf darf ausdrücklich zum Vergleich geöffnet werden; seine Basis wird dabei nicht verändert. Rebase und Übernahme bleiben gesonderte Handlungen.

Codeanker: [Assistant-Session](../app/src/assistant/use-assistant-session.ts), [Fortsetzungskarte](../app/src/studio/AssistantPanel.tsx), [Studio](../app/src/studio/Studio.tsx), [Projektgedächtnis](../app/src/studio/ProjectMemoryPanel.tsx), [bestehender Editor](../app/src/use-personal-memory.ts).

Abnahme: rote/grüne Store- und UI-Regressionen für exakte Inkarnation/Revision, zweite Registerkarte, aktive/verworfene/übernommene Drafts, fremde/gelöschte/ersetzte Projekte, saubere/schmutzige/gesperrte Editoren, Abbruch während Lesen, neuere Eingabe, superseded Navigation und Back/Forward. Reale Desktop-/Mobilflows müssen dieselbe gespeicherte Revision bewusst öffnen, ohne Memory-/Config-/Draftschreibzugriff des Öffnungspfads. Gesamtsuite und echte Desktop-/Mobilflows werden mit dem eingefrorenen Quellstand im internen Reviewpaket nachgewiesen; keine automatische Quality-Adoption, Versionsanhebung, neue Ausgabe, Engineinstallation oder Autonomiefreigabe.

Historischer erster K2-Kandidat: `56115aba91b4820b8faf87ae40be407eed32bd5009ad99f9c7455813b1a5aa94`. [Neue Editorregressionen](../app/tests/system/personal-draft-open.test.tsx), [Assistant-Übergangstests](../app/tests/system/assistant-ui.test.tsx) und [Revisionsbindung](../app/tests/system/assistant-continuation.test.ts) belegen die neuen Grenzen. Die Browserprüfung fand und behob zusätzlich einen Fokuszeitpunkt vor Freigabe des Textfelds; Fokus wird nach dem Rendern nur bei weiterhin passender Navigation und unveränderter Eingabe gesetzt.

Beim blockierten Wechsel von einem anderen ungesicherten Projekt bleibt die vorhandene Entscheidung „Beim Entwurf bleiben“ / „Ohne Sicherung wechseln“ erhalten. Nur die zweite ausdrückliche Handlung darf die ursprüngliche Zielrevision erneut prüfen und öffnen. Zwischenzeitliche Zieländerungen benötigen eine neue Öffnungswahl. Bleiben, Back, Abbruch oder weitere Navigation verwerfen die flüchtige Anforderung. Eine deaktivierte Fortsetzungskarte zeigt keinen Öffnungsknopf ohne sichtbare Entwurfsgrundlage.

### Reviewfortschreibung: Historybesitz und nächster Produktabschnitt

Der oben bezeichnete K2-Kandidat ist historisch: Der unabhängige Review fand eine noch lebende Wechselentscheidung nach `history.go(-2)` auf das bereits ausgewählte Projekt. Die Korrektur bindet die interne URL-Rückkehr an ihr konkretes Ereignis; jede neue externe Navigation entwertet die alte Entscheidung vor dem Gleichheitsvergleich. Der alte Knopf kann keine verworfene Öffnungsanforderung wiederbeleben. Back/Forward, identische Route, stille URL-Änderung und Erhalt gültiger Konfliktentscheidungen sind gesonderte Regressionen.

Der anschließend unabhängig geprüfte gemeinsame Stand ergänzt die [konkrete Änderungsvorschau im gebündelten Produktkontext](27-product-continuation-context.md). Historyfix und Vorschauerweiterung bleiben getrennte Diffs; der vollständige Prüfbeleg bindet beide an eine gemeinsame Quelle. Die zwei Qualitymetadaten sind nach ausdrücklicher Freigabe übernommen; daraus folgt keine zusätzliche Plattformfreigabe.

### Bewusst angenommener gemeinsamer Stand

Quelle `c123f8ab5f155c61382a9b58208bb73e04b91a3188f8159241d588bd17285869`; externer Contractpin `2dcc49f273fd7378166463c2778cfd6cc4b8c46cd1c2d6313c206f6b86ec4489`. Die bisherigen 33 Schutzgruppen bleiben unverändert; acht Gruppen für Entwurfsöffnung und konkrete Vorschau kommen hinzu, ohne Ausnahmen. [Produktkontext und Nachweisgrenzen](27-product-continuation-context.md). Der [K1-Nachweis](26-k1-continuation.md) bleibt unverändert erhalten.
