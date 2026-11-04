"""Tests for omega_host_audit.py (standard library only).

Each CodeRabbit finding on Test-OmegaHost.ps1 (PR #30) has a regression case here.
Run: python3 -m unittest discover -s tools/windows -p 'test_*.py'
"""

from __future__ import annotations

import io
import json
import ipaddress
import os
import random
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))

import omega_host_audit as audit
from omega_host_audit import FAIL, INFO, OK, WARN, HostData


def statuses(findings):
    return [finding.status for finding in findings]


class OllamaTest(unittest.TestCase):
    def test_bind_host_parsing(self) -> None:
        cases = {
            '0.0.0.0': '0.0.0.0',
            '0.0.0.0:11434': '0.0.0.0',
            ':11434': '',
            'http://127.0.0.1:11434/': '127.0.0.1',
            '[::]:11434': '::',
            '[::1]:11434': '::1',
            '::1': '::1',
            'localhost:11434': 'localhost',
            '192.168.1.10:11434': '192.168.1.10',
        }
        for value, host in cases.items():
            with self.subTest(value=value):
                self.assertEqual(audit.ollama_bind_host(value), host)

    def test_env_only_loopback_is_ok(self) -> None:
        for value in (None, '', '127.0.0.1:11434', 'localhost', '[::1]:11434', 'http://127.0.0.1:11434'):
            with self.subTest(value=value):
                self.assertEqual(audit.analyze_ollama_env(value).status, OK)

    def test_env_reachable_addresses_fail(self) -> None:
        # CodeRabbit: a specific LAN address was reported OK before.
        for value in ('0.0.0.0', '0.0.0.0:11434', '192.168.1.10:11434', ':11434', '[::]:11434', 'myhost:11434'):
            with self.subTest(value=value):
                self.assertEqual(audit.analyze_ollama_env(value).status, FAIL)

    def test_listeners_on_any_port_are_judged_by_address(self) -> None:
        # CodeRabbit: a custom port was invisible before; the collector now uses Ollama's PIDs.
        listeners = [{'LocalAddress': '0.0.0.0', 'LocalPort': 12345}, {'LocalAddress': '127.0.0.1', 'LocalPort': 11434}]
        self.assertEqual(statuses(audit.analyze_ollama_listeners(listeners, running=True)), [FAIL, OK])

    def test_listener_states_without_data(self) -> None:
        self.assertEqual(statuses(audit.analyze_ollama_listeners(None, running=False)), [INFO])
        self.assertEqual(audit.analyze_ollama_listeners([], running=False)[0].detail, 'Ollama laeuft nicht')
        self.assertIn('ohne Listener', audit.analyze_ollama_listeners([], running=True)[0].detail)


def rule(**overrides):
    base = {
        'Name': 'r',
        'DisplayName': 'Regel',
        'Protocol': 'TCP',
        'LocalPort': ['22'],
        'RemoteAddress': ['Any'],
        'InterfaceAlias': ['Any'],
    }
    base.update(overrides)
    return base


class FirewallTest(unittest.TestCase):
    def test_any_active_rule_for_port_22_counts(self) -> None:
        # CodeRabbit: only 'OpenSSH-Server-In-TCP' was inspected before.
        rules = [rule(Name='Custom-SSH', DisplayName='Eigene SSH-Regel')]
        self.assertEqual(statuses(audit.analyze_ssh_firewall(rules)), [FAIL])

    def test_tailscale_interface_is_the_only_ok_restriction(self) -> None:
        ok = rule(InterfaceAlias=['Tailscale'])
        cgnat_only = rule(RemoteAddress=['100.64.0.0/255.192.0.0'])  # docs/33: address filter is not exclusive
        local_subnet = rule(RemoteAddress=['LocalSubnet'])
        self.assertEqual(statuses(audit.analyze_ssh_firewall([ok, cgnat_only, local_subnet])), [OK, FAIL, FAIL])

    def test_port_matching(self) -> None:
        self.assertTrue(audit.rule_allows_tcp_port(rule(LocalPort=['Any'], Protocol='Any'), 22))
        self.assertTrue(audit.rule_allows_tcp_port(rule(LocalPort=['20-30']), 22))
        self.assertTrue(audit.rule_allows_tcp_port(rule(LocalPort='22'), 22))
        self.assertFalse(audit.rule_allows_tcp_port(rule(LocalPort=['2222']), 22))
        self.assertFalse(audit.rule_allows_tcp_port(rule(Protocol='UDP'), 22))
        self.assertFalse(audit.rule_allows_tcp_port(rule(LocalPort=['RPC']), 22))

    def test_no_rule_and_no_data(self) -> None:
        self.assertEqual(statuses(audit.analyze_ssh_firewall([rule(LocalPort=['443'])])), [OK])
        self.assertEqual(statuses(audit.analyze_ssh_firewall(None)), [INFO])


