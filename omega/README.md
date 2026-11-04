# OMEGA-Runtime

Abhängigkeitsfreie Bausteine für den OMEGA-Plan ([docs/31](../docs/31-analyse-und-omega-plan.md)).
Der Umsetzungsstand mit Nachweisen steht in [docs/35](../docs/35-omega-runtime-stand.md), die Tasker-Anbindung in
[docs/34](../docs/34-tasker-bruecke.md). LowQuantFlow unter `app/` bleibt unverändert. Drift-Tests lesen nur
dessen Typen, damit Verträge und App nicht auseinanderlaufen. Die spätere Einbindung in die App läuft über die
OmegaBridge (geschützter Pfad `app/android/`, nur per Quality-Adoption).

Voraussetzung: Node ≥ 22.18.0. Für den Interop-Test zusätzlich ein JDK ≥ 17; ohne JDK wird dieser Test übersprungen.

## Module

| Modul | Aufgabe | Anforderung |
| --- | --- | --- |
| `runtime/canonical.mjs` | Kanonisches JSON (RFC 8785) für Signatur und MAC | – |
| `runtime/hlc.mjs` | Hybrid Logical Clock, sortierbare Stempel, Drift-Grenze | OMG-04 |
| `runtime/signing.mjs` | Ed25519 (Knoten) und HMAC-SHA256 (Tasker) | OMG-01, OMG-09 |
| `runtime/peers.mjs` | Selbstzertifizierende Knoten-ID, Kopplungscode, Peer-Registry | OMG-01 |
| `runtime/events.mjs` | `omega.event/v1` mit Datenklasse, Replay-Schutz je Knoten | OMG-04 |
| `runtime/journal.mjs` | Hash-verkettetes Journal, Absturzwiederherstellung, Quarantäne-Untergrenze | OMG-04 |
| `runtime/lease.mjs` | Leases mit Fencing-Token (≥ Uhrzeit), Kill-Switch `revokeAll()` | OMG-03 |
| `runtime/task.mjs` | `omega.task/v1`: 10 Missionsstufen, Übergänge, 4 Profile wie in der App | OMG-03 |
| `runtime/trust-kernel.mjs` | Aktionsklassen E0–E3, Selbstentwicklung nach Art der Änderung, E4 nur mit Eigentümer-Signatur, Freigaben | OMG-06, OMG-07 |
| `runtime/capabilities.mjs` | `omega.capability/v1` mit ablaufendem Nachweis, Voraussetzungen, Fallbacks | OMG-02 |
| `runtime/model-grant.mjs` | `omega.model-grant/v1`: Tokens, Aufrufe und Kosten pro UTC-Tag, Datenklassen | OMG-07 |
| `runtime/tasker-bridge.mjs` | `omega.tasker/v1`: Allowlist `OMEGA_*`, Parameter, Gate, HTTP-Transport | OMG-09 |
| `runtime/store.mjs` | Atomarer Zustandsspeicher (Temp-Datei, fsync, Umbenennen) | OMG-07 |
| `node/service.mjs` | Knotendienst: Identität, Peers, Journal, Leases, Kill-Switch, Reparatur | P3 |
| `node/server.mjs` | HTTP `/api/omega/v1` (nur Loopback/Mesh-IP, Host- und Origin-Schutz, Limits) | P3 |
| `node/probes.mjs` | Nachweis-Proben adb/scrcpy → Fähigkeiten | OMG-02, OMG-05 |
| `cli/omega.mjs` | Kommandozeile für den Windows-Knoten | P3 |
| `java/OmegaTaskerGate.java` | Java-Referenz der Tasker-Prüfung (Vorlage OmegaBridge/Tasker) | OMG-09 |
| `windows/Start-OmegaLink.ps1` | Plug & Play: mDNS → `adb connect` → scrcpy | OMG-05 |
| `contracts/*.schema.json` | Sieben Verträge, gegen die Laufzeit getestet | – |

## Unverrückbare Regeln (durch Tests abgesichert)

1. Irreversible Aktionen brauchen auf jeder Stufe eine menschliche Freigabe.
2. E4-Änderungen (Trust Kernel, Policy) laufen nie autonom, sondern nur mit inhaltsgebundener Signatur des Eigentümers.
3. Sicherheitsaktionen (`OMEGA_KILL`, `OMEGA_ADB_OFF`) gehen immer durch, auch bei aktivem Kill-Switch.
4. Eine unbeantwortete Freigabe gilt als Ablehnung. Jede Freigabe ist genau einmal verwendbar.
5. Fehlt der Zustand oder ist er defekt, startet der Knoten auf E0 mit Kill-Switch. Die Reparatur und die spätere Freigabe sind zwei getrennte menschliche Schritte.
6. Daten der Klasse `secret` verlassen den Knoten nie und gehen nie an ein entferntes Modell.
7. Tasker führt keine freien Befehle aus, sondern nur Tasks aus `TASKER_ACTIONS`.

## Schnellstart (Windows-Knoten)

Alle Befehle aus dem Repo-Wurzelordner. Der Zustand liegt in `--state`; Standard ist `$OMEGA_STATE_DIR` oder `~/.omega`.

```bash
node omega/cli/omega.mjs init --label win-gpu
```

```bash
node omega/cli/omega.mjs probe
```

```bash
node omega/cli/omega.mjs secret --out tasker.secret
```

```bash
node omega/cli/omega.mjs tasker-cmd --secret-file tasker.secret --action OMEGA_STATUS
```

```bash
node omega/cli/omega.mjs serve
```

Weitere Befehle: `id`, `status`, `pair-code`, `peer-add`, `peers`, `peer-revoke`, `kill`, `kill --release --confirm-human`,
`repair --confirm-human`, `journal-verify`. Übersicht mit `node omega/cli/omega.mjs help`.

## Tests

```bash
cd omega && node --test test/*.test.mjs
```
