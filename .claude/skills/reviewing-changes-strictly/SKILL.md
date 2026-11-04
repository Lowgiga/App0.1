---
name: reviewing-changes-strictly
description: Use when about to commit, push, open or update a pull request, or report work as done in this repository; also when a reviewer such as CodeRabbit or a person reports findings, or when the same kind of finding comes back a second time.
---

# Strenge Prüfung vor jedem Abschluss

## Grundsatz

Eine Änderung gilt erst als fertig, wenn ein Prüfer, der strenger ist als CodeRabbit (Profil ASSERTIVE), nichts mehr finden würde. Jede Aussage ist belegt: durch einen Test, der ohne die Änderung fehlschlägt, oder durch eine Primärquelle mit Version oder Commit. Was nicht belegt ist, wird als „nicht nachgewiesen“ berichtet und nie als erledigt.

## Ablauf (alle acht Stufen, in dieser Reihenfolge)

1. **Diff vollständig lesen.** Jede geänderte Datei ganz lesen, nicht nur die Hunks. Bei jeder Funktion fragen: Welche Eingabe bricht sie? Leere, riesige oder kaputte Eingabe, nicht lesbare Datei, andere Plattform oder Locale, fehlendes Werkzeug.
2. **Belege holen.** Jede Behauptung über fremdes Verhalten (Spezifikation, Bibliothek, CLI, API, Format) gegen die Primärquelle prüfen und mit Version oder Commit festhalten. Rangfolge: Spezifikation (z. B. spec.commonmark.org), Quellcode im Tag oder Commit, offizielle Doku, Paketregister (pypi.org/…/json, npm). Blogs und Foren gelten nicht als Beleg.
3. **Befunde notieren, je Befund alle Felder** (Vorlage unten). Eigene Befunde gehören dazu, auch wenn kein Reviewer sie gemeldet hat.
4. **Ursache statt Symptom.** Kommt dieselbe Fehlerklasse zum zweiten Mal, ist der Ansatz falsch: Muster durch Parser ersetzen, Sonderfall durch Spezifikation, Zeitschranke durch Verhältnistest.
5. **Folgefehler prüfen.** Für jeden Fix:
   - Welche anderen Stellen haben dieselbe Ursache?
   - Was ändert sich an Schnittstelle, Exit-Code, Doku, CI und Abhängigkeiten?
   - Läuft die CI-Umgebung noch, also andere Python-, Node- oder Betriebssystem-Versionen?
6. **Gegenprobe.** Jeder neue Test schlägt gegen den Stand vor dem Fix fehl. Dazu den alten Code mit `git show <alt>:<datei>` in ein Scratch-Verzeichnis legen, die neuen Tests dagegen laufen lassen und die Fehlschläge zählen.
7. **Konsistenz-Scan.** Jede Zahl, Version, Pfad und Verweis, die die Änderung berührt, wird in allen Dokumenten gesucht und gegen die Quelle abgeglichen (`rg` über `README.md`, `CHANGELOG.md`, `docs/`, Grafiken `*.svg`, PR-Beschreibung). Testzahlen kommen aus einem frischen Lauf, Befundzahlen aus der GitHub-API, nicht aus dem Gedächtnis. Eine Zahl, die nicht belegt ist, wird gestrichen. Automatisch geprüft werden schon: Testzahlen der README (`tools/ci/check_test_counts.py`), SHA-256 der Grafiken (`tools/ci/check_asset_hashes.py`) und die Bestandsaufnahme gegen die Matrix (`tools/repo/requirements_inventory.py --check`). Alles andere wird von Hand gesucht.
8. **Gesamtprüfung wie in der CI**, mit denselben gepinnten Werkzeugen (`tools/ci/requirements*.txt`): Lint, alle Tests, Abdeckung ≥ 98 % (`COVERAGE_RCFILE=tools/ci/coverage.ini`), Link-Prüfung und die drei Konsistenzprüfungen aus Stufe 7 (Befehle in [`AGENTS.md`](../../../AGENTS.md)). Bei zeitabhängigen Tests dreimal laufen lassen.

