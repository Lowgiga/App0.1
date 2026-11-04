# Protokolle und Add-on-Ideen · geprüftes Arbeitsmaterial

Abrufdatum: 01.10.2026 Europe/Berlin. Die im Nutzertext enthaltenen 113 Links bilden keinen pauschal bestätigten Faktenbestand. Für Architekturentscheidungen wurden passende Primärquellen gelesen; Produktlisten und fremde Marketingclaims sind keine Integrationsbelege.

| Ebene | Zweck | Für diese App |
|---|---|---|
| MCP | Werkzeuge / Datenoperationen | Vorhandener privater read-only Endpoint mit vier Tools. Aktuelle Toolprotokollversionen bleiben unverändert |
| AG-UI | Agent-/Oberflächen-Ereignisse, Zustand und Interaktion | Adapterkandidat; kein tatsächlicher Remote-Agentstream angeschlossen |
| A2UI | Deklarative Oberflächenbeschreibung für eigene Renderer | Adapterkandidat hinter eigenem Komponentenkatalog; Roadmap meldete v0.9.1 stable/current und v1.0 candidate |
| MCP Apps | UI-Ressourcen, hostkontrollierte Sandbox und UI-Kommunikation | Separater Host-/Permissions-Test erforderlich; normales MCP liefert das nicht automatisch |
| A2A | Entfernte Agentenkommunikation | Keine aktuelle Low-Identität oder aktivierte Agentenverbindung hier verifiziert |

Interessante praktische Arbeitsflächen bleiben die vorhandenen Missionen, Matrix, Projektevidenz, Agentenbereiche und Kooperationsbrief. Künftige Project-/Knowledge-/Observability-/Automation-Flächen benötigen echte Daten und Zieladapter. Ein leeres Terminal-/Tracing-/Kostenwidget wäre kein operativer Fortschritt.

Die relevanten Entwicklungen sind deklarative sichere UI, überprüfbare Zustandsereignisse, Cancellation, Human-in-the-loop und protokollgetrennte Agent-/Tool-/UI-Verbindungen. Diese Prinzipien lassen sich im vorhandenen System nutzen, ohne alle Frameworks oder einen neuen Backendstack zu installieren. Die Behauptung eines auffällig polnischen Produktionsschwerpunkts wurde in dieser App-Wave nicht breit untersucht und bleibt aus dem übernommenen Text unbestätigt; sie ist keine technische Abhängigkeit.

Quellen: [AG-UI Introduction](https://docs.ag-ui.com/introduction), [A2UI Roadmap](https://a2ui.org/roadmap/), [A2UI Repository](https://github.com/a2ui-project/a2ui), [MCP Apps Overview](https://modelcontextprotocol.io/extensions/apps/overview), [MCP Apps Repository](https://github.com/modelcontextprotocol/ext-apps). Referenzdetails und aktuelle Grenzen stehen in `EVIDENCE.md`.
