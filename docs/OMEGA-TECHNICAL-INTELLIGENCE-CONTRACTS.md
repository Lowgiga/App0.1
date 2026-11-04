# OMEGA Technical Intelligence — Schnittstellen- und Abnahmeverträge

Status: ergänzende Spezifikation zu `OMEGA-TECHNICAL-INTELLIGENCE.md`
Ziel: Umsetzung in kleinen, kompatiblen Schritten; keine Behauptung einer bestehenden Implementierung.

## 1. Produktgrenze

Das Modul ist ein technischer Problemlöser innerhalb der bestehenden LowQuantFlow-Oberfläche. Es nutzt vorhandene Assistant-Verträge und Advisory-Grenzen, statt einen zweiten allgemeinen Agenten-Runner in die App einzubauen.

Verantwortungsgrenzen:
- LowQuantFlow bleibt Eigentümer seiner WorkState-, Projektgedächtnis- und Studio-Daten.
- Technical Intelligence besitzt nur Intake-Sitzungen, Findings, Vorschläge und Validierungsberichte, die über den bestehenden Datenzugriff ausdrücklich freigegeben werden.
- Lang laufende oder privilegierte Ausführung gehört später in einen getrennten OMEGA-Node-Prozess, nicht in den UI-Thread und nicht in die bestehende kurze lokale Workflow-Schleife.
- Die UI darf Ergebnisse anzeigen, aber aus einem Analyseergebnis niemals stillschweigend eine Ausführung ableiten.

## 2. Kernobjekte (v1)

### IntakeRequest
```ts
type IntakeRequest = {
  schema: "omega.technical-intake/v1";
  requestId: string;             // UUID
  createdAt: string;              // ISO-8601 UTC
  source: "manual" | "file" | "log" | "repository";
  platform: "termux" | "android-adb" | "windows-powershell" |
            "windows-cmd" | "linux" | "macos" | "unknown";
  language: "bash" | "sh" | "powershell" | "cmd" | "javascript" |
            "typescript" | "python" | "json" | "yaml" | "unknown";
  intent: "explain" | "complete" | "diagnose" | "review" |
          "repository-audit" | "prepare-patch";
  content: string;                // byte-limitiert, Secrets vor Speicherung redigieren
  relatedOutput?: string;         // stderr/stdout/Log, separat limitiert
  exitCode?: number;
  workingDirectoryHint?: string; // nur Kontext, kein Ausführungsauftrag
  environmentFacts: Array<{ key: string; value: string; provenance: "user" | "probe" }>;
};
```

### Finding
```ts
type Finding = {
  findingId: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: "syntax" | "logic" | "security" | "compatibility" |
            "dependency" | "performance" | "reliability" | "maintainability";
  title: string;
  explanation: string;
  sourceEvidence: Array<{ kind: "input-range" | "log-range" | "file-range" | "tool-result"; locator: string }>;
  inference: { statement: string; confidence: number }; // 0..1
  falsifiableCheck: { action: string; expectedObservation: string };
  sideEffect: "pure" | "read-only" | "write" | "privileged" | "network" | "unknown";
  remediation?: string;
};
```

### Proposal und ValidationResult
```ts
type Proposal = {
  proposalId: string;
  basedOnRequestId: string;
  summary: string;
  unifiedDiff?: string;
  changedPaths: string[];
  risk: "low" | "medium" | "high" | "blocked";
  requiresExecutionApproval: boolean;
  rollbackPlan: string;
};

type ValidationResult = {
  validationId: string;
  proposalId: string;
  mode: "static" | "sandbox";
  commands: Array<{ executable: string; args: string[]; exitCode: number | null }>;
  status: "passed" | "failed" | "blocked" | "not-run";
  environment: { platform: string; toolVersions: Record<string, string> };
  startedAt: string;
  finishedAt: string;
};
```

Diese Typen sind Zielverträge, keine bereits vorhandenen Exporte. Bei der Implementierung sind sie mit Zod zu validieren und gegen Größen-, Zeit- und Arraygrenzen zu schützen. Bestehende Assistant-Kontrakte bleiben maßgeblich; keine parallele konkurrierende Kontext- oder Policy-Engine.

## 3. Zustandsautomat

```text
draft
  -> submitted
  -> analyzing
  -> findings_ready
  -> proposal_ready
  -> patch_prepared
  -> validating
  -> validation_complete
  -> awaiting_user_decision
  -> accepted | rejected | abandoned
```

