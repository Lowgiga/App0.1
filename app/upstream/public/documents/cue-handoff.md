# Antwort an Cue und tatsächlich vorbereitetes Hand-off

**Stand: 29.09.2026 · Europe/Berlin.**
**Grundlage:** die zuletzt übergebene Datei „CUE_TEAM_INITIALISIERUNG_2026-09-29 (1).md“.
**Status:** Antwortentwurf und gezielte GitHub-Lesearbeit abgeschlossen; keine Integration aktiviert.

Dieses Dokument enthält eine kopierbare Antwort an Cue und einen tatsächlich abgerufenen PAZ-Kontext. Die Rollen- und Integrationsvorschläge ändern keine Agentenprofile. ChatGPT hat keine Nachricht an Cue versendet und keinen Zugriff auf Cue selbst bestätigt.

**Was die neue Cue-Datei ändert**

Make, Slack und Zapier werden im aktuellen Cue-Werkzeugbestand mit authentifizierter Sitzung gemeldet. Die frühere Aussage „Make ist in meinem aktuellen MCP-Bestand nicht verfügbar“ ist damit für diesen aktuellen dokumentierten Lauf überholt. Profilbindung, agentenspezifische Sichtbarkeit und Funktionsprüfung bleiben getrennte Fragen.

Die aktive Cue-Umgebung ist Sandbox; der Online-Cloud-PC ist laut Datei nur Sidecar und nicht als aktives Gerät umschaltbar. Daraus folgt kein Zugriff auf Alex’ Rechner oder Galaxy S25.

**Technisch nachgeprüfte Grenzen**

