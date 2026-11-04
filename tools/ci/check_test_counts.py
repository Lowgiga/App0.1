#!/usr/bin/env python3
"""Check that the test counts stated in README.md match the tests that actually exist.

Stale counts were the most frequent self-found error on this branch. The tool
counts tests with unittest's own loader (the same discovery the CI runs) and
compares them with:

- the single "Python-Tests" badge (sum over all tool directories), and
- every table whose header has a "Tests" column: in a row whose first link
  points to tools/<dir>/<module>.py, the first number of the Tests cell must
  equal the tests in tools/<dir>/test_<module>.py, or, if that file does not
  exist, all tests in tools/<dir>.

A test module that fails to import is not counted as one test (unittest's
placeholder); it makes the check fail, like an unreadable README.

    python tools/ci/check_test_counts.py [repo_root]

Exit codes: 0 consistent, 1 mismatch, 2 README or test discovery unusable.
"""

from __future__ import annotations

import re
import sys
import unittest
from pathlib import Path

from markdown_it import MarkdownIt
from markdown_it.token import Token

TOOL_DIRS = ('tools/ci', 'tools/repo', 'tools/windows')
TESTS_HEADER = 'Tests'
BADGE = re.compile(r'img\.shields\.io/badge/Python--Tests-(\d+)_')
TOOL_LINK = re.compile(r'^(tools/[a-z0-9_]+)/([a-z0-9_]+)\.py$')
FIRST_NUMBER = re.compile(r'\d+')
PARSER = MarkdownIt('commonmark').enable(['table', 'strikethrough'])


def count_tests(directory: Path, pattern: str = 'test_*.py') -> int:
    if not directory.is_dir():
        raise ValueError(f'{directory}: not a directory')
    loader = unittest.TestLoader()
    suite = loader.discover(str(directory), pattern=pattern, top_level_dir=str(directory))
    if loader.errors:
        first = loader.errors[0].strip().splitlines()[-1]
        raise ValueError(f'{directory}: {len(loader.errors)} test module(s) failed to load ({first})')
    return suite.countTestCases()


def visible_text(inline: Token) -> str:
    """Text a reader sees in a cell: markup and link targets dropped, whitespace collapsed."""
    parts = [c.content for c in inline.children or [] if c.type in ('text', 'code_inline')]
    return ' '.join(''.join(parts).split())


def _tables(tokens: list[Token]) -> list[tuple[list[str], list[list[Token]]]]:
    """(header texts, body rows of inline tokens) for every table."""
    tables: list[tuple[list[str], list[list[Token]]]] = []
    header: list[str] = []
    row: list[Token] = []
    in_body = False
    for token in tokens:
        if token.type == 'table_open':
            header, in_body = [], False
            tables.append((header, []))
        elif token.type == 'tbody_open':
            in_body = True
        elif token.type == 'tr_open':
            row = []
        elif token.type == 'inline' and tables:
            row.append(token)
        elif token.type == 'tr_close':
            if in_body:
                tables[-1][1].append(row)
            else:
                header.extend(visible_text(cell) for cell in row)
    return tables


def table_claims(readme: str) -> list[tuple[str, str, int]]:
    """(tool dir, module, stated count) for each row of a table with a Tests column."""
    claims = []
    for header, rows in _tables(PARSER.parse(readme)):
        if TESTS_HEADER not in header:
            continue
        column = header.index(TESTS_HEADER)
        for cells in rows:
            links = [c.attrGet('href') for c in cells[0].children or [] if c.type == 'link_open']
            # The visible text, not the source: a link target such as docs/30-x.md holds digits.
            number = FIRST_NUMBER.search(visible_text(cells[column]))
            if not links or number is None:
                continue
            target = str(links[0]).removeprefix('./')
            if not (target.startswith('tools/') and target.endswith('.py')):
                continue
            match = TOOL_LINK.match(target)
            if match is None:
                raise ValueError(f'cannot map {target!r} to a test module')
            claims.append((match.group(1), match.group(2), int(number.group())))
    return claims


def check(root: Path) -> list[str]:
    readme = (root / 'README.md').read_text(encoding='utf-8')
    badges = BADGE.findall(readme)
    if len(badges) != 1:
        raise ValueError(f'expected one Python-Tests badge, found {len(badges)}')
    claims = table_claims(readme)
    if not claims:
        raise ValueError('README states no test counts in a table with a Tests column')
    per_dir = {d: count_tests(root / d) for d in TOOL_DIRS}
    problems = []
    total = sum(per_dir.values())
    if int(badges[0]) != total:
        problems.append(f'badge says {badges[0]}, discovery finds {total}')
    for tool_dir, module, stated in claims:
        own = root / tool_dir / f'test_{module}.py'
        actual = count_tests(own.parent, own.name) if own.is_file() else per_dir.get(tool_dir)
        if actual != stated:
            problems.append(f'{tool_dir}/{module}.py: README says {stated}, discovery finds {actual}')
    return problems


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    root = Path(args[0] if args else '.')
    try:
        problems = check(root)
    except (OSError, UnicodeDecodeError, ValueError) as error:
        print(f'README or test discovery unusable: {error}', file=sys.stderr)
        return 2
    for problem in problems:
        print(problem, file=sys.stderr)
    if not problems:
        print('README test counts match discovery')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
