#!/usr/bin/env python3
"""Check relative links and images in Markdown files of this repository.

Pinned or generated zones are skipped on purpose: app/upstream (byte-identical V7 source),
app/vendor and app/extensions (hash-pinned modules), app/archive (historical evidence) and
build output. Their files must not be edited here, so a broken link inside them is reported
in docs instead of failing CI. Standard library only; exit code 1 on any broken link.

Usage: python3 tools/ci/check_markdown_links.py [ROOT]
"""

from __future__ import annotations

import os
import re
import sys
from collections.abc import Iterator

SKIP_DIRS = frozenset({'.git', 'node_modules', 'dist', 'build', '.gradle'})
SKIP_PREFIXES = ('app/upstream/', 'app/vendor/', 'app/extensions/', 'app/archive/')
# Matches [text](target) and ![alt](target) with an optional "title". A target in <...> may contain
# spaces (CommonMark link destination); a bare target ends at the first whitespace.
LINK = re.compile(r'\[[^\]]*\]\(\s*(?:<([^<>\n]+)>|([^)\s]+))(?:\s+"[^"]*")?\s*\)')
FENCE = re.compile(r'^(```|~~~).*?^\1', re.S | re.M)
INLINE_CODE = re.compile(r'`[^`\n]*`')
EXTERNAL = re.compile(r'^(?:[a-z][a-z0-9+.-]*:|#|//)', re.I)


def markdown_files(root: str) -> Iterator[str]:
    """Yield repository-relative paths (with '/') of all Markdown files outside skipped zones."""
    for directory, dirs, files in os.walk(root):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
        rel_dir = os.path.relpath(directory, root).replace(os.sep, '/')
        rel_dir = '' if rel_dir == '.' else rel_dir + '/'
        if rel_dir.startswith(SKIP_PREFIXES):
            continue
        for name in sorted(files):
            if name.lower().endswith('.md'):
                yield rel_dir + name


def link_targets(markdown: str) -> list[str]:
    """Return relative link and image targets, ignoring code blocks, inline code and external URLs."""
    text = INLINE_CODE.sub('', FENCE.sub('', markdown))
    targets = (bracketed or bare for bracketed, bare in LINK.findall(text))
    return [target for target in targets if not EXTERNAL.match(target)]


def find_broken(root: str) -> tuple[int, list[tuple[str, str]]]:
    """Return (number of relative targets checked, [(markdown file, broken target), ...])."""
    checked = 0
    broken: list[tuple[str, str]] = []
    for rel in markdown_files(root):
        path = os.path.join(root, rel)
        with open(path, encoding='utf-8', errors='replace') as handle:
            targets = link_targets(handle.read())
        for target in targets:
            checked += 1
            file_part = target.split('#', 1)[0].split('?', 1)[0]
            resolved = os.path.normpath(os.path.join(os.path.dirname(path), file_part))
            if file_part and not os.path.exists(resolved):
                broken.append((rel, target))
    return checked, broken


def main(argv: list[str]) -> int:
    root = os.path.abspath(argv[1] if len(argv) > 1 else '.')
    checked, broken = find_broken(root)
    print(f'Relative Markdown links checked: {checked}; broken: {len(broken)}')
    for rel, target in broken:
        print(f'  BROKEN {rel} -> {target}')
    return 1 if broken else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