- Die aktuelle offizielle Hermes-Termux-Seite meldet ein defektes Paket. Das betrifft den beschriebenen Hermes-Installationsweg; eine bestehende funktionierende Installation auf Alex’ Gerät wurde hier nicht untersucht. [Hermes auf Android/Termux](https://hermes-agent.nousresearch.com/docs/getting-started/termux).
- Hermes dokumentiert für `hermes mcp serve` einen stdio-Messaging-Bridge. Allgemeine Shell-/Dateioperationen werden dadurch nicht bereitgestellt. [Hermes MCP](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp).
- `hermes serve` ist ein gesondertes Desktop-Backend mit JSON-RPC/WebSocket. Eine Cue-Anbindung daran wäre ein eigener Integrationsschritt. [Hermes Desktop](https://hermes-agent.nousresearch.com/docs/user-guide/desktop).
- MCP kennt verschiedene Transporte. Client, Server, Protokollversion und Transport müssen zusammenpassen. Ein HTTP-JSON-Endpunkt wird durch seine Erreichbarkeit nicht zum MCP-Server. [MCP-Transporte](https://modelcontextprotocol.io/specification/latest/basic/transports).
- Tailscale Serve stellt Dienste innerhalb des Tailnets bereit. Ein Cue-Cloud-Kontext ohne passende Tailnet-Erreichbarkeit erhält dadurch keinen Zugriff. [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve).
- Für Hermes führen die aktuellen Plattformhinweise Windows 10/11 auf; das MSIX-Desktoppaket benötigt Windows 11 22H2 oder neuer. Eine Windows-10-Lösung muss den passenden Installationsweg wählen. [Hermes Plattformen](https://hermes-agent.nousresearch.com/docs/getting-started/platform-support).

Diese Aussagen sind Dokumentationsbefunde; es wurde kein Hermes-/SSH-/MCP-Verbindungstest auf Alex’ Geräten durchgeführt. Der dort vorhandene Desktop-Commander-Gerätestatus wurde lediglich gelesen: `localhost` und `DESKTOP-GIPC0VK` sind offline.

**Antwort zum Kopieren in Cue**

Der folgende Text ist ein Entwurf für den Nutzer. Er gibt einen konkret begrenzten Lese-/Entwurfsauftrag; neue dauerhafte Verbindungen, Dienste und Automationen bleiben gesonderte Maßnahmen.

```text
Cue, ich konkretisiere meinen Auftrag auf Grundlage der neuen Datei
„CUE_TEAM_INITIALISIERUNG_2026-09-29 (1).md“.

ZIEL
Erstelle mit dem vorhandenen Team einen funktionsfähigen, überprüfbaren
Arbeitsablauf. Nutze bestehende Zugriffe gezielt und entwirf für echte
Integrationslücken den kleinsten belastbaren Anschlussweg.

Du sollst aus meinem Ziel konkrete nächste Schritte ableiten. Wenn eine
Verbindung fehlt, prüfe Alternativen und bereite eine konkrete Lösung vor.
Eine Blockade einer Schnittstelle darf unabhängige erlaubte Arbeit nicht
stoppen.

AKTUELLER AUSFÜHRUNGSUMFANG
Du darfst jetzt vorhandene, für diesen Auftrag zugängliche Werkzeuge
gezielt lesend prüfen, öffentliche Dokumentation recherchieren,
die übergebenen Dateien auswerten und interne Entwürfe erstellen.

Neue Account-/Profilbindungen, Installationen, dauerhafte Dienste,
Schreibrechte und Automationen werden als konkrete Maßnahmen vorbereitet.
Ihre Aktivierung bleibt ein gesonderter, überprüfbarer Freigabepunkt.
Vorhandene Zahlungs- oder Werbeverbindungen gehören nicht in diesen Auftrag.

1. TEAM: DIE DREI VORHANDENEN AGENTEN VERWENDEN

Zimt:
Mission, Abhängigkeiten, aktueller Zustand, Hand-offs, Fortschritt,
Entscheidungsvorlagen und abschließende Synthese.

Manus:
Gezielte Werkzeugprüfungen, technische Recherche, Artefakte,
Adapterentwürfe und konkret abgegrenzte Implementierungspläne.

Junior:
Unabhängige Prüfung von Annahmen, Quellen, Berechtigungen, Fehlerfällen,
Testplänen und Erfolgsmeldungen.

Zunächst keine neuen Agenten anlegen.
Ein zusätzlicher „Device Operator“ ist erst sinnvoll, wenn ein
Gerätezugriff funktioniert und wiederkehrende Aufgaben dessen eigene
Zuständigkeit rechtfertigen. ChatGPT und Perplexity zunächst als
externe Dienste beziehungsweise Übergabepartner behandeln.

2. DIE AKTUALISIERTE BESTANDSAUFNAHME VERWENDEN

Make, Slack und Zapier sind laut neuer Datei im aktuellen
Werkzeugbestand vorhanden und im aktuellen Lauf authentifiziert.
Profilbindungen fehlen; Kataloganzeigen unterscheiden sich je Agent.
Leite daraus keinen globalen Verbindungszustand ab.

Prüfe pro benötigtem Dienst getrennt:
- Ausführungsinstanz und Zeitpunkt;
- Katalogstatus;
- Account-/Sitzungsauthentifizierung;
- Agent-Profilbindung;
- tatsächlich sichtbare Aktionen und ihre Parameter;
- wirksame Berechtigungen;
- Ergebnis genau eines erlaubten Leseaufrufs.

Nutze die tatsächlichen Werkzeugnamen und Schemas.
Eine erfolgreiche Anmeldung oder Werkzeugliste ersetzt keinen Funktionstest.
Eine behauptete Nur-Lese-Regel ersetzt keine technisch begrenzten Rechte.

3. KONKRETE DIENSTE, ROLLEN UND MINIMALE RECHTE

GitHub / PAZ:
Zielrepository: Klarmedizin-V4/prometheus-archon-zeta.
Manus benötigt für den Pilot Repositorymetadaten, ausgewählte
Dateiinhalte, Issues und gegebenenfalls PR-Metadaten lesend.
Junior erhält den referenzierten Snapshot; direkte eigene Leseanbindung
nur, wenn sie für die unabhängige Prüfung nötig ist.
Zimt führt Mission, Evidenz und Entscheidungen zusammen.

Keine Kommentare, Branches, Commits, Pushes, Merges, Webhookanlagen
oder Repository-Einstellungsänderungen.
Wenn die native Anbindung den Zugriff nicht auf dieses Repository und
Leseaktionen begrenzen kann, dokumentiere den tatsächlichen Umfang.
Bereite eine passend begrenzte alternative Anbindung vor; aktiviere sie
nicht mit pauschalen zusätzlichen Rechten.

Make:
Prüfe über ein bereits verfügbares Werkzeug nur Account-/Organisations-
und Szenario-Metadaten im erforderlichen Umfang. Manus übernimmt die
Prüfung und übergibt Zimt einen kompakten Befund.
Kein Szenario starten, keinen vorhandenen Webhook testweise auslösen
und keine Scheduling-Einstellung verändern.
Wenn eine dauerhafte Profilbindung erforderlich ist, schlage Make
gezielt für Zimt als späteren Automation Owner vor.

Zapier:
Zunächst nur aktivierte Apps, Aktionen und relevante Verbindungen lesen.
Prüfe es erst als Alternative, wenn Make die konkret benötigte Funktion
nicht zuverlässig abdeckt. Für denselben Ablauf nicht beide Plattformen
parallel aufbauen.

Notion / gemeinsamer Projektkontext:
Manus darf einen bereits eindeutig ausgewählten, für diesen Auftrag
freigegebenen Projektbereich lesend prüfen.
Ist kein solcher Bereich benannt, arbeite mit den angehängten Dokumenten
und bereite einen Vorschlag vor; nicht den gesamten Workspace inventarisieren.
Keine neue Datenbank, kein Seitenüberschreiben und keine Freigabeänderung.

Slack / Agent Mail:
Interner Cue-Gruppenchat ist vorerst der Ausgabekanal.
Kein externer Versand als Verbindungstest. Eine spätere Slack-Zielgruppe
oder Agent-Mail-Adresse muss exakt festgelegt werden.

OpenAI / Anthropic / Gemini / Perplexity / Mistral:
Keine zusätzlichen Modell-Connectoren allein wegen ihrer Verfügbarkeit.
Verwende vorhandene Cue-Funktionen für den Pilot. Zusätzliche Modelle nur
für eine konkrete Lücke und mit benanntem Zweck und Aufruflimit.
Ein OpenAI-Connector gewährt keinen Zugriff auf ChatGPT-Unterhaltungen.

Stripe / PayPal / Wallet / Meta Ads / Vercel:
Für diese Mission nicht verwenden.
Bestehende Verbindungen nicht ungefragt entfernen oder umkonfigurieren.

4. CHATGPT KANN FEHLENDE TEILARBEITEN ÜBERNEHMEN

ChatGPT/Codex hat über seine eigene GitHub-Anbindung bereits
PAZ-Metadaten, Repositorybaum, ausgewählte Dokumente, das
Konfigurationsschema und das offene Issue #23 abgerufen.

Das beigefügte Hand-off enthält den Commit, Quellen und offenen Fragen.
Nutze diese Ergebnisse und markiere ihre Herkunft.
Sie beweisen keinen GitHub-Zugriff innerhalb von Cue.

Wenn weitere Arbeit nur bei ChatGPT möglich ist:
Formuliere ein kompaktes HANDOFF mit Mission, konkretem Input,
gewünschtem Ergebnis, Belegen, Grenzen und Rückgabeziel.
Alex übernimmt zunächst die ausgewählte Datei-/Textübergabe.
Keine automatische Verbindung zu ChatGPT oder zu dessen Apps behaupten;
keine Tokens, Browser-Cookies oder komplette Gesprächsarchive übertragen.

5. ALTERNATIVE INTEGRATIONEN GEZIELT PRÜFEN

Wähle anhand der benötigten Funktion und bestätigten Laufzeitfähigkeit:

A. Bereits funktionierende native Anbindung.
B. Kompatibler MCP-Server oder MCP-Adapter.
C. Authentifizierter, begrenzter SSH-Zugang.
D. Dokumentierte HTTPS-API oder typisierte Auftragsqueue.
E. Ausgewählte Datei-/Textübergabe.

Für jeden Kandidaten nennen:
benötigte Funktion, Ausführungsort, Voraussetzungen, Rechte,
kleinster Test, Kosten, Persistenz und Rückweg.

Bei MCP zuerst feststellen, ob Cue tatsächlich benutzerdefinierte
Server akzeptiert und welche Transporte/Auth-Verfahren unterstützt sind.
Ein vorhandener Dienst mit JSON oder HTTP ist nicht automatisch MCP.

Bei SSH zuerst prüfen, ob der ausführende Cue-Kontext überhaupt einen
SSH-Client und eine erlaubte Netzwerkroute hat.
Nur auf ausdrücklich ausgewählte Geräte und Arbeitsverzeichnisse zugreifen.
Für einen Gerätehelfer feste Diagnoseoperationen statt freier Shellbefehle
vorsehen. Eine alternative Anbindung übernimmt dieselben genehmigten
Rechte; eine fehlende Integration ist kein Anlass zur Rechteausweitung.

Bei Tailscale prüfen, ob auch der ausführende Cloud-/Sandbox-Kontext
das Gerät über eine autorisierte Verbindung erreichen kann.
Eine private Adresse oder Tailscale allein auf meinem Handy reicht nicht.
Öffentliche Freigaben, Firewall- und Routeränderungen separat behandeln.

Die aktive Cue-Umgebung ist laut neuer Datei Sandbox.
Der Online-Cloud-PC ist nur Sidecar („cloud_pc_sidecar_only“);
keine unbelegte Umschaltung oder dauerhafte Worker-Laufzeit behaupten.

6. HERMES UND ANDROID SAUBER TRENNEN

Die offizielle Hermes-Termux-Seite meldet aktuell ein defektes Paket.
Diesen Installationsweg nicht als gelöst oder funktionsfähig darstellen.

Eine separate Architektur darf vorbereitet werden:
- Hermes auf einem bereits funktionsfähigen, geeigneten Host;
- Termux als begrenzter Geräte-/Datei-/Diagnosehelfer;
- authentisierter Transport zwischen den tatsächlich erreichbaren Instanzen.

Das ist kein behaupteter Fix des Hermes-Termux-Pakets.
Ubuntu/proot ist ein Prüfkandidat, keine garantierte Kompatibilitätslösung.
Meine vorhandenen Hermes-Daten und Installationen nicht überschreiben.

Hermes als MCP-Client, „hermes mcp serve“ und „hermes serve“ unterscheiden.
Der dokumentierte „hermes mcp serve“-Modus ist ein stdio-Messaging-Bridge.
Er ist keine allgemeine Datei-/Shell-Schnittstelle.
„hermes serve“ ist der separate Desktop-Backend-Modus.
Ein Statusendpunkt belegt noch keine MCP-Kompatibilität.

MCP bezeichnet die Werkzeuganbindung.
MTP dient dem Dateitransport; USB-Verbindung allein belegt keinen ADB-Zugriff.

7. APPS ODER HELFER BEI KONKRETEM NUTZEN VORBEREITEN

Installation ist eine mögliche Lösung, kein Selbstzweck.
Prüfe vorhandene Termux-/SSH-/Tailscale-/Windows-Werkzeuge zuerst.

Wenn eine zusätzliche Komponente erforderlich ist, liefere:
- genaue Komponente, Version und offizielle Quelle;
- ausgewähltes Zielgerät und Betriebssystem;
- benannte benötigte Fähigkeit;
- installierte/fehlende Voraussetzungen;
- getrennte Installations- und Startbefehle;
- Rechte, erwartbare Kosten und Speicherbedarf;
- Test, Stoppen und Rückbau ohne Verlust vorhandener Daten.

Für mein Android-Gerät Android/Termux und gegebenenfalls Ubuntu/proot
getrennt behandeln. Die vorhandenen Versionen zuerst feststellen.
Für meinen Windows-Rechner zuerst die Version bestimmen und passende
unterstützte Varianten prüfen.
Keine nicht passenden Desktoppakete, Docker-Abhängigkeit in Termux
oder Administrator-/Root-Anforderungen stillschweigend voraussetzen.
Erst danach eine konkrete Installation zur Freigabe vorlegen.

8. AUTOMATIONEN KONKRET ENTWERFEN – VORERST INAKTIV

A1 – PAZ Issue-/PR-Briefing
Owner: Zimt; Manus analysiert; Junior prüft relevante Findings.
Trigger: ein relevantes Issue- oder PR-Ereignis ausschließlich im PAZ-Repo.
Aktion: aktuellen Kontext laden, Änderung zusammenfassen,
nächsten Schritt als Entwurf erstellen.
Häufigkeit: ereignisgesteuert; gleiche Objektversion nicht doppelt bearbeiten.
Ziel: interne Cue-Mission/Unterhaltung; keine GitHub-Kommentare.
Voraussetzung: bestätigter GitHub-Lesezugriff und passender Event-Trigger.
Status: Entwurf, nicht aktivieren.

A2 – Wochenbriefing zu Cue/Hermes und den untersuchten Integrationen
Owner: Zimt; Manus recherchiert; Junior prüft entscheidungsrelevante Aussagen.
Trigger: Freitag 09:30, Europe/Berlin.
Aktion: offizielle Änderungen zu Cue, Hermes und den konkret untersuchten
Anschlusswegen prüfen; nur Auswirkungen auf den geplanten Arbeitsablauf
sowie Android/Termux und Windows melden.
Häufigkeit: einmal wöchentlich.
Ziel: interne Cue-Zusammenfassung.
Zeit ist ein Vorschlag; vorhandene entsprechende Jobs vor Neuanlage prüfen.
Status: Entwurf, nicht aktivieren.

A3 – Geräte-Status auf ausdrücklichen Abruf
Owner: späterer Device Operator oder Manus.
Trigger: ausdrücklicher Nutzerauftrag mit ausgewähltem Gerät.
Aktion: genehmigte Versions-/Prozess-/Listener-Metadaten lesen
und begrenzten Statusbericht zurückgeben.
Häufigkeit: genau ein Lauf pro eindeutiger Auftrags-ID.
Ziel: interne Cue-Mission.
Voraussetzung: getesteter, eingeschränkter Gerätezugriff.
Status: manueller Worker-Entwurf, kein Hintergrundjob.

Für spätere dauerhafte Abläufe:
State Store, Audit-Log, Timeout, begrenzte Wiederholung,
Freigabepunkt und wirksamen Kill Switch benennen.
Keine beliebigen Shellstrings in einer Queue.
Eine Queue benötigt authentisierte Quelle, Auftrags-ID, Ablaufzeit,
atomare Übernahme, erlaubte Operationen und Ergebnisstatus.
Bei unbekanntem Ausgang zuerst das Ergebnis prüfen; kein
„exactly once“ versprechen, wenn das Zielsystem es nicht garantiert.

9. EIN KLEINER, SOFORT NUTZBARER PILOT

Verwendet zunächst das beigefügte PAZ-Hand-off.
Dafür ist weder ein neuer Agent noch SSH, eine Installation oder eine
dauerhafte Automation erforderlich.

Zimt definiert die konkrete Mission.
Manus ergänzt den lesenden Befund um einen Implementierungsplan.
Junior prüft den Plan unabhängig.
Zimt liefert ein gemeinsames Ergebnis.

Issue #23 ist ein konkreter Kandidat für die Planungsarbeit.
Vor Umsetzung seinen PR-#19-Baselinebezug mit dem aktuellen Stand
abgleichen. Historische Reports nicht als neue Testergebnisse ausgeben.

DONE WHEN:
Ein referenzierter Projektzustand, eine benannte Aufgabe,
ein nachvollziehbarer Plan, Akzeptanzkriterien,
behandelte Review-Findings und ein Fortsetzungspunkt vorliegen.

Kein Code ändern, kein Issue kommentieren, keinen Branch erstellen,
keinen Push, Merge, Deployment oder produktiven Lauf ausführen.

10. ERGEBNIS UND KONKRETE ENTSCHEIDUNGSVORLAGEN

Liefere eine gemeinsame Antwort mit:
- tatsächlich erledigten Arbeiten und Belegen;
- agentenspezifischer Capability-Matrix;
- minimalem funktionierenden Arbeitsablauf;
- konkretem Integrationsvorschlag für die erste echte Lücke;
- ausführbaren, plattformspezifischen Schritten als Entwurf;
- nicht erledigten Arbeiten und genauem Grund;
- nächster Aktion und verantwortlichem Agenten.

Wenn eine Freigabe nötig ist, liefere eine fertige Karte:
ACTION_ID, genaue Aktion, Agent, Dienst/Gerät, Datenbereich,
Rechte, Kosten, Dauer/Persistenz, Test, Rückweg und offene Voraussetzung.

Frage nur nach Angaben, die technisch oder für die Freigabe tatsächlich
fehlen. Erledige unabhängige, erlaubte Arbeit währenddessen weiter.
Aktiviere keine pauschale Sammlung von Connectoren und Agenten.

```

**Tatsächlich erledigte Ersatzarbeit über ChatGPT**

Repository: [Klarmedizin-V4/prometheus-archon-zeta](https://github.com/Klarmedizin-V4/prometheus-archon-zeta)  
Referenz: `main` am Commit `7a2c918462bb5eeba6d4e5727d85be01a89e1cf5`  
Repositorybaum: 356 Einträge, `truncated=false`.

Erfolgreiche Leseabrufe:
- Repositorymetadaten und Branch-Metadaten;
- vollständiger Baum für den benannten Commit;
- `README.md`;
- `docs/CODE_QUALITY_ASSESSMENT.md`;
- `paz_kernel/config_schema.py`;
- Issue-Suche mit maximal 20 Treffern;
- Issue #23 einzeln mit bestätigtem Status `open`.

Die Suche lieferte 20 Treffer. Diese Zahl ist **kein Gesamtbestand aller offenen Issues**. Keine Repositorydatei wurde verändert. Es wurden keine Projekt- oder CI-Tests ausgeführt.

**Gezielte statische Beobachtung**

Im abgerufenen `PazConfig` sind die Rootfelder `system`, `trading`, `risk`, `agents` deklariert. Das Issue #23 fordert darüber hinaus die typisierte Abbildung von `logging`, `defi` und `security`. Damit liegt ein konkreter Abgleichspunkt für die Planungsarbeit vor. Der fehlende vollständige Ist-Soll-Abgleich von YAML, Loader, Tests und dem PR-#19-Stand bleibt offen.

Am geprüften Commit wurden keine Dateien mit den kanonischen Basenames `PROJECT.md`, `STATE.md`, `DECISIONS.md`, `TASKS.md`, `CHECKPOINT.md`, `EVIDENCE.md` oder `RUNS.md` gefunden. Bereits vorhandene Dokumente umfassen unter anderem `docs/ARCHITECTURE.md`, `docs/PAZ_INFRA_MANIFEST.md`, `docs/MVP_REVIEW.md`, `docs/CHANGELOG.md` und den Qualitätsbericht. Eine neue parallele Struktur wurde nicht angelegt.

Der Qualitätsbericht ist eine bestehende Quelle. Seine dort genannten Testergebnisse und historischen Messwerte wurden hier **nicht erneut durchgeführt oder unabhängig bestätigt**.

**HANDOFF: ChatGPT → Cue / Zimt**

FROM: ChatGPT/Codex  
TO: Zimt, danach Manus und Junior  
MISSION: Mit dem übergebenen PAZ-Kontext einen lesenden Implementierungsplan für ein klar begrenztes Issue vorbereiten.  
INPUT: benannter Commit, abgerufene Quellen, Issue #23 und dessen Akzeptanzkriterien.  
COMPLETED: die oben aufgeführten GitHub-Leseabrufe und ein Abgleich der deklarierten Config-Rootfelder.  
EVIDENCE: Commit-/Blobreferenzen im folgenden Snapshot.  
ASSUMPTIONS: Issue #23 ist ein Planungskandidat, noch kein Freigabebeleg für Codeänderungen.  
OPEN QUESTIONS: PR-#19-Baseline versus aktuelles main; Inhalte des YAML/Loaders/Tests; tatsächliche Cue-GitHub-Berechtigung.  
OUTPUT REQUIRED: Scope, betroffene Dateien, Reihenfolge, Akzeptanzkriterien, Testentwurf, Review-Findings und Checkpoint.  
RISK: LOW für die lesende Planung; keine Live-Finanzaktionen.  
RETURN TO: Zimt → Alex.

**Issue #23 – verifizierter Inhalt**

Titel: Config hardening loop: strict schema, safe env overrides and paper-only runtime  
Link: https://github.com/Klarmedizin-V4/prometheus-archon-zeta/issues/23  
Status: open  
Letzte Aktualisierung laut GitHub: 2026-09-12T00:36:11Z

> Der Issue-Text nennt als Baseline PR #19 mit Commit `adebae2e1cefe1c680a06d6c3686e27a7ece1403`. Dieser Bezug unterscheidet sich vom hier gelesenen main-Commit. Vor einer Umsetzung muss die Baseline ausdrücklich abgeglichen werden.

## Ziel
Die PAZ-Konfiguration wird in einer wiederholbaren Verbesserungs- und Verifikationsschleife gehärtet, bis YAML, Pydantic-Schema, Environment-Overrides, Runtime-Sicherheitsgrenzen und Tests konsistent sind.

## Baseline
Ausgangspunkt ist der aktuelle Head von PR #19 (`adebae2e1cefe1c680a06d6c3686e27a7ece1403`), ohne #19/#20/#22 direkt zu verändern.

## Schleife
1. Ist-Vertrag erfassen.
2. Eine klar begrenzte Config-Invariante korrigieren.
3. Positive und negative Regressionstests ergänzen.
4. CI/Review-Evidence prüfen.
5. Fehler oder neue Drift erneut in Schritt 1 einspeisen.
6. Erst beenden, wenn alle Acceptance Criteria erfüllt sind.

## Acceptance Criteria
- Alle legitimen YAML-Rootbereiche sind typisiert (`system`, `trading`, `risk`, `agents`, `logging`, `defi`, `security`).
- Unbekannte YAML-Felder schlagen fail-closed fehl.
- Allgemeine Prozessvariablen wie `PAZ_BOT_ACTOR` werden nicht als Runtime-Config missinterpretiert.
- Neue Config-Overrides verwenden einen eindeutigen Namespace; bestehende dokumentierte Overrides bleiben kontrolliert kompatibel.
- `paper_mode=false` wird bereits durch Config-Validierung abgelehnt, solange kein Live-Execution-Adapter existiert.
- EMA- und Risiko-Invarianten sind validiert.
- Die Repository-YAML lässt sich vollständig gegen das Schema laden.
- Tests decken Defaults, vollständige YAML, Env-Overrides, unbekannte Keys, ungültige Live-Konfiguration und Cross-Field-Constraints ab.
- Keine Behauptung über grüne Tests ohne ausgeführte CI-Evidence.

## Nicht Bestandteil dieser Schleife
Control-Plane-P1-Fixes aus #19, Research Scientist aus #20 und allgemeines API-Auth-Hardening. Diese bleiben getrennte Sprints.

**Vorgeschlagene Planungsfolge für Issue #23**

1. PR-#19-Status und beabsichtigte Baseline lesen; keine fremden offenen Änderungen übernehmen.
2. YAML-Rootbereiche, Loader-Logik und vorhandene Tests am gewählten Stand zusammenführen.
3. Abbildung aller legitimen Bereiche, Umgang mit unbekannten Feldern und Cross-Field-Invarianten definieren.
4. Environment-Overrides mit klarer Positivliste beziehungsweise eindeutigem Namespace planen; allgemeine Prozessvariablen nicht als Runtime-Config interpretieren.
5. Die im Issue geforderte Paper-Mode-Grenze und ungültige Parameterkombinationen in Akzeptanzkriterien aufnehmen.
6. Positive und negative Regressionstests entwerfen; die exakten Laufbefehle aus dem tatsächlichen Testsetup ableiten.
7. Junior prüft Kompatibilität, Baseline, Datenverlust-/Default-Risiken und Testabdeckung.
8. Zimt stellt den Plan zur Abnahme bereit. Codeänderung und PR sind ein späterer Auftrag.

**Suchtreffer zur offenen Arbeit**

| Issue | Titel |
|---|---|
| 23 | Config hardening loop: strict schema, safe env overrides and paper-only runtime |
| 12 | 🤖 Termux Webhook Trigger |
| 42 | [LOW] Pydantic v1 zu v2 Migration: class Config zu model_config |
| 41 | [MEDIUM] pytest-cov Konfiguration + Coverage-Gate in CI |
| 40 | [MEDIUM] README.md: Setup-Anleitung, Prerequisites, Env-Vars und Quick-Start ergaenzen |
| 39 | [HIGH] DeFi-Connectors sind TODO-Stubs — Aave, DEX, Gas, Yield nicht implementiert |
| 38 | [MEDIUM] Test-Coverage: tools.py ungetestet — File-Hashing, Scan, pytest/ruff Runner |
| 37 | [LOW] Keine Tags oder Releases — Rollback-Nachweis nicht moeglich |
| 36 | [MEDIUM] except Exception: pass/continue ohne Logging in strategy_registry und event_consumer |
| 35 | [MEDIUM] Test-Coverage: crypto_utils.py ungetestet — kritische Security-Komponente |
| 34 | [MEDIUM] paz-autonomy: Relative Imports + keine eigene pyproject.toml |
| 33 | [LOW] Dateiname mit Emoji: .github/Trinkgeld 🫶.yml |
| 32 | [LOW] Test-Coverage: 14 Agenten ohne direkte Tests |
| 30 | [HIGH] API-Routes sind TODO-Stubs — kpi, trades, agents, main lifespan nicht implementiert |
| 31 | [MEDIUM] state.data ist untypisiert (dict[str, Any]) — Schluessel als String-Literale |
| 28 | [MEDIUM] tempfile.mktemp im API-Orchestrator (deprecated, race condition) |
| 29 | [MEDIUM] API-Key-Felder als leere Strings ohne Validierung in Config-Dataclasses |
| 27 | [MEDIUM] Globaler State in prometheus_master.py — global _shutdown_event |
| 26 | [MEDIUM] Inkonsistente Logger-Patterns — DI vs. modul-level structlog |
| 25 | [HIGH] Hardcoded Blockchain-Adressen im Sourcecode (dex_connector.py) |

**Maschinenlesbarer Snapshot**

```json
{
  "date": "2026-09-29",
  "timezone": "Europe/Berlin",
  "acquired_by": "ChatGPT/Codex über eigene GitHub-Anbindung; keine Cue-Anbindung getestet",
  "repository": "Klarmedizin-V4/prometheus-archon-zeta",
  "branch": "main",
  "commit_sha": "7a2c918462bb5eeba6d4e5727d85be01a89e1cf5",
  "repository_tree_entries": 356,
  "repository_tree_truncated": false,
  "canonical_project_files_found": [],
  "files_read": [
    {
      "path": "README.md",
      "blob_sha": "9e2f8dab809975c83c7f219680c42725fbfcd9c8"
    },
    {
      "path": "docs/CODE_QUALITY_ASSESSMENT.md",
      "blob_sha": "2a2c4c4ff4ca3ba2f8da6074f63be92240a4f3ad"
    },
    {
      "path": "paz_kernel/config_schema.py",
      "blob_sha": "45566826c5ba14bf9eb518cacf129ec295cdc7d0"
    }
  ],
  "issue_verified": {
    "number": 23,
    "state": "open",
    "title": "Config hardening loop: strict schema, safe env overrides and paper-only runtime",
    "url": "https://github.com/Klarmedizin-V4/prometheus-archon-zeta/issues/23",
    "updated_at": "2026-09-12T00:36:11Z",
    "baseline_in_issue": "PR #19; adebae2e1cefe1c680a06d6c3686e27a7ece1403"
  },
  "issue_search": {
    "query": "repo:Klarmedizin-V4/prometheus-archon-zeta is:issue is:open",
    "limit": 20,
    "returned": 20,
    "is_total_count": false
  },
  "inspected_root_config_fields": [
    "system",
    "trading",
    "risk",
    "agents"
  ],
  "project_tests_run": false,
  "repository_writes_performed": false,
  "installs_performed": false,
  "automations_activated": false,
  "transfer_to_cue": "Nutzer legt dieses Dokument in Cue vor; kein direkter Versand durch ChatGPT."
}
```

**Unabhängige Gegenprüfung**

Ein separater Codex-Prüfagent hat die neueste Cue-Datei und diesen Entwurf vollständig auf Konsistenz, Herkunftskennzeichnung und Freigabeumfang geprüft: keine zwingenden Korrekturen. Er hat weder die GitHub-Abrufe noch die Herstellerdokumentation erneut abgefragt. Das Review bestätigt keinen Cue-, Geräte-, SSH- oder MCP-Funktionstest.

**Fortsetzungspunkt**

- Abgeschlossen: neue Cue-Bestandsaufnahme gelesen; Dokumentationsprüfung; eigene GitHub-Lesearbeit; unabhängige Bewertung der Integrationsgrenzen.
- Nicht ausgeführt: Cue-Connectorbindung, Installationen, SSH-/MCP-Verbindungen, Gerätediagnose, externe Kommunikation, produktive Workflows, GitHub-Schreibaktionen und neue Zeitpläne.
- Nächster Schritt: Alex übergibt diese Datei beziehungsweise den Antworttext an Cue. Cue kann den lesenden Plan anhand des enthaltenen Kontextes beginnen und seine vorhandenen Make-Werkzeuge gezielt prüfen.
