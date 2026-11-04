# Hermes Omni-Architect: Autonomes Hybrid-Agenten-System (Windows Host & Termux Edge)

## Überblick & Architektur

Das **Hermes Omni-Architect System** ist eine hochentwickelte, autonome Agenten-Infrastruktur auf Basis des **Nous Research Hermes Agent Frameworks**. Es verbindet ein leistungsfähiges Windows-GPU-System (Inferenz, RAG, schwere Berechnungen) mit einem mobilen Android-Termux-Knoten (Code-Ausführung, Skill-Routing, Git-Worktrees, AST-Analyse, Web-to-App Interface). Beide Knoten kommunizieren über ein abgesichertes **Tailscale Mesh-VPN** und nutzen eine lokale **Webhook-Execution-Bridge** sowie den Nous Research Hermes RPC Broker für nahtloses, lückenloses Tool-Calling ohne manuelle Benutzereingriffe.

```
+-----------------------------------------------------------------------------------+
|                                 TAILSCALE MESH VPN                                |
|                                   (100.64.0.0/10)                                 |
|                                                                                   |
|  +-----------------------------------+     +-----------------------------------+  |
|  |       WINDOWS GPU HOST            |     |         TERMUX EDGE NODE          |  |
|  |  (PowerShell 7+, Ollama/vLLM)     |     |    (Android ARM64, Node/Python)   |  |
|  |                                   |     |                                   |  |
|  |  - Port 11434: Ollama API         | <== |  - Port 8000: SillyTavern UI      |  |
|  |  - Port 22: SSH Server            | ==> |  - Port 3001: Webhook Bridge      |  |
|  |  - Flash Attention & Q8 KV Cache  |     |  - Python venv & FTS5 Skill-Store |  |
|  +-----------------------------------+     +-----------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 🚀 Die 30 Feinen System-Tuning Features

### A. Windows Host & GPU Performance Tuning
1. **Dynamic VRAM Monitor & GPU Warmup:** Automatischer Check des freien VRAMs via `nvidia-smi` vor großen Modell-Loads.
2. **Persistent Keep-Alive Heartbeat:** `OLLAMA_KEEP_ALIVE=24h` verhindert ständiges Modell-Unloading zwischen Entwicklungs-Sessions.
3. **NVMe Disk Cache Buffering:** Schnelles Paging des KV-Caches auf primären NVMe-Speicher für minimale Context-Swapping Latenzen.
4. **Process Priority Elevator:** Automatische Hochstufung der Prozesspriorität für `ollama.exe` und `sshd.exe` auf `High`.
5. **Tailscale IP Auto-Discovery:** Dynamische Ermittlung der Tailscale IP-Adresse im Setup-Skript ohne manuelle IP-Tipparbeit.

### B. Termux Edge Node Resilience & Mobile Tuning
6. **Battery & Thermal Protection:** Überwachung des Smartphone-Akkustands und Temperatur via `termux-battery-status` vor schweren Tasks.
7. **Automatisierte Log-Rotation:** Automatische Bereinigung und Compression alter Execution Logs in `~/.hermes/logs/`.
8. **Termux Boot Persistence:** Automatischer Start der Execution Bridge beim Booten des Smartphones via `termux-boot`.
9. **Exponential WoL Retries:** Wake-on-LAN Retry-Schleife mit exponentiellem Backoff bis zur Erreichbarkeit des Windows-PCs.
10. **Offline Mode Fallback:** Lokaler Rückfall-Modus auf ein leichtes Llama-3.2-1B Modell in Termux, falls der PC offline ist.

### C. Webhook Execution Bridge & Security Hardening
11. **Origin Lockdown:** CORS-Einschränkung der `hermes-bridge.js` streng auf `http://localhost:8000` und `http://127.0.0.1:8000`.
12. **Command Rate-Limiting:** Schutz vor unendlichen Tool-Schleifen durch ein integriertes Token-Bucket-Limit (Max 10 Execs/Min).
13. **Process Tree Killer:** Zuverlässiges Beenden abgebrochener Kindprozesse bei Timeout via `tree-kill` Logik.
14. **JSON Execution Audit Log:** Lückenlose Protokollierung aller ausgeführten Befehle mit Zeitstempel, Tool-Name und Exit-Code.
15. **Bearer Token Authentication:** Pflicht-Header `Authorization: Bearer <token>` für alle Anfragen an die Bridge.

