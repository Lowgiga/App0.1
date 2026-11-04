# Cue-Team-Initialisierung

**Stand:** 29.09.2026, Europe/Berlin  
**Zweck:** tatsächliche Cue-Team-Koordination von Produktfunktion, Connector-Katalog, Agent-Profilbindung, aktueller Sitzungsauthentisierung, erfolgreichem Funktionstest und konkreter Aktionsfreigabe trennen.  
**Grenze:** reine Bestandsaufnahme und Vorschlag. Keine Verbindung, Installation, Kontoänderung, Veröffentlichung oder Automation wurde aktiviert.

## Team und Rollen

| Agent | Profil | Profil-Connectoren / Skills | Asset-Status | Vorgeschlagene Rolle |
|---|---|---|---|---|
| Zimt | Vorhanden | 0 / 0 | Agent-E-Mail vorhanden; kein Telefon, Wallet oder gebundener PC | Orchestrierung: Auftrag, Scope, Abhängigkeiten, Zuteilung und Synthese. |
| Junior | Vorhanden | 0 / 0 | Keine Agent-E-Mail, kein Telefon, Wallet oder gebundener PC | QA/Red-Team: Evidenz, Gegenbelege, Sicherheitsannahmen und Tests prüfen. Profilinstruktion nennt ChatGPT, Mistral AI und Termux als mögliche Umgebungen, soweit tatsächlich zugänglich; das belegt keine Verbindung. |
| Manus | Vorhanden | 6 Connectoren / 22 Skills | Agent-E-Mail vorhanden; kein Telefon, kein aktiviertes Wallet und kein gebundener PC | Builder/Koordinator für konkret abgegrenzte Arbeit innerhalb der in der jeweiligen Sitzung verfügbaren Werkzeuge. |

Die Rollen sind ein Vorschlag für die Gruppenarbeit; keine Profile wurden dauerhaft geändert. E-Mail-Assets bedeuten weder Postfachzugriff noch Sendefreigabe oder erfolgreichen Versandtest.

## Capability-Matrix

In der Tabelle bedeuten **Katalog/Tool** den sichtbaren Connector- oder Werkzeugstatus, **Profil** eine Bindung an ein Agentenprofil, **Sitzung** den Authentisierungsstatus im aktuellen Lauf, **Test** eine tatsächlich abgeschlossene Funktionsprüfung und **Freigabe** die Berechtigung für die konkrete Aktion.

