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
import time
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest import mock

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
        run_git(repo, 'switch', '-q', '-c', 'pr-encoding', main)
        (repo / 'docs' / 'latin1.txt').write_bytes('Grüße aus Köln\n'.encode('latin-1'))
        run_git(repo, 'add', 'docs/latin1.txt')
        cls.encoding = commit(repo, {'docs/utf8.md': 'Es gibt keinen ausführbaren Quellcode.\n'}, 'latin-1 + utf-8')

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

    def test_non_utf8_file_and_umlauts_in_the_diff(self) -> None:
        # CodeRabbit (#32): git output was decoded with the locale codec and strict errors, so a
        # Latin-1 file aborted the whole run and cp1252 garbled the German claim patterns.
        row = self.triage([pr(6, self.encoding)])['rows'][0]
        self.assertNotIn('error', row)
        self.assertEqual(row['claims'], {'stale_no_source_in_repo': 1})
        # CodeRabbit (#32, round 3): replaced bytes must not look like a complete analysis.
        self.assertIn('Nicht-UTF-8', row['incomplete'])
        self.assertIn('UNVOLLSTAENDIG', pr_triage.markdown({'rows': [row]}))
        clean = self.triage([pr(3, self.docs_a)])['rows'][0]
        self.assertNotIn('incomplete', clean)
        # CodeRabbit (#32, round 4): a lossy diff must not take part in the similarity comparison.
        rows = {r['n']: r for r in self.triage([pr(3, self.docs_a), pr(4, self.docs_b), pr(6, self.encoding)])['rows']}
        self.assertNotIn('max_similarity', rows[6])
        self.assertEqual(rows[3]['max_similarity']['pr'], 4)
        self.assertEqual(rows[3]['redundancy'], 1.0)

    def test_git_failure_is_reported_per_pr_not_hidden(self) -> None:
        # CodeRabbit: failing git commands were swallowed and the PR looked empty.
        rows = self.triage([pr(3, self.docs_a), pr(9, 'f' * 40)])['rows']
        self.assertNotIn('error', rows[0])
        self.assertIn('git cat-file', rows[1]['error'])
        self.assertNotIn('empty', rows[1])
        self.assertIn('FEHLER', pr_triage.markdown({'rows': rows}))
        # A head that exists but is no commit must not trigger a fetch either (--no-fetch).
        tree = run_git(self.repo, 'rev-parse', 'main^{tree}')
        self.assertIn('not a commit', self.triage([pr(10, tree)])['rows'][0]['error'])

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
            quiet = [arg for arg in argv if arg not in ('--json', str(out_json), '--markdown')]
            with redirect_stdout(io.StringIO()) as out:
                self.assertEqual(pr_triage.main(quiet), 0)
            self.assertEqual(out.getvalue(), '')  # neither --json nor --markdown: exit code only

    def test_missing_head_is_fetched_from_the_pull_ref_on_origin(self) -> None:
        # The fetch path for real: the head exists only as refs/pull/7/head on 'origin', as on GitHub.
        with tempfile.TemporaryDirectory() as tmp:
            origin, clone = Path(tmp, 'origin.git'), Path(tmp, 'clone')
            run_git(Path(tmp), 'clone', '-q', '--bare', '--no-local', str(self.repo), str(origin))
            run_git(origin, 'update-ref', 'refs/pull/7/head', self.encoding)
            run_git(origin, 'branch', '-q', '-D', 'pr-encoding')
            run_git(origin, 'gc', '-q', '--prune=now')
            run_git(Path(tmp), 'clone', '-q', '--no-local', str(origin), str(clone))
            with self.assertRaises(pr_triage.GitError):
                pr_triage.git(str(clone), 'cat-file', '-t', self.encoding)
            rows = pr_triage.triage(str(clone), [pr(7, self.encoding)], main_ref='origin/main', fetch=True)['rows']
            self.assertNotIn('error', rows[0])
            self.assertEqual(rows[0]['claims'], {'stale_no_source_in_repo': 1})
            self.assertEqual(pr_triage.git(str(clone), 'cat-file', '-t', self.encoding).strip(), 'commit')

    def test_git_missing_from_path_is_a_git_error(self) -> None:
        with mock.patch.object(pr_triage.shutil, 'which', return_value=None), self.assertRaises(pr_triage.GitError):
            pr_triage.git(str(self.repo), 'status')


