# Cue Command Mesh · Offline Skill Core

Ein funktionaler, isolierter erster Kandidat mit vier originalen Skills. Keine Installation, kein Modellaufruf, kein Connector, kein externer Effekt, keine Dashboard-Änderung.

## Starten

Node 22 oder neuer, keine Dependencies und kein `npm install` erforderlich:

```sh
cd skill-core
node --test tests/*.test.mjs
node examples/demo.mjs
```

`npm test` und `npm run demo` sind äquivalent. In dieser Umgebung kann npm eine globale `http-proxy`-Konfigurationswarnung ausgeben; die direkten Node-Befehle brauchen npm nicht.

## Was tatsächlich funktioniert

- Vier validierte Pakete mit konkreter ID, semantischer Version, SHA-256-Versionhash, Trigger-Tags, geschlossenen Ein-/Ausgabe-Schemas und Toolbedarf
- Deterministische Auswahl mit Gründen, Negativtriggern und stabiler Reihenfolge; strukturierte Tags statt behaupteter natürlicher Sprachinterpretation
- Getrennte Readiness-Dimensionen und expliziter Host-Vertrauensnachweis; unbekannt bleibt unbekannt
- Bedarfsgeladenes SKILL.md und einzelne Ressourcen; Integritätsprüfung liest zur Kontrolle alle deklarierten Dateien, fügt sie aber keinem Prompt hinzu
- Fest implementierte Offline-Funktionen: Mission prüfen, Graph erklären, Backup-Prüfplan, Quellenstatus
- Begrenztes, strukturiertes Prompt-Bundle mit getrennter Host-Policy und untrusted Skill-/Anfrage-/Datensektion
- Graph-Inspector-Vertrag mit Auswahlgründen, fehlenden Tools/Rechten, echten Host-Testreferenzen und lokalem Integritätsstatus
- Begrenzt vorgehaltene, fortlaufend nummerierte In-Memory-Ereignisse ohne Rohprompts oder Eingabedaten

## Dateien und Schnittstellen

| Datei | Aufgabe |
|---|---|
| `src/browser.mjs` | Portabler Browser-/Android-Entry, ohne Node-Imports |
| `src/contract.mjs` | Strenge Verträge, Schema-Teilmenge, Standard-Frontmatter, WebCrypto-Hash |
| `src/kernel.mjs` | Routing, Readiness, Inspector, Gate vor Ausführung |
| `src/events.mjs` | Begrenzte Historie mit Pagination und sichtbarer Retention |
| `src/host.mjs` | Host-eigene, widerrufbare/ablaufende In-Process-Evidence |
| `src/handlers.mjs` | Vier reine Offline-Funktionen, feste Dispatch-Tabelle |
| `src/prompt.mjs` | Begrenztes Daten-/Instruktions-Bundle |
| `src/loader.mjs` | Separater Node-Dateisystemadapter und Byte-/Hashprüfung |
| `skills/*` | SKILL.md, namespaced cue-skill.json, optionale Referenz |
| `docs/API.md` | Integrationsvertrag und Statussemantik |
| `docs/PIPELINE-ADAPTER.md` | Klar abgegrenzter nächster lokaler Prozessadapter, noch nicht implementiert |

Der Browser-Entry ist per Importgraph und WebCrypto-Gleichheit getestet. Er ist noch nicht in einer WebView oder APK ausgeführt. Ein gebündelter Browser-Ressourcenadapter ist noch erforderlich; er kann dieselbe Katalogschnittstelle lokal erfüllen. Ein Backend ist architektonisch nicht erforderlich.

## Sicherheitsmodell

Skilltext ist Datenmaterial. Er kann keine Rechte, Tools, Authentifizierung oder bestandenen Tests erzeugen. `allowed-tools` wird niemals als Berechtigung ausgewertet. Der separate Vertrag heißt `cue.command-mesh.skill/v1`; Standardfelder werden nicht umgedeutet.

Der vertrauenswürdige Host besitzt `createHostAuthority()`. Nur dort ausgestellte opaque Handles werden von seiner Kernelinstanz akzeptiert. JSON-Kopien, ähnlich aussehende Objekte, andere Authorities, Widerruf und beobachteter Ablauf sperren den Zugriff dauerhaft. Der Standardclock ist monoton; ein Rücksprung einer injizierten Hostclock invalidiert betroffene Handles. Die Authority darf weder als Model-Tool noch für Paketcode zugänglich sein. Sie ist keine Sandbox gegen feindlichen JavaScript-Code im selben Prozess. In einem zukünftigen Host muss fremder Code getrennt laufen.

Der Hash bindet Manifestsemantik und deklarierte Ressourceninhalte. Er ist keine Signatur und kein Nachweis eines vertrauenswürdigen Herausgebers. Der Host genehmigt deshalb eine konkrete ID plus Versionhash; geänderte Dateien führen vor Ausführung zur Sperre. Externe Writes sind grundsätzlich gesperrt, externe Reads besitzen in diesem Kandidaten ebenfalls keinen Executor.

