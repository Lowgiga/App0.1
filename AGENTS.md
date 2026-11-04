# Anweisungen für Coding-Agenten

Diese Datei gilt für jeden automatischen Agenten in diesem Repository, zum Beispiel GitHub Copilot, Codex, Jules oder Claude. Verbindlich sind die Regeln in [`CLAUDE.md`](CLAUDE.md) und der Prüfablauf in [`.claude/skills/reviewing-changes-strictly/SKILL.md`](.claude/skills/reviewing-changes-strictly/SKILL.md). Diese Seite fasst beide zusammen und nennt die Befehle.

## Grenzen

- `app/` ist durch den Quality-Vertrag gepinnt. Änderungen dort brauchen eine Quality-Adoption. `app/upstream`, `app/vendor`, `app/extensions` und `app/archive` werden nicht bearbeitet.
- Neue Abhängigkeiten, Löschungen und Richtungswechsel nur nach Zustimmung des Nutzers. Gemergt wird nur vom Nutzer.
- Sicherheitssperren werden nicht umgangen. Was nicht ausgeführt werden konnte, steht im Bericht unter „nicht nachgewiesen“, mit Grund.
- Neuer Code in Python, wo möglich.

## Vor jedem Commit oder PR-Update (wie die CI)

```bash
pip install --require-hashes --only-binary=:all: -r tools/ci/requirements.txt -r tools/ci/requirements-lint.txt
```

```bash
python tools/ci/check_markdown_links.py .
```

```bash
python tools/repo/requirements_inventory.py --check docs/37-bestandsaufnahme.md
```

```bash
python tools/ci/check_test_counts.py .
```

```bash
python tools/ci/check_asset_hashes.py docs/assets
```

```bash
for dir in tools/ci tools/repo tools/windows; do COVERAGE_RCFILE=tools/ci/coverage.ini coverage run --parallel-mode -m unittest discover -s "$dir" -p 'test_*.py'; done
```

```bash
COVERAGE_RCFILE=tools/ci/coverage.ini coverage combine && COVERAGE_RCFILE=tools/ci/coverage.ini coverage report
```

```bash
python -m ruff check tools/ && python -m ruff format --check tools/
```

```bash
shellcheck -x tools/*.sh
```

```bash
actionlint
```

actionlint in Version 1.7.12, so wie der Lint-Job in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) es herunterlädt und gegen die offizielle Prüfsumme prüft. Kann ein Schritt hier nicht ausgeführt werden (in der bisherigen Entwicklungsumgebung war actionlint gesperrt), steht er im Bericht unter „nicht nachgewiesen“. Maßgeblich bleibt immer der Lint-Job in `ci.yml`.

Die Abdeckung muss mindestens 98 % betragen. Rufe ruff über `python -m ruff` auf und vergleiche `python -m ruff --version` mit `tools/ci/requirements-lint.txt`: Ein anderes `ruff` im `PATH` kann die gepinnte Version verdecken.

## Selbstkorrektur

- Jeder neue Test schlägt gegen den Stand vor dem Fix fehl. Das wird mit `git show <alt>:<datei>` geprüft.
- Zahlen (Tests, Befunde, Versionen) stammen aus einem frischen Lauf oder aus der GitHub-API und werden in allen Dokumenten nachgezogen (README, CHANGELOG, `docs/`, Grafiken).
- Status von Anforderungen nie von Hand abschreiben. Die Quelle ist `docs/16-acceptance-matrix.md`. Doku 37 wird mit `--write` erzeugt.
- Findet ein Reviewer (z. B. CodeRabbit) dieselbe Fehlerklasse zum zweiten Mal, wird der Ansatz gewechselt (Parser statt Muster). Ein weiterer Sonderfall reicht dann nicht.
