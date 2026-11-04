#!/usr/bin/env python3
"""Deterministic pull-request triage for this repository (stages T0-T6).

The procedure is documented in docs/32-pr-triage-2026-11-03.md. It reads git objects and a
PR metadata export only; it never changes the repository or GitHub (except fetching a missing
PR head into the local object store). Standard library only.

Usage (export every page, then flatten the pages inside the script):
  gh api --paginate --slurp 'repos/Lowgiga/APP/pulls?state=all&per_page=100' > pulls.json
  python3 tools/repo/pr_triage.py --repo . --pulls pulls.json --json triage.json --markdown

Stages:
  T0 inventory      number, author, dates, base, head, commits, files, +/- lines
  T1 empty          no file change against the merge base
  T2 base           merge base classified as docs-only main or source line (app/ present)
  T3 duplicates     word 5-gram Jaccard similarity (literal copies) and redundancy
  T3b topics        concept fingerprint per PR (topical copies with new wording)
  T4 claims         known stale or false statements (verified 2026-11-03, see docs/30)
  T5 executability  done separately with actionlint, shellcheck and tests
  T6 value          manual: unique content is carried into docs before a PR is closed
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass

CLAIMS = {
    'stale_file_count_859': r'\b859\b',
    'stale_test_count_264': r'\b264\b',
    'stale_version_0_5_2': r'0\.5\.2',
    'wrong_cas_content_addressed': r'Content[- ]Address',
    'stale_no_source_in_repo': (
        r'(keinen?|nicht den|nicht der)\s+(ausführbaren\s+|baubaren\s+)?(App-|Anwendungs-)?(Quellcode|Source)\b'
    ),
    'env_specific_javac_proxy403': r'javac|CONNECT[- ]?403|403.{0,30}Proxy|Proxy.{0,30}403',
    'unmeasured_kpi_fps_bundle': r'60\s*FPS|3[,.]5\s*MB|1[,.]2\s*(s|Sek)',
    'coverage_target_80': r'80\s*%',
}
CONCEPTS = {
    'hybrid-edge': r'Hybrid[- ]?Edge|Edge[- ]Node|Omni-Architect',
    'spatial-ar': r'Spatial AR|Digital Twin|AR[- ]Studio',
    'event-sourcing': r'Event[- ]?Sourcing|Time[- ]?Travel',
    'drift-guardian': r'Drift[- ]Guardian|AST',
    'p2p-zk': r'P2P|Zero[- ]Knowledge',
    'merkle': r'Merkle',
    'webgpu-onnx': r'WebGPU|ONNX',
    'patch-chain': r'Patch-Kette|7-stufig|Quellkette',
    'ram-sim': r'happy-dom|fake-indexeddb|RAM',
    'repo-decoupling': r'Entkopplung|nur Dokumentation',
    'build-blocker': r'Build-Blocker|Blocker|javac|403',
    'kpi-matrix': r'KPI|Metrik|Verbesserungsmatrix|Improvement Matrix',
}
SHINGLE_SIZE = 5


class GitError(RuntimeError):
    """A git command failed; the message names the command and git's error output."""


@dataclass(frozen=True)
class NumstatEntry:
    added: int | None  # None for binary files
    deleted: int | None
    paths: tuple[str, ...]  # one path, or (old, new) for a rename or copy


def git(repo: str, *args: str) -> str:
    executable = shutil.which('git')
    if executable is None:
        raise GitError('git not found in PATH')
    # Fixed argument list, no shell; values come from git itself or the PR export.
    done = subprocess.run([executable, '-C', repo, *args], capture_output=True, text=True, check=False)  # noqa: S603
    if done.returncode != 0:
        raise GitError(f'git {" ".join(args)}: {done.stderr.strip() or f"exit {done.returncode}"}')
    return done.stdout


def load_pulls(data: object) -> list[dict]:
    """Accept a plain PR list or the page list written by 'gh api --paginate --slurp'."""
    if not isinstance(data, list):
        raise ValueError('PR export must be a JSON array')
    if data and all(isinstance(page, list) for page in data):
        return [pr for page in data for pr in page]
    return data


def _count(text: str) -> int | None:
    return int(text) if text.isdigit() else None


def parse_numstat_z(output: str) -> list[NumstatEntry]:
    """Parse 'git diff --numstat -z': rename records carry an empty path field, then old and new path."""
    fields = output.split('\0')
    entries: list[NumstatEntry] = []
    index = 0
    while index < len(fields) and fields[index]:
        added, deleted, path = fields[index].split('\t', 2)
        index += 1
        if path == '':
            paths = (fields[index], fields[index + 1])
            index += 2
        else:
            paths = (path,)
        entries.append(NumstatEntry(_count(added), _count(deleted), paths))
    return entries


def classify_base(repo: str, merge_base: str) -> str:
    """T2: 'source' when the merge base already contains app/, otherwise 'docs-only'."""
    return 'source' if git(repo, 'ls-tree', '-d', '--name-only', merge_base, 'app').strip() else 'docs-only'


def shingles(text: str) -> set[str]:
    words = re.findall(r'[a-zäöüß0-9]+', text.lower())
    return {' '.join(words[i : i + SHINGLE_SIZE]) for i in range(max(0, len(words) - SHINGLE_SIZE + 1))}


def _ensure_head(repo: str, number: int, head: str, fetch: bool) -> None:
    try:
        if git(repo, 'cat-file', '-t', head).strip() == 'commit':
            return
    except GitError:
        if not fetch:
            raise
    git(repo, 'fetch', '-q', 'origin', f'refs/pull/{number}/head')


