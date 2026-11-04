#!/usr/bin/env python3
"""Read-only audit of an OMEGA Windows host (replaces Test-OmegaHost.ps1).

Requirements come from docs/33-hermes-sicher-einrichten.md:
  * Ollama listens on loopback only (it has no authentication).
  * Inbound SSH (TCP 22) is allowed only on the Tailscale interface; an address filter on
    100.64.0.0/10 is not enough (general carrier-grade NAT range).
  * sshd: PasswordAuthentication no (also inside Match blocks).
  * Hermes Agent: approvals.mode manual; cron_mode, single_query_mode, unattended_mode deny;
    no HERMES_YOLO_MODE. Keys and defaults verified against
    https://hermes-agent.nousresearch.com/docs/user-guide/security (2026-11-04).

The audit changes nothing. The analysis functions are pure and unit-tested; only the
collectors call Windows tools (PowerShell, sshd, adb) with fixed argument lists and no shell.
Exit code = number of FAIL findings. Standard library only, Python 3.10+.

Usage: python tools/windows/omega_host_audit.py [--hermes-config PATH] [--json]
"""

from __future__ import annotations

import argparse
import ipaddress
import json
import os
import re
import shutil
import subprocess
import sys
from collections.abc import Callable, Iterable
from dataclasses import asdict, dataclass, field
from pathlib import Path

OK, WARN, FAIL, INFO = 'OK', 'WARN', 'FAIL', 'INFO'
TAILSCALE_ALIAS = 'tailscale'
SSH_PORT = 22
HERMES_HEADLESS_KEYS = ('cron_mode', 'single_query_mode', 'unattended_mode')


@dataclass(frozen=True)
class Finding:
    status: str
    check: str
    detail: str


# --------------------------------------------------------------------------- analysis (pure)


def is_loopback(host: str) -> bool:
    """True only for provable loopback hosts; other names are treated as reachable."""
    host = host.strip().strip('[]').lower()
    if host == 'localhost':
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def ollama_bind_host(value: str) -> str:
    """Extract the host part of an OLLAMA_HOST value ('' means all interfaces, as in Go)."""
    text = re.sub(r'^[a-z][a-z0-9+.-]*://', '', value.strip(), flags=re.I).rstrip('/')
    if text.startswith('['):
        return text[1 : text.index(']')] if ']' in text else text[1:]
    if text.count(':') == 1:
        host, port = text.split(':')
        return host if port.isdigit() or port == '' else text
    return text


def analyze_ollama_env(value: str | None) -> Finding:
    check = 'Ollama OLLAMA_HOST'
    if not value:
        return Finding(OK, check, 'nicht gesetzt: Standard 127.0.0.1:11434')
    host = ollama_bind_host(value)
    if host and is_loopback(host):
        return Finding(OK, check, value)
    reach = 'alle Schnittstellen' if host in ('', '0.0.0.0', '::', '*') else f'nicht Loopback ({host})'  # noqa: S104
    return Finding(FAIL, check, f'{value}: {reach}, ohne Authentifizierung erreichbar')


def analyze_ollama_listeners(listeners: list[dict] | None, running: bool) -> list[Finding]:
    """listeners: sockets owned by Ollama processes (any port), each with LocalAddress/LocalPort."""
    check = 'Ollama Listener'
    if listeners is None:
        return [Finding(INFO, check, 'nicht ermittelbar (kein Windows oder keine Berechtigung)')]
    if not listeners:
        return [Finding(INFO, check, 'Ollama laeuft, aber ohne Listener' if running else 'Ollama laeuft nicht')]
    findings = []
    for item in listeners:
        address, port = str(item.get('LocalAddress', '')), item.get('LocalPort')
        status = OK if is_loopback(address) else FAIL
        findings.append(Finding(status, check, f'lauscht auf {address}:{port}'))
    return findings