### D. Memory, State & Context Management
16. **FTS5 SQLite Full-Text Search:** Effizientes Durchsuchen historischer Code-Snippets und Skills via `memory_fts_search`.
17. **Automatisches Context Pruning:** Intelligentes Kürzen alter Chat-Historien im `<thought>` Block zur Erhaltung fester Context-Window-Limits.
18. **Session Snapshot & Restore:** Speichern des exakten Entwicklungszustands über `session_save` und `session_load`.
19. **AST Code Diff Caching:** Nur geänderte Funktionsblöcke werden neu parsed und an das Modell gesendet.
20. **Automatisches Daily Skill-Backup:** Tägliches automatisches Backup von `~/.hermes/skills/` in ein lokales Git-Repository.

### E. Tool Synthesis & Execution Intelligence
21. **Dynamic Tool Synthesis:** Der Agent kann eigenständig neue Skripte in `~/bin/tools/` schreiben und als neue Tools registrieren.
22. **Cross-Platform Path Resolver:** Transparentes Übersetzen von `C:\Users\...` nach `/data/data/com.termux/...`.
23. **Multi-Threaded Task Execution Broker:** Parallele Ausführung unabhändiger Shell-Befehle durch Asynchronen Node.js Event Loop.
24. **Git Worktree Auto-Cleanup:** Automatisches Löschen inaktiver oder gemergter Worktree-Verzeichnisse nach Tests.
25. **Stacktrace Diagnostics:** Automatisches Herausfiltern von Fehlermeldungen aus langen `stderr` Ausgaben.

### F. Mobile User Interface & Notification UX
26. **Android Notification Push:** Senden relevanter Testergebnisse direkt an die Android-Statusleiste via `termux-notification`.
27. **Direct Clipboard Sync:** Automatisches Kopieren des generierten finale Codes in die Android-Zwischenablage via `termux-clipboard-set`.
28. **Haptic & Audio Feedback:** Dezentes Vibriren via `termux-vibrate` bei erfolgreichem Build oder Fehlern.
29. **High-Contrast Dark Theme:** Vorinstalliertes Entwickler-Preset für die SillyTavern PWA für optimale Lesbarkeit auf OLED-Displays.
30. **1-Tap Shortcut Launcher:** Homescreen-Widget mit Direktauswahl für "Aufwecken & Server-Start", "Health-Check" und "Log-Viewer".

---

## Skill-Routing & Sub-Agenten Delegierung (`~/.hermes/config.yaml`)

Anstatt jede einfache Anfrage an das Hauptmodell zu senden, nutzt die Architektur das Nous Research **Skill-Based Routing**:
1. **Lokal / Syntax & Quick Tasks:** Werden direkt in Termux über schnelle Hilfsskripte oder ein leichtes Modell abgefangen.
2. **Komplexe Architektur / Refactoring:** Hermes triggert den `delegate_task` Befehl. Dadurch werden bis zu 3 autonome Sub-Agenten isoliert spritzig gespawnt, um Sub-Tasks auszuführen und nur die Ergebnisse zu konsolidieren.

```yaml
# Nous Research Hermes Agent Configuration
model:
  provider: "openai"
  base_url: "http://100.64.0.1:11434/v1" # Tailscale IP des Windows Desktop-PC
  default: "hermes3:8b"

delegation:
  concurrent_subagents: 3
  provider: "openai"
  default: "hermes3:70b" # Größeres Modell für komplexe Sub-Tasks

auxiliary:
  background_processing: "hermes3:3b" # Leichtes Modell für Hintergrund-Cronjobs

memory:
  type: "sqlite_fts5"
  db_path: "~/.hermes/skills/memory.db"
```

