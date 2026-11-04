# EINGEFROREN – nicht mergen

Stand: 2026-11-04. Dieser OMEGA-Entwurf (Node.js, `omega/`) ist nach **Zyklus 1 (Architektur)** eingefroren.
Entscheidung des Eigentümers: einfrieren, zuerst ein konkretes erstes Ziel festlegen (zum Beispiel
„USB-C → scrcpy zwischen Samsung und Windows“), dann nur das dafür Nötige **in Python** neu aufbauen.

## Warum eingefroren

| ID | Befund | Ampel | Beleg |
| --- | --- | --- | --- |
| A1 | Kein Nutzer: weder die App noch ein Gerät verwendet den Code | 🔴 8 | rund 3.600 Zeilen, 0 Aufrufer außerhalb von `omega/` |
| A3 | Technologiebruch: reines JavaScript mit doppelt definierten Verträgen (JSON-Schema + Prüfcode); die App nutzt TypeScript strict + zod | 🟡 6 | `tsc --strict --checkJs`: 278 Befunde |
| A4 | `node/service.mjs` vereint 7 Aufgaben; HTTP-Handler in einer Funktion | 🟡 5 | Komplexität 15 bzw. 22 |
| A5 | Prüffunktionen mit Komplexität 30–32 | 🟡 5 | `validateModelGrant`, `validateCapability`, `validateTask` |
| A6 | 80 öffentliche Exporte ohne Stabilitätsregel | 🟢 3 | `runtime/index.mjs` |

## Offene Befunde aus dem Review (CodeRabbit, PR #30) – bewusst nicht behoben

| Datei | Befund | Schwere |
| --- | --- | --- |
| `runtime/peers.mjs` | Der sechsstellige Kopplungscode bindet den Schlüsseltausch nicht. Ein Angreifer dazwischen kann mit rund 10^6 Schlüsselerzeugungen einen passenden Code erzwingen. Nötig ist ein Commit-then-Reveal-Verfahren mit Nonces, wie bei ZRTP oder Bluetooth Numeric Comparison. | Major, Sicherheit |
| `node/service.mjs` | Ist das Journal blockiert, wird auch ein Sicherheitsbefehl (`OMEGA_KILL`) nicht ausgegeben. Der Lease bleibt dann ohne Befehl gespeichert. | Major |
| `runtime/hlc.mjs` | `receive` ändert den Zustand, bevor der Überlauf geprüft wird. Danach ist die kausale Ordnung verletzt. | Minor |
| `runtime/task.mjs` | `Approved` prüft nicht, ob die Freigabe zur selben Aufgabe gehört (laut CodeRabbit unbestätigt) | Minor |

## Was davon wiederverwendbar ist

Die Ideen und die getesteten Abläufe sind belegt (79 Tests, feste RFC-8032-Sollwerte, Interop Node → Java):
kanonisches JSON, HLC, signierte Ereignisse mit Replay-Schutz, Leases mit Fencing-Token, persistenter
Kill-Switch mit fail-safe Start, Allowlist-Gate für Tasker. Beim Neuaufbau in Python werden nur die Teile
übernommen, die das erste Ziel braucht, mit eigener Typprüfung, Linter und Review.
