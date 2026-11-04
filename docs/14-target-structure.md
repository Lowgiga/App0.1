> Historischer Strukturvorschlag, kein aktuelles Dateiinventar. Projektgedächtnis, persönliche Fortsetzung, Assistant und Companion sind inzwischen unter konkreten `app/src/`-Pfaden vorhanden. Ihre jetzigen Anker und Restlücken stehen in der [Abdeckungsmatrix](16-acceptance-matrix.md). Bestehende Module zuerst weiterverwenden; die vorgeschlagenen Parallelverzeichnisse nicht automatisch neu anlegen. Die Entscheidungen, insbesondere ADR-007, bleiben erhalten.

# Geplante Zielstruktur

**Alle in diesem Kapitel neu vorgeschlagenen Pfade sind geplant und nicht implementiert.** Es werden keine leeren Appordner erzeugt, um Fortschritt vorzutäuschen. Die bestehenden Quellwurzeln bleiben erhalten.

## Prinzip

Bestehende Module schrittweise erweitern. Kein neues Framework, keine Microserviceaufteilung, kein zweiter Runner, keine zweite 3D-Engine und keine zusätzliche Datenbank ohne konkreten belegten Bedarf. Ein Ordner wird erst zusammen mit seinem Vertrag, tatsächlicher Implementierung und Tests eingeführt.

## Vorschlag innerhalb der bestehenden src-Struktur

```text
src/                                  BESTEHEND
├── diagnostics.ts                    GEPRÜFTER NACHTRAG
├── studio/DiagnosticsPanel.tsx       GEPRÜFTER NACHTRAG
├── studio/                           BESTEHEND + RECOVERY-NACHTRAG
├── platform/                         BESTEHEND
├── workshop/                         GEPLANT, NICHT IMPLEMENTIERT
│   ├── task-builder/                 geführter Entwurf auf Task/Mission
│   ├── impact/                       deterministische Abhängigkeitsanalyse
│   ├── variants/                     vergleichbare Alternativen
│   ├── review/                       revisionsgebundene Reviewkarten
│   ├── shadow/                       isolierte Simulationsprojektion
│   └── presentation/                 erlaubte Ergebnisprojektion
├── project-memory/                   GEPLANT, NICHT IMPLEMENTIERT
│   ├── contract.ts                   Projekt/Herkunft/Revision/Gültigkeit
│   ├── projection.ts                 Suche und Sicht innerhalb eines Projekts
│   └── migration.ts                  explizite, versionierte Übernahme
├── configuration/                    GEPLANT, NICHT IMPLEMENTIERT
│   ├── ui.ts                         Oberfläche
│   ├── execution.ts                  Rechte und Ressourcen
│   ├── output.ts                     Ergebnisprofile
│   └── behavior.ts                   Modell-/Promptverhalten
└── optional/                         GEPLANT, NICHT IMPLEMENTIERT
    ├── companion/                    Actoradapter im vorhandenen Three-Viewport
    └── video-studio/                 eigener optionaler Medienarbeitsbereich
```

Die genannten Dateinamen sind Arbeitsvorschläge, keine endgültige öffentliche API. Bei Implementierung anhand tatsächlicher Verantwortlichkeiten anpassen.

## Anschluss an den Bestand

| Geplantes Modul | Wiederverwendeter Bestand | Nicht neu erfinden |
| --- | --- | --- |
| task-builder | taskContract, missionContract, lokale Schreibroute | Zweite Aufgaben-/Missionsdatenbank |
| impact | Referenzen, Dependencyregeln, Graphadapter | Unbelegte Repositoryanalyse |
| project-memory | Projektbezüge in Missionen/Räumen, versionierter WorkState | Globale ungetrennte Notizsammlung |
| review | Quality-R2-Regeln und Freigabekarten | Vom Inhalt gelöste Zustimmung |
| shadow | Reine Planer und Offlinehandler | Operative Mutationen als Simulation |
| autopilot | Vorhandener Runner, Journal, Hostgrenzen | Zweiter Scheduler oder Hintergrundagent |
| presentation | Datei-/Exportadapter, erlaubte Ergebnisfelder | Automatische Veröffentlichung |
| companion | ThreeView und existierende Rendererinstanz | Eingebettete zweite 3D-App |
| video-studio | Projekt-/Ergebnisvertrag und kontrollierte Exportgrenze | Unautorisierten Generierungsanbieter |

## Tests wachsen mit der Funktion

Vorgeschlagene neue Testgruppen sind ebenfalls **geplant**: `tests/workshop/`, `tests/project-memory/` und `tests/optional/`. Ein zusätzlicher Testordner ist kein Qualitätsbeleg. Bestehende System-/Domain-/Rendererprüfungen bleiben verpflichtend.

## Entscheidung vor jeder neuen Grenze

Eine neue Schicht ist nur sinnvoll, wenn sie eine konkrete Verantwortung isoliert, eine reale Wiederverwendung ermöglicht oder eine echte Sicherheits-/Daten-/Plattformgrenze klarer macht. Andernfalls im vorhandenen Modul arbeiten. Die Kriterien stehen in der [Methodik](20-power-user-method.md).

[Iststruktur](03-source-tree.md) · [Arbeitspakete](15-roadmap.md)
