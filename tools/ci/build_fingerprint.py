#!/usr/bin/env python3
"""Print the web build fingerprint from app/docs/build-manifest.json.

Writes the same line to $GITHUB_STEP_SUMMARY when it is set. Usage:
  python3 tools/ci/build_fingerprint.py <label> [path/to/build-manifest.json]
"""
import json
import os
import sys

label = sys.argv[1] if len(sys.argv) > 1 else 'build'
path = sys.argv[2] if len(sys.argv) > 2 else 'app/docs/build-manifest.json'
with open(path, encoding='utf-8') as handle:
    manifest = json.load(handle)
line = f"{label}: distContentSha256 {manifest['distContentSha256']} ({len(manifest['files'])} Dateien)"
print(line)
summary = os.environ.get('GITHUB_STEP_SUMMARY')
if summary:
    with open(summary, 'a', encoding='utf-8') as handle:
        handle.write(f'- {line}\n')
