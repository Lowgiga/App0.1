# Nächster begrenzter lokaler Prozessadapter

Status: Design-/Integrationsvertrag, noch keine implementierte Laufzeit. Der stabile Kern stellt `route`, `readiness`, `verify`, `run`, `inspect` und strukturierte Ereignisse bereit. Der Adapter soll auf diesen APIs aufbauen, ohne fremden Code oder Textanweisungen als Programm auszuführen.

## Drei erlaubte Anwendungen

1. Missionsvoraussetzungen prüfen und passende Skills vorschlagen: `route` + `readiness` + vorhandener Mission-Prüfhandler
2. Lokale Ergebnisqualität prüfen: Eingabe-/Ausgabe-Schema und feste fachliche Prüffunktionen
3. Sichere lokale Prüfschritte mit Stop/Checkpoint fortsetzen: ausschließlich geprüfte read-only bzw. reine Berechnungsfunktionen

Das ist regelbasierte lokale Automatisierung, kein belegter KI- oder LLM-Lauf. Externe Effekte bleiben vollständig gesperrt, einschließlich Backup-Restore, Versand, Installation, Netzwerkzugriff und Paket-Scripts.

## Vorgeschlagenes Host-API

```ts
type LocalStep = {
  stepId: string;
  kind: 'inspect-mission' | 'validate-local-result' | 'run-offline-skill';
  skillId: string;
  versionHash: string;
  input: JsonValue;
};
type Limits = {maxSteps: number; maxElapsedMs: number};
type Checkpoint = {
  pipelineId: string;
  revisionHash: string;
  nextStepIndex: number;
  completed: Array<{stepId: string; inputHash: string; versionHash: string; output: JsonValue}>;
  state: 'paused' | 'completed' | 'aborted' | 'failed' | 'budget-exhausted';
};
// Future adapter only:
// runLocalPipeline(steps, {kernel, getFreshHostEvidence, limits, signal, checkpoint})
```

Empfohlene anfängliche harte Konfigurationsobergrenzen: acht Schritte, eine Sekunde aktiver Arbeit je Lauf und die bestehenden Kern-Eingabebudgets. Vor jedem Schritt: Abbruchsignal, Zeitbudget, passende Versionsbindung, Inputhash, gültige Capability-Evidence und aktuelle Readiness prüfen. Keine frei wählbaren Handler, kein eval, kein dynamischer Import, keine Shell, keine URLs. Pipeline-Specs und Checkpoints bleiben strikt validierte Daten.

## Stop und Wiederaufnahme

- Ein Fehler, Abbruchsignal oder überschrittenes Budget hält vor dem nächsten Schritt an
- Ergebnis und Checkpoint werden vor Beginn des Folgeschritts atomar dem Host übergeben
- Checkpoints dürfen keine Capability-Handles, Zugangsdaten oder Host-Grants enthalten
- Resume braucht neue aktuelle Evidence; alte Berechtigungen werden nie rekonstruiert
- Identische abgeschlossene Schritte mit passender Pipeline-/Input-/Versionsbindung werden aus geprüftem Checkpoint übernommen; keine Wiederholung
- Abweichender Input, Hash oder Version verlangt einen neuen Prüfentscheid; keine stille Weiterarbeit
- Da keine externen Effekte erlaubt sind, kann dieser Kandidat keinen früheren externen Effekt wiederholen. Ein künftiger externer Executor benötigt ein separates Idempotenz-/Bestätigungsdesign
- Harte Unterbrechung einer einzelnen synchronen Funktion ist noch nicht zugesichert. Für ein strikt präemptives Zeitbudget muss der Host einen Worker und terminierbare Ausführung nutzen; bloße Zeitmessung zwischen Schritten genügt dafür nicht

## Ereignisse für den späteren Graph

`pipeline-started`, `step-started`, `step-completed`, `checkpoint-saved`, `pipeline-paused`, `pipeline-aborted`, `pipeline-failed`, `budget-exhausted`, `pipeline-completed`.

Jedes Ereignis enthält Sequenz, Pipeline-/Schritt-ID, Version-/Inputhash und tatsächlichen Status. Ausgabe-/Fehlerdaten bleiben begrenzt und credentialfrei. Keine optimistischen Erfolgsmeldungen und keine Aussage, dass ein ungeprüfter Connector oder LLM aktiv war.

## Erforderliche Tests vor Aktivierung

Pause/Resume ohne Doppelberechnung; Abbruch vor Schrittstart; Fehler stoppt Folgeschritte; Zeit-/Schrittbudget; gefälschter oder veralteter Checkpoint; abgelaufene Evidence; geänderte Inputs/Versionshashes; keine externen Effekte trotz manipulierter Spec; echte nachvollziehbare Statusereignisse.