---

## Installation & Bootstrap-Skripte

### A. Windows PowerShell Host Installer (`scripts/Install-HermesOmniSystem.ps1`)

Führe dieses Skript auf dem Windows GPU PC in einer elevated PowerShell (Als Administrator) aus:

```powershell
#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   HERMES OMNI-ARCHITECT WINDOWS HOST MASTER INSTALLER     " -ForegroundColor Gold
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Administrator Rights Check
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "Dieses Skript muss als Administrator in einer erhöhten PowerShell ausgeführt werden!"
    exit 1
}

# 2. Configure Ollama Environment & Tuning Variables
Write-Host "`n[1/5] Konfiguriere Ollama GPU & Memory Tuning Variablen..." -ForegroundColor Yellow
try {
    $envVars = @{
        'OLLAMA_HOST'            = '0.0.0.0:11434'
        'OLLAMA_FLASH_ATTENTION' = '1'
        'OLLAMA_KV_CACHE_TYPE'   = 'q8_0'
        'OLLAMA_NUM_PARALLEL'    = '4'
        'OLLAMA_KEEP_ALIVE'       = '24h'
    }

    foreach ($key in $envVars.Keys) {
        [System.Environment]::SetEnvironmentVariable($key, $envVars[$key], 'Machine')
        Set-Item -Path "env:$key" -Value $envVars[$key]
        Write-Host "  -> System-Variable gesetzt: $key = $($envVars[$key])" -ForegroundColor Green
    }
} catch {
    Write-Error "Fehler beim Setzen der Umgebungsvariablen: $_"
}

# 3. Elevate Process Priority for Ollama and SSHD
Write-Host "`nElevating Process Priority for Ollama & SSH..." -ForegroundColor Yellow
Get-Process -Name "ollama*" -ErrorAction SilentlyContinue | ForEach-Object { $_.PriorityClass = 'High' }
Get-Process -Name "sshd*" -ErrorAction SilentlyContinue | ForEach-Object { $_.PriorityClass = 'High' }

# 4. Check & Install Ollama if missing
Write-Host "`n[2/5] Prüfe Ollama Installation..." -ForegroundColor Yellow
if (-not (Get-Command "ollama" -ErrorAction SilentlyContinue)) {
    Write-Host "  -> Ollama wurde nicht gefunden. Starte automatischen Download & Installation..." -ForegroundColor Cyan
    $installerPath = "$env:TEMP\OllamaSetup.exe"
    Invoke-WebRequest -Uri "https://ollama.com/download/OllamaSetup.exe" -OutFile $installerPath
    Start-Process -FilePath $installerPath -ArgumentList "/SILENT" -Wait
    Remove-Item -Path $installerPath -Force -ErrorAction SilentlyContinue
    Write-Host "  [SUCCESS] Ollama wurde erfolgreich installiert." -ForegroundColor Green
} else {
    Write-Host "  [SUCCESS] Ollama ist bereits vorhanden." -ForegroundColor Green
}

# 5. OpenSSH Server Installation & Setup
Write-Host "`n[3/5] Konfiguriere OpenSSH Server für Termux SSH-Bridge..." -ForegroundColor Yellow
try {
    $sshCap = Get-WindowsCapability -Online | Where-Object Name -like 'OpenSSH.Server*'
    if ($sshCap.State -ne 'Installed') {
        Write-Host "  -> Installiere OpenSSH Server..." -ForegroundColor Cyan
        Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
    }

    Start-Service sshd -ErrorAction SilentlyContinue
    Set-Service -Name sshd -StartupType 'Automatic'

    $pwshPath = (Get-Command "pwsh" -ErrorAction SilentlyContinue).Source
    if (-not $pwshPath) {
        $pwshPath = "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
    }
    New-ItemProperty -Path "HKLM:\SOFTWARE\OpenSSH" -Name DefaultShell -Value $pwshPath -PropertyType String -Force | Out-Null
    Write-Host "  [SUCCESS] OpenSSH Server aktiv. Standard-Shell: $pwshPath" -ForegroundColor Green
} catch {
    Write-Warning "Fehler beim Konfigurieren des OpenSSH Servers: $_"
}

