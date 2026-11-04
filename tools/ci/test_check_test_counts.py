"""Tests for check_test_counts.py (run: python -m unittest discover -s tools/ci)."""

from __future__ import annotations

import contextlib
import io
import itertools
import tempfile
import unittest
from pathlib import Path

import check_test_counts as ctc

REPO = Path(__file__).resolve().parents[2]
_unique = itertools.count()
HEADER = '| Werkzeug | Zweck | Tests |\n| --- | --- | --- |\n'


def test_file(n: int, prelude: str = '') -> str:
    methods = ''.join(f'    def test_{i}(self):\n        pass\n' for i in range(n))
    return f'{prelude}import unittest\n\n\nclass T(unittest.TestCase):\n{methods}'


class FixtureRepo:
    """A minimal repository with distinct test module names (discovery caches modules by name)."""

    def __init__(self, case: unittest.TestCase, ci: int = 2, tool: int = 3, other: int = 1, windows: int = 4):
        tmp = tempfile.TemporaryDirectory()
        case.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.tag = next(_unique)
        self.tool = f'fx_tool_{self.tag}'
        self.write(f'tools/ci/test_fx_ci_{self.tag}.py', test_file(ci))
        self.write(f'tools/repo/test_{self.tool}.py', test_file(tool))
        self.write(f'tools/repo/test_fx_other_{self.tag}.py', test_file(other))
        self.write(f'tools/windows/test_fx_win_{self.tag}.py', test_file(windows))

    def write(self, rel: str, text: str) -> None:
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding='utf-8')

    def readme(self, badge: int, rows: str, header: str = HEADER) -> None:
        text = f'![Python-Tests](https://img.shields.io/badge/Python--Tests-{badge}_lokal-2ea043)\n\n{header}{rows}'
        self.write('README.md', text)


def run(root: Path) -> tuple[int, str]:
    err = io.StringIO()
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(err):
        code = ctc.main([str(root)])
    return code, err.getvalue()


class CheckTestCountsTest(unittest.TestCase):
    def test_consistent_readme_passes_with_file_and_directory_counts(self):
        repo = FixtureRepo(self)
        repo.readme(
            10,
            (
                f'| [`t`](tools/repo/{repo.tool}.py) | eigene Testdatei | 3 |\n'
                '| [`c`](./tools/ci/check.py) | ganzes Verzeichnis | 2 (ganzes `tools/ci`) |\n'
                '| [`w`](tools/windows/audit.py) | Verzeichnis | in den 4 enthalten |\n'
                '| [`s`](tools/check.sh) | kein Python | über die CI |\n'
                '| [`d`](docs/x.md) | keine Werkzeugdatei | 7 |\n'
                '| ohne Link | x | 99 |\n'
            ),
        )
        self.assertEqual(run(repo.root), (0, ''))

    def test_stale_badge_and_rows_are_reported(self):
        repo = FixtureRepo(self)
        repo.readme(9, f'| [`t`](tools/repo/{repo.tool}.py) | x | 4 |\n| [`c`](tools/ci/c.py) | x | 2 |\n')
        code, err = run(repo.root)
        self.assertEqual(code, 1)
        self.assertIn('badge says 9, discovery finds 10', err)
        self.assertIn(f'tools/repo/{repo.tool}.py: README says 4, discovery finds 3', err)
        self.assertNotIn('tools/ci/c.py', err)

    def test_a_module_that_fails_to_import_is_not_counted_as_one_test(self):
        # unittest turns an import error into a single placeholder test; a README that states
        # exactly that number must not pass while the module's real tests never run.
        repo = FixtureRepo(self, ci=2)
        repo.write(f'tools/ci/test_fx_ci_{repo.tag}.py', test_file(2, prelude='import module_that_does_not_exist\n'))
        repo.readme(9, '| [`c`](tools/ci/c.py) | x | 1 |\n')
        code, err = run(repo.root)
        self.assertEqual(code, 2)
        self.assertIn('failed to load', err)
        self.assertIn('module_that_does_not_exist', err)

    def test_missing_tool_directory_exits_2_instead_of_raising(self):
        repo = FixtureRepo(self)
        repo.readme(10, '| [`c`](tools/ci/c.py) | x | 2 |\n')
        for path in (repo.root / 'tools/windows').iterdir():
            path.unlink()
        (repo.root / 'tools/windows').rmdir()
        code, err = run(repo.root)
        self.assertEqual(code, 2)
        self.assertIn('not a directory', err)

    def test_only_the_tests_column_of_tables_that_have_one_counts(self):
        other_table = '| Werkzeug | PR |\n| --- | --- |\n| [x](tools/ci/check_markdown_links.py) | seit 32 |\n'
        self.assertEqual(ctc.table_claims(other_table), [])
        middle = '| Werkzeug | Tests | Notiz |\n| --- | --- | --- |\n| [x](tools/ci/a.py) | 5 | Stand 2026 |\n'
        self.assertEqual(ctc.table_claims(middle), [('tools/ci', 'a', 5)])

    def test_unmappable_tool_links_are_errors_not_silent_skips(self):
        with self.assertRaisesRegex(ValueError, 'cannot map'):
            ctc.table_claims(HEADER + '| [y](tools/ci/b-c.py) | x | 4 |\n')

    def test_unusable_readme_exits_2(self):
        repo = FixtureRepo(self)
        self.assertEqual(run(repo.root)[0], 2)  # no README at all
        repo.write('README.md', HEADER + '| [x](tools/ci/c.py) | y | 2 |\n')
        self.assertIn('found 0', run(repo.root)[1])
        repo.readme(10, '| [x](tools/ci/c.py) | y | 2 |\n![b](https://img.shields.io/badge/Python--Tests-10_x-1)\n')
        self.assertIn('found 2', run(repo.root)[1])
        repo.readme(10, '')
        self.assertIn('no test counts', run(repo.root)[1])

    def test_repository_readme_matches_discovery(self):
        self.assertEqual(ctc.check(REPO), [])


if __name__ == '__main__':
    unittest.main()