def _as_list(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        return [str(item) for item in value]
    return [str(value)]


def _port_matches(spec: str, port: int) -> bool:
    spec = spec.strip()
    if spec.lower() == 'any':
        return True
    if re.fullmatch(r'\d+', spec):
        return int(spec) == port
    match = re.fullmatch(r'(\d+)-(\d+)', spec)
    return bool(match) and int(match.group(1)) <= port <= int(match.group(2))


def rule_allows_tcp_port(rule: dict, port: int) -> bool:
    protocol = str(rule.get('Protocol', 'Any')).upper()
    if protocol not in ('TCP', 'ANY', '6'):
        return False
    return any(_port_matches(spec, port) for spec in _as_list(rule.get('LocalPort', 'Any')))


def rule_limited_to_tailscale_interface(rule: dict) -> bool:
    aliases = [alias.lower() for alias in _as_list(rule.get('InterfaceAlias', 'Any'))]
    return bool(aliases) and all(alias == TAILSCALE_ALIAS for alias in aliases)


def analyze_ssh_firewall(rules: list[dict] | None) -> list[Finding]:
    """rules: enabled inbound allow rules with Protocol, LocalPort, RemoteAddress, InterfaceAlias."""
    check = 'Firewall SSH (TCP 22)'
    if rules is None:
        return [Finding(INFO, check, 'nicht ermittelbar (kein Windows oder keine Berechtigung)')]
    ssh_rules = [rule for rule in rules if rule_allows_tcp_port(rule, SSH_PORT)]
    if not ssh_rules:
        return [Finding(OK, check, 'keine aktive Eingangsregel fuer TCP 22')]
    findings = []
    for rule in ssh_rules:
        name = rule.get('DisplayName') or rule.get('Name') or '?'
        remote = ','.join(_as_list(rule.get('RemoteAddress', 'Any'))) or 'Any'
        if rule_limited_to_tailscale_interface(rule):
            findings.append(Finding(OK, check, f'{name}: nur Schnittstelle Tailscale'))
        else:
            aliases = ','.join(_as_list(rule.get('InterfaceAlias', 'Any'))) or 'Any'
            detail = f'{name}: Schnittstelle {aliases}, RemoteAddress {remote} (nicht auf Tailscale beschraenkt)'
            findings.append(Finding(FAIL, check, detail))
    return findings


@dataclass(frozen=True)
class SshdPasswordSettings:
    global_value: str | None
    match_values: tuple[tuple[str, str], ...]
    has_includes: bool


def parse_sshd_password_settings(config_text: str) -> SshdPasswordSettings:
    """Global PasswordAuthentication (first value wins, as in sshd) and every Match-block override."""
    global_value, includes = None, False
    match_values: list[tuple[str, str]] = []
    current_match: str | None = None
    for raw in config_text.splitlines():
        # Keyword and argument are separated by whitespace or by an optional '='.
        parsed = re.match(r'^(\S+?)(?:\s*=\s*|\s+)(.*)$', raw.split('#', 1)[0].strip())
        if not parsed:
            continue
        keyword, rest = parsed.group(1).lower(), parsed.group(2).strip().strip('"')
        if keyword == 'match':
            current_match = rest
        elif keyword == 'include':
            includes = True
        elif keyword == 'passwordauthentication' and current_match is not None:
            match_values.append((current_match, rest.lower()))
        elif keyword == 'passwordauthentication' and global_value is None:
            global_value = rest.lower()
    return SshdPasswordSettings(global_value, tuple(match_values), includes)


def _sshd_effective_finding(check: str, effective: str) -> Finding:
    match = re.search(r'^passwordauthentication\s+(\S+)', effective, re.M | re.I)
    value = match.group(1).lower() if match else None
    if value == 'no':
        return Finding(OK, check, 'effektiv no (sshd -T)')
    return Finding(FAIL, check, f'effektiv {value or "unbekannt"} (sshd -T)')


def analyze_sshd(effective: str | None, config_text: str | None) -> list[Finding]:
    """effective: output of 'sshd -T' (may be None); config_text: sshd_config (may be None)."""
    check = 'sshd PasswordAuthentication'
    findings = [_sshd_effective_finding(check, effective)] if effective is not None else []
    if config_text is None:
        return findings or [Finding(INFO, check, 'sshd_config nicht gefunden')]
    settings = parse_sshd_password_settings(config_text)
    global_value, match_values, includes = settings.global_value, settings.match_values, settings.has_includes
    if effective is None and global_value == 'no':
        findings.append(Finding(OK, check, 'no (sshd_config)'))
    elif effective is None:
        detail = f'{global_value} (sshd_config)' if global_value else 'nicht gesetzt: OpenSSH-Standard ist yes'
        findings.append(Finding(FAIL, check, detail))
    for condition, value in match_values:
        if value != 'no':
            findings.append(Finding(FAIL, check, f'Match {condition}: PasswordAuthentication {value}'))
    if includes:
        findings.append(
            Finding(WARN, check, 'Include-Dateien werden nicht ausgewertet; sshd -T als Administrator nutzen')
        )
    return findings


def parse_hermes_approvals(text: str) -> dict[str, str]:
    """Read the scalar keys directly below 'approvals:' (a minimal YAML subset, no dependency)."""
    values: dict[str, str] = {}
    in_block, indent = False, None
    for raw in text.splitlines():
        if not raw.strip() or raw.lstrip().startswith('#'):
            continue
        if re.match(r'^approvals:\s*(#.*)?$', raw):
            in_block, indent = True, None
            continue
        if not in_block:
            continue
        if not raw[0].isspace():
            break
        current = len(raw) - len(raw.lstrip())
        indent = current if indent is None else indent
        if current != indent:
            continue  # nested lists such as 'deny:' entries
        match = re.match(r'^\s+([A-Za-z_]+):\s*(.*?)\s*$', raw)
        if not match:
            continue
        value = match.group(2).split(' #', 1)[0].strip().strip('"\'')
        if value:
            values[match.group(1)] = value
    return values


def analyze_hermes(config_text: str | None, yolo_env: str | None) -> list[Finding]:
    findings: list[Finding] = []
    if yolo_env and yolo_env.strip().lower() not in ('0', 'false', 'no', ''):
        findings.append(Finding(FAIL, 'Hermes HERMES_YOLO_MODE', f'gesetzt ({yolo_env}): keine Freigaben'))
    if config_text is None:
        findings.append(Finding(INFO, 'Hermes approvals', 'keine Konfiguration gefunden (Hermes nicht installiert?)'))
        return findings
    approvals = parse_hermes_approvals(config_text)
    mode = approvals.get('mode')
    if mode == 'manual':
        findings.append(Finding(OK, 'Hermes approvals.mode', 'manual'))
    elif mode is None:
        findings.append(
            Finding(FAIL, 'Hermes approvals.mode', 'nicht gesetzt: Standard ist smart, verlangt ist manual')
        )
    else:
        findings.append(Finding(FAIL, 'Hermes approvals.mode', f'{mode}: verlangt ist manual'))
    for key in HERMES_HEADLESS_KEYS:
        value = approvals.get(key)
        if value is None:
            findings.append(Finding(OK, f'Hermes approvals.{key}', 'nicht gesetzt: Standard deny'))
        elif value == 'deny':
            findings.append(Finding(OK, f'Hermes approvals.{key}', 'deny'))
        else:
            findings.append(Finding(FAIL, f'Hermes approvals.{key}', f'{value}: verlangt ist deny'))
    return findings


def analyze_adb(devices_output: str | None) -> Finding:
    check = 'ADB Geraete'
    if devices_output is None:
        return Finding(INFO, check, 'adb nicht im PATH')
    count = len(re.findall(r'^\S+\s+device$', devices_output, re.M))
    if count > 1:
        return Finding(WARN, check, f'{count} Transporte aktiv: Befehle immer mit -s <Seriennummer>')
    return Finding(OK, check, f'{count} Transport(e)')


# --------------------------------------------------------------------------- collectors (Windows)


@dataclass
class HostData:
    ollama_host: str | None = None
    ollama_listeners: list[dict] | None = None
    ollama_running: bool = False
    firewall_rules: list[dict] | None = None
    sshd_effective: str | None = None
    sshd_config: str | None = None
    hermes_config: str | None = None
    hermes_yolo: str | None = None
    adb_devices: str | None = None
    notes: list[str] = field(default_factory=list)


def _run(argv: list[str], timeout: int = 60) -> str | None:
    executable = shutil.which(argv[0])
    if not executable:
        return None
    try:
        # Fixed argument list, no shell, no user-supplied values.
        done = subprocess.run([executable, *argv[1:]], capture_output=True, text=True, timeout=timeout, check=False)  # noqa: S603
    except (OSError, subprocess.TimeoutExpired):
        return None
    return done.stdout if done.returncode == 0 else None


def _powershell_json(script: str) -> list[dict] | None:
    out = _run(['powershell', '-NoProfile', '-NonInteractive', '-Command', script], timeout=180)
    if out is None:
        return None
    try:
        data = json.loads(out) if out.strip() else []
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, list) else [data]


