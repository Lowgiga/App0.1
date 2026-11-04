#!/usr/bin/env python3
"""Print the web build fingerprint from app/docs/build-manifest.json.

Writes the same line to $GITHUB_STEP_SUMMARY when it is set. The CI reproducibility job
compares this line between Node versions.

Usage: python3 tools/ci/build_fingerprint.py [LABEL] [MANIFEST]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys

DEFAULT_MANIFEST = 'app/docs/build-manifest.json'
SHA256_HEX = re.compile(r'[0-9a-fA-F]{64}')


def fingerprint_line(label: str, manifest: dict) -> str:
    """Format the fingerprint; raise ValueError when the manifest lacks the expected fields."""
    digest = manifest.get('distContentSha256')
    files = manifest.get('files')
    if not isinstance(digest, str) or not SHA256_HEX.fullmatch(digest):
        raise ValueError('build manifest: distContentSha256 missing or not a SHA-256 hex digest')
    # The app's generator writes a {path: sha256} map; a list or a plain count is accepted as well.
    count = len(files) if isinstance(files, (dict, list)) else files
    if not isinstance(count, int) or isinstance(count, bool) or count < 0:
        raise ValueError('build manifest: files missing (expected a {path: sha256} map, a list or a count)')
    return f'{label}: distContentSha256 {digest} ({count} Dateien)'


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description='Print the web build fingerprint.')
    parser.add_argument('label', nargs='?', default='build')
    parser.add_argument('manifest', nargs='?', default=DEFAULT_MANIFEST)
    args = parser.parse_args(argv[1:])
    try:
        with open(args.manifest, encoding='utf-8') as handle:
            line = fingerprint_line(args.label, json.load(handle))
    except (OSError, ValueError) as error:
        print(f'build_fingerprint: {error}', file=sys.stderr)
        return 1
    print(line)
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a', encoding='utf-8') as handle:
            handle.write(f'- {line}\n')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
