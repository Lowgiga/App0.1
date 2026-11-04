# OMEGA Technical Intelligence — Ergänzungsarchitektur

Status: Architektur- und Umsetzungsauftrag, kein Nachweis einer bereits implementierten Funktion  
Stand: 2026-11-03  
Zielbranch: `omega/technical-intelligence-complement-20261103`

## 1. Auftrag und Abgrenzung

Dieses Arbeitspaket ergänzt die laufende Repository-Bestandsaufnahme. Es dupliziert weder das allgemeine Datei-Inventar noch Claudes laufende README-/Quellcode-Erfassung. Der Fokus liegt ausschließlich auf einem nutzbaren technischen Problemlöser für Terminalbefehle, Skripte, Logs und Repositories.

Leitprinzip: **Erst verstehen und belegen, dann Änderung vorschlagen, anschließend isoliert validieren.** Analyse, Patch-Erzeugung und Ausführung sind getrennte Fähigkeiten. Ein Analyseergebnis darf niemals implizit eine Ausführung autorisieren.

## 2. Verifizierter Ausgangspunkt im Source-Branch

Untersuchte Basis: `update/lowquantflow-source-949-20261005`, Commit `031065c05bf098ee641143a99a8c0872f98cd4ea`.

Im Branch existieren bereits:
- `app/src/assistant/contracts.ts`: Zod-Verträge, begrenzte Kontext-/Ergebnisgrößen und Evidenzreferenzen.
- `app/src/assistant/runtime.ts`: begrenzte, abbrechbare Advisory-Laufzeit; derzeit keine echte Provider-/Commit-Transportintegration.
- `app/src/assistant/policy.ts`: Laufzeitbudgets, Retry-Regeln nach Seiteneffektklasse und Fehlercodes.
- `app/src/assistant/config.ts`: revisionsgebundene Konfigurationsvorschläge.
- `app/src/studio/AssistantPanel.tsx` und `AssistantCompanion.tsx`: bestehende UI-/Companion-Oberfläche.
- `app/src/studio/DiagnosticsPanel.tsx`: ausdrücklich read-only; zeigt übergebene Metadaten, startet selbst keine Live-Prüfung.
- Systemtests für Assistant-Verträge, Policy, Runtime, Session und Companion.

Wichtige Einschränkung: Die bestehende Assistant-Runtime ist eine konservative Offline-/Advisory-Grenze. Sie darf nicht als bereits vorhandener allgemeiner Shell-Agent oder als Provider-Integration dargestellt werden. Die README dokumentiert zudem offene vollständige Build-, Sync- und Geräteabnahmen.

## 3. Produktziel

Ein Nutzer kann Text, einen unvollständigen Befehl, ein fehlgeschlagenes Skript, einen Log-Ausschnitt oder ein Repository-Artefakt einreichen. Das System liefert eine nachvollziehbare Diagnose und einen sicheren nächsten Schritt.

### Eingabemodi
1. **Befehl erklären:** Zweck, Plattform, Voraussetzungen und Nebenwirkungen erklären.
2. **Befehl vervollständigen:** Unvollständige Eingabe markieren und eine korrigierte Variante vorschlagen.
3. **Fehler diagnostizieren:** Fehlermeldung, Exitcode, relevante Umgebung und Skriptabschnitt zusammenführen.
4. **Skript reviewen:** Syntax, Kontrollfluss, Pfade, Berechtigungen, Fehlerbehandlung und Seiteneffekte prüfen.
5. **Repository verstehen:** Manifest, Verzeichnisstruktur, Einstiegspunkte, Abhängigkeiten, Tests und Lizenzhinweise analysieren.
6. **Patch vorbereiten:** Änderung als Diff mit Begründung und Tests erzeugen; nie stillschweigend in den Arbeitsbaum schreiben.

## 4. Ergebnisvertrag

Jede Diagnose muss strukturiert liefern:
- **Kurzbefund** und betroffene Plattform/Sprache.
- **SOURCE:** direkt vorliegende Eingaben, Logs, Dateiinhalte oder maschinelle Prüfergebnisse.
- **INFERRED:** Schlussfolgerungen, jeweils mit Konfidenz 0–1.
- **Annahmen / fehlende Informationen.**
- **Ursache(n):** priorisiert, mit konkreten Belegstellen.
- **Korrekturvorschlag:** minimale Änderung zuerst; Alternativen getrennt.
- **Risiko und Seiteneffektklasse:** `pure`, `read-only`, `write` oder `unknown`.
- **Validierung:** konkrete, möglichst nicht-destruktive Tests und erwartetes Resultat.
- **Rückfallweg:** wie die Änderung zurückgenommen wird.

