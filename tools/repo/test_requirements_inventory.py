"""Tests for requirements_inventory.py (run: python -m unittest discover -s tools/repo)."""

from __future__ import annotations

import contextlib
import io
import tempfile
import unicodedata
import unittest
from pathlib import Path
from unittest import mock

import requirements_inventory as inv

REPO = Path(__file__).resolve().parents[2]


def matrix(*rows: str, heading: str = 'Die {n} Anforderungen', header: str = '') -> str:
    header = header or '| ID | Status | Schritt | Abnahme |\n| --- | --- | --- | --- |'
    body = '\n'.join(rows)
    return (
        '# Matrix\n\n## Zählregel\n\n| x | y |\n| --- | --- |\n| a | b |\n\n'
        f'## {heading.format(n=len(rows))}\n\n{header}\n{body}\n\n## Danach\n'
    )


ROW_A = '| AB-01 | **Geprüft (Web):** [x](a.md) | Schritt `eins` mit [Link](b.md) | - |'
ROW_B = '| CD-02 | **Teilweise geprüft:** foo | Schritt zwei | - |'


def run(*argv: str) -> tuple[int, str, str]:
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = inv.main(list(argv))
    return code, out.getvalue(), err.getvalue()


def step_cells(markdown: str) -> list:
    """Inline tokens of the third column of every body row in `markdown`."""
    tokens = inv.PARSER.parse(markdown)
    cells, row, in_body = [], [], False
    for token in tokens:
        if token.type == 'tbody_open':
            in_body = True
        elif token.type == 'tr_open':
            row = []
        elif token.type == 'inline':
            row.append(token)
        elif token.type == 'tr_close' and in_body and len(row) > inv.NEXT_STEP_COLUMN:
            cells.append(row[inv.NEXT_STEP_COLUMN])
        elif token.type == 'table_close':
            in_body = False
    return cells


class ParseTest(unittest.TestCase):
    def test_real_matrix_has_27_unique_requirements_with_known_classes(self):
        declared, reqs = inv.parse_matrix(inv.DEFAULT_MATRIX.read_text(encoding='utf-8'))
        self.assertEqual(declared, 27)
        self.assertEqual(len({r.rid for r in reqs}), 27)
        # LEARN-01 has a five-letter prefix; a {2,4} line regex silently dropped it once.
        self.assertIn('LEARN-01', {r.rid for r in reqs})

    def test_default_matrix_does_not_depend_on_the_working_directory(self):
        self.assertTrue(inv.DEFAULT_MATRIX.is_absolute())
        self.assertEqual(inv.DEFAULT_MATRIX, REPO / 'docs' / '16-acceptance-matrix.md')

    def test_cells_are_reduced_to_visible_text_and_code_stays_code(self):
        _, reqs = inv.parse_matrix(matrix(ROW_A, ROW_B))
        self.assertEqual(reqs[0], inv.Requirement('AB-01', 'Geprüft (Web)', 'Geprüft', 'Schritt `eins` mit Link'))
        self.assertEqual(reqs[1].status_class, 'Teilweise geprüft')

    def test_partial_status_is_not_counted_as_fully_checked(self):
        self.assertEqual(inv.classify('Teilweise geprüft'), 'Teilweise geprüft')
        self.assertEqual(inv.classify('Geprüft im Bestand'), 'Geprüft')
        # The first word decides, so combined labels are never counted upwards.
        self.assertEqual(inv.classify('Implementiert und Suite-geprüft'), 'Implementiert')

    def test_decomposed_umlauts_from_macos_are_normalised(self):
        nfd = unicodedata.normalize('NFD', 'Geprüft')
        self.assertNotEqual(nfd, 'Geprüft')
        _, reqs = inv.parse_matrix(matrix(f'| AB-01 | **{nfd}:** x | s | a |'))
        self.assertEqual((reqs[0].status, reqs[0].status_class), ('Geprüft', 'Geprüft'))

    def test_unclosed_bold_like_on_github_is_rejected(self):
        # CommonMark: '**' after ':' and before a digit is not right-flanking, so it stays literal.
        with self.assertRaisesRegex(inv.MatrixError, 'bold status'):
            inv.parse_matrix(matrix('| AB-01 | **Implementiert:**17 Bereiche | s | a |'))

    def test_unusable_tables_are_rejected(self):
        cases = {
            'unknown status': matrix('| AB-01 | **Erledigt:** x | s | a |'),
            'duplicate ids': matrix(ROW_A, ROW_A),
            'invalid requirement id': matrix('| ab-1 | **Offen:** x | s | a |'),
            'declares 5': matrix(ROW_A, heading='Die 5 Anforderungen'),
            'no table': '# Nur Text\n\n## Die 3 Anforderungen\n\nkeine Tabelle\n',
            'empty next step': matrix('| AB-01 | **Offen:** x |'),
            'at least 3 columns': matrix('| AB-01 |', header='| ID |\n| --- |'),
            'first named ID': matrix(ROW_A, header='| Key | Status | Schritt | A |\n| --- | --- | --- | --- |'),
        }
        for message, text in cases.items():
            with self.subTest(message), self.assertRaisesRegex(inv.MatrixError, message):
                inv.parse_matrix(text)

    def test_table_before_the_heading_does_not_count(self):
        text = '## Die 1 Anforderungen\n\nText\n\n## Andere\n\n' + matrix(ROW_A)
        _, reqs = inv.parse_matrix(text)
        self.assertEqual([r.rid for r in reqs], ['AB-01'])


