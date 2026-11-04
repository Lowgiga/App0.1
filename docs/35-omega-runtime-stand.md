# 35 · OMEGA-Runtime: Umsetzungsstand und Nachweise (2026-11-04)

Bezug: [Plan 31](31-analyse-und-omega-plan.md), [Tasker-Brücke 34](34-tasker-bruecke.md), Code unter [`omega/`](../omega/README.md).
LowQuantFlow unter `app/` ist unverändert; die Runtime liest die App nur in Drift-Tests.

## Kurzfassung

Die erste Fassung der Runtime vom 2026-11-04 (Commit `57bbe21`) wurde gegen Plan 31 und gegen die
Typen der App geprüft. Gefunden wurden **6 Verknüpfungsfehler** (Code ≠ Plan ≠ App) und
**10 Stabilitäts- bzw. Sicherheitslücken**. Alle sind behoben und durch Tests abgesichert. Neu hinzugekommen
sind Peers mit Kopplungscode, eine Capability-Registry mit Nachweis, ein hash-verkettetes
Journal, Modell-Grants mit Tagesbudget, das Missionsmodell, ein Knotendienst mit HTTP-API, eine
CLI, Proben für adb und scrcpy sowie eine Java-Referenz der Tasker-Prüfung.

| Kennzahl | Wert |
| --- | --- |
| Tests | 79 / 79 grün (15 Dateien), davon 4 Drift-Tests gegen `app/`, 1 Java-Interop-Test und feste Sollwerte aus RFC 8032; 50 Wiederholungsläufe nach der letzten Korrektur ohne Fehlschlag |
| Laufzeit lokal | Node v22.23.4, OpenJDK 21.0.12.1 |
| Abhängigkeiten | keine (nur Node-Standardbibliothek) |
| Umfang | 2.819 Zeilen in `runtime/`, `node/`, `cli/`, `java/`, `windows/`, `contracts/` |
| Nicht ausgeführt | `Start-OmegaLink.ps1` unter Windows, Tasker-Profile auf dem Gerät, GitHub-CI (Actions startet nicht) |

## Verknüpfungsfehler (Plan ↔ Code ↔ App)

| ID | Befund | Behebung | Nachweis |
| --- | --- | --- | --- |
| L1 | Code behandelte E4 als „autonomste“ Stufe; Plan 31: E4 darf **nichts** autonom | Zwei Achsen: Aktionsklassen je Stufe E0–E3 und Art der Änderung → nötige Stufe und Nachweise. E4 (Trust Kernel, Policy) nur mit `omega.owner-approval/v1` | `trust-tasker.test.mjs` |
| L2 | `omega.capability/v1` hatte eine andere Form als im Plan | Form wie Plan: `provider`, `effect`, `requires`, `state`, `evidence`, `fallbacks` | `contracts.test.mjs` (Beispiel aus Plan 31) |
| L3 | `omega.event/v1` ohne Datenklasse | `dataClass` public · internal · personal · financial · secret; `secret` verlässt den Knoten nie | `core.test.mjs`, `service.test.mjs` |
| L4 | `omega.task/v1` ohne Missionsstufe und Profil | 10 Stufen, Übergänge und 4 Profile wie in `app/upstream/lib/*` | `task.test.mjs`, `app-link.test.mjs` |
| L5 | `omega.model-grant/v1` ohne Kosten pro Tag, Datenklassen und `execution` | Felder ergänzt; `bindingId` wie `identifier` der App | `model-grant.test.mjs`, `app-link.test.mjs` |
| L6 | Knoten-IDs frei wählbar (`android-1`) | Selbstzertifizierend: `n` + 16 Hex von SHA-256(Schlüssel); Prüfung bei jedem Ereignis | `peers.test.mjs`, `core.test.mjs` |

Die Drift-Tests in `omega/test/app-link.test.mjs` lesen `missionStages`, `stageTransitions`, `agentIds`,
`OperationEffect`, `execution` und `identifier` direkt aus `app/`. Ändert sich die App, schlagen sie fehl,
statt dass Verträge still auseinanderlaufen.

## Stabilität und Sicherheit