## Befund-Vorlage (jedes Feld ist Pflicht)

| Feld | Inhalt |
|---|---|
| Ort | `datei:zeile` |
| Szenario | konkrete Eingabe oder Lage → falsches Ergebnis |
| Beleg | Repro-Befehl oder Test, der vorher fehlschlägt |
| Quelle | Primärquelle mit Version/Commit, oder „Code dieses Repos“ |
| Schwere | Ampel und Score 1–10 |
| Fix | Änderung und Regressionstest |
| Folgefehler | geprüft: wo noch, was ändert sich, Ergebnis |

## Selbstkorrektur

Findest du einen eigenen Fehler, auch einen offensichtlichen wie eine veraltete Zahl, einen toten Verweis oder eine Behauptung ohne Beleg: Korrigiere ihn im selben Zug, prüfe die Korrektur nach und nenne den Fehler im Bericht. Warte nicht auf einen Reviewer. Das gilt auch für Fehler, die frühere Antworten dieser Sitzung betreffen.

## Abschlussbericht

Der Bericht hat diese Teile, in dieser Reihenfolge:

1. Befunde (fremd und eigen) mit Status.
2. Belege: Testzahlen, Ergebnis der Gegenprobe, Abdeckung.
3. Quellen.
4. „Nicht nachgewiesen“: alles, was nicht ausgeführt werden konnte, mit Grund.
5. Offene Entscheidungen für den Nutzer.

## Warnzeichen (sofort anhalten und zu Stufe 4 zurück)

| Gedanke | Was stattdessen gilt |
|---|---|
| „Noch ein Sonderfall im Regex“ | Zweites Auftreten derselben Klasse: den Ansatz wechseln. |
| „Der Test bestätigt mein Verhalten“ | Er muss das spezifizierte Verhalten bestätigen. Erst die Quelle lesen, dann den Test schreiben. |
| „< 2 s reicht als Grenze“ | Feste Zeitschranken sind auf CI und unter Coverage zufällig rot. Verhältnis bei doppelter Eingabe messen. |
| „Hash für meine Python-Version genügt“ | Alle Zielumgebungen pinnen und mit einer frischen Installation prüfen. |
| „`rm .coverage*` räumt auf“ | Globs treffen Konfigurationsdateien. Dateien einzeln benennen. |
| „Die Zahl stimmt sicher noch“ | Veraltet ist sie fast immer. Frisch zählen, überall suchen (Stufe 7). |
| „Der Prüfer findet es schon“ | Eigene Fehler werden von dir gefunden und korrigiert, bevor ein Reviewer sie sieht. |
| „ruff ist doch installiert“ | Version und Herkunft prüfen: `python -m ruff --version` gegen `tools/ci/requirements-lint.txt`. Ein anderes Werkzeug im `PATH` kann das gepinnte verdecken; Lint, der mit einer anderen Version lief, zählt nicht. |
| „Die API hat die Zahl geliefert“ | Bei mehr als einer Seite seitenweise über `repos/{owner}/{repo}/…?page=N` zählen. `gh api --paginate` folgt `repositories/{id}`-Links, die der Proxy dieser Umgebung mit 403 ablehnt; dann stammt die Zahl nur von Seite 1. |
| „Der PR ist noch offen“ | Vor jedem Push den PR-Status prüfen. Ein Commit nach dem Merge landet nicht in `main`; er wird auf `main` gerebased und als neuer PR eingereicht, die Thread-Antworten werden richtiggestellt. |
| „Läuft lokal, also fertig“ | Nur die CI-gleiche Gesamtprüfung zählt. Was nicht lief, kommt unter „nicht nachgewiesen“. |
| „Steht so in der Doku des Projekts“ | Die eigene Doku ist kein Beleg für fremdes Verhalten. Die Primärquelle prüfen. |
