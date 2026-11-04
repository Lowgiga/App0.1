"""Tests for the CI helper scripts (standard library only).

Run: python3 -m unittest discover -s tools/ci -p 'test_*.py'
"""

from __future__ import annotations

import io
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_fingerprint
import check_markdown_links


def write(root: Path, rel: str, text: str = '') -> None:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')


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
        self.assertEqual(targets, ['docs/a b.md', 'c.md'])


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

    def test_skips_pinned_zones_and_build_output(self) -> None:
        for rel in ('app/upstream/x.md', 'app/vendor/y.md', 'node_modules/z.md', 'app/dist/w.md'):
            write(self.root, rel, '[kaputt](fehlt.md)')
        self.assertEqual(check_markdown_links.find_broken(str(self.root)), (0, []))

    def test_main_exit_code(self) -> None:
        write(self.root, 'README.md', '[kaputt](fehlt.md)')
        with redirect_stdout(io.StringIO()) as out:
            self.assertEqual(check_markdown_links.main(['x', str(self.root)]), 1)
        self.assertIn('BROKEN README.md -> fehlt.md', out.getvalue())


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
            {'distContentSha256': self.DIGEST},
            {'distContentSha256': self.DIGEST, 'files': True},
        ):
            with self.subTest(manifest=manifest), self.assertRaises(ValueError):
                build_fingerprint.fingerprint_line('x', manifest)

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


if __name__ == '__main__':
    unittest.main()