| ID | Lücke | Behebung |
| --- | --- | --- |
| S1 | Kill-Switch nur im Speicher; nach Neustart wieder aktiv | Zustand atomar gespeichert; fehlender oder defekter Zustand startet auf E0 **mit** Kill-Switch |
| S2 | Replay-Schutz ging bei Neustart verloren | Das Journal ist die Quelle: höchste Sequenz je Knoten wird beim Start gelesen |
| S3 | Tasker-Gate: ein Absender mit vorgehender Uhr blockierte alle anderen | Replay-Stand je Absender |
| S4 | Tasker-Befehl ohne Lease-Ablauf | `leaseExpiresAt` im MAC-geschützten Befehl; abgelaufen = abgewiesen |
| S5 | Freigaben wuchsen unbegrenzt | Höchstzahl offener Anfragen, Bereinigung nach Aufbewahrungszeit |
| S6 | `validateTaskerParams('toString')` stürzte ab (geerbte Objektnamen) | `Object.hasOwn` an allen Allowlist-Stellen |
| S7 | Fencing-Tokens begannen nach Neustart wieder bei 1 | Token ≥ aktuelle Uhrzeit in ms: auch ohne Zustand höher als alle alten. Springt die Uhr zurück, wird abgelehnt statt doppelt ausgeführt |
| S8 | Sackgasse: Bei defektem Zustand war der Kill-Switch nie wieder lösbar | `omega repair --confirm-human`: Zustände neu schreiben; defektes Journal in Quarantäne mit Sequenz-Untergrenze (nur aus eigenen Rotationen). Kill-Switch bleibt danach an; die Freigabe ist ein eigener Schritt |
| S9 | Windows PowerShell 5.1 schreibt bei `>` UTF-16 mit BOM; das Geheimnis wäre unlesbar gewesen | `omega secret --out` schreibt direkt (0600, kein Überschreiben, nicht im Terminal); Einlesen verträgt UTF-8-BOM und UTF-16LE |
| S10 | CLI: Öffentliche Schlüssel, die mit `-` beginnen (1 von 64), wurden von `parseArgs` als mehrdeutig abgelehnt. Kopplung per CLI wäre dann unmöglich gewesen. Entdeckt durch einen einzelnen Fehlschlag in rund 74 Testläufen | Text-Optionen werden vor dem Parsen zu `--name=wert` zusammengefasst; deterministischer Test mit erzwungenem `-`-Schlüssel. Zufallsabhängige Annahmen in Tests durch feste RFC-8032-Sollwerte ersetzt (unabhängig mit Python nachgerechnet) |

## Bausteine und Anforderungen

| OMG | Baustein | Datei |
| --- | --- | --- |
| OMG-01 | Identität, Kopplungscode, Peer-Registry mit endgültigem Widerruf | `runtime/peers.mjs`, `node/service.mjs` |
| OMG-02 | Capability-Registry mit ablaufendem Nachweis (≤ 24 h), Zyklenerkennung, Fallbacks; Proben adb/scrcpy | `runtime/capabilities.mjs`, `node/probes.mjs` |
| OMG-03 | Leases mit Fencing, Missionsübergänge nur mit gültigem Token | `runtime/lease.mjs`, `runtime/task.mjs` |
| OMG-04 | Ed25519-Ereignisse, hash-verkettetes Journal, Absturzwiederherstellung | `runtime/events.mjs`, `runtime/journal.mjs` |
| OMG-05 | Plug & Play: Windows-Skript, Tasker-Anleitung, Proben | `windows/Start-OmegaLink.ps1`, [34](34-tasker-bruecke.md) |
| OMG-06 | Stufen der Selbstentwicklung als Code; E4 nur mit Signatur des Eigentümers | `runtime/trust-kernel.mjs` |
| OMG-07 | Persistenter Kill-Switch (auch per Peer-Ereignis `control.kill`), Modell-Grants mit Tagesbudget | `runtime/trust-kernel.mjs`, `runtime/model-grant.mjs` |
| OMG-09 | Tasker-Brücke: Allowlist, HMAC, Lease-Ablauf, Replay je Absender, Java-Referenz | `runtime/tasker-bridge.mjs`, `java/OmegaTaskerGate.java` |