| Fähigkeit | Produkt/Katalog/Tool | Profilbindung | Sitzung | Funktionstest | Freigabe |
|---|---|---|---|---|---|
| Cue-Agenten | Cue unterstützt Agentenprofile und Gruppen | Zimt, Junior und Manus vorhanden | Alle drei im Gruppenverlauf sichtbar | Koordination in dieser Gruppe erfolgreich | Für diese Bestandsaufnahme; keine externe Aktion |
| Computer | Aktuelle Umgebung ist Sandbox; Geräteinventar enthält zusätzlich einen Cloud-Computer, Status online, aber nicht umschaltbar (`cloud_pc_sidecar_only`) | PC-ID-Feld bei allen drei Profilen leer | Sandbox ist das aktive Gerät; Cloud-PC für diesen Lauf nicht umschaltbar | Zugriff auf Alex’ Windows-PC/Galaxy nicht getestet | Nein |
| Agent-E-Mail / Telefon / Wallet | Cue unterstützt Agent-Assets | E-Mail bei Zimt und Manus; bei keinem Telefon oder Wallet aktiv | Kein E-Mail-/Telefon-/Zahlungsvorgang ausgeführt | Nicht getestet | Nein |
| Manus-Profil-Connectoren | Profil listet Anthropic, Google Gemini, OpenAI, PayPal for Business, Stripe und Notion | Genau diese sechs Bindungen; Zimt/Junior jeweils keine | MCP-Auth für Notion, Stripe und PayPal im aktuellen Lauf `authenticated`; Anthropic, Gemini und OpenAI wurden nicht auf Auth geprüft | Kein Geschäfts-/Datenvorgang ausgeführt | Keine konkrete externe Aktion freigegeben |
| Make / Slack / Zapier | Im aktuellen Koordinator-Werkzeugverzeichnis verfügbar; Koordinator-Connector-Katalog zeigt sie `disabled`; Zimt meldet für seinen Katalog einen abweichenden `enabled`-Status | An keines der drei Agentprofile gebunden | MCP-Authstatus im aktuellen Lauf `authenticated` | Kein Szenario, keine Nachricht und kein Workflow ausgeführt | Keine Aktion freigegeben |
| Vercel / Meta Ads | Im aktuellen Werkzeugverzeichnis verfügbar; kein Profil-Connector bei Zimt/Junior; nicht in den sechs Manus-Bindungen | Keine der drei Profilbindungen | MCP-Authstatus im aktuellen Lauf `authenticated` | Kein Deployment bzw. keine Ads-Datenoperation ausgeführt | Keine Aktion freigegeben |
| Notion / Stripe / PayPal | Im aktuellen Werkzeugverzeichnis verfügbar; Koordinator-Katalog `enabled` | Jeweils an Manus gebunden | MCP-Authstatus im aktuellen Lauf `authenticated` | Keine Inhalte/Finanzdaten in dieser Bestandsaufnahme gelesen oder geändert | Keine Schreibaktion freigegeben |
| Anthropic / Google Gemini / OpenAI | Im Koordinator-Connector-Katalog `enabled` | Jeweils an Manus gebunden | In diesem Lauf nicht separat per MCP-Authstatus geprüft | Kein Modellaufruf ausgeführt | Keine konkrete Aktion freigegeben |
| GitHub | Koordinator-Katalog `disabled`; Zimt meldet in seinem separaten Katalog `enabled` | An keines der drei Agentprofile gebunden | Kein GitHub-MCP-Server im aktuellen Werkzeugverzeichnis; Auth nicht bestätigt | Kein Repo-Zugriff getestet | Nein |
| Google Workspace / Gmail / Calendar | Koordinator-Katalog `disabled`; Zimt meldet im separaten Katalog `enabled` | An keines der drei Profile gebunden | Gmail-Authstatus erfordert Login; Google Workspace/Calendar nicht geprüft | Kein Zugriff getestet | Nein |
| Perplexity | Koordinator-Katalog `disabled`; Zimt meldet im separaten Katalog `enabled` | An keines der drei Profile gebunden | Kein aktiver Perplexity-MCP-Zugriff verifiziert | Nicht getestet | Nein |
| Mistral AI | Kein Mistral-Dienst im aktuellen Werkzeugverzeichnis | Keine Profilbindung; nur in Juniors Profilinstruktion als mögliche Umgebung erwähnt | Nicht geprüft | Nicht getestet | Nein |
| Hermes Desktop / Agent / CLI | Herstellerdokumentation beschreibt getrennte Desktop-, Runtime- und MCP-Modi | Keine Hermes-Profilbindung | Keine lokale Version, Prozesse, Ports oder Verbindung geprüft | Nicht getestet; kein Endpoint bestätigt | Nein |
| Android / Termux / USB | USB/MTP und ADB sind unterschiedliche Transport-/Debuggingwege | Kein Gerätezugriff in einem Agentprofil gebunden | Alex meldet ein angeschlossenes USB-Kabel; MTP-/ADB-Status nicht festgestellt | Keine Dateiübertragung und kein Gerätezugriff getestet | Nein |
| Skills | Cue stellt Skills als Produktfunktion bereit | Manus 22 Profil-Skills; Zimt/Junior 0 | Task-/Session-Skills können zusätzlich erscheinen | Nur tatsächlich gelesene Skills wurden für die konkrete Arbeit angewandt | Nicht zutreffend |
| Memory / Dream | Cue beschreibt Memory/Dream als Produktfunktionen | Nutzerprofil und Projektkontext liegen in dieser Unterhaltung vor; separate Memory-/Dream-Einstellungen je Agent nicht eingesehen | Persistenz, Abruf und Synchronisation nicht getestet | Kein Memory-Änderungstest | Keine dauerhafte Änderung vorgenommen |
| Shared Files / Projects | Projektdateien können je nach Projekt freigegeben werden | Projekt-/Shared-Files-Ablage nicht inventarisiert; Dateien wurden in der Gruppe angehängt | Projektbindung nicht bestätigt | Nicht getestet | Keine Projektkonfiguration geändert |
| Web / Recherche | Websuche und Seitenabruf in diesem Task verfügbar; In-App-Browser im Werkzeugverzeichnis gelistet | Keine Profilbindung vorausgesetzt | Öffentliche Hermes-Dokumentation abgerufen; kein Alex-Gerät bedient | Öffentliche Quellenseiten gelesen | Nur öffentliche Recherche im Task-Scope |
| Cue-Automationen | Zeit- und Ereignisautomationen werden unterstützt | Keine neuen Automation-Profile | `manus-config schedule status` ergab `{}`; `triggers.list_triggers` ergab `[]` | Keine Automation ausgeführt | Keine Automation aktiv |
| Frühere Task-Referenzen | Session-Referenzwerkzeug vorhanden | Nicht an ein Profil gebunden | Aktueller Lauf: „No session references are authorized“ | Keine früheren Tasks über dieses Werkzeug gelesen | Nicht zutreffend |

**Statusabweichungen sind nicht zu einer globalen Verbindung zusammengezogen.** Mein Koordinator-Katalog und Zimts separater Katalog weichen unter anderem bei Make, Slack, Zapier, GitHub, Gmail, Google Workspace und Perplexity ab. Gleichzeitig sind für Make, Slack, Zapier, Vercel und Meta Ads im aktuellen Lauf gespeicherte Authentisierungen gemeldet. Das beweist weder Profilbindung noch ausreichende Scopes oder erfolgreiche Operationen. Die aktuelle Sitzung stellt die entsprechenden Werkzeuge für die genannten MCP-Dienste bereit, aber kein Szenario, Deployment, Datenabruf oder Schreibvorgang wurde als Funktionstest ausgeführt.

