# 33 · Hermes und Windows-Host sicher einrichten

Stand: 3. November 2026. Diese Anleitung ersetzt die Installationsteile aus PR #15. Sie beschreibt einen Weg, der die Freigabemechanik von Hermes nutzt statt sie zu umgehen. In diesem Repository wurde Hermes **nicht** installiert oder ausgeführt; alle Befehle stammen aus der offiziellen Dokumentation oder sind als Community-Wissen gekennzeichnet.

## Kurzfassung

| Baustein | Sicherer Weg | Nicht verwenden (aus PR #15) |
| --- | --- | --- |
| Hermes installieren | Offizielles Installationsskript herunterladen, lesen, dann ausführen | `iex (irm …)` ungeprüft; eigenes Skript mit `-ForegroundColor Gold` |
| Befehlsausführung | Hermes-eigenes Terminal-Tool mit `approvals.mode: manual` | Eigene Webhook-Bridge mit Standard-Token und `exec(string)` |
| Lokale Modelle | Ollama nur auf 127.0.0.1 | `OLLAMA_HOST=0.0.0.0:11434`, Neustart als Administrator |
| SSH | Schlüssel, Regel nur für die Tailscale-Schnittstelle, Standardregel prüfen | `StrictHostKeyChecking=no`, Annahme „exklusiv Tailscale“ |
| Android | Termux optional; Systemänderungen nur bewusst und gezielt | `device_config` ohne Seriennummer und ohne Rückweg |

## 1 · Hermes Agent installieren (Windows nativ)

Die offizielle Doku unterstützt Windows nativ ohne WSL; installiert wird nach `%LOCALAPPDATA%\hermes` ([Installation](https://hermes-agent.nousresearch.com/docs/getting-started/installation/)). Statt das Skript direkt auszuführen:

```powershell
Invoke-RestMethod https://hermes-agent.nousresearch.com/install.ps1 -OutFile "$env:TEMP\install-hermes.ps1"
notepad "$env:TEMP\install-hermes.ps1"   # lesen, was es tut
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:TEMP\install-hermes.ps1"
```

Laut README kann ein Virenscanner `uv.exe` melden; dann gezielt `%LOCALAPPDATA%\hermes\bin` freigeben, nicht den Scanner abschalten ([Repository](https://github.com/NousResearch/hermes-agent)).

## 2 · Freigaben verbindlich einschalten

Hermes bringt eine eigene Freigabemechanik mit ([Sicherheit](https://hermes-agent.nousresearch.com/docs/user-guide/security)). Für OMEGA gilt: Jede Befehlsausführung braucht eine Bestätigung.

```yaml
# ~/.hermes/config.yaml (Ausschnitt)
approvals:
  mode: manual          # smart | manual | off — "off" entspricht --yolo
  timeout: 300
  cron_mode: deny
  single_query_mode: deny
  unattended_mode: deny
```

Geheimnisse gehören nach `~/.hermes/.env`, nicht in `config.yaml`; `hermes config set` sortiert Schlüssel automatisch dorthin ([Konfiguration](https://hermes-agent.nousresearch.com/docs/user-guide/configuration)). Die Schlüsselnamen für einen eigenen Modell-Endpunkt bitte auf der Provider-Seite der offiziellen Doku nachlesen; die Variante aus PR #15 (`memory.type: sqlite_fts5`, `delegation.concurrent_subagents`) entspricht nicht dem offiziellen Schema.

MCP-Server werden einzeln und mit Tool-Filter eingebunden ([MCP](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp)):

```yaml
mcp_servers:
  omega-node:
    url: "http://127.0.0.1:47800/mcp"
    tools:
      include: [omega_capabilities_list, omega_task_status]
```

Der Server `omega-node` existiert noch nicht; er ist der geplante Anschluss aus [31](31-analyse-und-omega-plan.md).

## 3 · Ollama nur lokal

Ollama hat keine eingebaute Authentifizierung ([Wiz zu CVE-2024-37032](https://www.wiz.io/blog/probllama-ollama-vulnerability-cve-2024-37032)); im Februar 2026 waren 12.269 Instanzen ungeschützt im Internet erreichbar ([LeakIX](https://blog.leakix.net/2026/02/ollama-exposed/)). Ohne `OLLAMA_HOST` lauscht Ollama übereinstimmenden Anleitungen zufolge nur auf 127.0.0.1:11434. Deshalb:

- `OLLAMA_HOST` nicht auf `0.0.0.0` setzen; in der Desktop-App „Expose Ollama to the network“ ausgeschaltet lassen.
- Ollama als normaler Benutzer starten, nicht aus einer Administrator-Sitzung.
- Braucht ein anderer Rechner Zugriff, einen Reverse-Proxy mit Authentifizierung davorsetzen.

## 4 · SSH nur über Tailscale

Die Installation von OpenSSH Server legt selbst die Firewall-Regel `OpenSSH-Server-In-TCP` für Port 22 an und aktiviert sie ([Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse)). Eine zusätzliche Erlaubnisregel für 100.64.0.0/10 macht den Zugang deshalb nicht exklusiv; 100.64.0.0/10 ist zudem allgemeiner Carrier-NAT-Bereich.

```powershell
Get-NetAdapter | Select-Object Name, InterfaceDescription   # Alias des Tailscale-Adapters prüfen
Disable-NetFirewallRule -Name 'OpenSSH-Server-In-TCP'
New-NetFirewallRule -Name 'OMEGA-SSH-Tailscale' -DisplayName 'OpenSSH nur ueber Tailscale' `
  -Direction Inbound -Protocol TCP -LocalPort 22 -InterfaceAlias 'Tailscale' -Action Allow
```

In `C:\ProgramData\ssh\sshd_config` `PasswordAuthentication no` setzen, nur Schlüssel verwenden, danach `Restart-Service sshd`. Auf der Gegenseite den Host-Schlüssel beim ersten Verbinden prüfen und nie `StrictHostKeyChecking=no` setzen.

## 5 · Android und Termux

- Das offizielle Termux-Paket von Hermes funktioniert laut Doku derzeit nicht ([Termux](https://hermes-agent.nousresearch.com/docs/getting-started/termux)). Der Android-Node wird deshalb nicht auf Hermes in Termux aufgebaut.
- Wake-on-LAN erreicht den PC nur aus demselben LAN, nicht über Tailscale.
- Der Phantom-Prozess-Schutz ab Android 12 beendet Termux-Kindprozesse. Ändern nur bewusst, für genau ein Gerät und mit Rückweg. Die folgenden Befehle sind Community-Wissen, nicht offiziell dokumentiert:

```sh
adb devices                                   # Seriennummer ablesen; bei USB + WLAN erscheinen zwei Einträge
adb -s SERIENNUMMER shell "/system/bin/device_config get activity_manager max_phantom_processes"   # vorher: Wert notieren (null = nicht gesetzt)
adb -s SERIENNUMMER shell "/system/bin/device_config get_sync_disabled_for_tests"   # vorher: Modus notieren (none, persistent oder until_reboot)
adb -s SERIENNUMMER shell "/system/bin/device_config set_sync_disabled_for_tests persistent"
adb -s SERIENNUMMER shell "/system/bin/device_config put activity_manager max_phantom_processes 2147483647"
adb -s SERIENNUMMER shell "/system/bin/device_config get activity_manager max_phantom_processes"   # Kontrolle
# Rückweg: eigenen Wert entfernen (war vorher ein Wert gesetzt: mit put wiederherstellen),
# dann den notierten Sync-Modus wiederherstellen (hier: none) und neu starten
adb -s SERIENNUMMER shell "/system/bin/device_config delete activity_manager max_phantom_processes"
adb -s SERIENNUMMER shell "/system/bin/device_config set_sync_disabled_for_tests none"
adb -s SERIENNUMMER reboot
```

Ab Android 12L/13 gibt es dafür meist einen Schalter in den Entwickleroptionen, der vorzuziehen ist.

## 6 · Prüfen statt annehmen

[`tools/windows/omega_host_audit.py`](../tools/windows/omega_host_audit.py) prüft den Host nur lesend gegen die Regeln dieser Seite:

| Prüfung | FAIL, wenn |
| --- | --- |
| `OLLAMA_HOST` (Prozess, Benutzer, Maschine) | eine Adresse außerhalb von Loopback gesetzt ist |
| Ollama-Listener (alle Ports der Ollama-Prozesse) | ein Socket nicht auf Loopback lauscht |
| Firewall: jede aktive Eingangsregel für TCP 22 | sie nicht auf die Schnittstelle `Tailscale` beschränkt ist (ein Adressfilter auf 100.64.0.0/10 genügt nicht) |
| sshd: effektiver Wert (`sshd -T`) und alle `Match`-Blöcke | `PasswordAuthentication` nicht `no` ist; nicht gesetzt bedeutet den OpenSSH-Standard `yes` |
| Hermes `approvals.mode` | er nicht `manual` ist (nicht gesetzt bedeutet `smart`) |
| Hermes `cron_mode`, `single_query_mode`, `unattended_mode` | einer davon gesetzt ist und nicht genau `deny` lautet (nicht gesetzt bedeutet `deny`) |
| `HERMES_YOLO_MODE` | sie einen anderen Wert als leer, `0`, `false` oder `no` hat; Hermes selbst wertet nur `1`, `true`, `yes` und `on` als aktiv ([`utils.is_truthy_value`](https://github.com/NousResearch/hermes-agent/blob/71736c9f32597bbca9d89cede5aa136e55946b2f/utils.py)), das Audit prüft also strenger |

Mehrere ADB-Transporte ergeben nur eine Warnung. Der Exit-Code ist die Zahl der FAIL-Befunde.

```powershell
python tools\windows\omega_host_audit.py
```

Die Prüflogik ist mit 44 Unit-Tests abgesichert. Die Schlüssel und Standardwerte von Hermes wurden am 2026-11-04 gegen die [offizielle Sicherheitsseite](https://hermes-agent.nousresearch.com/docs/user-guide/security) geprüft. Die Datensammler (Firewall, Listener, `sshd -T`, Registry) sind auf echtem Windows noch nicht gelaufen. Das frühere PowerShell-Skript `Test-OmegaHost.ps1` ist durch dieses Werkzeug ersetzt.
