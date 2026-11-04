"""Tests for pr_triage.py against a real temporary git repository (standard library + git).

Each CodeRabbit finding on pr_triage.py (PR #30) has a regression case here.
Run: python3 -m unittest discover -s tools/repo -p 'test_*.py'
"""

from __future__ import annotations

import io
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pr_triage

GIT = shutil.which('git')
TEXT = ' '.join(f'Abschnitt {i} beschreibt die Pruefung der Quellkette ohne Aenderung am Code' for i in range(12))


def run_git(repo: Path, *args: str) -> str:
    env = {
        'GIT_AUTHOR_NAME': 'T',
        'GIT_AUTHOR_EMAIL': 't@example.invalid',
        'GIT_COMMITTER_NAME': 'T',
        'GIT_COMMITTER_EMAIL': 't@example.invalid',
        'GIT_CONFIG_GLOBAL': '/dev/null',
        'PATH': '/usr/bin:/bin',
    }
    done = subprocess.run([GIT, '-C', str(repo), *args], capture_output=True, text=True, check=True, env=env)  # noqa: S603
    return done.stdout.strip()


def commit(repo: Path, files: dict[str, str | None], message: str) -> str:
    for rel, content in files.items():
        path = repo / rel
        if content is None:
            run_git(repo, 'rm', '-q', rel)
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding='utf-8')
        run_git(repo, 'add', rel)
    run_git(repo, 'commit', '-q', '-m', message)
    return run_git(repo, 'rev-parse', 'HEAD')


def pr(number: int, head: str, base: str = 'main', state: str = 'open') -> dict:
    return {
        'number': number,
        'title': f'PR {number}',
        'user': {'login': 'bot'},
        'created_at': '2026-11-03T00:00:00Z',
        'state': state,
        'draft': False,
        'base': {'ref': base},
        'head': {'sha': head},
        'merged_at': None,
    }


