# Backlog · priorisierte Feature Map

| Priorität | Funktion | Abnahme / Begründung |
|---|---|---|
| MUST · diese Wave | Phasengenaue AR-Diagnose und expliziter Surface-Modus | Startfehler erhalten, kein stiller Fallback, frische Treffer, Ressourcenabbau |
| MUST · diese Wave | Vier Praxislevel und echter Transferauftrag | Wissenseinordnung, Beziehungen, tatsächliche Auswahl/Fokus oder 2D-Alternative, einmalige XP, CAS-Integrität |
| MUST · diese Wave | Tests, Budget, unabhängiges Review, private Veröffentlichung | Dokumentierte Exitcodes; Datenerhalt; owner-only |
| MUST · externe Abnahme | Android-Kamera-/Flächentest durch erreichbares Gerät / Low | Tatsächlicher Browser, Kamera-Passthrough, Treffer, Platzieren, Maßstab, Verlust/Recovery, Exit; kein Emulatorersatz |
| SHOULD | Zeitbewusste Evidenzansicht | observed_at/last_verified getrennt; CURRENT/AGING/STALE/UNKNOWN; keine Snapshot-Umdeklaration |
| SHOULD | Nachgewiesener read-only Adapter | Ein eigener begrenzter Abruf, OAuth/Scope, Provenance, Fehler-/Timeoutpfad; dann erst „verbunden“ |
| SHOULD | E-Commerce-Vergleich mit eigener Beobachtung | Nur belegte Preise, Datumsfelder und Quellen; keine Kaufaktion |
| EXPERIMENT | A2UI-Adapter hinter internem Schema | Versionierter Komponenten-Allowlist-Renderer, begrenzte Komplexität, XSS-/Referenztests; kein beliebiger Code |
| EXPERIMENT | AG-UI-Stream | Nur mit tatsächlichem Agentendpoint, authentifizierten Ereignissen, Abbruch und Sequenzierung. Kein erfundenes Token-/Kostenmonitoring |
| EXPERIMENT | MCP-Apps-Host | Host-Kompatibilität, Sandbox/CSP und Permissions zuerst; von bestehendem read-only MCP-Endpunkt getrennt |
| EXPERIMENT | AR-Anchors / Szenenokklusion | Nur nach Gerätetest; Unterstützung, Drift und Kosten messen. Hit-Test allein liefert keinen dauerhaften Anchor |
| LATER | PWA-/Tauri-/Capacitor-Verpackung | Erst aktuelle Auth-/Offline-/Kamera-Grenzen im Zielhost verifizieren. Separate native Implementierung und Wartung sind reale Kosten |
| LATER | Automation Studio / SRE | Reale Adapter, Events, Audit, Scope, Idempotenz, Budget und Kill Switch erforderlich |
| REJECT | Alle Add-ons pauschal verbinden | Registriert ≠ autorisiert; unklare Datenzugriffe und Außenwirkungen, keine pauschalen Health-Checks |
| REJECT | 3D-Shader als reale Kamera-/Hologramm-Projektion bezeichnen | Eine gerenderte Geometrie bestätigt weder Kamera-Passthrough noch physische Projektion |
| REJECT | Direkt eingebetteter KI-generierter HTML-/JS-Code | Ohne vertrauenswürdigen Komponentenvertrag kein zulässiger Hauptapp-Renderer |
| REJECT | Kamera-/Agentenaktivität zur Belohnung simulieren | XP und Animation erklären dokumentierte Nutzeraktionen; sie erzeugen keine externen Berechtigungen oder Ausführung |

Frühere offene Anforderungen werden weitergeführt, nicht als in dieser Wave getestet markiert. Priorisierungsgrund: die vom Nutzer gemeldete konkrete Kamera-/AR-Störung zuerst beheben, anschließend die Kontext-/Informationsebene vertiefen.