Regeln:
- `analyzing` darf ausschließlich lesende Adapter aufrufen.
- `proposal_ready` verändert keine Datei.
- `patch_prepared` schreibt nur in einen isolierten Branch/Worktree und hält den Patch-Hash fest.
- `validating` startet ausschließlich freigegebene, allowlist-basierte Prüfungen in einer Sandbox.
- `accepted` bedeutet Nutzerentscheidung, nicht automatisches Merge oder Deployment.
- Jede Navigation/Abbruchaktion widerruft veraltete Callbacks; jede Mutation ist an Request-ID und Basisrevision gebunden.
- Wiederholungen müssen idempotent sein. Schreib-/Netzwerkaktionen werden niemals blind wiederholt.

## 4. Tool-Adaptervertrag

Jeder Adapter meldet:
```ts
type AdapterDescriptor = {
  id: string;
  version: string;
  platforms: string[];
  languages: string[];
  availability: "available" | "unavailable" | "degraded" | "error";
  license: string | "unknown";
  executionClass: "pure" | "read-only" | "write" | "network" | "privileged";
  inputLimitBytes: number;
  outputLimitBytes: number;
};
```

Adapter liefern strukturierte Findings und Rohbelege getrennt. Ein LLM darf Toolausgaben erläutern, aber niemals Toolausgaben, Exitcodes oder Versionsinformationen erfinden.

Priorisierte Adapter:
1. Parser/Validatoren und lokale Sprachwerkzeuge, wenn installiert.
2. ShellCheck für Bash/POSIX-Shell.
3. PSScriptAnalyzer für PowerShell.
4. Git-Diff-/Manifest-Inspektion für Repositories.
5. Semgrep nur nach Regel-, Datenschutz- und Lizenzprüfung.

Kein automatisches Installieren. Kein Download während einer Analyse. Adapter nicht verfügbar bedeutet sichtbarer Status `unavailable`, nicht ein stiller Fallback mit erfundenem Ergebnis.

## 5. UX-Vertrag: Jede Aktion braucht einen abgeschlossenen Zweck

| UI-Aktion | Erwarteter Effekt | Fehler-/Leerzustand |
|---|---|---|
| Befehl erklären | Erklärung, Plattformannahmen, Nebenwirkungen | Plattform unbekannt: Rückfrage/Annahmen markieren |
| Unvollständigen Befehl prüfen | Lücken markieren und korrigierte Variante als Vorschlag zeigen | Keine automatische Ausführung |
| Fehlgeschlagenes Skript analysieren | Exitcode/Logs mit relevanten Codezeilen korrelieren | Ohne Log: statische Analyse kennzeichnen |
| Skript prüfen | Findings mit Schweregrad und Belegstellen | Keine Findings ist kein Sicherheitszertifikat |
| Repository analysieren | Manifest, Einstiegspunkte, Abhängigkeiten, Tests und Lizenzstatus auflisten | Unvollständiger Zugriff als Scope-Lücke ausweisen |
| Patch vorbereiten | Diff, betroffene Pfade, Risiko und Rollback anzeigen | Keine direkte Änderung am Hauptbranch |
| Validierung starten | Exakte Befehle, Versionen, Exitcodes und Artefakte erfassen | Nicht ausgeführt/abgebrochen/blocked klar unterscheiden |
| Ergebnis exportieren | Redigierter Bericht mit Quellen- und Commitbezug | Secrets und private Werte niemals exportieren |

Keine Schaltfläche darf nur dekorativ sein. Wenn eine Funktion noch nicht implementiert ist, muss sie als deaktivierte Vorschau mit Grund erscheinen oder aus der UI entfernt werden.

## 6. Sicherheitsregeln für Terminaleingaben

- Ein eingereichter Befehl ist zunächst Datenmaterial, kein Auftrag an eine Shell.
- Befehle werden in Tokens/Argumente zerlegt; niemals dynamisch zu einer Shell-Zeichenkette zusammengesetzt.
- Shell-Metazeichen, Substitution, Pipes, Redirects, Here-Docs und verkettete Befehle werden als eigene Syntaxelemente erkannt.
- Unbekannte oder privilegierte Operationen erhalten `unknown` bzw. `privileged` und blockieren automatische Ausführung.
- Dry-Run ist nur dann als sicher zu bezeichnen, wenn das konkrete Tool die Semantik tatsächlich garantiert.
- Geheimnisse werden vor Modellübertragung redigiert; Redaktionshinweise bleiben sichtbar.
- Keine Root-/Administratorrechte als Standard. Keine Änderung an Firewall, Registry, SELinux, Android device_config oder Diensten ohne separates, konkretes Freigabeverfahren.
- Netzwerkzugriff in Sandbox standardmäßig aus; explizite Ausnahme mit Zielhost, Zweck und Zeitlimit.