class SshdTest(unittest.TestCase):
    def test_effective_config_from_sshd_t(self) -> None:
        self.assertEqual(statuses(audit.analyze_sshd('port 22\npasswordauthentication no\n', None)), [OK])
        self.assertEqual(statuses(audit.analyze_sshd('passwordauthentication yes\n', None)), [FAIL])

    def test_match_block_override_fails(self) -> None:
        # CodeRabbit: the first textual match ('no') was accepted although a Match block sets 'yes'.
        config = 'PasswordAuthentication no\n\nMatch User admin\n    PasswordAuthentication yes\n'
        self.assertEqual(statuses(audit.analyze_sshd(None, config)), [OK, FAIL])
        self.assertEqual(statuses(audit.analyze_sshd('passwordauthentication no', config)), [OK, FAIL])

    def test_defaults_syntax_and_includes(self) -> None:
        self.assertIn('Standard ist yes', audit.analyze_sshd(None, '# leer\nPort 22\n')[0].detail)
        self.assertEqual(statuses(audit.analyze_sshd(None, 'passwordauthentication=no\n')), [OK])
        self.assertEqual(statuses(audit.analyze_sshd(None, 'PasswordAuthentication\tno\n')), [OK])
        self.assertEqual(
            statuses(audit.analyze_sshd(None, 'PasswordAuthentication yes\nPasswordAuthentication no\n')), [FAIL]
        )
        self.assertEqual(
            statuses(audit.analyze_sshd(None, 'Include sshd_config.d/*.conf\nPasswordAuthentication no\n')), [OK, WARN]
        )
        self.assertEqual(statuses(audit.analyze_sshd(None, None)), [INFO])


HERMES_SAFE = """\
model: foo
approvals:
  mode: manual          # smart | manual | off
  timeout: 300
  cron_mode: deny
  single_query_mode: "deny"
  unattended_mode: 'deny'
  deny:
    - "git push --force*"
command_allowlist:
  - rm
"""


class HermesTest(unittest.TestCase):
    def test_parser_reads_only_direct_scalar_keys(self) -> None:
        self.assertEqual(
            audit.parse_hermes_approvals(HERMES_SAFE),
            {
                'mode': 'manual',
                'timeout': '300',
                'cron_mode': 'deny',
                'single_query_mode': 'deny',
                'unattended_mode': 'deny',
            },
        )

    def test_safe_configuration(self) -> None:
        self.assertEqual(statuses(audit.analyze_hermes(HERMES_SAFE, None)), [OK, OK, OK, OK])

    def test_mode_must_be_manual(self) -> None:
        # CodeRabbit: 'smart' was WARN and 'unset' INFO before, so the exit code stayed 0.
        for text, expected in (
            ('approvals:\n  mode: smart\n', 'smart'),
            ('approvals:\n  mode: off\n', 'off'),
            ('approvals:\n  timeout: 30\n', 'Standard ist smart'),
        ):
            with self.subTest(text=text):
                first = audit.analyze_hermes(text, None)[0]
                self.assertEqual(first.status, FAIL)
                self.assertIn(expected, first.detail)

    def test_headless_modes_must_deny(self) -> None:
        # CodeRabbit: 'unattended_mode: approve' was not checked before.
        text = 'approvals:\n  mode: manual\n  unattended_mode: approve\n'
        findings = audit.analyze_hermes(text, None)
        self.assertEqual(statuses(findings), [OK, OK, OK, FAIL])
        self.assertEqual(findings[-1].check, 'Hermes approvals.unattended_mode')

    def test_yolo_environment_and_missing_config(self) -> None:
        self.assertEqual(statuses(audit.analyze_hermes(HERMES_SAFE, '1'))[0], FAIL)
        self.assertEqual(statuses(audit.analyze_hermes(HERMES_SAFE, '0')), [OK, OK, OK, OK])
        self.assertEqual(statuses(audit.analyze_hermes(None, None)), [INFO])


