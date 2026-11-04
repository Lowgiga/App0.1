"""Tests for check_asset_hashes.py (run: python -m unittest discover -s tools/ci)."""

from __future__ import annotations

import contextlib
import hashlib
import io
import tempfile
import unittest
from pathlib import Path

import check_asset_hashes as cah

REPO = Path(__file__).resolve().parents[2]


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def run(assets: Path) -> tuple[int, str]:
    err = io.StringIO()
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(err):
        code = cah.main([str(assets)])
    return code, err.getvalue()


class AssetHashTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.dir = Path(tmp.name)
        (self.dir / 'a.svg').write_bytes(b'<svg/>')
        (self.dir / 'b.svg').write_bytes(b'<svg></svg>')

    def readme(self, *items: str, heading: str = cah.HEADING) -> None:
        body = '\n'.join(f'- {item}' for item in items)
        text = (
            '# Grafiken\n\n- `x.svg`: kein Hash, andere Liste\n\n'
            f'## {heading}\n\nText.\n\n{body}\n\n## Danach\n\n- `y`\n'
        )
        (self.dir / 'README.md').write_text(text, encoding='utf-8')

    def test_matching_entries_pass(self):
        self.readme(f'`a.svg`: `{sha(b"<svg/>")}`', f'`b.svg`: `{sha(b"<svg></svg>")}`')
        self.assertEqual(run(self.dir), (0, ''))

    def test_changed_missing_unlisted_and_duplicate_files_are_reported(self):
        stale = sha(b'old')
        self.readme(f'`a.svg`: `{stale}`', f'`a.svg`: `{stale}`', f'`gone.svg`: `{stale}`')
        code, err = run(self.dir)
        self.assertEqual(code, 1)
        self.assertIn('a.svg: listed 2 times', err)
        self.assertIn('b.svg: no hash entry', err)
        self.assertIn('gone.svg: listed but missing', err)
        self.assertIn(f'a.svg: recorded {stale[:12]}', err)
        err.encode('ascii')  # no typographic ellipsis: Windows consoles may not encode it

    def test_unusable_readmes_exit_2(self):
        cases = {
            'no entries': lambda: self.readme(heading='Andere Überschrift'),
            'malformed': lambda: self.readme('`a.svg`: kein Hash'),
            'malformed hash': lambda: self.readme('`a.svg`: `ABC`'),
            # Entries describe files in this folder; a path must not certify a file elsewhere.
            'parent path': lambda: self.readme(f'`../a.svg`: `{sha(b"<svg/>")}`'),
            'sub path': lambda: self.readme(f'`sub/a.svg`: `{sha(b"<svg/>")}`'),
            'backslash path': lambda: self.readme(f'`..\\a.svg`: `{sha(b"<svg/>")}`'),
        }
        for label, write in cases.items():
            with self.subTest(label):
                write()
                self.assertEqual(run(self.dir)[0], 2)
        (self.dir / 'README.md').unlink()
        self.assertEqual(run(self.dir)[0], 2)

    def test_repository_assets_match(self):
        self.assertEqual(cah.check(REPO / 'docs/assets'), [])


if __name__ == '__main__':
    unittest.main()
