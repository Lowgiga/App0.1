#!/usr/bin/env python3
"""Check the SHA-256 list in docs/assets/README.md against the SVG files.

Each list item under the heading "SHA-256 der SVG-Dateien" has the form
`` `name.svg`: `<sha256>` ``. Every SVG in the directory needs exactly one
entry and every entry must match the file. A graphic edited without updating
its hash (it happened once on this branch) fails the CI.

    python tools/ci/check_asset_hashes.py [assets_dir]

Exit codes: 0 consistent, 1 mismatch, 2 README unusable.
"""

from __future__ import annotations

import hashlib
import re
import sys
from collections import Counter
from pathlib import Path

from markdown_it import MarkdownIt

HEADING = 'SHA-256 der SVG-Dateien'
SHA256 = re.compile(r'^[0-9a-f]{64}$')
PARSER = MarkdownIt('commonmark')
ENTRY_PARTS = 2  # file name and hash, each as a code span


def _in_list_item(tokens: list, index: int) -> bool:
    """True if the inline token at `index` is the paragraph text of a list item."""
    opener = index - 2  # list_item_open, paragraph_open, inline
    return opener >= 0 and tokens[opener].type == 'list_item_open'


def _plain_name(name: str) -> bool:
    """Entries describe files in this folder only: no separators, no '.' or '..'."""
    return name not in ('', '.', '..') and '/' not in name and '\\' not in name


def recorded_hashes(readme: str) -> list[tuple[str, str]]:
    """(file name, hash) for each list item in the hash section, in document order."""
    tokens = PARSER.parse(readme)
    entries: list[tuple[str, str]] = []
    in_section = False
    for i, token in enumerate(tokens):
        if token.type == 'heading_open':
            in_section = tokens[i + 1].content.strip() == HEADING
        elif in_section and token.type == 'inline' and _in_list_item(tokens, i):
            codes = [c.content for c in token.children or [] if c.type == 'code_inline']
            if len(codes) != ENTRY_PARTS or not SHA256.match(codes[1]) or not _plain_name(codes[0]):
                raise ValueError(f'malformed hash entry: {token.content!r}')
            entries.append((codes[0], codes[1]))
    if not entries:
        raise ValueError(f'no entries under the heading {HEADING!r}')
    return entries


def check(assets: Path) -> list[str]:
    entries = recorded_hashes((assets / 'README.md').read_text(encoding='utf-8'))
    problems = [f'{name}: listed {n} times' for name, n in Counter(n for n, _ in entries).items() if n > 1]
    listed = {name for name, _ in entries}
    problems += [f'{p.name}: no hash entry' for p in sorted(assets.glob('*.svg')) if p.name not in listed]
    for name, expected in entries:
        path = assets / name
        if not path.is_file():
            problems.append(f'{name}: listed but missing')
            continue
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != expected:
            problems.append(f'{name}: recorded {expected[:12]}..., file has {actual[:12]}...')
    return problems


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    assets = Path(args[0] if args else 'docs/assets')
    try:
        problems = check(assets)
    except (OSError, UnicodeDecodeError, ValueError) as error:
        print(f'asset README unusable: {error}', file=sys.stderr)
        return 2
    for problem in problems:
        print(problem, file=sys.stderr)
    if not problems:
        print('asset hashes match')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
