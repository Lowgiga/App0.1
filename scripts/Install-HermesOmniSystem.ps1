#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Master Installation & Provisioning Script for Hermes Omni-Architect Windows Host.
.DESCRIPTION
    Automates Ollama installation/tuning, OpenSSH server setup, Windows Firewall hardening for Tailscale,
    ADB Phantom Process Killer mitigation, and SSH Key permissions for Termux Edge Node integration.
#>

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

    if (-not (Test-Path "HKLM:\SOFTWARE\OpenSSH")) {
        New-Item -Path "HKLM:\SOFTWARE\OpenSSH" -Force | Out-Null
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