Den Abnahmestand je ID führt die [Abnahmematrix](16-acceptance-matrix.md#omega-erweiterung-omg-01-bis-omg-09).

## HTTP-Schnittstelle des Knotens

`omega serve` bindet standardmäßig an `127.0.0.1:7341`. Ein Bind an `0.0.0.0` oder `::` ist verboten;
für das Mesh ist eine konkrete Tailnet-IP mit `--allow-external` nötig.

| Route | Zweck | Schutz |
| --- | --- | --- |
| `GET /api/omega/v1/health` | Stufe, Kill-Switch, Fehler, Journal-Kopf | Host-Prüfung (DNS-Rebinding), kein `Origin` (kein Browserzugriff) |
| `GET /api/omega/v1/capabilities` | Fähigkeiten mit Zustand | wie oben |
| `POST /api/omega/v1/events` | signierte Ereignisse von Peers | JSON-Pflicht, ≤ 96 KiB, Ratenbegrenzung, Signatur, Replay, `secret` → 422 |

## Bedienung am Windows-Knoten

```bash
node omega/cli/omega.mjs init --label win-gpu
```

```bash
node omega/cli/omega.mjs pair-code --peer-key <SCHLUESSEL_DES_HANDYS>
```

```bash
node omega/cli/omega.mjs peer-add --peer-key <SCHLUESSEL_DES_HANDYS> --role android --label Samsung --code <CODE_VOM_HANDY>
```

```bash
node omega/cli/omega.mjs secret --out tasker.secret
```

```bash
node omega/cli/omega.mjs tasker-cmd --secret-file tasker.secret --action OMEGA_ADB_ON --params '{"minutes":15}' --confirm --send http://<TAILNET_IP_HANDY>:<PORT>/omega
```

```bash
node omega/cli/omega.mjs kill
```

```bash
node omega/cli/omega.mjs serve
```

Bei Stufe E1 (Standard) braucht jede umkehrbare Aktion `--confirm`; das ist die menschliche Freigabe beim Absender.
Gesperrte Aktionen (Kill-Switch, falsche Parameter) werden schon beim Erzeugen abgelehnt.

## Offen und nächste Schritte

| Prio | Schritt | Zeitrahmen | Aufwand |
| --- | --- | --- | --- |
| 1 | GitHub Actions freischalten; CI-Job `omega` (Node 22.18.0/24, JDK 21, CLI-Rauchtest) grün | sofort | niedrig |
| 1 | `Start-OmegaLink.ps1` und `omega probe` auf dem Windows-PC ausführen (G3-Vorstufe) | nach CI | niedrig |
| 2 | Tasker-Profile und Kill-Kachel auf dem Samsung nach [34](34-tasker-bruecke.md) (G1) | nach Gerätezugang | mittel |
| 2 | OmegaBridge (Android): Java-Gate übernehmen, Identität im Android-Keystore, Journal auf dem Gerät | P4 | hoch |
| 3 | OMG-08: Journal-Ereignisse als OpenTelemetry-Logs lokal exportieren | P5 | mittel |
| 3 | Modell-Grants an den AdvisoryAdapter der App binden (nur mit gültigem Grant) | P5 | mittel |

## Risiken

| Risiko | Ampel | Score | Gegenmaßnahme |
| --- | --- | --- | --- |
| CI läuft nicht; Nachweise nur lokal | Gelb | 6 | Actions freischalten; der Job ist vorbereitet |
| Dateirechte 0600 wirken unter Windows nicht (ACL) | Gelb | 5 | Zustandsordner im Benutzerprofil; später DPAPI bzw. Windows-Anmeldeinformationsspeicher |
| Uhr springt zurück → Leases werden abgelehnt | Grün | 3 | Gewollt fail-safe; NTP aktiv halten |
| Tasker-HTTP ohne eigene Authentifizierung | Rot | 8 | Nur Mesh + HMAC + Allowlist + Lease-Ablauf (umgesetzt); WebView nie in Freigabe-Scenes |

[DATEN-QUELLE]: lokale Testläufe (`node --test`), Quelltext `app/` · [ZEITSTEMPEL]: 2026-11-04 · [KONFIDENZ]: Hoch für den Code, Niedrig für Geräte und Windows (nicht ausgeführt) · [GAMMA-STATUS]: Unvollständig – Geräte- und CI-Nachweis fehlen