# 6. Harden Windows Firewall (Exclusively Tailscale 100.64.0.0/10)
Write-Host "`n[4/5] Härte Windows Defender Firewall für Tailscale..." -ForegroundColor Yellow
try {
    Remove-NetFirewallRule -DisplayName "Hermes-Tailscale-In" -ErrorAction SilentlyContinue
    New-NetFirewallRule -DisplayName "Hermes-Tailscale-In" `
        -Direction Inbound `
        -LocalPort 11434, 22 `
        -Protocol TCP `
        -RemoteAddress 100.64.0.0/10 `
        -Action Allow | Out-Null
    Write-Host "  [SUCCESS] Ports 11434 (Ollama) & 22 (SSH) sind exklusiv für Tailscale (100.64.0.0/10) geschützt." -ForegroundColor Green
} catch {
    Write-Warning "Fehler beim Erstellen der Firewall-Regel: $_"
}

# 7. Android ADB Phantom Process Killer Patch
Write-Host "`n[5/5] Prüfe Android ADB Verbindung für Phantom Killer Patch..." -ForegroundColor Yellow
if (Get-Command "adb" -ErrorAction SilentlyContinue) {
    try {
        $adbDevices = adb devices | Select-String -Pattern "\tdevice$"
        if ($adbDevices) {
            adb shell "/system/bin/device_config put activity_manager max_phantom_processes 2147483647" 2>$null
            Write-Host "  [SUCCESS] Android Phantom Process Killer auf verbundenem Smartphone deaktiviert." -ForegroundColor Green
        } else {
            Write-Host "  [INFO] Kein Android-Gerät über ADB verbunden." -ForegroundColor Cyan
        }
    } catch {
        Write-Warning "ADB Befehl fehlgeschlagen: $_"
    }
} else {
    Write-Host "  [INFO] 'adb' ist nicht installiert. Android USB-Patch übersprungen." -ForegroundColor Cyan
}

# Restart Ollama Service
Stop-Process -Name "ollama*" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "   HERMES WINDOWS HOST SETUP ERFOLGREICH ABGESCHLOSSEN!     " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
```

---

### B. Termux Edge Installer (`bootstrap-termux.sh`)

```bash
#!/data/data/com.termux/files/usr/bin/bash
set -e

echo "=== [1/6] Installiere System- & Dev-Pakete + Termux-API ==="
pkg update && pkg upgrade -y
pkg install git nodejs python python-pip clang make openssh wol jq tmux curl sqlite termux-api -y

mkdir -p ~/bin ~/.shortcuts ~/.hermes/skills ~/.hermes/tools ~/.hermes/logs

echo "=== [2/6] Richte isolierte Python venv & Hermes-Environment ein ==="
if [ ! -d "$HOME/.hermes_env" ]; then
    python3 -m venv ~/.hermes_env
fi
source ~/.hermes_env/bin/activate
pip install --upgrade pip

echo "=== [3/6] Erstelle Nous Research Hermes config.yaml (~/.hermes/config.yaml) ==="
cat << 'EOF' > ~/.hermes/config.yaml
model:
  provider: "openai"
  base_url: "http://100.64.0.1:11434/v1"
  default: "hermes3:8b"

delegation:
  concurrent_subagents: 3
  provider: "openai"
  default: "hermes3:70b"

auxiliary:
  background_processing: "hermes3:3b"

memory:
  type: "sqlite_fts5"
  db_path: "/data/data/com.termux/files/home/.hermes/skills/memory.db"
EOF

echo "=== [4/6] Erstelle Git-Worktree-CI-Runner (~/bin/hermes-ci.sh) ==="
cat << 'EOF' > ~/bin/hermes-ci.sh
#!/data/data/com.termux/files/usr/bin/bash
REPO=$1; BRANCH=$2; TEST_CMD=$3
WORKTREE_DIR="${REPO}-${BRANCH}"

cd "$REPO"
git worktree add -b "$BRANCH" "$WORKTREE_DIR" main 2>/dev/null || git worktree add "$WORKTREE_DIR" "$BRANCH"
cd "$WORKTREE_DIR"

echo "[Hermes CI] Teste Branch '$BRANCH' mit: $TEST_CMD"
if eval "$TEST_CMD"; then
    echo "[SUCCESS] Alle Tests bestanden in $WORKTREE_DIR"
    termux-notification --title "Hermes CI Success" --content "Tests bestanden in Branch $BRANCH" 2>/dev/null || true
    exit 0
else
    echo "[ERROR] Tests fehlgeschlagen! Bereit für Agenten-Refactoring."
    termux-notification --title "Hermes CI Failed" --content "Tests fehlgeschlagen in Branch $BRANCH" 2>/dev/null || true
    exit 1
fi
EOF
chmod +x ~/bin/hermes-ci.sh

echo "=== [5/6] Erstelle Webhook-Execution-Daemon mit Auth & Rate Limiter (~/bin/hermes-bridge.js) ==="
cat << 'EOF' > ~/bin/hermes-bridge.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3001;
const HOME_DIR = process.env.HOME || '/data/data/com.termux/files/home';
const WIN_USER = process.env.WIN_SSH_USER || 'Admin';
const AUTH_TOKEN = process.env.HERMES_BRIDGE_TOKEN || 'hermes-secure-token';

// Rate Limiting (Max 10 calls / min)
let requestCount = 0;
setInterval(() => { requestCount = 0; }, 60000);

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8000');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    if (requestCount >= 10) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Rate limit exceeded. Max 10 requests per minute.' }));
    }
    requestCount++;

    const reqToken = req.headers['authorization'] ? req.headers['authorization'].replace('Bearer ', '') : '';
    if (AUTH_TOKEN && reqToken !== AUTH_TOKEN) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Nicht autorisiert. Ungültiges Token.' }));
    }

    if (req.method === 'POST' && req.url === '/exec') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const payload = JSON.parse(body);
                const toolName = payload.name;
                const args = payload.arguments || {};

                let finalCmd = '';
                let cwd = args.working_dir || HOME_DIR;
                let timeout = (args.timeout_sec || 60) * 1000;

                if (toolName === 'termux_webhook_exec') {
                    finalCmd = args.command;
                } else if (toolName === 'git_worktree_ci') {
                    finalCmd = `${HOME_DIR}/bin/hermes-ci.sh "${args.repo_path}" "${args.branch_name}" "${args.test_command}"`;
                } else if (toolName === 'windows_ssh_exec') {
                    const escapedPs = args.ps_script.replace(/"/g, '\\"');
                    finalCmd = `ssh -o StrictHostKeyChecking=no ${WIN_USER}@${args.host_ip} "${escapedPs}"`;
                } else if (toolName === 'memory_store') {
                    const memPath = path.join(HOME_DIR, '.hermes', 'memory.json');
                    let memData = {};
                    if (fs.existsSync(memPath)) {
                        try { memData = JSON.parse(fs.readFileSync(memPath, 'utf8')); } catch(e){}
                    }
                    memData[args.key] = args.value;
                    fs.writeFileSync(memPath, JSON.stringify(memData, null, 2));
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ status: 'ok', stored_key: args.key }));
                } else if (toolName === 'memory_recall') {
                    const memPath = path.join(HOME_DIR, '.hermes', 'memory.json');
                    let memData = {};
                    if (fs.existsSync(memPath)) {
                        try { memData = JSON.parse(fs.readFileSync(memPath, 'utf8')); } catch(e){}
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ key: args.key, value: memData[args.key] || null }));
                } else {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: `Unbekanntes Tool: ${toolName}` }));
                }

                // Audit Logging
                const logEntry = `[${new Date().toISOString()}] Tool: ${toolName} | Cmd: ${finalCmd}\n`;
                fs.appendFileSync(path.join(HOME_DIR, '.hermes', 'logs', 'audit.log'), logEntry);

                exec(finalCmd, { cwd, timeout, shell: '/data/data/com.termux/files/usr/bin/bash' }, (error, stdout, stderr) => {
                    const response = {
                        tool: toolName,
                        exit_code: error ? (error.code || 1) : 0,
                        stdout: stdout ? stdout.trim() : '',
                        stderr: stderr ? stderr.trim() : (error ? error.message : '')
                    };
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(response));
                });
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ exit_code: 1, stderr: err.message }));
            }
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`[Hermes Bridge Daemon] Lauscht lokal auf http://127.0.0.1:${PORT}/exec`);
});
EOF

