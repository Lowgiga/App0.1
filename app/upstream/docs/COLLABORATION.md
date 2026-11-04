# Codex ↔ Low · Kooperation 1.4.1

Ziel: Dashboard weiterentwickeln und Integrations-/Gerätearbeit gezielt abgeben, ohne dieselben Dateien parallel zu ändern. Low ist der vom Nutzer genannte Agent, kein umbenannter Codex-Subagent. Direkter Kanal, Identität, Zustellung und Annahme sind weiterhin unbestätigt.

## Zuständigkeiten

| Owner | Nische | Arbeitsbereich |
| --- | --- | --- |
| Codex | Oberfläche, UX, App-Verträge, Prüfungen, private Veröffentlichung | Eigenes Worktree und `feat/codex-*`; konkrete Dateiliste im Registry |
| Low | Integrationsbefunde, Android-/Geräteprüfung, isolierte Adapterentwürfe | Eigenes Worktree und `feat/low-*`; ausschließlich `integrations/low/`, `tests/low/`, `docs/low/` |
| Unabhängiger Reviewer | Gegenprüfung von Änderungen und Evidenz | Lesen; keine parallelen Edits und kein Low-Alias |

Codex-Worktree dieser Wave: `cue-codex-coordination`. Das vorherige `cue-command-mesh`-Worktree bleibt unangetastet. Die App und das PAZ-Repository sind getrennte Projekte. Neue Low-Dateien werden erst nach einem tatsächlichen Bericht und Review integriert.

Geschützte gemeinsame Dateien sind lesbar. Änderungen an Zustandsmodell, Migrationen, Authentifizierung, State-/Action-Endpunkten oder Abhängigkeiten erfordern einen konkreten neuen Schnittstellenauftrag. Die Registry und der Scope-Guard selbst liegen außerhalb von Lows Bereich.

## Verifizierte Zugangswege und Grenzen

- Bestehende private Site und ihr MCP-Endpunkt sind über Sites-Metadaten nachgewiesen. Die Site bleibt auf ihren Eigentümer beschränkt.
- Endpoint und OAuth-Ressource: `https://cue-command-mesh.medezinander-4731.chatgpt.site/mcp`.
- Neuer Lesebefehl: `mesh_get_collaboration_brief`, Argumente `{}`. Keine fremde API, Zustellung, Worker-Ausführung oder neue Schreiboperation.
- Unterstützter MCP-Client und eigene Plattformanmeldung/-Einwilligung sind erforderlich. Der Eigentümer autorisiert den Client; keine Übertragung von Tokens, Cookies oder Passwörtern.
- Alternativ: Agentenansicht → Low-Arbeitsbrief kopieren oder Brief als JSON exportieren. Kopieren bedeutet keine Nachricht an Low.
- Remote Desktop Commander meldete beim im Registry gespeicherten Abruf zwei Geräte offline. Das ist ein datierter Befund dieser Schnittstelle, kein aktueller Statusnachweis für Low oder Hermes.
- Eine direkte Cue-/Low-/Hermes-, Perplexity- oder Code-Engine-Anrufmöglichkeit wurde im verfügbaren Werkzeugbestand nicht belegt. Kein anderer Agent wird zur Überbrückung als Low ausgegeben.

Die existierenden drei Snapshot-Lesewerkzeuge bleiben erhalten. Authentifizierung, Origin-Prüfung und unterstützte MCP-Versionen sind unverändert. Kein SSE-Stream, automatische Synchronisierung oder remote arbeitender Agent wird behauptet.

## Begrenzte Mission für Low

Ein realer Zugangs-/Integrationsbefund und optional eine tatsächliche Android-Bedienprüfung. Maximal 20 Minuten, acht relevante Leseaufrufe, keine weitere Delegation. Zugang auf minimalen Read-Scope begrenzen. Kein Kauf, Versand, Szenariostart, Scheduler, Rechteausbau oder neue Installation aus diesem Auftrag.

Vor Beginn Mission, Dateigrenzen und aktuellen App-Source-HEAD bestätigen. Der vollständige `referenceCommit` im Brief ist der Ausgangsstand dieser Wave, nicht der aktuelle Remote-HEAD. Erst tatsächlich verfügbare Schnittstellen lesen; bei Auth-/Zugriffsblockern konkret melden und stoppen. Keine Wiederholung unbekannter externer Aktionen.

Der Brief enthält nur Zeitstempel des eigenen gespeicherten Standes, maximal sechs nicht archivierte Missionskurzfassungen und Anzahl offener Aufgaben. Keine Notizen, Missionsziele, Mailadressen oder Credentials. Fehlender Arbeitsstand heißt `unknown`; persönlicher Export ist dann gesperrt.

## Bindung und Rückmeldung