@unittest.skipIf(GIT is None, 'git not installed')
class TriageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._tmp = tempfile.TemporaryDirectory()
        repo = cls.repo = Path(cls._tmp.name)
        run_git(repo, 'init', '-q', '-b', 'main')
        main = commit(repo, {'docs/README.md': 'Doku\n'}, 'docs-only main')
        run_git(repo, 'switch', '-q', '-c', 'source')
        commit(repo, {'app/x.ts': 'export const x = 1;\n'}, 'source line')
        run_git(repo, 'switch', '-q', '-c', 'pr-umlaut')
        cls.umlaut = commit(repo, {'app/Über.md': 'neu\n'}, 'non-ascii app path')
        run_git(repo, 'switch', '-q', '-c', 'pr-docs-a', main)
        cls.docs_a = commit(repo, {'docs/a.md': TEXT}, 'docs a')
        run_git(repo, 'switch', '-q', '-c', 'pr-docs-b', main)
        cls.docs_b = commit(repo, {'docs/b.md': TEXT}, 'docs b (literal copy)')
        run_git(repo, 'switch', '-q', '-c', 'pr-rename', main)
        commit(repo, {'docs/move.md': 'wandert\n' * 20}, 'add file')
        run_git(repo, 'switch', '-q', 'main')
        run_git(repo, 'merge', '-q', '--ff-only', 'pr-rename')
        run_git(repo, 'switch', '-q', 'pr-rename')
        (repo / 'app').mkdir(exist_ok=True)  # git mv needs an existing target directory
        run_git(repo, 'mv', 'docs/move.md', 'app/moved.md')
        run_git(repo, 'commit', '-q', '-m', 'rename into app/')
        cls.rename = run_git(repo, 'rev-parse', 'HEAD')
        cls.empty = run_git(repo, 'rev-parse', 'main')

    @classmethod
    def tearDownClass(cls) -> None:
        cls._tmp.cleanup()

    def triage(self, pulls):
        return pr_triage.triage(str(self.repo), pulls, main_ref='main', remote_prefix='', fetch=False)

    def test_non_ascii_and_renamed_paths_count_as_app_changes(self) -> None:
        # CodeRabbit: quoted non-ASCII paths and rename records missed the app/ prefix check.
        rows = {r['n']: r for r in self.triage([pr(1, self.umlaut, base='source'), pr(2, self.rename)])['rows']}
        self.assertTrue(rows[1]['touches_app'])
        self.assertTrue(rows[2]['touches_app'])
        self.assertEqual(rows[2]['files'], 1)

    def test_base_classification_uses_the_merge_base(self) -> None:
        # CodeRabbit: only the target branch name was reported, not the T2 classification.
        rows = {r['n']: r for r in self.triage([pr(1, self.umlaut, base='source'), pr(3, self.docs_a)])['rows']}
        self.assertEqual(rows[1]['base_line'], 'source')
        self.assertEqual(rows[3]['base_line'], 'docs-only')
        self.assertEqual(len(rows[3]['merge_base']), 7)

    def test_empty_pr_and_literal_copies(self) -> None:
        rows = {r['n']: r for r in self.triage([pr(3, self.docs_a), pr(4, self.docs_b), pr(5, self.empty)])['rows']}
        self.assertTrue(rows[5]['empty'])
        self.assertEqual(rows[3]['max_similarity'], {'pr': 4, 'jaccard': 1.0})
        self.assertIn('patch-chain', rows[3]['concepts'])

    def test_git_failure_is_reported_per_pr_not_hidden(self) -> None:
        # CodeRabbit: failing git commands were swallowed and the PR looked empty.
        rows = self.triage([pr(3, self.docs_a), pr(9, 'f' * 40)])['rows']
        self.assertNotIn('error', rows[0])
        self.assertIn('git cat-file', rows[1]['error'])
        self.assertNotIn('empty', rows[1])
        self.assertIn('FEHLER', pr_triage.markdown({'rows': rows}))

    def test_cli_exit_codes_and_slurped_pages(self) -> None:
        # CodeRabbit: only the first page of a paginated export was used.
        with tempfile.TemporaryDirectory() as tmp:
            pulls = Path(tmp, 'pulls.json')
            pulls.write_text(json.dumps([[pr(3, self.docs_a)], [pr(4, self.docs_b)]]), encoding='utf-8')
            out_json = Path(tmp, 'out.json')
            argv = [
                'x',
                '--repo',
                str(self.repo),
                '--pulls',
                str(pulls),
                '--main-ref',
                'main',
                '--remote-prefix',
                '',
                '--no-fetch',
                '--json',
                str(out_json),
                '--markdown',
            ]
            with redirect_stdout(io.StringIO()) as out:
                self.assertEqual(pr_triage.main(argv), 0)
            self.assertEqual([r['n'] for r in json.loads(out_json.read_text(encoding='utf-8'))['rows']], [3, 4])
            self.assertIn('main @', out.getvalue())
            bad_ref = [*argv[:6], 'nicht-da', *argv[7:]]
            with redirect_stderr(io.StringIO()) as err:
                self.assertEqual(pr_triage.main(bad_ref), 2)
            self.assertIn('pr_triage: git rev-parse nicht-da', err.getvalue())


class UnitTest(unittest.TestCase):
    def test_load_pulls_accepts_list_and_pages(self) -> None:
        self.assertEqual(pr_triage.load_pulls([{'number': 1}]), [{'number': 1}])
        self.assertEqual(pr_triage.load_pulls([[{'number': 1}], [{'number': 2}]]), [{'number': 1}, {'number': 2}])
        self.assertEqual(pr_triage.load_pulls([]), [])
        with self.assertRaises(ValueError):
            pr_triage.load_pulls({'number': 1})

    def test_parse_numstat_z(self) -> None:
        output = '3\t1\tdocs/a.md\x00-\t-\tapp/bild.png\x000\t0\t\x00docs/alt.md\x00app/neu.md\x00'
        entries = pr_triage.parse_numstat_z(output)
        self.assertEqual([e.paths for e in entries], [('docs/a.md',), ('app/bild.png',), ('docs/alt.md', 'app/neu.md')])
        self.assertEqual([(e.added, e.deleted) for e in entries], [(3, 1), (None, None), (0, 0)])
        self.assertEqual(pr_triage.parse_numstat_z(''), [])


if __name__ == '__main__':
    unittest.main()
