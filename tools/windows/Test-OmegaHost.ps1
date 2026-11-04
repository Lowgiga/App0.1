#Requires -Version 5.1
<#
.SYNOPSIS
    Read-only audit of an OMEGA Windows host: Ollama exposure, SSH exposure, Hermes approvals, ADB transports.

.DESCRIPTION
    Changes nothing on the system. Every check only reads configuration or state and reports
    OK, WARN, FAIL or INFO. The exit code is the number of FAIL findings (0 = no blocking finding).
    Checks that need Windows-only cmdlets (NetTCPIP, NetSecurity) report INFO when unavailable.
    Background: docs/33-hermes-sicher-einrichten.md (findings from PR #15).

.PARAMETER HermesConfigPath
    Optional explicit path to the Hermes config.yaml. Default: $HOME\.hermes\config.yaml.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\windows\Test-OmegaHost.ps1
#>
[CmdletBinding()]
param(
    [string]$HermesConfigPath = (Join-Path -Path $HOME -ChildPath '.hermes/config.yaml')
)

Set-StrictMode -Version 3.0
$ErrorActionPreference = 'Stop'
$findings = New-Object -TypeName 'System.Collections.Generic.List[object]'

function Add-Finding {
    param(
        [Parameter(Mandatory)][ValidateSet('OK', 'WARN', 'FAIL', 'INFO')][string]$Status,
        [Parameter(Mandatory)][string]$Check,
        [Parameter(Mandatory)][string]$Detail
    )
    $findings.Add([pscustomobject]@{ Status = $Status; Check = $Check; Detail = $Detail })
}

function Test-AllInterfacesAddress {
    param([string]$Address)
    return ($Address -match '^(0\.0\.0\.0|::|\[::\]|\*)$')
}

# 1. Ollama: configured bind address. Ollama has no built-in authentication.
$ollamaHost = $null
foreach ($scope in 'Process', 'User', 'Machine') {
    $value = [Environment]::GetEnvironmentVariable('OLLAMA_HOST', $scope)
    if ($value) { $ollamaHost = $value; break }
}
if (-not $ollamaHost) {
    Add-Finding -Status OK -Check 'Ollama OLLAMA_HOST' -Detail 'nicht gesetzt: Standard 127.0.0.1:11434'
} else {
    $hostPart = ($ollamaHost -replace '^https?://', '') -replace ':\d+$', ''
    if (Test-AllInterfacesAddress -Address $hostPart) {
        Add-Finding -Status FAIL -Check 'Ollama OLLAMA_HOST' -Detail "$ollamaHost lauscht auf allen Schnittstellen (keine Authentifizierung)"
    } else {
        Add-Finding -Status OK -Check 'Ollama OLLAMA_HOST' -Detail "$ollamaHost"
    }
}

# 2. Ollama: actual listener on port 11434 (Windows NetTCPIP module).
if (Get-Command -Name Get-NetTCPConnection -ErrorAction SilentlyContinue) {
    $listeners = @(Get-NetTCPConnection -LocalPort 11434 -State Listen -ErrorAction SilentlyContinue)
    if ($listeners.Count -eq 0) {
        Add-Finding -Status INFO -Check 'Ollama Port 11434' -Detail 'kein Listener (Ollama laeuft nicht)'
    }
    foreach ($listener in $listeners) {
        if (Test-AllInterfacesAddress -Address $listener.LocalAddress) {
            Add-Finding -Status FAIL -Check 'Ollama Port 11434' -Detail "lauscht auf $($listener.LocalAddress)"
        } else {
            Add-Finding -Status OK -Check 'Ollama Port 11434' -Detail "lauscht auf $($listener.LocalAddress)"
        }
    }
} else {
    Add-Finding -Status INFO -Check 'Ollama Port 11434' -Detail 'Get-NetTCPConnection nicht verfuegbar (kein Windows)'
}

# 3. Firewall: default OpenSSH rule created by the OpenSSH Server installation.
if (Get-Command -Name Get-NetFirewallRule -ErrorAction SilentlyContinue) {
    $sshRule = Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -ErrorAction SilentlyContinue
    if (-not $sshRule) {
        Add-Finding -Status INFO -Check 'Firewall OpenSSH-Server-In-TCP' -Detail 'Regel nicht vorhanden'
    } elseif ("$($sshRule.Enabled)" -eq 'True') {
        $remote = (($sshRule | Get-NetFirewallAddressFilter).RemoteAddress) -join ','
        Add-Finding -Status WARN -Check 'Firewall OpenSSH-Server-In-TCP' -Detail "aktiv; Profile=$($sshRule.Profile); RemoteAddress=$remote"
    } else {
        Add-Finding -Status OK -Check 'Firewall OpenSSH-Server-In-TCP' -Detail 'deaktiviert'
    }
} else {
    Add-Finding -Status INFO -Check 'Firewall OpenSSH-Server-In-TCP' -Detail 'Get-NetFirewallRule nicht verfuegbar (kein Windows)'
}

# 4. OpenSSH server: password authentication.
$sshdConfig = if ($env:ProgramData) { Join-Path -Path $env:ProgramData -ChildPath 'ssh/sshd_config' } else { $null }
if ($sshdConfig -and (Test-Path -LiteralPath $sshdConfig)) {
    $lines = @(Select-String -LiteralPath $sshdConfig -Pattern '^\s*PasswordAuthentication\s+(\S+)')
    if ($lines.Count -gt 0 -and $lines[0].Matches[0].Groups[1].Value -eq 'no') {
        Add-Finding -Status OK -Check 'sshd PasswordAuthentication' -Detail 'no'
    } else {
        Add-Finding -Status WARN -Check 'sshd PasswordAuthentication' -Detail 'nicht ausdruecklich auf no gesetzt'
    }
} else {
    Add-Finding -Status INFO -Check 'sshd PasswordAuthentication' -Detail 'sshd_config nicht gefunden'
}

# 5. Hermes Agent: approval mode must not be off (equivalent to --yolo).
if (Test-Path -LiteralPath $HermesConfigPath) {
    $inApprovals = $false
    $mode = $null
    foreach ($line in Get-Content -LiteralPath $HermesConfigPath) {
        if ($line -match '^approvals:\s*$') { $inApprovals = $true; continue }
        if ($inApprovals -and $line -match '^\S') { break }
        if ($inApprovals -and $line -match '^\s+mode:\s*["'']?(\w+)') { $mode = $Matches[1]; break }
    }
    switch ($mode) {
        'manual' { Add-Finding -Status OK -Check 'Hermes approvals.mode' -Detail 'manual' }
        'smart'  { Add-Finding -Status WARN -Check 'Hermes approvals.mode' -Detail 'smart: Freigabe durch ein Hilfsmodell, fuer OMEGA manual empfohlen' }
        'off'    { Add-Finding -Status FAIL -Check 'Hermes approvals.mode' -Detail 'off: entspricht --yolo, keine Freigaben' }
        default  { Add-Finding -Status INFO -Check 'Hermes approvals.mode' -Detail 'nicht gesetzt: Standard der installierten Version pruefen' }
    }
} else {
    Add-Finding -Status INFO -Check 'Hermes approvals.mode' -Detail "keine Konfiguration unter $HermesConfigPath"
}

# 6. ADB: several transports at once make every 'adb shell' without -s fail.
$adb = Get-Command -Name adb -ErrorAction SilentlyContinue
if ($adb) {
    $devices = @(& $adb.Source devices | Select-String -Pattern "`tdevice$")
    if ($devices.Count -gt 1) {
        Add-Finding -Status WARN -Check 'ADB Geraete' -Detail "$($devices.Count) Transporte aktiv: Befehle immer mit -s <Seriennummer>"
    } else {
        Add-Finding -Status OK -Check 'ADB Geraete' -Detail "$($devices.Count) Transport(e)"
    }
} else {
    Add-Finding -Status INFO -Check 'ADB Geraete' -Detail 'adb nicht im PATH'
}

$findings | Format-Table -AutoSize -Wrap | Out-String -Width 200 | Write-Output
$failCount = @($findings | Where-Object { $_.Status -eq 'FAIL' }).Count
Write-Output ("{0} FAIL, {1} WARN" -f $failCount, @($findings | Where-Object { $_.Status -eq 'WARN' }).Count)
exit $failCount