Falsifizierbares Beispiel: Eine Eingabe `pkg install git && rm -rf "$HOME/tmp"` muss als zusammengesetzter Befehl mit Paketinstallation (Netzwerk/Änderung) und destruktivem Dateizugriff erkannt werden. Das System darf ihn erklären und einen sicheren Prüfplan liefern, aber nicht als einen harmlosen Einzelbefehl behandeln oder ausführen.

## 7. Integration in vorhandene Assistant-Komponenten

Vor Implementierung müssen die tatsächlichen Exporte und Aufrufpfade der folgenden Dateien erneut geprüft werden:
- `app/src/assistant/contracts.ts`
- `app/src/assistant/runtime.ts`
- `app/src/assistant/policy.ts`
- `app/src/assistant/config.ts`
- `app/src/studio/AssistantPanel.tsx`
- `app/src/studio/AssistantCompanion.tsx`
- `app/src/studio/DiagnosticsPanel.tsx`

Integrationsregel: neue Technical-Intelligence-Verträge werden entweder in die vorhandenen Assistant-Schemas integriert oder als eng begrenzte Subschemas referenziert. Keine zweite globale Policy, kein zweiter App-Runner, keine zweite WorkState-Datenbank.

Der bestehende DiagnosticsPanel ist laut Quelltext read-only und zeigt übergebene Metadaten; er darf nicht als bereits vorhandene Live-Skriptanalyse dargestellt werden. Der Companion ist ein UI-Begleiter, kein autonomer Agent.

## 8. Testmatrix für die erste Implementierung

| Testfall | Erwartung |
|---|---|
| Leere Eingabe | Validierungsfehler, kein Toolaufruf |
| Übergrößeneingabe | deterministische Ablehnung vor Modellaufruf |
| Shell unbekannt | Plattformannahme sichtbar, keine Ausführung |
| Bash-Syntaxfehler | Parser-/Linterbefund mit Beleg |
| PowerShell-Syntaxfehler | PSScriptAnalyzer-Befund oder Adapter-unavailable |
| Secret-Muster im Input | Redaktion vor persistenter Speicherung/Providertransfer |
| Destruktiver Befehl | Seiteneffektklasse write/privileged, Ausführung blockiert |
| Veraltete Basisrevision | Patch/Bestätigung abgelehnt, neu laden erforderlich |
| Nutzer bricht ab | Lauf abgebrochen, keine späten UI-Schreibaktionen |
| Adapter fehlt | sichtbarer unavailable-Zustand, App bleibt funktionsfähig |
| Tool Timeout | bounded timeout, kein Endlos-Retry |
| Patch erzeugt | Hash, Pfade und Diff stimmen überein |
| Testfehler | Fehlerbericht mit echtem Exitcode, kein grüner Status |
| Offline | statische lokale Analyse bleibt möglich; Providerstatus unavailable |
| UI-Aktion ohne Implementierung | deaktiviert oder entfernt, niemals scheinbar aktiv |

## 9. Definition of Done — Lieferung A

Lieferung A ist abgeschlossen, wenn:
- Zod-Schemas und Größenlimits vorhanden sind;
- alle Zustandsübergänge durch Tests abgedeckt sind;
- UI-Eingabe, Ergebnis, Findings und leere/Fehlerzustände funktionieren;
- SOURCE und INFERRED visuell getrennt sind;
- jede wesentliche Inferenz Konfidenz und einen falsifizierbaren Check besitzt;
- keine Shell-, Netzwerk- oder Dateischreibaktion ausgelöst werden kann;
- Accessibility, Tastaturbedienung und Mobile-Layout getestet sind;
- bestehende Assistant-, Companion- und WorkState-Tests unverändert bestehen.

## 10. Offene Entscheidungen / nicht behauptete Fakten

- Providerwahl, Modellrouting und Kostenbudget sind noch nicht festgelegt.
- Die konkrete Sandbox-Technologie ist noch nicht ausgewählt.
- Lizenz- und Versionsstände aller externen Analyzer sind vor Integration neu zu prüfen.
- Die aktuelle Geräte-/Buildabnahme ist nicht erfolgt.
- Die Zielverträge müssen vor Implementierung gegen den vollständigen aktuellen Source-Tree und Claudes Bestandsaufnahme abgeglichen werden.