Keine erfundenen Testergebnisse. Wenn eine Umgebung nicht erreichbar ist, muss das Ergebnis ausdrücklich als statische Analyse gekennzeichnet werden.

## 5. Zielarchitektur

```text
AssistantCompanion / AssistantPanel
              |
     Technical Intake UI
              |
      Input Normalizer
              |
   Platform & Language Router
              |
   Evidence / Context Builder
              |
    Analyzer Orchestrator
      |       |       |
   Shell   Script   Repository
   Linter  Review   Inspector
      |       |       |
      +--- Findings / Evidence ---+
                                  |
                         Advisory Runtime
                                  |
                    Proposal + Validation Plan
                                  |
                         User-controlled gate
                                  |
                   Isolated patch / test runner
```

### Verantwortlichkeiten
- **UI:** Eingabe, Ergebnisdarstellung, Diff-Vorschau, explizite Aktionen.
- **Normalizer:** erkennt Sprache/Plattform, normalisiert aber keine Befehle durch blindes Umschreiben.
- **Analyzers:** deterministische Werkzeuge zuerst; Modell nur für Erklärung, Triage und Vorschläge.
- **Advisory Runtime:** Kontextbudget, Abbruch, Laufzeitbudget, Evidenz und Rollenrichtlinien.
- **Patch Layer:** erzeugt einen isolierten Patch/Branch, nie direkte Änderungen an `main`.
- **Validation:** führt nur fest definierte Tests in isolierter Umgebung aus; Netzwerk und Schreibzugriffe standardmäßig aus.
- **Audit Trail:** Eingabe-Hash, Tool-/Versionsangabe, Findings, Patch-Hash und Teststatus; keine Secrets oder vollständigen sensiblen Inhalte protokollieren.

## 6. Tooling-Kandidaten — noch keine Integrationsfreigabe

| Kandidat | Einsatz | Entscheidungskriterium |
|---|---|---|
| ShellCheck | Bash-/POSIX-Shell-Analyse | Lizenz, Version, reproduzierbare CLI-Ausgabe |
| PowerShell ScriptAnalyzer | PowerShell-Regeln | Modulversion, Plattformkompatibilität |
| tree-sitter | AST-/Syntaxstruktur mehrerer Sprachen | Parser-Abdeckung, Pflegezustand, Lizenz |
| Semgrep | Regelbasierte Code-/Security-Analyse | Regelqualität, Datenschutz, Lizenz/Edition |
| Git diff / Git worktree | isolierte Patch-Erstellung | sauberer Ausgangsstand, reproduzierbarer Diff |
| npm-/Gradle-Testkommandos | Projektvalidierung | nur aus Manifest/CI ableiten, keine Befehle raten |

Vor Übernahme jedes Projekts: Lizenzdatei und konkrete Lizenzversion prüfen, Herkunft dokumentieren, Abhängigkeiten/Supply-Chain-Risiko bewerten und erforderliche Notices erhalten. Keine Quellcodeübernahme allein aufgrund öffentlicher Verfügbarkeit.

## 7. Plattformprofile

### Termux / Android
- Termux-spezifische Pfade und Paketverwaltung erkennen; keine ungeprüften GNU/Linux-Standardpfade voraussetzen.
- Android-Sandbox und fehlende Root-Rechte als Standard annehmen.
- Keine Änderung an `device_config`, Phantom-Process-Limits, SELinux, Firewall oder Systemdiensten vorschlagen, ohne Geräte-/OS-Nachweis und gesonderte Risikoanalyse.
- Ein Befehl wie `pkg install` ist nicht automatisch harmlos: Paketquellen, Netzwerkzugriff und installierte Skripte berücksichtigen.

### Windows
- PowerShell und CMD unterscheiden.
- PowerShell-Version, Execution Policy, Benutzerkontext und Administratorstatus nicht erraten.
- Skripte mit `-WhatIf`/Dry-Run unterstützen, wo Cmdlets dies verlässlich anbieten.
- Keine pauschalen Registry-, Firewall-, Dienst- oder Machine-Environment-Änderungen.