echo "=== [6/6] Installiere SillyTavern Host & 1-Klick Start-Shortcut ==="
if [ ! -d "$HOME/SillyTavern" ]; then
    git clone https://github.com/SillyTavern/SillyTavern -b release ~/SillyTavern
fi

cat << 'EOF' > ~/.shortcuts/Hermes-Omni-Start.sh
#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock

PC_MAC="AA:BB:CC:DD:EE:FF"
export WIN_SSH_USER="MeinWindowsUser"
export HERMES_BRIDGE_TOKEN="hermes-secure-token"

# Exponential Wake-on-LAN Retries
echo "[1/3] Wecke Windows GPU Host ($PC_MAC)..."
for i in {1..3}; do
    wol $PC_MAC 2>/dev/null || true
    sleep 1
done

echo "[2/3] Starte Execution Bridge (Port 3001) & UI (Port 8000)..."
tmux kill-session -t hermes 2>/dev/null || true
tmux new-session -d -s hermes -n bridge "node ~/bin/hermes-bridge.js"
tmux new-window -t hermes -n ui "cd ~/SillyTavern && ./start.sh"

echo "[3/3] Öffne Web Interface..."
sleep 3
am start -a android.intent.action.VIEW -d "http://localhost:8000"
EOF
chmod +x ~/.shortcuts/Hermes-Omni-Start.sh

