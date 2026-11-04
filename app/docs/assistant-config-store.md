# Lokaler Assistenten-Konfigurationsspeicher (Paket C)

Dieser lokale TypeScript-/IndexedDB-Prototyp verbindet keine Modelle oder Provider und enthält keine Assistentenoberfläche. Die spätere Oberfläche muss die beschriebene Hostgrenze tatsächlich einhalten. Ein vorbereitetes Interface ist noch kein nachgewiesener Nutzerklick.

## Bestehende Daten und Grenzen

Die Datenbank `cue-command-mesh-local`, Version 1, und ihr Objektstore `work` bleiben bestehen. Neue Schlüssel:

- `assistant-config-v1:<contextId>@<contextCreatedAt>`: streng validierte Konfiguration mit eigener sicherer Ganzzahlrevision
- `assistant-receipt-v1:<operationId>`: atomarer, textarmer Commitbeleg

UUID und Erstellzeit identifizieren gemeinsam eine Projektinkarnation. Gleiche Titel oder wiederverwendete UUIDs übernehmen keine alte Konfiguration. Unterstützte WorkState-v3-Daten werden über den vorhandenen Decoder gelesen, ohne den gespeicherten Envelope umzuschreiben. Unbekannte Versionen und beschädigte Daten bleiben erhalten und sperren das betreffende Lesen oder Schreiben.

`local-default`, sein `updatedAt`, Projektgedächtnis, Workflowjournal und persönliche Entwürfe werden durch diesen Pfad nicht geschrieben. CSP, externe Fähigkeiten, native Hosts und `restoreAvailable:false` bleiben unverändert.

Die neuen Konfigurationen und Receipts sind nur auf diesem Gerät gespeichert und NICHT im bestehenden Systembackup enthalten. Die bestehende Backupimplementierung wird nicht erweitert. Jede erfolgreiche Protokollantwort mit Konfiguration enthält `storage: {deviceLocal:true, includedInSystemBackup:false}`. Vorschauen und Freigaben werden nie persistiert oder importiert.

## Explizites lokales Protokoll

`LocalWorkStore.request('/api/assistant', {method:'POST', body: JSON.stringify(request)})` ist eine lokale Dispatchroute, kein Netzwerkendpoint und kein Fetch-Ersatz. Die strikte Union erlaubt nur:

1. `read-config`: `context`
2. `preview-config`: `context`, `expectedBasis`, `change`
3. `commit-config`: `context`, `expectedBasis`, `proposalId`, `operationId`
4. `read-receipt`: `context`, `operationId`

Kontext enthält `contextId` und `contextCreatedAt`; Basis enthält `workUpdatedAt`, `memoryRevision` und `configRevision`. Requests sind auf 32 KiB UTF-8 begrenzt. Zusätzliche Felder, freie Commitpatches, Rechte und Netzwerkheader werden abgewiesen. Vertragsfehler liefern 400, Konflikte 409 und nicht sicher verfügbarer oder beschädigter Speicher 503. Abbruch bleibt `AbortError`. Keine Schreibwiederholung ist eingebaut.

WorkState, Gedächtnis, Konfiguration und der passende Receipt werden in einer einzigen IndexedDB-Transaktion gelesen. Ein Commit prüft aktuelle Rauminkarnation, Archivierung, alle drei Basisrevisionen und die exakte kanonische Vorher-/Nachherkonfiguration. Erst `tx.oncomplete` bestätigt den atomaren Abschluss von Konfiguration und Pflichtreceipt.

## Hostfreigabe und späterer UI-Anschluss

Eine Vorschau liefert den vom Host berechneten `proposal`, dessen SHA-256 `proposalHash` und `expiresAt`. Der Host hält eine abgetrennte Kopie. Eine Änderung der zurückgegebenen Vorschau verändert diese nicht.

Nach vollständiger Anzeige und einer konkreten Nutzerentscheidung ruft ausschließlich der UI-/Hostpfad auf:

`store.approveAssistantConfig({context, expectedBasis, proposalId, proposalHash, operationId})`

Anschließend darf genau die passende `commit-config`-Anfrage folgen. Der lokale Protokollrequest alleine kann keine Freigabe erzeugen. Die bestehende AdvisoryAdapter-/Simulator-Schnittstelle erhält weder den Store noch diese Methode oder einen Schreibtransport.

