# Integrationsvertrag

## Standard-Paket + eigener JSON-Vertrag

`SKILL.md` nutzt Standard-YAML-Frontmatter. `cue-skill.json` ist unabhängig namespaced und enthält exakt:

- `namespace`: `cue.command-mesh.skill/v1`
- `id`: `cue.<skill-name>`; `name` stimmt mit Ordnername überein
- `version`: kanonisches `major.minor.patch`, ohne führende Nullen
- `versionHash`: `sha256:` plus 64 Hexzeichen; Hash über kanonisches JSON aller übrigen Felder, inklusive aller Dateihashes
- `description`: 1–1024 Zeichen, identisch zur Standardbeschreibung
- `triggers`: `intents`, `anyTags`, `allTags`, `excludeTags`, `nodeTypes`, jeweils eindeutige Tokenlisten
- `inputSchema`, `outputSchema`: geschlossene Schema-Teilmenge, siehe SPEC
- `tools`: deklarative Anforderungen `{id, effect, authentication, permissions}`; niemals Grants
- `handler`: feste Auswahl aus den vier eingebauten Funktionen
- `files`: `{path, stage, sha256}`; genau ein `SKILL.md`, weitere Ressourcen nur unmittelbar unter references/assets und als md/txt/json

Routing: Intentmatch +100, jedes positive Tag +10; `allTags` und `nodeTypes` sind Einschränkungen. Exclusion-Tags sperren unabhängig vom Score. Positive Auswahl wird vor negativen Kandidaten sortiert; danach Score absteigend, ID codepoint-aufsteigend. Requesttext wird nicht gescannt oder als Routerprogramm ausgeführt.

## Katalogadapter

Die aktuelle Node-Implementierung ist synchron; ein späterer Browseradapter sollte vor Initialisierung ein überprüftes, lokal gebündeltes Inventar vorbereiten und dann denselben synchronen Vertrag anbieten:

```js
const catalog = {
  list() {},                    // Kopien der validierten Manifestobjekte
  loadInstructions(id) {},      // geprüfter SKILL.md-Body, untrusted string
  loadResource(id, path) {},     // geprüfte, deklarierte Ressource
  verify(id) {},                // {status:'passed',versionHash} oder {status:'failed',reason}
  events() {}                   // optionale getrennte Loader-Ereignisse
};
```

`list()` transportiert Metadaten/Schemas, keine Instruktions- oder Ressourceninhalte. Hashprüfung beim Laden prüft Byteintegrität. Vollprüfung liest alle deklarierten Inhalte nur zur Kontrolle. Sie ist keine pauschale Promptaufnahme.

## Host und Kernel

```js
import {createKernel, createHostAuthority} from './src/browser.mjs';
const authority = createHostAuthority();
const kernel = createKernel({catalog, authority});
kernel.route({intent:'mission-check', tags:['mission'], nodeType:'mission'});
kernel.verify('cue.mission-check');
// Erst nach echten Hostprüfungen und konkreter Freigabe:
const handle = authority.issue({skillApprovals, tools}, {ttlMs:60000});
kernel.readiness('cue.mission-check', handle);
kernel.run('cue.mission-check', input, handle);
kernel.inspect(request, handle);
authority.revoke(handle);
```

`skillApprovals`: `{id, versionHash, test:{status,runId}}`.
`tools`: `{id,catalogued,configured,authenticated,authorized,permissions,check:{status,runId}}`.
Dimensionen sind booleans oder `unknown`; Auth kann zusätzlich `not-required` sein. Prüfstatus ist `passed`, `failed` oder `unknown`; `passed` erfordert eine nichtleere `runId`. Der Host darf diese Angaben nur aus seinen eigenen aktuellen Prüfungen erzeugen. Die Demo führt dafür einen echten, kleinen lokalen Selbsttest aus. Opaque Handles enthalten selbst keine lesbaren Claims und gehören nicht in UI-State, URL, JSON oder Prompt. TTL maximal eine Stunde; standardmäßig fünf Minuten. Der Standardclock nutzt performance.now(); ein beobachteter Ablauf oder ungültiger/rückwärts laufender Hostclock löscht den betroffenen Handle dauerhaft.

`run` verlangt gültige Eingabe, aktuelle Evidence, vorherige Vollprüfung, versiongepinnten bestandenen Hosttest und erfolgreiche erneute Integritätsprüfung. Ausgabe wird vor Rückgabe validiert. `run` ruft ausschließlich feste eigene lokale Funktionen auf.

## Inspector/UI

Antwort-Namespace: `cue.command-mesh.inspector/v1`.
Jeder Kandidat liefert ID, Version, Hash, Auswahl, Score, Gründe, Ausschlussgründe, Readiness und Teststatus. Englische Maschinenwerte werden in der UI übersetzt:

- `catalogued`: katalogisiert, beschreibt keine Installation
- `configured`: konfiguriert
- `authenticated`: authentifiziert oder nicht erforderlich
- `authorized`: berechtigt
- `checked`: geprüft
- `ready`: bereit (Skillboolean bzw. Tool-yes/no)
- `unknown`: unbekannt, keine positive Schlussfolgerung

`missingTools` und `missingPermissions` erlauben gezielte Hinweise. `test.runId` darf eine Hostreferenz anzeigen; Pakettext kann diesen Wert nicht setzen. `integrity` ist vom Hosttest getrennt. Explizites `no` wird im Aggregat erhalten, nicht zu `unknown` oder `yes` hochgestuft.

## Prompt-Bundle

`kernel.prompt(id,{request,input,resources:[],maxBytes:16384},handle)` liefert Daten im Namespace `cue.command-mesh.prompt/v1`. Maximal 65536 UTF-8-Bytes für das gesamte JSON-Envelope; bei Überschreitung Abbruch ohne Teilrückgabe. Es gibt keine `messages`-Liste, keine `systemRole` und keinen Modellaufruf. Ein Adapter darf untrusted Skillinhalte nicht in die Systemrolle anheben. Host-Evidence wird nicht serialisiert. Große Snapshotdateien gehören nicht pauschal in den Prompt.

## Historie

`kernel.events({afterSequence:0,limit:256})` und `catalog.events(...)` geben kopierte Seiten mit maximal 1024 Einträgen zurück. Fortlaufende Sequenzen enthalten Typ, Skill-ID, Versionhash und Ergebnisstatus. Maximal 4096 Einträge bleiben lokal erhalten; ältere laufen aus. `historyInfo()` liefert firstSequence, lastSequence, retainedCount und droppedCount, damit die UI keine Vollständigkeit vortäuscht. Kein Rohinput oder Prompttext. Der Host kann Ereignisse später separat persistieren. Noch keine Replay-/Resume-Garantie und keine Datenbank.
