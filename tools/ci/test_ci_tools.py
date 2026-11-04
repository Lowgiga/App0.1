"""Tests for the CI helper scripts (needs tools/ci/requirements.txt for the Markdown parser).

Run: python3 -m unittest discover -s tools/ci -p 'test_*.py'
"""

from __future__ import annotations

import io
import json
import os
import random
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.parse
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_fingerprint
import check_markdown_links


TOOLCHAIN_SCRIPT = Path(__file__).resolve().parents[1] / 'check-toolchain.sh'
BASH = shutil.which('bash')


def write(root: Path, rel: str, text: str = '') -> None:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')


def fastest_run(function, argument, repeat: int = 3) -> float:
    """Best of a few timings: the minimum is the least noisy estimate of the real cost."""
    best = float('inf')
    for _ in range(repeat):
        start = time.perf_counter()
        function(argument)
        best = min(best, time.perf_counter() - start)
    return best


def fake_tool(directory: Path, name: str, output: str) -> None:
    """Create an executable that prints `output`, standing in for node or javac."""
    write(directory, name, f"#!/bin/sh\ncat <<'EOF'\n{output}\nEOF\n")
    (directory / name).chmod(0o755)


class LinkTargetsTest(unittest.TestCase):
    def test_finds_links_and_images(self) -> None:
        md = '[Doku](docs/a.md) und ![Bild](img/b.png "Titel") und [Anker](c.md#teil)'
        self.assertEqual(check_markdown_links.link_targets(md), ['docs/a.md', 'img/b.png', 'c.md#teil'])

    def test_ignores_external_anchors_and_code(self) -> None:
        md = '\n'.join(
            [
                '[web](https://example.com) [mail](mailto:x@example.com) [anker](#oben) [proto](//cdn.example)',
                '`[inline](missing-inline.md)`',
                '```',
                '[im Block](missing-block.md)',
                '```',
            ]
        )
        self.assertEqual(check_markdown_links.link_targets(md), [])

    def test_angle_bracket_target_may_contain_spaces(self) -> None:
        targets = check_markdown_links.link_targets('[x](<docs/a b.md>) [y](<c.md> "T")')
        self.assertEqual(targets, ['docs/a%20b.md', 'c.md'])  # normalised as markdown-it renders it

    def test_reference_definitions_are_targets_but_footnotes_are_not(self) -> None:
        # CodeRabbit (#32): reference-style links were not checked at all.
        md = '[Text][ref] und Fussnote[^1]\n\n[ref]: docs/a.md "Titel"\n  [b]: <docs/b c.md>\n[^1]: keine Datei\n'
        self.assertEqual(check_markdown_links.link_targets(md), ['docs/a.md', 'docs/b%20c.md'])

    def test_definition_must_stand_alone_and_cannot_interrupt_a_paragraph(self) -> None:
        # Found in docs/36: the PAZ line '[DATEN-QUELLE]: hochgeladene Archive (...)' is text, not a link.
        md = '\n'.join(
            [
                '[DATEN-QUELLE]: hochgeladene Archive (SHA-256 oben), lokale Tests',
                '',
                'Ein Absatz',
                '[c]: absatz.md',
                '# Titel',
                '[d]: docs/d.md',
                '  "Titel auf eigener Zeile"',
                '[e]: <>',
                '[f]: docs/f.md',
                'Text vor dem Block',
                '```',
                'code',
                '```',
                '[g]: docs/g.md',
            ]
        )
        self.assertEqual(check_markdown_links.link_targets(md), ['docs/d.md', 'docs/f.md', 'docs/g.md'])

    def test_image_inside_a_link_yields_both_targets(self) -> None:
        # CodeRabbit (#32, round 3): the outer destination of a badge link was lost.
        md = '[![Badge](img/b.svg)](docs/ziel.md) und [Text [mit] Klammern](c.md) und [a] [b](d.md)'
        self.assertEqual(check_markdown_links.link_targets(md), ['docs/ziel.md', 'img/b.svg', 'c.md', 'd.md'])

    def test_definition_destination_may_start_on_the_next_line(self) -> None:
        # CodeRabbit (#32, round 3): '[x]:' followed by the target on the next line was skipped.
        md = '[x]:\n  docs/x.md "Titel"\n[y]:\n\nAbsatz\n'
        self.assertEqual(check_markdown_links.link_targets(md), ['docs/x.md'])

    def test_round_four_commonmark_cases(self) -> None:
        # CodeRabbit (#32, round 4): escaped brackets and parentheses, entities, text joined across a
        # code span, and things GitHub renders but the old patterns missed or invented.
        cases = {
            r'[link \]x](a.md)': ['a.md'],
            r'[x](docs/file\).md)': ['docs/file).md'],
            '[x](docs/a&amp;b.md)': ['docs/a&b.md'],
            '[text]`code`(missing.md)': [],
            '<!-- [kommentar](versteckt.md) -->': [],
            '    [eingerueckt](code.md)': [],
            '| a | b |\n|---|---|\n| [t](tabelle.md) | x |': ['tabelle.md'],
            'Text[^1]\n\n[^1]: Fussnote mit [link](fn.md)': ['fn.md'],
            '<p><img src="img/a.png" alt=""> <a href="docs/b.md">b</a></p>': ['img/a.png', 'docs/b.md'],
        }
        for md, expected in cases.items():
            with self.subTest(md=md):
                self.assertEqual(check_markdown_links.link_targets(md), expected)

    def test_code_span_and_link_text_end_at_a_blank_line(self) -> None:
        # A stray backtick must not hide the links of the following paragraphs.
        md = 'Ein einzelnes ` Zeichen.\n\n[x](da.md) und `code`\n'
        self.assertEqual(check_markdown_links.link_targets(md), ['da.md'])

    def test_bare_target_may_contain_balanced_parentheses(self) -> None:
        # CodeRabbit (#32): the target used to end at the first ')'.
        self.assertEqual(check_markdown_links.link_targets('[x](docs/file(1).md "T")'), ['docs/file(1).md'])

    def test_fence_closes_only_with_same_character_and_at_least_its_length(self) -> None:
        # CodeRabbit (#32): every line starting with ``` toggled the fence state.
        md = '\n'.join(
            [
                '````',
                '```',
                '[im 4er-Block](fehlt-a.md)',
                '```',
                '````',
                '~~~',
                '```',
                '[im Tilde-Block](fehlt-b.md)',
                '~~~',
                '[danach](sichtbar.md)',
            ]
        )
        self.assertEqual(check_markdown_links.link_targets(md), ['sichtbar.md'])

    def test_code_spans_of_any_backtick_length_are_ignored(self) -> None:
        # CodeRabbit (#32): only single-backtick spans were removed.
        md = '`` [x](fehlt-a.md) `y` `` und ``` [z](fehlt-b.md) ``` und [echt](da.md)'
        self.assertEqual(check_markdown_links.link_targets(md), ['da.md'])


class FindBrokenTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_reports_missing_page_and_missing_image(self) -> None:
        write(self.root, 'docs/ok.md')
        write(self.root, 'README.md', '[ok](docs/ok.md) [kaputt](docs/fehlt.md) ![bild](img/fehlt.png)')
        checked, broken = check_markdown_links.find_broken(str(self.root))
        self.assertEqual(checked, 3)
        self.assertEqual(broken, [('README.md', 'docs/fehlt.md'), ('README.md', 'img/fehlt.png')])

    def test_resolves_relative_to_the_markdown_file(self) -> None:
        write(self.root, 'docs/a.md', '[b](b.md) [hoch](../README.md)')
        write(self.root, 'docs/b.md')
        write(self.root, 'README.md')
        self.assertEqual(check_markdown_links.find_broken(str(self.root)), (2, []))

    def test_reference_link_to_missing_file_is_broken(self) -> None:
        write(self.root, 'README.md', '[gut][a] [kaputt][b]\n\n[a]: README.md\n[b]: docs/fehlt.md\n')
        self.assertEqual(check_markdown_links.find_broken(str(self.root)), (2, [('README.md', 'docs/fehlt.md')]))

    def test_parentheses_root_relative_and_percent_encoded_targets_resolve(self) -> None:
        # CodeRabbit (#32): all three were reported as broken although the files exist.
        write(self.root, 'docs/file(1).md')
        write(self.root, 'docs/a b.md')
        write(self.root, 'docs/sub/c.md', '[root](/docs/file(1).md) [kodiert](../a%20b.md#teil)')
        write(self.root, 'README.md', '[x](docs/file(1).md) [y](/docs/a%20b.md) [z](/fehlt.md)')
        self.assertEqual(check_markdown_links.find_broken(str(self.root)), (5, [('README.md', '/fehlt.md')]))

    def test_backslash_escapes_are_removed_before_the_file_check(self) -> None:
        # CodeRabbit (#32, rounds 3 and 4): escapes are resolved first; an escaped '#' still starts the
        # fragment (CommonMark), so a '#' in a file name must be written as %23.
        write(self.root, 'docs/a_b.md')
        write(self.root, 'docs/c#1.md')
        md = r'[x](docs/a\_b.md#teil) [y](docs/c%231.md) [w](docs/c\#1.md) [z](docs/f\_x.md)'
        write(self.root, 'README.md', md)
        broken = [('README.md', 'docs/c#1.md'), ('README.md', 'docs/f_x.md')]
        self.assertEqual(check_markdown_links.find_broken(str(self.root)), (4, broken))

    def test_case_must_match_and_targets_must_stay_inside_the_repository(self) -> None:
        # Own finding: macOS/Windows accept 'Docs/A.md' for 'docs/a.md', GitHub does not; '../..' left the repo.
        md = '[gross](../Docs/a.md) [klein](a.md) [raus](../../../etc/hosts) [ordner](.) [durch](a.md/x.md)'
        write(self.root, 'docs/a.md', md)
        broken = [('docs/a.md', '../Docs/a.md'), ('docs/a.md', '../../../etc/hosts'), ('docs/a.md', 'a.md/x.md')]
        self.assertEqual(check_markdown_links.find_broken(str(self.root)), (5, broken))

    def test_skips_pinned_zones_and_build_output(self) -> None:
        for rel in ('app/upstream/x.md', 'app/vendor/y.md', 'node_modules/z.md', 'app/dist/w.md'):
            write(self.root, rel, '[kaputt](fehlt.md)')
        self.assertEqual(check_markdown_links.find_broken(str(self.root)), (0, []))

    def test_main_exit_code(self) -> None:
        write(self.root, 'README.md', '[kaputt](fehlt.md)')
        with redirect_stdout(io.StringIO()) as out:
            self.assertEqual(check_markdown_links.main(['x', str(self.root)]), 1)
        self.assertIn('BROKEN README.md -> fehlt.md', out.getvalue())

    def test_query_only_targets_and_non_markdown_files(self) -> None:
        write(self.root, 'docs/bild.png')  # not Markdown: not scanned
        write(self.root, 'docs/a.md', '[q](?ansicht=1) [leer](<>) [x](\\#roh)')  # '\\#roh' is the fragment #roh
        self.assertEqual(check_markdown_links.find_broken(str(self.root)), (1, []))
        self.assertIsNone(check_markdown_links.resolve_target(str(self.root), 'docs/a.md', '?ansicht=1'))

    def test_scripts_run_as_commands(self) -> None:
        # The entry points as CI calls them: python3 tools/ci/<script>.py ...
        write(self.root, 'README.md', '[ok](README.md)')
        here = Path(__file__).resolve().parent
        done = subprocess.run(  # noqa: S603 - fixed argv, test-owned script
            [sys.executable, str(here / 'check_markdown_links.py'), str(self.root)],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual((done.returncode, done.stdout.strip()), (0, 'Relative Markdown links checked: 1; broken: 0'))
        manifest = self.root / 'm.json'
        manifest.write_text(json.dumps({'distContentSha256': 'a' * 64, 'files': 3}), encoding='utf-8')
        env = {key: value for key, value in os.environ.items() if key != 'GITHUB_STEP_SUMMARY'}
        done = subprocess.run(  # noqa: S603 - fixed argv, test-owned script
            [sys.executable, str(here / 'build_fingerprint.py'), 'Node 24', str(manifest)],
            capture_output=True,
            text=True,
            env=env,
            check=False,
        )
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertTrue(done.stdout.endswith('(3 Dateien)\n'))


class FingerprintTest(unittest.TestCase):
    DIGEST = 'a' * 64

    def test_formats_list_and_count(self) -> None:
        self.assertEqual(
            build_fingerprint.fingerprint_line('Node 24', {'distContentSha256': self.DIGEST, 'files': [1, 2]}),
            f'Node 24: distContentSha256 {self.DIGEST} (2 Dateien)',
        )
        self.assertEqual(
            build_fingerprint.fingerprint_line('x', {'distContentSha256': self.DIGEST, 'files': 61}),
            f'x: distContentSha256 {self.DIGEST} (61 Dateien)',
        )

    def test_accepts_the_path_hash_map_written_by_the_app(self) -> None:
        files = {'assets/a.js': 'b' * 64, 'index.html': 'c' * 64}
        self.assertEqual(
            build_fingerprint.fingerprint_line('x', {'distContentSha256': self.DIGEST, 'files': files}),
            f'x: distContentSha256 {self.DIGEST} (2 Dateien)',
        )

    def test_real_manifest_of_the_repository(self) -> None:
        # Guards against drift between this script and the app's manifest generator.
        real = Path(__file__).resolve().parents[2] / 'app' / 'docs' / 'build-manifest.json'
        if not real.exists():
            self.skipTest('app/docs/build-manifest.json not present')
        manifest = json.loads(real.read_text(encoding='utf-8'))
        line = build_fingerprint.fingerprint_line('repo', manifest)
        self.assertIn(manifest['distContentSha256'], line)
        self.assertTrue(line.endswith(f'({len(manifest["files"])} Dateien)'))

    def test_rejects_incomplete_manifests(self) -> None:
        for manifest in (
            {},
            {'distContentSha256': 'abc', 'files': []},
            {'distContentSha256': 'g' * 64, 'files': []},  # CodeRabbit (#32): length alone was accepted
            {'distContentSha256': self.DIGEST},
            {'distContentSha256': self.DIGEST, 'files': True},
        ):
            with self.subTest(manifest=manifest), self.assertRaises(ValueError):
                build_fingerprint.fingerprint_line('x', manifest)

    def test_main_without_step_summary_only_prints(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            manifest = Path(tmp, 'm.json')
            manifest.write_text(json.dumps({'distContentSha256': self.DIGEST, 'files': 2}), encoding='utf-8')
            with mock.patch.dict(os.environ, {}, clear=True), redirect_stdout(io.StringIO()) as out:
                self.assertEqual(build_fingerprint.main(['x', 'lokal', str(manifest)]), 0)
            self.assertEqual(out.getvalue(), f'lokal: distContentSha256 {self.DIGEST} (2 Dateien)\n')
            self.assertEqual(sorted(os.listdir(tmp)), ['m.json'])

    def test_main_writes_step_summary_and_reports_errors(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            manifest = Path(tmp, 'm.json')
            manifest.write_text(json.dumps({'distContentSha256': self.DIGEST, 'files': []}), encoding='utf-8')
            summary = Path(tmp, 'summary.md')
            os.environ['GITHUB_STEP_SUMMARY'] = str(summary)
            try:
                with redirect_stdout(io.StringIO()):
                    self.assertEqual(build_fingerprint.main(['x', 'Node 22', str(manifest)]), 0)
            finally:
                del os.environ['GITHUB_STEP_SUMMARY']
            expected = f'- Node 22: distContentSha256 {self.DIGEST} (0 Dateien)\n'
            self.assertEqual(summary.read_text(encoding='utf-8'), expected)
            with redirect_stderr(io.StringIO()) as err:
                self.assertEqual(build_fingerprint.main(['x', 'y', str(Path(tmp, 'fehlt.json'))]), 1)
            self.assertIn('build_fingerprint:', err.getvalue())


@unittest.skipUnless(BASH and os.name == 'posix', 'needs bash on a POSIX system')
class ToolchainScriptTest(unittest.TestCase):
    """tools/check-toolchain.sh --android with fake node/javac binaries and a fake SDK."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.path_bin = self.root / 'path-bin'
        fake_tool(self.path_bin, 'node', '24.11.0')
        sdk = self.root / 'sdk'
        (sdk / 'platforms' / 'android-36').mkdir(parents=True)
        (sdk / 'build-tools' / '35.0.0').mkdir(parents=True)
        self.env = {key: value for key, value in os.environ.items() if key not in ('JAVA_HOME', 'ANDROID_SDK_ROOT')}
        self.env['PATH'] = f'{self.path_bin}{os.pathsep}{os.environ.get("PATH", "")}'
        self.env['ANDROID_HOME'] = str(sdk)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def jdk(self, name: str, javac_output: str | None, java_version: str = '21.0.5') -> Path:
        home = self.root / name
        (home / 'bin').mkdir(parents=True)
        if javac_output is not None:
            fake_tool(home / 'bin', 'javac', javac_output)
        fake_tool(home / 'bin', 'java', f'openjdk version "{java_version}" 2024-10-15')
        return home

    def run_script(self, java_home: Path | None) -> tuple[int, str]:
        env = dict(self.env)
        if java_home is not None:
            env['JAVA_HOME'] = str(java_home)
        done = subprocess.run(  # noqa: S603 - fixed argv, test-owned script
            [BASH, str(TOOLCHAIN_SCRIPT), '--android'], capture_output=True, text=True, check=False, env=env
        )
        return done.returncode, done.stdout

    def test_java_home_wins_over_a_jdk_21_on_path(self) -> None:
        # CodeRabbit (#32): javac 21 on PATH passed although Gradle runs the JDK 17 from JAVA_HOME.
        fake_tool(self.path_bin, 'javac', 'javac 21.0.5')
        code, out = self.run_script(self.jdk('jdk17', 'javac 17.0.12'))
        self.assertEqual(code, 1, out)
        self.assertIn("[FAIL] javac-Version 'javac 17.0.12' aus JAVA_HOME statt 21", out)

    def test_jdk_21_from_java_home_passes_despite_tool_options_banner(self) -> None:
        fake_tool(self.path_bin, 'javac', 'javac 17.0.12')
        code, out = self.run_script(self.jdk('jdk21', 'Picked up JAVA_TOOL_OPTIONS: -Dx=y\njavac 21.0.5'))
        self.assertEqual(code, 0, out)
        self.assertIn('[OK]   javac 21.0.5 (JDK 21, aus JAVA_HOME)', out)

    def test_path_is_used_without_java_home(self) -> None:
        fake_tool(self.path_bin, 'javac', 'javac 21.0.5')
        fake_tool(self.path_bin, 'java', 'openjdk version "21.0.5" 2024-10-15')
        code, out = self.run_script(None)
        self.assertEqual(code, 0, out)
        self.assertIn('(JDK 21, aus PATH)', out)

    def test_node_version_boundaries_follow_the_engines_range(self) -> None:
        # app/package.json: "^22.18.0 || ^24.0.0"
        for version, expected in [
            ('22.17.1', 1),
            ('22.18.0', 0),
            ('22.20.3', 0),
            ('23.0.0', 1),
            ('24.0.0', 0),
            ('24.11.1', 0),
            ('20.19.0', 1),
            ('25.1.0', 1),
        ]:
            with self.subTest(version=version):
                fake_tool(self.path_bin, 'node', version)
                done = subprocess.run(  # noqa: S603 - fixed argv, test-owned script
                    [BASH, str(TOOLCHAIN_SCRIPT)], capture_output=True, text=True, check=False, env=self.env
                )
                self.assertEqual(done.returncode, expected, done.stdout)

    def test_older_runtime_next_to_javac_21_fails(self) -> None:
        # CodeRabbit (#32, round 3): javac 21 passed although 'java' was still JDK 17.
        fake_tool(self.path_bin, 'javac', 'javac 21.0.5')
        fake_tool(self.path_bin, 'java', 'openjdk version "17.0.12" 2024-07-16')
        code, out = self.run_script(None)
        self.assertEqual(code, 1, out)
        self.assertIn('[FAIL] java-Laufzeit', out)
        code, out = self.run_script(self.jdk('mixed', 'javac 21.0.5', java_version='17.0.12'))
        self.assertEqual(code, 1, out)
        self.assertIn('aus JAVA_HOME statt 21', out)

    def test_java_home_without_compiler_fails(self) -> None:
        fake_tool(self.path_bin, 'javac', 'javac 21.0.5')
        code, out = self.run_script(self.jdk('jre21', None))
        self.assertEqual(code, 1, out)
        self.assertIn('[FAIL] javac fehlt (JAVA_HOME)', out)


class LinkPropertyTest(unittest.TestCase):
    """Generated cases (fixed seed) instead of single examples."""

    ALPHABET = 'abcXYZ09 _-.()äß&+#%[]'

    def names(self, count: int) -> list[str]:
        rng = random.Random(32)
        names: set[str] = set()
        while len(names) < count:
            name = ''.join(rng.choice(self.ALPHABET) for _ in range(rng.randint(1, 12))).strip(' .')
            if name:
                names.add(name + '.md')
        return sorted(names)

    def test_existing_files_are_never_reported_and_missing_ones_always(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            names = self.names(150)
            for name in names:
                (root / 'docs').mkdir(exist_ok=True)
                (root / 'docs' / name).write_text('', encoding='utf-8')
            links = [f'[l](docs/{urllib.parse.quote(name)})' for name in names]
            links += [f'[m](docs/fehlt-{urllib.parse.quote(name)})' for name in names]
            write(root, 'README.md', '\n\n'.join(links))
            checked, broken = check_markdown_links.find_broken(str(root))
        self.assertEqual(checked, 2 * len(names))
        self.assertEqual(
            sorted(target for _, target in broken), sorted(f'docs/fehlt-{urllib.parse.quote(name)}' for name in names)
        )

    def test_pathological_input_is_processed_in_linear_time(self) -> None:
        # CWE-1333: doubling hostile input must roughly double the time (quadratic would be ~4x).
        # A ratio instead of a fixed time limit, so slow runners and coverage cannot make it flaky.
        for unit in ('[', '](', '![', '`', '[a](', '[x]: a'):
            with self.subTest(unit=unit):
                single = fastest_run(check_markdown_links.link_targets, unit * 4000)
                double = fastest_run(check_markdown_links.link_targets, unit * 8000)
                self.assertLess(double / max(single, 1e-4), 3.0)


if __name__ == '__main__':
    unittest.main()