def env_value(name: str) -> str | None:
    """Process, user and machine scope (registry) - Ollama may be started from another environment."""
    value = os.environ.get(name)
    if value or sys.platform != 'win32':
        return value
    import winreg  # noqa: PLC0415 - Windows only

    locations = (
        (winreg.HKEY_CURRENT_USER, r'Environment'),
        (winreg.HKEY_LOCAL_MACHINE, r'SYSTEM\CurrentControlSet\Control\Session Manager\Environment'),
    )
    for hive, key in locations:
        try:
            with winreg.OpenKey(hive, key) as handle:
                return str(winreg.QueryValueEx(handle, name)[0])
        except OSError:
            continue
    return None


OLLAMA_LISTENERS_PS = (
    '$ids = @(Get-Process -Name ollama -ErrorAction SilentlyContinue | ForEach-Object { $_.Id });'
    ' Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue'
    ' | Where-Object { $ids -contains $_.OwningProcess }'
    ' | Select-Object LocalAddress, LocalPort | ConvertTo-Json -Compress'
)
OLLAMA_RUNNING_PS = '@(Get-Process -Name ollama -ErrorAction SilentlyContinue).Count | ConvertTo-Json'
FIREWALL_RULES_PS = (
    'Get-NetFirewallRule -Direction Inbound -Action Allow -Enabled True | ForEach-Object {'
    ' $p = $_ | Get-NetFirewallPortFilter; $a = $_ | Get-NetFirewallAddressFilter;'
    ' $i = $_ | Get-NetFirewallInterfaceFilter;'
    ' [pscustomobject]@{ Name = $_.Name; DisplayName = $_.DisplayName; Protocol = $p.Protocol;'
    ' LocalPort = @($p.LocalPort); RemoteAddress = @($a.RemoteAddress); InterfaceAlias = @($i.InterfaceAlias) } }'
    ' | ConvertTo-Json -Compress -Depth 3'
)