### Linux / POSIX
- Shell-Dialekt, Distribution und Paketmanager unterscheiden.
- Keine Annahme, dass `bash`, GNU-Tools oder Root verfügbar sind.

## 8. Sicherheits- und Ausführungsmodell

Ausführung ist standardmäßig deaktiviert. Die UI muss die folgenden Zustände getrennt darstellen:
1. Analysiert — keine Änderung.
2. Vorschlag erstellt — kein Patch angewendet.
3. Patch in isoliertem Branch/Worktree erzeugt.
4. Statische Prüfungen abgeschlossen.
5. Tests abgeschlossen — genaue Befehle und Exitcodes sichtbar.
6. Bereit zur menschlichen Prüfung.

Blockierende Regeln:
- Keine dynamisch zusammengesetzten Shell-Kommandos via `exec(string)`; Argumentarrays und feste Allowlist verwenden.
- Keine Tokens, Passwörter oder privaten Schlüssel in Prompts, Logs, Diffs oder Testartefakten.
- Keine automatischen Netzwerk-Downloads oder Installationen während Analyse.
- Keine automatischen Wiederholungen von Schreib-/unbekannten Operationen.
- Bei unklaren Seiteneffekten abbrechen und als `unknown` klassifizieren.
- Jede Patch-Erstellung muss auf einem separaten Branch erfolgen; kein Push auf `main`, kein Merge und keine Veröffentlichung ohne separate Freigabe.

## 9. Bereits erkannte Integrationsrisiken in offenen PRs

### PR #14 — CI/CD und Toolchain
Der Draft-Workflow enthält einen Android-Build-Job mit einer Bedingung, die reguläre Pull-Request-Refs nicht abdeckt. Außerdem wird `npm ci` nur ausgeführt, wenn ein Root-`package.json` existiert, obwohl die App laut Source-Branch unter `app/package.json` liegt. Damit kann der Workflow in einem gemischten Docs-/Source-Repository einen irreführenden grünen bzw. unvollständigen Lauf liefern. Node-Cache-Pfad und tatsächliche Java-Compiler-Version müssen ebenfalls an die echte Projektstruktur gebunden werden.

### PR #15 — Hermes Omni-Architect
Der Draft enthält umfangreiche Agenten-/Bootstrap-Anweisungen. Vor jeder Übernahme sind insbesondere dynamische Shell-Ausführung, fest eingebauter Token, deaktivierte SSH-Hostprüfung, systemweite Windows-Änderungen und Android-ADB-Systemänderungen als nicht freigabefähige Standardpfade zu behandeln. Die Dokumentation darf diese Aktionen nicht als bereits sicher oder getestet darstellen.

Diese Punkte sind Prüfhinweise, keine Aussage, dass die PRs bereits korrigiert oder getestet wurden.

## 10. Umsetzung in kleinen, überprüfbaren Lieferungen

### Lieferung A — Verträge und Ergebnisdarstellung
- Typed contracts für Intake, Finding, Evidence, PlatformProfile, Proposal und ValidationResult.
- UI-Ansicht für Eingabe, Ergebnis und Belegstellen.
- Fixtures und Tests für leere, übergroße, fehlerhafte und fremde Eingaben.
- Noch keine Provider- oder Shell-Ausführung.

### Lieferung B — Deterministische Analyseadapter
- ShellCheck und PowerShell ScriptAnalyzer als optionale, lokal erkannte Adapter.
- Adapterstatus `available/unavailable`; keine stillschweigende Installation.
- Tests mit fest versionierten Fixtures und bekannten Findings.

### Lieferung C — Modellgestützte Erklärung
- Provideradapter hinter dem bestehenden Advisory-Vertrag.
- Capability-, Kosten-, Timeout-, Cancellation- und Datenschutzgrenzen.
- Modell darf Findings erklären und Patchvorschläge erzeugen, aber Toolresultate nicht erfinden.

### Lieferung D — Isolierte Patch-/Teststrecke
- eigener Branch/Worktree, Patch-Hash, Diff-Review.
- nur allowlist-basierte Testkommandos aus Projektmanifest/CI.
- standardmäßig kein Netzwerk und keine privilegierten Aktionen.
- explizite Bestätigung vor jeder tatsächlichen Ausführung mit Seiteneffekt.

