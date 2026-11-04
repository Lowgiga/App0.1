#!/usr/bin/env python3
"""Check relative links in Markdown files of this repository.

Pinned or generated zones are skipped on purpose: app/upstream (byte-identical V7 source),
app/vendor and app/extensions (hash-pinned modules), app/archive (historical evidence) and
build output. Their files must not be edited here, so a broken link inside them is reported
in docs instead of failing CI. Standard library only; exit code 1 on any broken link.
"""
import os
import re
import sys

ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
SKIP_DIRS = {'.git', 'node_modules', 'dist', 'build', '.gradle'}
SKIP_PREFIXES = ('app/upstream/', 'app/vendor/', 'app/extensions/', 'app/archive/')
LINK = re.compile(r'(?<!!)\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)')
FENCE = re.compile(r'^(```|~~~).*?^\1', re.S | re.M)
INLINE_CODE = re.compile(r'`[^`\n]*`')
EXTERNAL = re.compile(r'^(?:[a-z][a-z0-9+.-]*:|#|//)', re.I)


def markdown_files():
    for directory, dirs, files in os.walk(ROOT):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
        rel_dir = os.path.relpath(directory, ROOT).replace(os.sep, '/')
        rel_dir = '' if rel_dir == '.' else rel_dir + '/'
        if rel_dir.startswith(SKIP_PREFIXES):
            continue
        for name in sorted(files):
            if name.lower().endswith('.md'):
                yield rel_dir + name


def main():
    checked = 0
    broken = []
    for rel in markdown_files():
        path = os.path.join(ROOT, rel)
        with open(path, encoding='utf-8', errors='replace') as handle:
            text = INLINE_CODE.sub('', FENCE.sub('', handle.read()))
        for target in LINK.findall(text):
            if EXTERNAL.match(target):
                continue
            checked += 1
            file_part = target.split('#', 1)[0].split('?', 1)[0]
            resolved = os.path.normpath(os.path.join(os.path.dirname(path), file_part))
            if file_part and not os.path.exists(resolved):
                broken.append((rel, target))
    print(f'Relative Markdown links checked: {checked}; broken: {len(broken)}')
    for rel, target in broken:
        print(f'  BROKEN {rel} -> {target}')
    return 1 if broken else 0


if __name__ == '__main__':
    sys.exit(main())