class UnitTest(unittest.TestCase):
    def test_load_pulls_accepts_list_and_pages(self) -> None:
        one, two = pr(1, 'a' * 40), pr(2, 'b' * 40)
        self.assertEqual(pr_triage.load_pulls([one]), [one])
        self.assertEqual(pr_triage.load_pulls([[one], [two]]), [one, two])
        self.assertEqual(pr_triage.load_pulls([]), [])
        with self.assertRaises(ValueError):
            pr_triage.load_pulls({'number': 1})

    def test_malformed_export_is_rejected_with_the_missing_field(self) -> None:
        # Own finding: a missing field ended in a KeyError traceback (exit 1, same as 'PR with error').
        good = {
            'number': 1,
            'title': 't',
            'state': 'open',
            'created_at': 'x',
            'user': {'login': 'u'},
            'base': {'ref': 'main'},
            'head': {'sha': 'a' * 40},
        }
        self.assertEqual(pr_triage.load_pulls([good]), [good])
        for broken, field in [
            ({**good, 'head': {}}, 'head.sha'),
            ({**good, 'user': None}, 'user.login'),
            ({**good, 'head': {'sha': 123}}, 'head.sha'),
        ]:
            with (
                self.subTest(field=field),
                self.assertRaisesRegex(ValueError, f'entry 0: field {field} (missing|must be)'),
            ):
                pr_triage.load_pulls([broken])

    def test_wrong_types_and_non_objects_are_rejected(self) -> None:
        # CodeRabbit (#32, round 6): head.sha = 123 passed and raised TypeError in analyze_pr.
        good = pr(1, 'a' * 40)
        with self.assertRaisesRegex(ValueError, 'field number must be int'):
            pr_triage.load_pulls([{**good, 'number': '1'}])
        with self.assertRaisesRegex(ValueError, 'field number must be int'):
            pr_triage.load_pulls([{**good, 'number': True}])
        with self.assertRaisesRegex(ValueError, 'not an object'):
            pr_triage.load_pulls(['kein Objekt'])

    def test_cli_reports_unusable_export_with_exit_code_2(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            for name, content in [('kaputt.json', '{'), ('leer.json', '[{"number": 1}]')]:
                path = Path(tmp, name)
                path.write_text(content, encoding='utf-8')
                with self.subTest(name=name), redirect_stderr(io.StringIO()) as err:
                    self.assertEqual(pr_triage.main(['x', '--pulls', str(path)]), 2)
                self.assertIn('pr_triage: --pulls', err.getvalue())
            with redirect_stderr(io.StringIO()):
                self.assertEqual(pr_triage.main(['x', '--pulls', str(Path(tmp, 'fehlt.json'))]), 2)

    def test_patterns_ignore_substrings_and_neighbouring_digits(self) -> None:
        # CodeRabbit (#32): AST, RAM and 403 matched inside 'last', 'program' and '14039'.
        noise = (
            'last fast master program frame parameter ast ram 14039 Solar Studio spatial arrangement '
            '180 % 160 FPS 13,5 MB Punkte 1,2 sind 11.2s 10.5.2'
        )
        self.assertEqual(pr_triage.find_concepts(noise), [])
        self.assertEqual(pr_triage.find_claims(noise), {})

    def test_patterns_still_find_the_real_terms(self) -> None:
        text = 'AST-Pruefung, RAM-Simulation, CONNECT 403 am Proxy, KPI: 60 FPS, 3,5 MB, 1,2 Sekunden, 80 % Coverage'
        self.assertEqual(
            pr_triage.find_concepts(text + ', v0.5.2, P2P und Spatial AR'),
            ['build-blocker', 'drift-guardian', 'kpi-matrix', 'p2p-zk', 'ram-sim', 'spatial-ar'],
        )
        self.assertEqual(
            pr_triage.find_claims(text + ', v0.5.2'),
            {
                'env_specific_javac_proxy403': 1,
                'unmeasured_kpi_fps_bundle': 3,
                'coverage_target_80': 1,
                'stale_version_0_5_2': 1,
            },
        )
        self.assertEqual(pr_triage.find_concepts('ASTs im 403er-Log'), ['build-blocker', 'drift-guardian'])

    def test_shingles_are_word_five_grams(self) -> None:
        self.assertEqual(pr_triage.shingles('eins zwei drei vier'), set())
        self.assertEqual(pr_triage.shingles('A b c d e f'), {'a b c d e', 'b c d e f'})
        self.assertEqual(pr_triage.shingles('Größe, Maß; über: äh 5'), {'größe maß über äh 5'})
        text = ' '.join(f'w{i}' for i in range(40))
        self.assertEqual(len(pr_triage.shingles(text)), 36)

    def test_patterns_are_linear_on_long_input(self) -> None:
        # Doubling the input must roughly double the time (quadratic backtracking would be ~4x).
        def cost(repeat: int) -> float:
            text = ('403' * repeat) + ('AST' * repeat) + ('keinen ' * repeat) + ('1,2 ' * repeat)
            best = float('inf')
            for _ in range(3):
                start = time.perf_counter()
                pr_triage.find_claims(text)
                pr_triage.find_concepts(text)
                best = min(best, time.perf_counter() - start)
            return best

        self.assertLess(cost(40000) / max(cost(20000), 1e-4), 3.0)

    def test_parse_numstat_z(self) -> None:
        output = '3\t1\tdocs/a.md\x00-\t-\tapp/bild.png\x000\t0\t\x00docs/alt.md\x00app/neu.md\x00'
        entries = pr_triage.parse_numstat_z(output)
        self.assertEqual([e.paths for e in entries], [('docs/a.md',), ('app/bild.png',), ('docs/alt.md', 'app/neu.md')])
        self.assertEqual([(e.added, e.deleted) for e in entries], [(3, 1), (None, None), (0, 0)])
        self.assertEqual(pr_triage.parse_numstat_z(''), [])


if __name__ == '__main__':
    unittest.main()