class AdbTest(unittest.TestCase):
    def test_counts_only_authorized_transports(self) -> None:
        out = 'List of devices attached\nR5CX123\tdevice\n192.168.1.5:5555\tdevice\nX\tunauthorized\n'
        self.assertEqual(audit.analyze_adb(out).status, WARN)
        self.assertEqual(audit.analyze_adb('List of devices attached\nR5CX123\tdevice\n').status, OK)
        self.assertEqual(audit.analyze_adb(None).status, INFO)


class ToolResolutionTest(unittest.TestCase):
    """CodeRabbit (#32): CWE-426 lookup and locale-dependent decoding in the collectors."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def executable(self, rel: str, body: bytes = b'#!/bin/sh\nexit 0\n', mode: int = 0o755) -> Path:
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
        path.chmod(mode)
        return path

    def test_find_on_path_never_uses_the_working_directory(self) -> None:
        planted = self.executable('download/adb')
        trusted = self.executable('platform-tools/adb')
        previous = os.getcwd()
        os.chdir(planted.parent)
        try:
            # Empty and relative entries point at the working directory and are skipped.
            unsafe = os.pathsep.join(['', '.', 'download'])
            self.assertEqual(audit.find_on_path('adb', unsafe + os.pathsep + str(trusted.parent), ''), str(trusted))
            self.assertIsNone(audit.find_on_path('adb', unsafe, ''))
        finally:
            os.chdir(previous)

    def test_find_on_path_tries_pathext_suffixes(self) -> None:
        exe = self.executable('tools/adb.exe')
        self.assertEqual(audit.find_on_path('adb', str(exe.parent), '.COM;.EXE;.BAT'), str(exe))
        self.assertIsNone(audit.find_on_path('adb', str(exe.parent), ''))

    @unittest.skipUnless(os.name == 'posix', 'execute permission is a POSIX concept')
    def test_find_on_path_skips_files_that_are_not_executable(self) -> None:
        data = self.executable('tools/adb', mode=0o644)
        self.assertIsNone(audit.find_on_path('adb', str(data.parent), ''))

    def test_system_tools_come_from_fixed_locations_only(self) -> None:
        powershell = self.executable('Windows/System32/WindowsPowerShell/v1.0/powershell.exe')
        environ = {'SystemRoot': str(self.root / 'Windows'), 'PATH': str(self.root)}
        self.assertEqual(audit.system_tool('powershell', environ), str(powershell))
        self.assertIsNone(audit.system_tool('sshd', environ))
        msi = self.executable('Program Files/OpenSSH/sshd.exe')
        environ['ProgramFiles'] = str(self.root / 'Program Files')
        self.assertEqual(audit.system_tool('sshd', environ), str(msi))
        capability = self.executable('Windows/System32/OpenSSH/sshd.exe')
        self.assertEqual(audit.system_tool('sshd', environ), str(capability))
        self.assertIsNone(audit.system_tool('powershell', {'SystemRoot': 'Windows'}))  # relative: ignored
        self.assertIsNone(audit.system_tool('powershell', {}))

    @unittest.skipUnless(os.name == 'posix', 'uses a shell script as the fake tool')
    def test_run_decodes_utf8_and_survives_invalid_bytes(self) -> None:
        # A Latin-1 byte (0xFC) used to raise UnicodeDecodeError and abort the whole audit.
        tool = self.executable('bin/tool', b"#!/bin/sh\nprintf 'Regel f\\303\\274r SSH \\374\\n'\n")
        self.assertEqual(audit._run(str(tool), []), 'Regel f\u00fcr SSH \ufffd\n')
        self.assertIsNone(audit._run(str(self.executable('bin/fails', b'#!/bin/sh\nexit 3\n')), []))
        self.assertIsNone(audit._run(None, ['devices']))

    def test_every_powershell_script_forces_utf8_and_a_bom_is_tolerated(self) -> None:
        calls = []

        def fake_run(executable, args, timeout=60):
            calls.append((executable, args))
            return '\ufeff[{"LocalAddress": "127.0.0.1", "LocalPort": 11434}]'

        with (
            mock.patch.object(audit, 'system_tool', return_value='C:/Windows/powershell.exe'),
            mock.patch.object(audit, '_run', fake_run),
        ):
            listeners = audit._powershell_json(audit.OLLAMA_LISTENERS_PS)
        self.assertEqual(listeners, [{'LocalAddress': '127.0.0.1', 'LocalPort': 11434}])
        self.assertEqual(calls[0][0], 'C:/Windows/powershell.exe')
        self.assertEqual(calls[0][1][-1], audit.POWERSHELL_UTF8 + audit.OLLAMA_LISTENERS_PS)


class FakeWinreg:
    """Stand-in for the Windows-only winreg module: {(hive, key): {name: value}}."""

    HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE = 'HKCU', 'HKLM'

    def __init__(self, values: dict) -> None:
        self.values = values

    def OpenKey(self, hive, key):  # mirrors the winreg API
        if (hive, key) not in self.values:
            raise OSError('key missing')
        return mock.MagicMock(__enter__=lambda _self: (hive, key), __exit__=lambda *_a: False)

    def QueryValueEx(self, handle, name):  # mirrors the winreg API
        if name not in self.values[handle]:
            raise OSError('value missing')
        return self.values[handle][name], 1


class CollectorTest(unittest.TestCase):
    """The Windows collectors, run on any system with a simulated platform and fake tools."""

    def test_env_value_reads_process_then_user_then_machine_scope(self) -> None:
        machine = (FakeWinreg.HKEY_LOCAL_MACHINE, r'SYSTEM\CurrentControlSet\Control\Session Manager\Environment')
        user = (FakeWinreg.HKEY_CURRENT_USER, 'Environment')
        fake = FakeWinreg({user: {'A': 'aus-user'}, machine: {'A': 'aus-machine', 'B': 'nur-machine'}})
        with mock.patch.object(audit.sys, 'platform', 'win32'), mock.patch.dict(sys.modules, {'winreg': fake}):
            with mock.patch.dict(os.environ, {'A': 'aus-prozess'}):
                self.assertEqual(audit.env_value('A'), 'aus-prozess')
            with mock.patch.dict(os.environ, {}, clear=True):
                self.assertEqual(audit.env_value('A'), 'aus-user')
                self.assertEqual(audit.env_value('B'), 'nur-machine')
                self.assertIsNone(audit.env_value('C'))
        with mock.patch.object(audit.sys, 'platform', 'linux'), mock.patch.dict(os.environ, {}, clear=True):
            self.assertIsNone(audit.env_value('A'))  # no registry outside Windows

    def test_powershell_json_handles_failure_empty_invalid_and_single_objects(self) -> None:
        cases = [(None, None), ('', []), ('  \n', []), ('{kaputt', None), ('{"a": 1}', [{'a': 1}]), ('[1, 2]', [1, 2])]
        for output, expected in cases:
            with self.subTest(output=output), mock.patch.object(audit, '_run', return_value=output):
                self.assertEqual(audit._powershell_json('x'), expected)

    @unittest.skipUnless(os.name == 'posix', 'uses /bin/sh as the fake tool')
    def test_run_returns_none_on_timeout_and_start_failure(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            slow = Path(tmp, 'slow')
            slow.write_text('#!/bin/sh\nsleep 5\n', encoding='utf-8')
            slow.chmod(0o755)
            self.assertIsNone(audit._run(str(slow), [], timeout=1))
            self.assertIsNone(audit._run(str(Path(tmp, 'fehlt')), []))

    def test_collect_on_windows_wires_every_source(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            program_data = Path(tmp, 'ProgramData')
            (program_data / 'ssh').mkdir(parents=True)
            (program_data / 'ssh' / 'sshd_config').write_text('PasswordAuthentication no\n', encoding='utf-8')
            hermes = Path(tmp, 'config.yaml')
            hermes.write_text(HERMES_SAFE, encoding='utf-8')
            scripts = {
                audit.OLLAMA_LISTENERS_PS: [{'LocalAddress': '127.0.0.1', 'LocalPort': 11434}],
                audit.OLLAMA_RUNNING_PS: [1],
                audit.FIREWALL_RULES_PS: [rule(InterfaceAlias=['Tailscale'])],
            }
            runs = {'sshd.exe': 'passwordauthentication no\n', 'adb': 'List of devices attached\n'}
            with (
                mock.patch.object(audit.sys, 'platform', 'win32'),
                mock.patch.object(audit, 'env_value', return_value=None),
                mock.patch.object(audit, '_powershell_json', side_effect=scripts.get),
                mock.patch.object(audit, 'system_tool', side_effect=lambda name: f'{name}.exe'),
                mock.patch.object(audit, 'find_on_path', return_value='adb'),
                mock.patch.object(audit, '_run', side_effect=lambda exe, _args, timeout=60: runs[exe]),
                mock.patch.dict(os.environ, {'PROGRAMDATA': str(program_data)}),
            ):
                data = audit.collect(hermes)
        self.assertTrue(data.ollama_running)
        # CodeRabbit (#32, round 5): assert every wired source, so a disconnected collector is caught.
        self.assertEqual(data.ollama_listeners, scripts[audit.OLLAMA_LISTENERS_PS])
        self.assertEqual(data.firewall_rules, scripts[audit.FIREWALL_RULES_PS])
        self.assertEqual(data.adb_devices, runs['adb'])
        self.assertEqual(data.notes, [])
        self.assertEqual(data.sshd_config, 'PasswordAuthentication no\n')
        self.assertEqual(data.sshd_effective, 'passwordauthentication no\n')
        self.assertEqual(data.hermes_config, HERMES_SAFE)
        self.assertNotIn(FAIL, statuses(audit.audit(data)))

    def test_collect_elsewhere_skips_windows_sources(self) -> None:
        with (
            mock.patch.object(audit.sys, 'platform', 'linux'),
            mock.patch.object(audit, 'env_value', return_value=None),
            mock.patch.object(audit, '_powershell_json') as powershell,
            mock.patch.object(audit, 'find_on_path', return_value=None),
        ):
            data = audit.collect(Path('/nicht/vorhanden.yaml'))
            findings = audit.audit(data)
        powershell.assert_not_called()
        self.assertIsNone(data.hermes_config)
        self.assertIn('nicht ermittelbar (kein Windows)', [f.detail for f in findings])

    def test_find_on_path_uses_the_process_environment_and_windows_defaults(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            exe = Path(tmp, 'adb.exe')
            exe.write_bytes(b'')
            exe.chmod(0o755)
            with mock.patch.object(audit.sys, 'platform', 'win32'), mock.patch.dict(os.environ, {'PATH': tmp}):
                os.environ.pop('PATHEXT', None)
                self.assertEqual(audit.find_on_path('adb'), str(exe))  # default PATHEXT includes .EXE

    def test_unreadable_files_become_warnings_not_a_crash(self) -> None:
        # CodeRabbit (#32, round 4): PermissionError on sshd_config or the Hermes config aborted collect().
        with tempfile.TemporaryDirectory() as tmp:
            program_data = Path(tmp, 'ProgramData')
            (program_data / 'ssh').mkdir(parents=True)
            (program_data / 'ssh' / 'sshd_config').write_text('x', encoding='utf-8')
            hermes = Path(tmp, 'config.yaml')
            hermes.write_text('x', encoding='utf-8')
            with (
                mock.patch.object(audit.sys, 'platform', 'win32'),
                mock.patch.object(audit, 'env_value', return_value=None),
                mock.patch.object(audit, '_powershell_json', return_value=None),
                mock.patch.object(audit, '_run', return_value=None),
                mock.patch.object(audit, 'find_on_path', return_value=None),
                mock.patch.object(audit.Path, 'read_text', side_effect=PermissionError('verweigert')),
                mock.patch.dict(os.environ, {'PROGRAMDATA': str(program_data)}),
            ):
                data = audit.collect(hermes)
        self.assertIsNone(data.sshd_config)
        self.assertIsNone(data.hermes_config)
        warnings = [f for f in audit.audit(data) if f.check == 'Datei']
        self.assertEqual([f.status for f in warnings], [WARN, WARN])
        self.assertIn('PermissionError', warnings[0].detail)

    def test_inaccessible_parent_and_missing_files_are_told_apart(self) -> None:
        # CodeRabbit (#32, round 6): a path below a regular file (an inaccessible parent) is a warning,
        # a missing file is simply absent. Works as root, unlike chmod-based tests.
        with tempfile.TemporaryDirectory() as tmp:
            blocker = Path(tmp, 'datei')
            blocker.write_text('x', encoding='utf-8')
            data = HostData()
            self.assertIsNone(audit._read_optional(Path(tmp, 'fehlt.yaml'), data))
            self.assertIsNone(audit._read_optional(Path(tmp, 'fehlt', 'config.yaml'), data))
            self.assertEqual(data.notes, [])
            self.assertIsNone(audit._read_optional(Path(blocker, 'config.yaml'), data))
            self.assertEqual(len(data.notes), 1)
            # Assert the outcome, not the platform-specific exception name.
            self.assertIn('nicht lesbar', data.notes[0])
            self.assertIn('Pruefung unvollstaendig', data.notes[0])
            self.assertEqual([f.status for f in audit.audit(data) if f.check == 'Datei'], [WARN])
            self.assertIsNone(audit._read_optional(None, data))

    def test_windows_style_file_not_found_below_a_regular_file_is_a_warning(self) -> None:
        # CodeRabbit (#32, round 7): Windows raises FileNotFoundError, not NotADirectoryError, for a
        # path below a regular file; that case must not be silently treated as an absent file.
        with tempfile.TemporaryDirectory() as tmp:
            blocker = Path(tmp, 'datei')
            blocker.write_text('x', encoding='utf-8')
            data = HostData()
            with mock.patch.object(audit.Path, 'read_text', side_effect=FileNotFoundError('fehlt')):
                self.assertIsNone(audit._read_optional(Path(blocker, 'sub', 'config.yaml'), data))
                self.assertIsNone(audit._read_optional(Path(tmp, 'fehlt', 'config.yaml'), data))
        self.assertEqual(len(data.notes), 1)
        self.assertIn('Elternpfad ist eine Datei', data.notes[0])

    def test_uninspectable_parent_is_a_warning_not_absent(self) -> None:
        # If a parent cannot be inspected, absence is not certain: the audit is incomplete.
        data = HostData()
        with (
            mock.patch.object(audit.Path, 'read_text', side_effect=FileNotFoundError('fehlt')),
            mock.patch.object(audit.Path, 'is_file', side_effect=PermissionError('verweigert')),
        ):
            self.assertIsNone(audit._read_optional(Path('gesperrt', 'config.yaml'), data))
        self.assertEqual(len(data.notes), 1)
        self.assertIn('nicht pruefbar', data.notes[0])

    def test_is_file_failures_do_not_bypass_the_handler(self) -> None:
        # The check no longer runs is_file() before reading; a PermissionError there must not escape.
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp, 'config.yaml')
            path.write_text('x', encoding='utf-8')
            data = HostData()
            with mock.patch.object(audit.Path, 'is_file', side_effect=PermissionError('verweigert')):
                self.assertEqual(audit._read_optional(path, data), 'x')
            self.assertEqual(data.notes, [])


class EdgeCaseTest(unittest.TestCase):
    def test_helpers_and_parser_corners(self) -> None:
        self.assertEqual(audit._as_list(None), [])
        self.assertEqual(audit._as_list(('a', 1)), ['a', '1'])
        self.assertEqual(audit._as_list(22), ['22'])
        text = 'approvals:\n\n  # Kommentar\n  mode: manual\n  - liste\n  cron_mode: "deny"  # inline\nnext: x\n'
        self.assertEqual(audit.parse_hermes_approvals(text), {'mode': 'manual', 'cron_mode': 'deny'})
        config = 'PasswordAuthentication no\nMatch User a\n  PasswordAuthentication no\n'
        self.assertEqual(statuses(audit.analyze_sshd(None, config)), [OK])

    def test_unknown_effective_value_and_unset_config_fail(self) -> None:
        self.assertIn('unbekannt', audit.analyze_sshd('port 22\n', None)[0].detail)
        self.assertEqual(statuses(audit.analyze_sshd(None, 'PasswordAuthentication yes\n')), [FAIL])


class PropertyTest(unittest.TestCase):
    """Generated cases (fixed seed) for the security-relevant classifications."""

    def test_loopback_is_exactly_127_slash_8_and_ipv6_one(self) -> None:
        rng = random.Random(33)
        for _ in range(500):
            address = ipaddress.IPv4Address(rng.getrandbits(32))
            with self.subTest(address=str(address)):
                self.assertEqual(audit.is_loopback(str(address)), address in ipaddress.ip_network('127.0.0.0/8'))
                expected = OK if address.is_loopback else FAIL
                self.assertEqual(audit.analyze_ollama_env(f'{address}:11434').status, expected)
        self.assertTrue(audit.is_loopback('[::1]'))
        self.assertFalse(audit.is_loopback('::'))
        self.assertFalse(audit.is_loopback('127.0.0.1.nip.io'))  # a name is never proven loopback

    def test_port_ranges_contain_22_exactly_when_the_bounds_do(self) -> None:
        rng = random.Random(22)
        for _ in range(500):
            low = rng.randint(1, 100)
            high = rng.randint(low, 120)
            spec = f'{low}-{high}'
            with self.subTest(spec=spec):
                self.assertEqual(audit.rule_allows_tcp_port(rule(LocalPort=[spec]), 22), low <= 22 <= high)

    def test_render_counts_and_aligns(self) -> None:
        findings = [audit.Finding(FAIL, 'a', 'x'), audit.Finding(WARN, 'langer Name', 'y'), audit.Finding(OK, 'b', 'z')]
        lines = audit.render(findings).splitlines()
        self.assertEqual(lines[-1], '1 FAIL, 1 WARN')
        self.assertEqual(len({line.index(detail) for line, detail in zip(lines, 'xyz', strict=False)}), 1)
        self.assertEqual(audit.render([]), '0 FAIL, 0 WARN')

    def test_collect_on_windows_without_sshd_config_file(self) -> None:
        with (
            tempfile.TemporaryDirectory() as tmp,
            mock.patch.object(audit.sys, 'platform', 'win32'),
            mock.patch.object(audit, 'env_value', return_value=None),
            mock.patch.object(audit, '_powershell_json', return_value=None),
            mock.patch.object(audit, '_run', return_value=None),
            mock.patch.object(audit, 'find_on_path', return_value=None),
            mock.patch.dict(os.environ, {'PROGRAMDATA': tmp}),
        ):
            data = audit.collect(Path(tmp, 'keine.yaml'))
        self.assertIsNone(data.sshd_config)
        self.assertFalse(data.ollama_running)


class MainTest(unittest.TestCase):
    def test_exit_code_is_number_of_fail_findings_and_json_output(self) -> None:
        unsafe = HostData(
            ollama_host='0.0.0.0',
            ollama_listeners=[],
            firewall_rules=[rule()],
            sshd_config='PasswordAuthentication no\n',
            hermes_config='approvals:\n  mode: off\n',
            adb_devices='List of devices attached\n',
        )
        with redirect_stdout(io.StringIO()) as out:
            code = audit.main(['audit', '--json'], collector=lambda _path: unsafe)
        findings = json.loads(out.getvalue())
        self.assertEqual(code, sum(f['status'] == FAIL for f in findings))
        self.assertEqual(code, 3)

    def test_safe_host_exits_zero(self) -> None:
        safe = HostData(
            ollama_host=None,
            ollama_listeners=[{'LocalAddress': '127.0.0.1', 'LocalPort': 11434}],
            ollama_running=True,
            firewall_rules=[rule(InterfaceAlias=['Tailscale'])],
            sshd_effective='passwordauthentication no',
            sshd_config='PasswordAuthentication no\n',
            hermes_config=HERMES_SAFE,
            adb_devices='List of devices attached\nR5CX123\tdevice\n',
        )
        with redirect_stdout(io.StringIO()) as out:
            self.assertEqual(audit.main(['audit'], collector=lambda _path: safe), 0)
        self.assertTrue(out.getvalue().rstrip().endswith('0 FAIL, 0 WARN'))

    def test_hermes_config_option_and_default_path_reach_the_collector(self) -> None:
        seen = []

        def collector(path):
            seen.append(path)
            return HostData()

        with redirect_stdout(io.StringIO()):
            audit.main(['audit', '--hermes-config', 'C:/hermes/config.yaml'], collector=collector)
            audit.main(['audit'], collector=collector)
        self.assertEqual(seen[0], Path('C:/hermes/config.yaml'))
        self.assertEqual(seen[1], Path.home() / '.hermes' / 'config.yaml')


if __name__ == '__main__':
    unittest.main()