SHA-256 über den deterministischen Briefinhalt ohne `generatedAt` erzeugt `briefHash`. Derselbe private Zustand liefert in UI und MCP dieselbe Kennung. Eine Inhaltsänderung oder neue gespeicherte Revision erfordert einen neuen Abgleich. Die Kennung ist keine Signatur und kein Identitätsnachweis.

LowReport ist ein streng validiertes JSON-Objekt:

| Feld | Bedeutung |
| --- | --- |
| `schemaVersion` | `1` |
| `revision`, `missionId`, `briefHash` | Unverändert aus dem tatsächlich erhaltenen Brief |
| `from`, `acknowledged` | `low`, `true`; manuell eingegangene Angaben, keine authentifizierte Agentenidentität |
| `referenceCommit` | Vollständiger 40-stelliger Ausgangscommit aus dem Brief |
| `baseCommit` | Vollständiger tatsächlich geprüfter Source-Commit; separat mit aktuellem Ziel prüfen |
| `status` | `blocked`, `partial` oder `completed` |
| `summary` | Konkreter Befund, 20–2000 Zeichen |
| `changedFiles` | Höchstens 40 eindeutige relative Dateien ausschließlich im Low-Bereich |
| `tests` | Höchstens 20 Angaben mit `command`, `exitCode` und konkretem `evidence`; nicht automatisch ausgeführt |
| `blockers` | Konkrete offene Hindernisse; bei `blocked` mindestens eines |

Maximal 24.000 UTF-8-Bytes. Abschlussmeldungen benötigen gemeldete Prüfungen mit Exit 0 und keine Blocker; auch sie bleiben Behauptungen. Unbekannte Felder und fingierte `verified`-Flags werden abgewiesen. Bereits formal gültige Berichte werden nie als Git-Diff oder Code importiert. Aufbewahrung nutzt die vorhandene Notizgrenze von 5000 Zeichen; größere Rückmeldungen als eigenständige Datei sichern.

Passende Rückmeldungen können als **ungeprüfte Notiz** gespeichert werden. Ein abweichender Bericht kann ausdrücklich als **historische ungeprüfte Notiz** aufbewahrt werden. Dadurch gehen tatsächlich erhaltene Rückmeldungen bei parallelen Notiz-/Theme-Änderungen nicht verloren. Sie übernehmen keinen aktuellen Status und erteilen keinen Integrationsauftrag. CAS-Konflikte erhalten den Entwurf; nach geladenem neuen Stand Briefbindung erneut prüfen. Kein Report bestätigt Tests, beendet eine Mission oder erteilt Rechte. React rendert Inhalt als Text.

Vor Codeintegration: echten Absender/Quelle feststellen, den aktuellen Remote-HEAD lesen, vollständigen Patch und Dateimodi prüfen, Konflikte identifizieren und relevante Tests selbst ausführen. Ein Scope-PASS allein ersetzt weder Review noch Authentifizierung.

## Lokale Dateiprüfung

Im zugehörigen App-Worktree ausführen:

```bash
node scripts/check-agent-scope.mjs --agent codex --base 2b838b4f574acfaff72013c270a1fa637eb995c6
```

Für Low dasselbe Kommando mit `--agent low` und seinem tatsächlich bestätigten vollständigen Basiscommit. Der Guard verlangt passenden Branch, gültigen Vorfahren und richtiges Repository. Er betrachtet staged/unstaged Änderungen gegenüber der Basis sowie untracked Dateien. Umbenennungsquelle und -ziel werden getrennt geprüft; Löschungen, geschützte Dateimodi, Symlinks und Gitlinks werden erfasst. Pfadtraversal, Secrets-Dateien und generierte Bereiche sind ausgeschlossen.

Das ist eine lokale advisory Projektregel. Ein Agent mit Shell-Zugriff ist dadurch nicht technisch eingeschränkt. Rechte des Betriebssystems, private Site-Authentifizierung und echte Agenten-Identität bleiben eigene Ebenen.

## Unterbrechungsarme Zusammenarbeit

Ein Brief, ein begrenztes Ergebnis, ein unabhängiges Review. Zusätzliche Nachrichten nur bei tatsächlichem Blocker oder nötiger Schnittstellenentscheidung. Keine periodischen Statusabfragen, gegenseitigen Edits oder Dauerjobs. Codex ist der alleinige Publisher dieser Wave; das bestehende private Publikum bleibt unverändert. Bei divergierendem Remote-HEAD zuerst lesen und abgleichen, niemals force-pushen.

## Technische Grundlage

- [Git worktree](https://git-scm.com/docs/git-worktree): getrennte Arbeitsbäume für unabhängige Branches.
- [MCP-Autorisierung](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization): bestehende unterstützte Autorisierung; Clientverbindung ist ein eigener Vorgang.
- [MCP-Sicherheitsbetrachtung](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations): kein Credential-Passthrough. Diese Wave behauptet keine neue Protokollkompatibilität oder vollständige Implementierung dieser Revision.