def analyze_pr(repo: str, pr: dict, main: str, remote_prefix: str, fetch: bool) -> tuple[dict, str]:
    number, head = pr['number'], pr['head']['sha']
    row = {
        'n': number,
        'title': pr['title'],
        'author': pr['user']['login'],
        'created': pr['created_at'][:10],
        'state': 'merged' if pr.get('merged_at') else pr['state'],
        'draft': pr.get('draft', False),
        'base_ref': pr['base']['ref'],
        'head': head[:7],
    }
    try:
        _ensure_head(repo, number, head, fetch)
        target = remote_prefix + pr['base']['ref'] if pr['state'] == 'open' else main
        base = git(repo, 'merge-base', head, target).strip()
        entries = parse_numstat_z(git(repo, 'diff', '--numstat', '-z', base, head))
        diff = git(repo, 'diff', '-U0', base, head)
        base_line = classify_base(repo, base)
    except GitError as error:
        row['error'] = str(error)
        return row, ''
    added = '\n'.join(line[1:] for line in diff.splitlines() if line.startswith('+') and not line.startswith('+++'))
    all_paths = [path for entry in entries for path in entry.paths]
    row.update(
        {
            'merge_base': base[:7],
            'base_line': base_line,
            'files': len(entries),
            'added': sum(entry.added or 0 for entry in entries),
            'deleted': sum(entry.deleted or 0 for entry in entries),
            'empty': not entries,
            'touches_app': any(path.startswith('app/') for path in all_paths),
            'claims': {k: len(re.findall(v, added, re.I)) for k, v in CLAIMS.items() if re.search(v, added, re.I)},
            'concepts': sorted(k for k, v in CONCEPTS.items() if re.search(v, added, re.I)),
        }
    )
    return row, added


def triage(
    repo: str, pulls: list[dict], main_ref: str = 'origin/main', remote_prefix: str = 'origin/', fetch: bool = True
) -> dict:
    main = git(repo, 'rev-parse', main_ref).strip()
    rows, texts = [], {}
    for pr in sorted(pulls, key=lambda p: p['number']):
        row, added = analyze_pr(repo, pr, main, remote_prefix, fetch)
        rows.append(row)
        texts[row['n']] = added
    docs = [
        r['n'] for r in rows if r['state'] == 'open' and 'error' not in r and not r['empty'] and not r['touches_app']
    ]
    sh = {n: shingles(texts[n]) for n in docs}
    for row in rows:
        if row['n'] not in docs or not sh[row['n']]:
            continue
        peers = [
            (other, len(sh[row['n']] & sh[other]) / len(sh[row['n']] | sh[other]))
            for other in docs
            if other != row['n'] and (sh[row['n']] | sh[other])
        ]
        if peers:
            other, value = max(peers, key=lambda item: item[1])
            row['max_similarity'] = {'pr': other, 'jaccard': round(value, 3)}
        rest = set().union(*(sh[m] for m in docs if m != row['n']))
        row['redundancy'] = round(len(sh[row['n']] & rest) / len(sh[row['n']]), 3)
    return {'main': main, 'rows': rows}


def markdown(result: dict) -> str:
    lines = [
        '| PR | Datum | Basis (Merge-Base, T2) | Dateien | +/- | Leer | Max. Aehnlichkeit | Konzepte '
        '| Veraltete Aussagen |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ]
    for r in result['rows']:
        if 'error' in r:
            lines.append(f'| #{r["n"]} | {r["created"]} | {r["base_ref"]} | FEHLER: {r["error"]} | | | | | |')
            continue
        sim = r.get('max_similarity')
        sim_text = f'#{sim["pr"]} {sim["jaccard"]}' if sim else '-'
        claims_text = ', '.join(sorted(r['claims'])) or '-'
        base_text = f'{r["base_ref"]} @{r["merge_base"]} ({r["base_line"]})'
        lines.append(
            f'| #{r["n"]} | {r["created"]} | {base_text} | {r["files"]} | +{r["added"]}/-{r["deleted"]} | '
            f'{"ja" if r["empty"] else "nein"} | {sim_text} | {len(r["concepts"])} | {claims_text} |'
        )
    return '\n'.join(lines)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description='Deterministic pull-request triage (T0-T6).')
    parser.add_argument('--repo', default='.')
    parser.add_argument('--pulls', required=True, help="export from 'gh api --paginate --slurp'")
    parser.add_argument('--json')
    parser.add_argument('--markdown', action='store_true')
    parser.add_argument('--main-ref', default='origin/main')
    parser.add_argument('--remote-prefix', default='origin/', help="prefix for open PR base refs ('' = local)")
    parser.add_argument('--no-fetch', action='store_true', help='never fetch missing PR heads')
    args = parser.parse_args(argv[1:])
    with open(args.pulls, encoding='utf-8') as handle:
        pulls = load_pulls(json.load(handle))
    try:
        result = triage(args.repo, pulls, args.main_ref, args.remote_prefix, fetch=not args.no_fetch)
    except GitError as error:
        print(f'pr_triage: {error}', file=sys.stderr)
        return 2
    if args.json:
        with open(args.json, 'w', encoding='utf-8') as handle:
            json.dump(result, handle, indent=1, ensure_ascii=False)
    if args.markdown:
        print(markdown(result))
    return 1 if any('error' in row for row in result['rows']) else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