class RenderTest(unittest.TestCase):
    def test_rendered_cells_read_back_as_the_original_text(self):
        # Code spans and escapes in the matrix must not turn into links, emphasis,
        # strikethrough, entities or extra table cells in the generated document.
        cells = [
            'Pfad `**/*.svg` prüfen',
            'Text `[x](fehlt.md)` wörtlich',
            'Pipe a \\| b und `c\\|d`',
            'Backticks `` a`b `` und `` `x` ``',
            'Escapes \\*a\\* \\_b\\_ \\$c\\$ \\~\\~d\\~\\~ \\[e\\](f) \\<g\\> \\\\ h',
            'Entity &amp;copy; bleibt Text',
        ]
        rows = [f'| AB-{i:02d} | **Offen:** x | {cell} | a |' for i, cell in enumerate(cells)]
        source = matrix(*rows)
        _, reqs = inv.parse_matrix(source)
        originals = step_cells(source[source.index('## Die') :])  # skip the earlier Zählregel table
        block = inv.render(reqs)
        rendered = step_cells(block[block.index('| ID |') :])  # skip the summary table
        self.assertEqual(len(originals), len(cells))
        self.assertEqual(len(rendered), len(cells))
        for cell, original, again in zip(cells, originals, rendered, strict=True):
            with self.subTest(cell):
                self.assertEqual(inv.plain_text(again), inv.plain_text(original))
                self.assertLessEqual({c.type for c in again.children or []}, {'text', 'code_inline'})

    def test_code_spans_keep_interior_spaces_while_prose_is_collapsed(self):
        # CodeRabbit (#32, round on 96277b1): whitespace normalisation must not alter code.
        _, reqs = inv.parse_matrix(matrix('| AB-01 | **Offen:** x |  Code `a  b` und `  c`   hier  | a |'))
        self.assertEqual(reqs[0].next_step, 'Code `a  b` und `  c` hier')
        rendered = step_cells(inv.render(reqs)[inv.render(reqs).index('| ID |') :])[0]
        codes = [c.content for c in rendered.children or [] if c.type == 'code_inline']
        self.assertEqual(codes, ['a  b', '  c'])

    def test_pipes_are_escaped_and_every_class_is_listed(self):
        req = inv.Requirement('AB-01', 'Offen | x', 'Offen', 'a \\| b')
        block = inv.render([req])
        self.assertIn('| AB-01 | Offen \\| x | a \\| b |', block)
        self.assertIn('| Geprüft | 0 | keine |', block)
        self.assertTrue(block.startswith(inv.START) and block.endswith(inv.END))

    def test_splice_requires_exactly_one_ordered_pair_of_markers(self):
        bad = [
            (f'{inv.END}\n{inv.START}', 'end marker before start'),
            ('no markers', 'exactly one'),
            (f'{inv.START}{inv.END}{inv.START}', 'exactly one'),
        ]
        for document, message in bad:
            with self.subTest(document), self.assertRaisesRegex(ValueError, message):
                inv.splice(document, 'x')
        self.assertEqual(inv.splice(f'a{inv.START}old{inv.END}b', 'NEW'), 'aNEWb')


class CliTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.tmp = Path(tmp.name)
        self.matrix = self.tmp / 'm.md'
        self.matrix.write_text(matrix(ROW_A, ROW_B), encoding='utf-8')
        self.doc = self.tmp / 'doc.md'
        self.doc.write_text(f'# Doc\n\n{inv.START}\n{inv.END}\n\nRest\n', encoding='utf-8')

    def test_write_then_check_round_trip_and_stale_detection(self):
        self.assertEqual(run('--matrix', str(self.matrix), '--check', str(self.doc))[0], 1)
        self.assertEqual(run('--matrix', str(self.matrix), '--write', str(self.doc))[0], 0)
        written = self.doc.read_text(encoding='utf-8')
        self.assertTrue(written.endswith('\n\nRest\n'))
        self.assertEqual(run('--matrix', str(self.matrix), '--write', str(self.doc))[0], 0)
        self.assertEqual(self.doc.read_text(encoding='utf-8'), written)
        self.assertEqual(run('--matrix', str(self.matrix), '--check', str(self.doc))[0], 0)
        self.matrix.write_text(matrix(ROW_A), encoding='utf-8')
        code, _, err = run('--matrix', str(self.matrix), '--check', str(self.doc))
        self.assertEqual(code, 1)
        self.assertIn('stale', err)

    def test_print_mode_and_error_exit_codes(self):
        code, out, _ = run('--matrix', str(self.matrix))
        self.assertEqual(code, 0)
        self.assertIn('| CD-02 |', out)
        self.assertEqual(run('--matrix', str(self.tmp / 'missing.md'))[0], 2)
        self.matrix.write_bytes(b'\xff\xfe')
        self.assertEqual(run('--matrix', str(self.matrix))[0], 2)
        self.matrix.write_text(matrix(ROW_A), encoding='utf-8')
        self.assertEqual(run('--matrix', str(self.matrix), '--check', str(self.tmp / 'nope.md'))[0], 1)
        self.doc.write_text('no markers', encoding='utf-8')
        self.assertEqual(run('--matrix', str(self.matrix), '--write', str(self.doc))[0], 1)

    def test_unwritable_target_is_reported_not_raised(self):
        with mock.patch.object(Path, 'write_text', side_effect=PermissionError('read-only')):
            code, _, err = run('--matrix', str(self.matrix), '--write', str(self.doc))
        self.assertEqual(code, 1)
        self.assertIn('read-only', err)

    def test_duplicate_markers_are_not_silently_kept(self):
        self.doc.write_text(f'{inv.START}\n{inv.END}\nText\n{inv.START}\n', encoding='utf-8')
        code, _, err = run('--matrix', str(self.matrix), '--write', str(self.doc))
        self.assertEqual(code, 1)
        self.assertIn('exactly one', err)

    def test_repository_inventory_is_current(self):
        code, _, err = run('--check', str(REPO / 'docs/37-bestandsaufnahme.md'))
        self.assertEqual(code, 0, err)


if __name__ == '__main__':
    unittest.main()
