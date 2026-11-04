#!/usr/bin/env python3
"""Check relative links and images in Markdown files of this repository.

Markdown is parsed with markdown-it-py (CommonMark reference behaviour) plus the GitHub
extensions that decide where links are: tables and footnotes. Escapes, entities, code spans,
indented and fenced code, HTML comments, nested images, reference links and multi-line
definitions therefore follow the specification instead of hand-written patterns.

Checked: link and image destinations, reference definitions (unused ones too) and href/src
attributes in raw HTML. A leading slash resolves from the repository root, as on GitHub. '#'
starts a fragment, so a file name containing '#' must be written as %23. A target must exist
with exactly the written upper/lower case (GitHub is case-sensitive, macOS and Windows are not)
and must stay inside the repository.

Pinned or generated zones are skipped on purpose: app/upstream (byte-identical V7 source),
app/vendor and app/extensions (hash-pinned modules), app/archive (historical evidence) and
build output. Their files must not be edited here, so a broken link inside them is reported
in docs instead of failing CI. Exit code 1 on any broken link.

Requires tools/ci/requirements.txt (hash-pinned):
  python3 -m venv .venv && .venv/bin/pip install --require-hashes -r tools/ci/requirements.txt
Usage: python3 tools/ci/check_markdown_links.py [ROOT]
"""

from __future__ import annotations

import os
import re
import sys
import urllib.parse
from collections.abc import Iterable, Iterator
from html.parser import HTMLParser

from markdown_it import MarkdownIt
from markdown_it.token import Token
from mdit_py_plugins.footnote import footnote_plugin

SKIP_DIRS = frozenset({'.git', 'node_modules', 'dist', 'build', '.gradle'})
SKIP_PREFIXES = ('app/upstream/', 'app/vendor/', 'app/extensions/', 'app/archive/')
# CommonMark plus the GitHub extensions that change where links are found.
PARSER = MarkdownIt('commonmark').enable(['table', 'strikethrough']).use(footnote_plugin)
EXTERNAL = re.compile(r'^(?:[a-z][a-z0-9+.-]*:|#|//)', re.I)
HTML_LINK_ATTRIBUTES = frozenset({'href', 'src'})


def markdown_files(root: str) -> Iterator[str]:
    """Yield repository-relative paths (with '/') of all Markdown files outside skipped zones."""
    for directory, dirs, files in os.walk(root):
        rel_dir = os.path.relpath(directory, root).replace(os.sep, '/')
        rel_dir = '' if rel_dir == '.' else rel_dir + '/'
        # Prune skipped zones instead of walking them (app/upstream alone holds thousands of files).
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS and not f'{rel_dir}{d}/'.startswith(SKIP_PREFIXES))
        for name in sorted(files):
            if name.lower().endswith('.md'):
                yield rel_dir + name


class _HtmlLinks(HTMLParser):
    """Collect href/src values from raw HTML; HTMLParser skips comments."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.targets: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.targets += [value for name, value in attrs if name in HTML_LINK_ATTRIBUTES and value]

    handle_startendtag = handle_starttag


def _token_targets(tokens: Iterable[Token]) -> Iterator[str]:
    for token in tokens:
        if token.type == 'link_open':
            yield str(token.attrGet('href') or '')
        elif token.type == 'image':
            yield str(token.attrGet('src') or '')
        elif token.type in ('html_block', 'html_inline'):
            parser = _HtmlLinks()
            parser.feed(token.content)
            parser.close()
            yield from parser.targets
        if token.children:
            yield from _token_targets(token.children)


def link_targets(markdown: str) -> list[str]:
    """Relative destinations of links, images, reference definitions and HTML href/src.

    Destinations are returned as markdown-it normalises them: escapes and entities resolved,
    spaces and non-ASCII characters percent-encoded.
    """
    env: dict = {}
    used = [target for target in _token_targets(PARSER.parse(markdown, env)) if target]
    # A definition nobody references is not rendered, but a broken one is still a defect.
    unused = [
        reference['href']
        for reference in env.get('references', {}).values()
        if reference['href'] and reference['href'] not in used
    ]
    return [target for target in used + unused if not EXTERNAL.match(target)]


def resolve_target(root: str, markdown_path: str, target: str) -> str | None:
    """Filesystem path for a target, or None for a pure fragment/query; '/x' is relative to the root."""
    file_part = urllib.parse.unquote(re.split(r'[#?]', target, maxsplit=1)[0])
    if not file_part:
        return None
    if file_part.startswith('/'):
        return os.path.normpath(os.path.join(root, file_part.lstrip('/')))
    return os.path.normpath(os.path.join(os.path.dirname(markdown_path), file_part))


def target_exists(root: str, resolved: str) -> bool:
    """True if the target lies inside the repository and exists with exactly the written case."""
    root = os.path.normpath(root)
    if os.path.commonpath([root, resolved]) != root:
        return False
    current = root
    relative = os.path.relpath(resolved, root)
    for part in [] if relative == '.' else relative.split(os.sep):
        try:
            entries = os.listdir(current)
        except OSError:  # not a directory
            return False
        if part not in entries:
            return False
        current = os.path.join(current, part)
    return True


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
            resolved = resolve_target(root, path, target)
            if resolved is not None and not target_exists(root, resolved):
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