Der Loader blockiert Traversal, Symlinks einschließlich Vorfahren, Hardlinks, Spezialdateien, nicht deklarierte Dateien, Scriptressourcen, doppelte JSON-Schlüssel und übergroße Dateien. Root und Verzeichnisvorfahren müssen während des Ladens unveränderlich unter Hostkontrolle stehen. Portable Node-Datei-APIs sind keine vollständige `openat2`-Isolation gegen gleichzeitiges feindliches Austauschen ganzer Verzeichnisse.

Keine Credentials werden gelesen oder gespeichert. Das Prompt-Bundle enthält keine Authority, Token, Host-Testobjekte oder den großen Snapshotkatalog. Anfragetext und bewusst gewählte Ressourcen bleiben dennoch potentiell sensible Eingaben: ein zukünftiger Modelladapter muss Datenminimierung und Credential-Redaktion erzwingen. Die strukturelle Trennung ist keine Garantie gegen Prompt-Injection in einem später angeschlossenen Modell.

## Standards und Lizenzen

Die vier SKILL.md-Dateien verwenden den gemeinsamen Standard-Subset `name` und `description`, kompatible Ordnernamen und Markdown. Der interne Parser unterstützt bewusst nur JSON-quoted YAML-Stringwerte, keine vollständige YAML-Grammatik. Ein expliziter Fehler ist besser als stilles Umdeuten fremder Syntax. Optionale standardisierte Felder werden eng geprüft; weitere Felder müssen gezielt ergänzt werden.

Alle vier Pakete wurden zusätzlich mit dem vorhandenen lokalen Skill-Validator geprüft: `reports/standard-validation.txt`. Das ist ein separater Frontmatter-Check, keine offizielle Interoperabilitätszertifizierung. Dessen engerer Feldkatalog akzeptierte das laut Agent-Skills-Spezifikation erlaubte optionale `compatibility` nicht; die ausgelieferten Beispiele verwenden deshalb nur den gemeinsamen Minimalumfang.

Original implementiert, keine Upstream-Scripts oder fremden Skills kopiert. Es wird keine Lizenz für Gemini, Anthropic, externe Marken, fremde Skillpakete oder Kataloginhalte eingeräumt. Vor einer öffentlichen Verteilung dieses neuen Projekts ist eine Projektlizenz festzulegen. Das Paket ist derzeit `private: true`.

Primärquellen, gezielt am 30.09.2026 geprüft:
- [Gemini CLI Skill Best Practices](https://geminicli.com/docs/cli/skills-best-practices/): präzise Trigger und dreistufige Kontextbereitstellung; deterministische Aufgaben lassen sich als feste Funktionen behandeln
- [Gemini CLI Managing Agent Skills](https://geminicli.com/docs/cli/using-agent-skills/): Skillverwaltung gehört zur CLI; daraus wird keine Gemini-Webapp-Funktion oder Installationsfreigabe abgeleitet
- [Agent Skills Specification](https://agentskills.io/specification): Standard-Frontmatter und optionale Ressourcenstruktur; der Cue-JSON-Vertrag ist eine eigene Erweiterung außerhalb der Standardfelder
- [Anthropic Managed Agents](https://www.anthropic.com/engineering/managed-agents): getrennte Historie, Steuerung und Ausführung; dieses kleine Modul übernimmt nur diese Trennung, nicht Anthropic-Infrastruktur

## Verifikation

43 Tests bestanden, 0 fehlgeschlagen, auf Node v24.19.0. Rohprotokolle der RED/GREEN-Phasen liegen unter `reports/`; `reports/12-independent-review-green.txt` enthält den vollständigen Lauf nach den Review-Fixes. `reports/production-sha256.txt` pinnt die geprüften Produktionsdateien. Die Demo ist real lokal ausgeführt; Ausgabe: `reports/demo.json`.

Die Tests decken unter anderem Negativauswahl, unbekannte Tools, gefälschte/abgelaufene/widerrufene Rechte, Pflichtrechte, explizites Deny, Versionbindung, manipulierte Inhalte, Ein-/Ausgabeschema, Traversal, Links, Größenbudget, doppelte JSON-Schlüssel, BOM-Hash und Prompt-Datengrenzen ab. Ein `passed`-Host-Test ist eine aktuelle Hostbehauptung mit Referenz, keine automatisch aus Skilltext gelesene Tatsache.

Unabhängiger finaler Recheck: zusätzlich 27/27 Grenztests bestanden; Demo Exit 0; alle neun Produktionsdatei-Hashes bestätigt. Keine offenen blockierenden Findings im erklärten Offline-Scope. Der separate Reviewbericht liegt beim übergeordneten Projektbericht. Das ist keine allgemeine Produktions- oder Sicherheitszertifizierung.

Nicht abgeschlossen: echtes Browser-/Android-Laufzeit-QA, UI-Anbindung, persistente Historie, Modelladapter, echte Toolanbindung, verteilte Capability-Evidence oder signierte Pakete. Der lokale begrenzte Pipeline-Adapter ist als nächster Schritt beschrieben, noch nicht implementiert.
