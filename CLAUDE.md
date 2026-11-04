# Arbeitsregeln für KI-Assistenten in diesem Repository

- **Strenge Prüfung ist Pflicht.** Vor jedem Commit, Push, PR-Update oder jeder Meldung „fertig“ den Skill `reviewing-changes-strictly` (`.claude/skills/reviewing-changes-strictly/SKILL.md`) vollständig anwenden. Das gilt auch für reine Doku-Änderungen.
- **Absprache vor großen Änderungen.** Richtungswechsel, neue Abhängigkeiten und Löschungen erst nach Zustimmung des Nutzers. Gemergt wird nur vom Nutzer.
- **Geschützte Bereiche.** `app/` ist durch den Quality-Vertrag (Pin) geschützt, Änderungen dort brauchen eine Quality-Adoption. `app/upstream`, `app/vendor`, `app/extensions` und `app/archive` sind gepinnt und werden nicht bearbeitet.
- **Neuer Code in Python**, wo möglich. Bestehender Code bleibt in seiner Sprache.
- **Ehrlich berichten.** Was nicht ausgeführt werden konnte, steht als „nicht nachgewiesen“ im Bericht, mit Grund. Sicherheitssperren werden nicht umgangen.
