<#
.SYNOPSIS
    OMEGA Plug & Play (Windows-Knoten): Handy per mDNS finden, adb verbinden, scrcpy starten.

.DESCRIPTION
    Gegenstueck zum Tasker-Profil "OMEGA Plug" (docs/34-tasker-bruecke.md). Das Handy schaltet
    beim Einstecken WLAN und kabelloses Debugging ein; dieses Skript wartet auf den mDNS-Dienst
    _adb-tls-connect._tcp, verbindet adb und startet scrcpy.

    Vertrauensbasis ist das einmalige ADB-TLS-Pairing (adb pair IP:PORT CODE), nicht das Netz:
    ein ungekoppeltes Geraet erreicht nie den Zustand "device". Mit -AllowedDevice laesst sich
    die Auswahl zusaetzlich auf bekannte mDNS-Instanznamen beschraenken.

    Das Skript aendert keine Systemeinstellungen. Exitcodes: 0 ok, 2 kein Geraet, 3 connect
    fehlgeschlagen, 4 nicht gekoppelt/autorisiert, 5 Werkzeug fehlt.

.EXAMPLE
    .\Start-OmegaLink.ps1 -AllowedDevice 'adb-R5CX12345-AbCdEf'
#>
[CmdletBinding()]
param(
    [string]$AdbPath = 'adb',
    [string]$ScrcpyPath = 'scrcpy',
    [ValidateRange(5, 900)]
    [int]$TimeoutSec = 120,
    [string[]]$AllowedDevice = @(),
    [string[]]$ScrcpyArgument = @('--stay-awake', '--turn-screen-off'),
    [switch]$NoScrcpy
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-OmegaTool {
    param([Parameter(Mandatory)][string]$Name)
    $cmd = Get-Command -Name $Name -ErrorAction SilentlyContinue
    if ($null -eq $cmd) {
        Write-Warning ("Werkzeug nicht gefunden: {0} (PATH pruefen oder -AdbPath/-ScrcpyPath setzen)" -f $Name)
        exit 5
    }
    return $cmd.Source
}

function Get-OmegaAdbService {
    param([Parameter(Mandatory)][string]$Adb)
    $lines = & $Adb mdns services 2>$null
    foreach ($line in @($lines)) {
        # Format: <instanz> <TAB> _adb-tls-connect._tcp <TAB> <ip>:<port>
        if ($line -match '^(?<name>\S+)\s+_adb-tls-connect\._tcp\.?\s+(?<addr>[0-9A-Fa-f\.:\[\]]+:\d{1,5})\s*$') {
            [pscustomobject]@{ Name = $Matches['name']; Address = $Matches['addr'] }
        }
    }
}

$adb = Resolve-OmegaTool -Name $AdbPath
& $adb start-server | Out-Null

$deadline = (Get-Date).AddSeconds($TimeoutSec)
$target = $null
Write-Output ("Warte bis zu {0} s auf kabelloses Debugging (mDNS)..." -f $TimeoutSec)
while ($null -eq $target -and (Get-Date) -lt $deadline) {
    $services = @(Get-OmegaAdbService -Adb $adb)
    if ($AllowedDevice.Count -gt 0) {
        $services = @($services | Where-Object { $AllowedDevice -contains $_.Name })
    }
    if ($services.Count -gt 0) {
        $target = $services[0]
    }
    else {
        Start-Sleep -Seconds 2
    }
}

if ($null -eq $target) {
    Write-Warning 'Kein Geraet gefunden. Handy entsperrt? WLAN gleich? Kabelloses Debugging an?'
    exit 2
}

Write-Output ("Gefunden: {0} @ {1}" -f $target.Name, $target.Address)
$connect = (& $adb connect $target.Address 2>&1 | Out-String).Trim()
if ($connect -notmatch 'connected to|already connected') {
    Write-Warning ("adb connect fehlgeschlagen: {0}" -f $connect)
    exit 3
}

$state = (& $adb -s $target.Address get-state 2>&1 | Out-String).Trim()
if ($state -ne 'device') {
    Write-Warning ("Geraetestatus '{0}'. Einmalig koppeln: Entwickleroptionen > Kabelloses Debugging > Mit Kopplungscode koppeln, dann: adb pair IP:PORT CODE" -f $state)
    exit 4
}

Write-Output ("adb verbunden: {0}" -f $target.Address)
if ($NoScrcpy) {
    exit 0
}

$scrcpy = Resolve-OmegaTool -Name $ScrcpyPath
& $scrcpy --serial $target.Address @ScrcpyArgument
exit $LASTEXITCODE
