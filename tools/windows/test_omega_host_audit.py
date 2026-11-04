"""Tests for omega_host_audit.py (standard library only).

Each CodeRabbit finding on Test-OmegaHost.ps1 (PR #30) has a regression case here.
Run: python3 -m unittest discover -s tools/windows -p 'test_*.py'
"""

from __future__ import annotations

import io
import json
import sys
import unittest
from contextlib import redirect_stdout
from pathlib import Path

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


if __name__ == '__main__':
    unittest.main()