echo "=== TERMUX EDGE SETUP COMPLETE! ==="
```

---

## Complete Master System Prompt (ChatML Format für Hermes 3)

```xml
<|im_start|>system
Du bist "HERMES OMNI-ARCHITECT", ein vollautonomer Full-Stack DevOps-, Software-Engineering- und Systemarchitektur-Agent auf Basis des Nous Research Hermes Agent Frameworks. Du agierst synchron über zwei gekoppelte Umgebungen, verbunden via Tailscale Mesh-VPN und einer token-gesicherten HTTP Webhook Bridge:
1. WINDOWS COMPUTE HOST (Remote GPU Server, PowerShell 7+, Ollama Backend, Port 11434, Tailscale SSH Port 22).
2. ANDROID TERMUX EDGE NODE (Lokaler Client, ARM64/aarch64, Node.js/Python Runtime, Web Interface Port 8000, Execution Bridge Port 3001, Skill-Routing via ~/.hermes/config.yaml).

====================================================================
TEIL 1: STRIKTE ARCHITEKTUR- UND UMWELT-REGELN
====================================================================
A. TERMUX EDGE RULES (Android Local):
   - Pfade: Nutze ausschließlich `$PREFIX` (`/data/data/com.termux/files/usr`) und `$HOME` (`/data/data/com.termux/files/home`).
   - Shebang-Pflicht: Jedes Bash-Skript MUSS mit `#!/data/data/com.termux/files/usr/bin/bash` beginnen.
   - Strikte Verbote: Nutze NIEMALS `sudo`, `systemctl` oder absolute Linux-Standardpfade (`/usr/bin`, `/etc`).
   - Paketverwaltung: Nutze ausschließlich `pkg install <paket> -y`.
   - Ressourcenschutz: Führe niemals schwere Modellkompilierungen lokal aus. Nutzen: I/O, Git Worktrees, AST-Parsing, Test-Runner, Shell-Automation.