def collect(hermes_config: Path) -> HostData:
    data = HostData(ollama_host=env_value('OLLAMA_HOST'), hermes_yolo=env_value('HERMES_YOLO_MODE'))
    if sys.platform == 'win32':
        data.ollama_listeners = _powershell_json(OLLAMA_LISTENERS_PS)
        running = _powershell_json(OLLAMA_RUNNING_PS)
        data.ollama_running = bool(running and running[0])
        data.firewall_rules = _powershell_json(FIREWALL_RULES_PS)
        data.sshd_effective = _run(['sshd', '-T'])
        program_data = os.environ.get('PROGRAMDATA')
        sshd_config = Path(program_data, 'ssh', 'sshd_config') if program_data else None
        if sshd_config and sshd_config.is_file():
            data.sshd_config = sshd_config.read_text(encoding='utf-8', errors='replace')
    if hermes_config.is_file():
        data.hermes_config = hermes_config.read_text(encoding='utf-8', errors='replace')
    data.adb_devices = _run(['adb', 'devices'])
    return data


# --------------------------------------------------------------------------- report


def audit(data: HostData) -> list[Finding]:
    findings = [analyze_ollama_env(data.ollama_host)]
    findings += analyze_ollama_listeners(data.ollama_listeners, data.ollama_running)
    findings += analyze_ssh_firewall(data.firewall_rules)
    if sys.platform == 'win32' or data.sshd_effective is not None or data.sshd_config is not None:
        findings += analyze_sshd(data.sshd_effective, data.sshd_config)
    else:
        findings.append(Finding(INFO, 'sshd PasswordAuthentication', 'nicht ermittelbar (kein Windows)'))
    findings += analyze_hermes(data.hermes_config, data.hermes_yolo)
    findings.append(analyze_adb(data.adb_devices))
    return findings


def render(findings: Iterable[Finding]) -> str:
    rows = list(findings)
    width = max((len(f.check) for f in rows), default=10)
    lines = [f'{f.status:<5} {f.check:<{width}}  {f.detail}' for f in rows]
    fails = sum(f.status == FAIL for f in rows)
    warns = sum(f.status == WARN for f in rows)
    return '\n'.join([*lines, f'{fails} FAIL, {warns} WARN'])


def main(argv: list[str], collector: Callable[[Path], HostData] = collect) -> int:
    parser = argparse.ArgumentParser(description='Read-only audit of an OMEGA Windows host.')
    parser.add_argument('--hermes-config', type=Path, default=Path.home() / '.hermes' / 'config.yaml')
    parser.add_argument('--json', action='store_true', help='print findings as JSON')
    args = parser.parse_args(argv[1:])
    findings = audit(collector(args.hermes_config))
    if args.json:
        print(json.dumps([asdict(f) for f in findings], ensure_ascii=False, indent=1))
    else:
        print(render(findings))
    return sum(f.status == FAIL for f in findings)


if __name__ == '__main__':
    sys.exit(main(sys.argv))
