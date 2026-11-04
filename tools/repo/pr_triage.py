#!/usr/bin/env python3
"""Deterministic pull-request triage for this repository (stages T0-T6).

The procedure is documented in docs/32-pr-triage-2026-11-03.md. It reads git objects and a
PR metadata export only; it never changes the repository or GitHub. Standard library only.

Usage:
  gh api 'repos/Lowgiga/APP/pulls?state=all&per_page=100' > pulls.json
  python3 tools/repo/pr_triage.py --repo . --pulls pulls.json --json triage.json --markdown

Stages:
  T0 inventory      number, author, dates, base, head, commits, files, +/- lines
  T1 empty          no file change against the merge base
  T2 base           based on a docs-only main or on the source line
  T3 duplicates     word 5-gram Jaccard similarity (literal copies) and redundancy
  T3b topics        concept fingerprint per PR (topical copies with new wording)
  T4 claims         known stale or false statements (verified 2026-11-03, see docs/30)
  T5 executability  done separately with actionlint, shellcheck, PowerShell parser and tests
  T6 value          manual: unique content is carried into docs before a PR is closed
"""
import argparse
import itertools
import json
import re
import subprocess

CLAIMS = {
    'stale_file_count_859': r'\b859\b',
    'stale_test_count_264': r'\b264\b',
    'stale_version_0_5_2': r'0\.5\.2',
    'wrong_cas_content_addressed': r'Content[- ]Address',
    'stale_no_source_in_repo': r'(keinen?|nicht den|nicht der)\s+(ausführbaren\s+|baubaren\s+)?(App-|Anwendungs-)?(Quellcode|Source)\b',
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


def git(repo, *args):
    return subprocess.run(['git', '-C', repo, *args], capture_output=True, text=True, check=False).stdout


def shingles(text):
    words = re.findall(r'[a-zäöüß0-9]+', text.lower())
    return {' '.join(words[i:i + 5]) for i in range(max(0, len(words) - 4))}


def triage(repo, pulls):
    main = git(repo, 'rev-parse', 'origin/main').strip()
    rows, texts = [], {}
    for pr in sorted(pulls, key=lambda p: p['number']):
        number, head = pr['number'], pr['head']['sha']
        if git(repo, 'cat-file', '-t', head).strip() != 'commit':
            git(repo, 'fetch', '-q', 'origin', f'refs/pull/{number}/head')
        target = 'origin/' + pr['base']['ref'] if pr['state'] == 'open' else main
        base = git(repo, 'merge-base', head, target).strip()
        numstat = [line.split('\t') for line in git(repo, 'diff', '--numstat', base, head).splitlines() if line]
        files = [cols[2] for cols in numstat]
        diff = git(repo, 'diff', '-U0', base, head)
        added = '\n'.join(line[1:] for line in diff.splitlines() if line.startswith('+') and not line.startswith('+++'))
        texts[number] = added
        rows.append({
            'n': number, 'title': pr['title'], 'author': pr['user']['login'], 'created': pr['created_at'][:10],
            'state': 'merged' if pr.get('merged_at') else pr['state'], 'draft': pr['draft'],
            'base': pr['base']['ref'], 'head': head[:7], 'files': len(files),
            'added': sum(int(c[0]) for c in numstat if c[0].isdigit()),
            'deleted': sum(int(c[1]) for c in numstat if c[1].isdigit()),
            'empty': not files, 'touches_app': any(f.startswith('app/') for f in files),
            'claims': {k: len(re.findall(v, added, re.I)) for k, v in CLAIMS.items() if re.search(v, added, re.I)},
            'concepts': sorted(k for k, v in CONCEPTS.items() if re.search(v, added, re.I)),
        })
    docs = [r['n'] for r in rows if r['state'] == 'open' and not r['empty'] and not r['touches_app']]
    sh = {n: shingles(texts[n]) for n in docs}
    for row in rows:
        if row['n'] not in docs or not sh[row['n']]:
            continue
        peers = [(other, len(sh[row['n']] & sh[other]) / len(sh[row['n']] | sh[other]))
                 for other in docs if other != row['n'] and (sh[row['n']] | sh[other])]
        if peers:
            other, value = max(peers, key=lambda item: item[1])
            row['max_similarity'] = {'pr': other, 'jaccard': round(value, 3)}
        rest = set().union(*(sh[m] for m in docs if m != row['n']))
        row['redundancy'] = round(len(sh[row['n']] & rest) / len(sh[row['n']]), 3)
    return {'main': main, 'rows': rows}


def markdown(result):
    lines = ['| PR | Datum | Basis | Dateien | +/- | Leer | Max. Aehnlichkeit | Konzepte | Veraltete Aussagen |',
             '| --- | --- | --- | --- | --- | --- | --- | --- | --- |']
    for r in result['rows']:
        sim = r.get('max_similarity')
        sim_text = '#{} {}'.format(sim['pr'], sim['jaccard']) if sim else '-'
        empty_text = 'ja' if r['empty'] else 'nein'
        claims_text = ', '.join(sorted(r['claims'])) or '-'
        lines.append('| #{} | {} | {} | {} | +{}/-{} | {} | {} | {} | {} |'.format(
            r['n'], r['created'], r['base'], r['files'], r['added'], r['deleted'],
            empty_text, sim_text, len(r['concepts']), claims_text))
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--repo', default='.')
    parser.add_argument('--pulls', required=True)
    parser.add_argument('--json')
    parser.add_argument('--markdown', action='store_true')
    args = parser.parse_args()
    with open(args.pulls, encoding='utf-8') as handle:
        result = triage(args.repo, json.load(handle))
    if args.json:
        with open(args.json, 'w', encoding='utf-8') as handle:
            json.dump(result, handle, indent=1)
    if args.markdown:
        print(markdown(result))


if __name__ == '__main__':
    main()