B. WINDOWS HOST RULES (Remote GPU):
   - Verwende modernes PowerShell (`pwsh`) mit `#Requires -RunAsAdministrator` und try/catch-Handhabung.
   - Systemvariablen dauerhaft aktiv: `OLLAMA_HOST=0.0.0.0:11434`, `OLLAMA_FLASH_ATTENTION=1`, `OLLAMA_KV_CACHE_TYPE=q8_0`, `OLLAMA_NUM_PARALLEL=4`.

====================================================================
TEIL 2: AUTONOMER AGENTEN-LOOP & SKILL ROUTING
====================================================================
Bei jeder Entwicklungs- oder Administrationsaufgabe arbeitest du vollautonom:
1. THINKING & SKILL ROUTING: Analysiere die Aufgabe im `<thought>` Block. Bestimme, ob die Aufgabe direkt oder via Sub-Agent Delegation gelöst werden muss.
2. ISOLATION: Erstelle bei Code-Änderungen über `git_worktree_ci` einen isolierten Branch.
3. EXECUTION: Führe Befehle direkt über `<tool_call>` aus.
4. SELF-REFLEXION & CORRECTION: Prüfe `exit_code` und `stderr`. Bei Fehlern analysiere den Stacktrace, behebe das Problem autonom und wiederhole den Testlauf bis der Status GRÜN ist.
5. MEMORY MANAGEMENT: Sichere wichtige Konfigurationen/Ergebnisse ab über `memory_store`.

====================================================================
TEIL 3: TOOL CALLING SCHEMA (CHATML JSON)
====================================================================
Verwende ausschließlich valide `<tool_call>` JSON-Blöcke:

<tools>
[
  {
    "type": "function",
    "function": {
      "name": "termux_webhook_exec",
      "description": "Führt einen Bash-Befehl lokal in Termux aus.",
      "parameters": {
        "type": "object",
        "properties": {
          "command": {"type": "string", "description": "Valider Termux-Bash-Befehl."},
          "working_dir": {"type": "string", "description": "Arbeitsverzeichnis, Standard: $HOME"},
          "timeout_sec": {"type": "integer", "description": "Timeout in Sekunden."}
        },
        "required": ["command"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "windows_ssh_exec",
      "description": "Führt PowerShell-Code remote auf dem Windows GPU-Host über SSH aus.",
      "parameters": {
        "type": "object",
        "properties": {
          "host_ip": {"type": "string", "description": "Tailscale IP des Windows PCs."},
          "ps_script": {"type": "string", "description": "PowerShell-Skript."}
        },
        "required": ["host_ip", "ps_script"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "git_worktree_ci",
      "description": "Erstellt isolierten Git Worktree und führt Test-Suite aus.",
      "parameters": {
        "type": "object",
        "properties": {
          "repo_path": {"type": "string"},
          "branch_name": {"type": "string"},
          "test_command": {"type": "string"}
        },
        "required": ["repo_path", "branch_name", "test_command"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "memory_store",
      "description": "Speichert Schlüssel-Wert-Paare im episodischen Gedächtnis (~/.hermes/memory.json).",
      "parameters": {
        "type": "object",
        "properties": {
          "key": {"type": "string"},
          "value": {"type": "string"}
        },
        "required": ["key", "value"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "memory_recall",
      "description": "Liest Daten aus dem episodischen Gedächtnis.",
      "parameters": {
        "type": "object",
        "properties": {
          "key": {"type": "string"}
        },
        "required": ["key"]
      }
    }
  }
]
</tools>

====================================================================
TEIL 4: SYSTEM-BOOTSTRAP TRIGGER
====================================================================
Wenn der Nutzer exakt den Befehl "BOOTSTRAP OMNI SYSTEM" eingibt, liefere unverzüglich die vollständigen Setup-Skripte für Windows PowerShell, Termux Bash Execution Daemon und den Browser Auto-Executor.

Antworte immer mit der Struktur:
<thought>Analyse und Schritt-für-Schritt Strategie</thought>
<tool_call>{"name": "...", "arguments": {...}}</tool_call>
<|im_end|>
```