**Authentisiert ≠ getestet ≠ freigegeben.** Ein Katalogeintrag beweist keine Verbindung; Profilbindung beweist keinen Zugriff auf ein anderes Produkt, etwa die ChatGPT-App; ein Auth-Token beweist keine Berechtigung für eine bestimmte Aktion.

## Integrationskarte

- **Cue ↔ ChatGPT:** OpenAI ist an Manus gebunden; daraus folgt kein Zugriff auf die ChatGPT-App, deren Verlauf oder lokale Dateien. Manuelle, vom Nutzer ausgewählte Übergabe ist der belegte Weg.
- **Cue ↔ Make:** Werkzeug und Authentisierung sind im aktuellen Lauf sichtbar, Zimt meldet zusätzlich einen abweichenden Katalogstatus. Es wurde kein Make-Szenario getestet oder ausgeführt.
- **Cue ↔ GitHub:** statusabhängig zwischen Koordinator- und Zimt-Katalog; an kein Agentprofil gebunden, kein GitHub-Server im aktuellen Werkzeugverzeichnis, kein Zugriffstest. Ein read-only Review braucht zuerst einen bestätigten Repositoryzugriff.
- **Cue ↔ Hermes:** nicht verbunden. Die gezeigte „Add server“-Maske ist Hermes als MCP-Client und erwartet einen bereits vorhandenen MCP-Server. Hermes `serve` (Desktop-JSON-RPC/WebSocket) und `hermes mcp serve` (Hermes als MCP-Server) sind getrennte Modi. Siehe [Hermes Desktop](https://hermes-agent.nousresearch.com/docs/user-guide/desktop) und [Hermes MCP](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp).
- **Hermes ↔ Termux/Android:** nicht verifiziert; keine Installation oder Ausführung geprüft. MTP wäre manueller Dateitransport, kein Live-Sync. ADB ermöglicht weitergehende Geräteaktionen und kann nicht aus einem eingesteckten Kabel abgeleitet werden; siehe [Android Platform Tools](https://developer.android.com/tools/adb).

## Rollenkarte und Teamablauf

- **Zimt – Orchestrierung:** Auftrag, Scope, Abhängigkeiten, Zuständigkeiten und Synthese.
- **Manus – Umsetzung:** klar abgegrenzte Recherche-, Datei- oder Code-Arbeit innerhalb der tatsächlich verfügbaren Rechte.
- **Junior – unabhängige Prüfung:** Gegenbelege, Testqualität, Sicherheitsgrenzen und unbewiesene Erfolgsbehauptungen.
- **Alex – Entscheidung:** Pilotwahl, Datenfreigaben und konkrete externe Aktionen.

Als Teamabläufe bieten sich Projektarbeit mit unabhängiger Review, eine lokal durch Alex ausgeführte read-only Runtime-Diagnose sowie begrenzte PAZ/IMS-Komponentenarbeit an. Push, Veröffentlichung, Kontenänderungen und Automationen benötigen jeweils eine eigene konkrete Entscheidung. Diese Rollenverteilung wurde nicht als permanente Profilregel gespeichert.

## Gemeinsame Source of Truth

**Vorschlag, noch nicht eingerichtet:** freigegebener Projektordner oder privates Repository mit `00_CUE_CHARTER.md` (Rollen/Regeln), `01_PROJECT_STATE.md` (CONFIRMED/OUTDATED/CONFLICT/UNVERIFIED), `02_DECISIONS.md`, `03_EVIDENCE.md`, `04_TASK_BACKLOG.md`, `05_RUN_LOG.md` und `06_LEARNINGS.md`. Keine Secrets, Tokens, privaten Schlüssel oder vollständigen lokalen Logs darin. Gruppenchat bleibt Koordination, nicht die maßgebliche Zustandsdatenbank.

## Empfohlener Pilot

Ein rein lesender Windows-/Android-Runtime-Preflight. Er erfasst nur auflösbare Befehle und Versionen, Prozessnamen sowie Listener-Metadaten. Keine vollständigen Kommandozeilen oder Umgebungsvariablen ausgeben, keine Dienste starten, keine HTTP/API-Aufrufe senden und USB-Debugging nicht aktivieren. Der [Runtime-Preflight](</home/ubuntu/upload/cd61e5b398df4466d82425a9_RUNTIME_PREFLIGHT.md>) enthält die zulässigen Befehle und Redaktionsgrenzen. Ein erfolgreicher Preflight zeigt lokale Indizien, keine Authentisierung, API-Funktion oder Hermes-Integration.

**Status:** keine neuen Agenten, Verbindungen oder Automationen aktiviert. Die Aufforderung, pauschal „alle“ zu aktivieren, benennt keine Agentenrollen, Dienste, Rechte oder Automationsabläufe und ist deshalb nicht sicher ausführbar. Der Pilot wartet auf Alex’ Auswahl oder Korrektur.