Die Freigabe bindet Vorschau-ID, kanonischen SHA-256, Projektinkarnation, Basis und Operations-ID. Es gibt höchstens eine offene Vorschau pro Host. Ihre maximale Gültigkeit beträgt fünf Minuten. Ablauf und rückwärts laufende Gerätezeit sperren; unmittelbar vor den Puts wird die Zeit erneut geprüft. Ein verbrauchter Grant ist nicht für eine zweite Operation verwendbar.

Die spätere UI muss bei Stop, Schließen der Vorschau und Kontextwechsel synchron `store.discardAssistantConfigPreview()` aufrufen. Das verwirft auch noch laufende Vorschauanfragen, ohne den übrigen Speicher zu schließen. Neue Vorschauanfragen verwerfen eine alte Vorschau bereits vor dem ersten asynchronen Schritt. Store-close, unerwartetes Datenbank-close, Neustart und Abbruch invalidieren die flüchtige Freigabe. Nach Neustart sind eine neue Vorschau und neue Bestätigung erforderlich.

Historische Receipts sind Belege, niemals Einwilligungen. Ein exakt identischer bereits gespeicherter Commit wird anhand Operations-ID, Proposal-ID, Kontext und Basis erkannt und gibt nur den bestehenden Beleg zurück. Es gibt dabei keinen zweiten Put oder Revisionssprung.

## Wiederlesen statt blindem Wiederholen

Nach einer unklaren Antwort oder einem Verbindungsabbruch zuerst `read-receipt` mit derselben Operations-ID aufrufen:

- `missing`: kein passender Receipt gefunden; kein Erfolg behauptet
- `verified`: gespeicherter Receipt und genau diese aktuelle Konfiguration stimmen in Revision und SHA-256 überein
- `superseded`: der Receipt belegt die damalige Speicherung; die Konfiguration hat inzwischen eine höhere Revision

Ein gleicher Revisionswert mit abweichendem Konfigurationshash oder eine Revision unter dem Commitbeleg ist Korruption. Die App behauptet dann keinen verifizierten Erfolg. Ein späterer Undo wäre eine neue Vorschau gegen die aktuelle Basis.

## Kapazität und Datensparsamkeit

Maximal 100 Konfigurationen, 200 Commit-Metadatenbelege und insgesamt 512 KiB kanonische UTF-8-Daten werden vor den Puts in derselben Schreibtransaktion gezählt. Es gibt keine automatische Löschung. Bei voller Kapazität bleibt gültiges gezieltes Lesen möglich. Andere künftige `assistant-*`-Schemas sperren neue Writes, bis sie ausdrücklich integriert sind. Beratungsrun- und Eventpersistenz sind in Paket C nicht implementiert.

Receipts enthalten nur Schema, Operations-/Proposal-ID, Proposalhash, Kontext, Basis, vorherige/nachherige Revision, genau einen strukturellen Feldpfad, Konfigurationshash und Commitzeit. Sie enthalten keine Raumtexte, Zwecktexte, Modellinputs, Antworten, Fehlermeldungen, Stacks, Header, Credentials oder Freigabeobjekte. Die Inhaltsdigests binden die konkrete Vorschau und Konfiguration; sie sind keine allgemeine Logredaktion für Secrettexte.

## Prüfung und verbleibende Abnahmen

Gezielt: `node --import ./scripts/register.mjs --test tests/system/assistant-store.test.ts`

Typecheck: `node node_modules/typescript/bin/tsc --noEmit`

Gesamtregression: die unveränderten Einzelkommandos aus `package.json` unter `test:serial`. Die Kommandos können direkt ohne npm ausgeführt werden. Dieses Paket installiert keine Abhängigkeiten.

Der reine Konstruktor-Syntaxwechsel in `AssistantContractError` erhält das Verhalten und ermöglicht den nativen Node-strip-only-Testpfad, der den Vertrag durch die neue Adapterintegration erstmals mitlädt.

Die Tests verwenden `fake-indexeddb` und decken Wiederöffnen, atomare CAS-Konflikte, verlorene Antworten, Idempotenz, Archivierung/Löschung/UUID-Wiederverwendung, Mutationen, Quota, Abort, Datenbank-close, unbekannte und beschädigte Datensätze einschließlich gespeichertem `undefined`, Revisionsüberlauf, Kapazitäten, Migration, Hostfreigabe und ausbleibende Fetchaufrufe ab.

Ein Fake-Datenbank-close ist KEIN echter Prozesscrash. Echte Browser-/Android-Prozessverlustabnahme, native Build-/Signierungsabnahme, spätere UI-Klick-/Kontextwechseltests und echte Modell-/Providerqualität bleiben gesondert offen.