### Lieferung E — Repository- und App-übergreifende Wissensbasis
- nur explizit hinzugefügte Repositories/Dateien.
- Herkunft, Commit-SHA, Lizenz und Aktualität jeder Quelle erfassen.
- keine automatische Übernahme fremden Codes.

## 11. Akzeptanzkriterien

Ein Release dieses Moduls ist erst akzeptabel, wenn:
- jede sichtbare Aktion einen implementierten, getesteten Effekt hat oder klar als Vorschau deaktiviert ist;
- Eingabegrenzen, Abbruch, Zeit-/Aufrufbudgets und Fehlerzustände getestet sind;
- Terminalbefehle nie allein durch Analyse ausgeführt werden;
- SOURCE und INFERRED getrennt und Konfidenz je wesentlicher Schlussfolgerung ausgegeben werden;
- Tests reproduzierbar sind und ihre tatsächlichen Exitcodes gespeichert werden;
- Lizenz-/Herkunftsinformationen für externe Komponenten dokumentiert sind;
- UI-Tests Keyboard, Accessibility, leere Zustände, Fehler und Erfolg abdecken;
- die App ohne optionale Analyzer weiterhin vollständig startfähig bleibt.

## 12. Explizit nicht Teil dieses Arbeitspakets

- Keine Duplikation des vollständigen Repository-Dateiinventars.
- Keine Änderung an Claudes laufenden Dateien oder Branches.
- Keine Installation auf Nutzergeräten.
- Kein Root-/ADB-/Systemtuning.
- Kein automatischer Shell-Agent mit freiem Kommandozugriff.
- Kein Merge der PRs #14 oder #15.
- Keine Behauptung einer erfolgreichen Laufzeit- oder Geräteprüfung ohne echte Ausführung.

## 13. Selbstprüfung und Konfidenz

- Vorhandensein der genannten Assistant-/Diagnostics-Dateien im untersuchten Branch: 0,99.
- Bestehende Runtime ist kein freier Shell-Ausführer: 0,99 (aus Runtime-Code und Policy abgeleitet).
- PR #14 und #15 sind offene Drafts: 0,99 zum geprüften Abrufzeitpunkt.
- Eignung der genannten Open-Source-Kandidaten für spätere Integration: 0,75; Lizenz-/Versionsprüfung und Prototypen stehen aus.

Falsifizierbares Beispiel: Wenn ein eingereichtes Termux-Skript `rm -rf "$HOME/cache"` enthält, muss die Analyse die Operation als schreibend/destruktiv klassifizieren, einen Dry-Run bzw. eine sichere Pfadprüfung vorschlagen und darf den Befehl nicht selbst ausführen.

## 14. Umsetzungsstand — erste technische Lieferung (2026-11-03)

Auf dem PR-Branch wurde eine erste, isolierte Implementierung ergänzt:

- `app/src/technical-intelligence/intake.ts`: Zod-validierter Intake-Vertrag, UTF-8-Eingabelimit, Secret-Redaktion, heuristische Plattform-/Spracherkennung und deterministische Musterbefunde.
- `app/tests/technical-intelligence.test.ts`: Tests für Größen-/Leergrenzen, Termux-Erkennung, zusammengesetzte/destruktive Befehle, Secret-Redaktion, explizite Nutzerangaben und den Unterschied zwischen „keine Findings“ und einem Sicherheitsnachweis.

**Wichtige Abgrenzung:** Der Kern ist noch nicht in die Assistant-Oberfläche eingebunden. Es gibt noch keine Upload-Komponente, keine LLM-Erklärung, keinen Parser-/Linter-Adapter und keine Patch-/Sandbox-Ausführung. Die Ergebnisse sind eine statische Ersttriage, kein vollständiger Shell-Parser und keine Sicherheitsfreigabe.

**Validierungsstatus:** Dateien wurden nach dem Commit erneut über GitHub abgerufen. Ein lokaler Typecheck, Testlauf und Geräte-/Browserlauf wurden nicht ausgeführt; der Windows-Remote-Desktop-Knoten war bei der letzten Prüfung offline. Der Status ist daher „implementiert, Laufzeitvalidierung ausstehend“, nicht „Build grün“.
