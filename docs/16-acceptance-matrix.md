# Anforderungen und Abnahmematrix

## Zählregel

**27 eindeutige Anforderungen**, sieben Freigabegates. Der Ausbau ist nicht fertig, nur weil einige bestehende Bausteine und gezielte Kandidatentests vorliegen. Jede Anforderung wird für einen genau bezeichneten Lieferumfang abgenommen.

Status: **K** = gezielt geprüfter Quellkandidat; **B** = bestehende Funktion, erneute Zielabnahme offen; **P** = geplant; **X** = notwendige Ausführung blockiert. Kombinierte Statuswerte betreffen unterschiedliche Teilumfänge und sind keine pauschale grüne Freigabe.

## Anforderungen

| ID | Ziel und kleinster sinnvoller Ausbau | Konkrete Abnahme | Abhängigkeiten | Status |
| --- | --- | --- | --- | --- |
| REL-01 | Reproduzierbare Zielquelle | Exakte vollständige Quellkette, alle Vor-/Nachhashes, keine Teilpatches, Preview unverändert | Erfolgreicher Quelltransfer in funktionsfähige Buildumgebung | K/X |
| REL-02 | Sechs Qualitybefunde R1–R6 schließen | Portalgrenze, revisionsgebundener Review, Close-/Save-Rennen und Katalog korrigiert; Toolchain frisch installieren und gesamthaft prüfen | REL-01 | K; Gesamt-/Toolchainabnahme offen |
| REL-03 | Neue LowQuantFlow-/Next-APK | Frischer Webbuild/Sync, vollständiger Assetvergleich, Tests/Lint/Build, tatsächliche ID/Labels/Manifest | REL-01/02 | X |
| REL-04 | Signierung und getrennte Installation | Zertifikat/Alignment, nutzerkontrollierter Schlüssel und zweite verschlüsselte Kopie, parallele UID/dataDir | REL-03, Schlüsselautorisation | P/X |
| DAT-01 | Import und Konfliktschutz erhalten | Ein konkurrierender Commit gewinnt; veralteter/abgebrochener Plan schreibt nicht; Vorschau entspricht Ziel | REL-01 | K |
| RUN-01 | Ausdrückliche sichere Wiederaufnahme | Reload startet nichts; bestätigte Schritte übersprungen; Drift/fehlende Locks/falsche ACKs blockieren; Pause/Stop verbindlich | REL-01/02 | K; WebView offen |
| DAT-02 | Backup und isolierter Restore | Vollständiger Feldvergleich in Testspeichern; Produktionsdaten unverändert; kein Resume aus Backup; produktiver Restore gesondert | REL-02, RUN-01 | B/K für Backup; P für Restore |
| OBS-01 | Lokale Diagnose | Nur Positivlistenmetadaten; keine Rohtexte/Secrets/Stacks, Probes, Telemetrie oder Export | REL-01/02, RUN-01 | K |
| OBS-02 | Ehrliche Verbindungsnachweise | Gespeichert/erreichbar/authentifiziert/geprüft getrennt; historische Daten niemals Livezugriff | OBS-01 | K für lokale Projektion; Liveprüfung P |
| MEM-01 | Projektgebundenes Gedächtnis | Projekt A sieht keine Daten aus B über Suche, Export oder Lauf; keine stille Altzuordnung; Entscheidungsherkunft erhalten | Versionierter Vertrag, DAT-01/02 | P |
| CFG-01 | Vier getrennte Einstellungsbereiche | Alle vier Profile verlustfrei; Theme/Output/Prompt erweitern keine Rechte oder Budgets | Migration, SAFE-01 | P |
| WRK-01 | Aufgabenkonstruktor | Pflichtfelder und Zyklen prüfen; Cancel ohne Write; konsistente Referenzen; Speicherung startet keinen Anbieter | MEM-01, CFG-01, DAT-01 | P |
| WRK-02 | Wirkungsanalyse | Direkte/transitive Folgen anhand Fixtures; Unbekanntes markieren; keine Mutation des aktiven Auftrags | WRK-01, MEM-01 | P |
| DEC-01 | Variantenvergleich | Gleiche Kriterien; keine erfundenen Scores; erst Auswahl ändert Auftrag; verworfene Varianten nachvollziehbar | WRK-01/02, MEM-01 | P |
| REV-01 | Erklärende Reviewkarten | Befund, Revision, Beleg, Auswirkung und Wiederholungsprüfung; geänderter Inhalt entwertet alte Zustimmung | REL-02/R2, WRK-02, MEM-01 | P |
| SIM-01 | Shadow-Modus | Getrennte Kopie; keine externen Calls/operativen Writes; Simulation eindeutig markiert | WRK-01/02, SAFE-01 | P |
| AUT-01 | Begrenzter Autopilot | Ausdrücklicher Start; Scope/Budget/Stop; keine Doppelwirkung oder Rechteausweitung; Reload ohne Start | RUN-01, SIM-01, CFG-01, SAFE-01 | P |
| SAFE-01 | Rechte unabhängig von Lernen/Darstellung | XP, Begleiter, Prompt/importierte Entscheidung schaffen keine Rechte; Widerruf und Drift blockieren | CFG-01, RUN-01 | B; neue Modi P |
| LEARN-01 | Bestehende Lernpfade erhalten | Vier Praxisstufen/fünf Ableitungen; keine Wiederholungs-XP; echter Transferbeleg; gleichwertiges 2D | SAFE-01, UX-01/02, DAT-01 | B |
| UX-01 | Sechs Werkstattmodi | Alle 17 Bereiche erreichbar; gleiche IDs/Status/Entwürfe; keine duplizierten Runner | CFG-01, Fachfunktionen | P |
| UX-02 | Drei Layouts | Mobiler Fokus, technische Werkbank, Ausgabestudio teilen Zustand/Aktionen; Fokus/Zurück korrekt | UX-01, QA-01 | P |
| DEV-01 | Entwicklungsbegleitung | Behauptet/begonnen/gespeichert/geprüft trennen; tatsächliche Blocker und unbekannte Ausgänge anzeigen | WRK-01/02, MEM-01, RUN-01 | P |
| OUT-01 | Bereinigte Präsentation | Allowlist auch beim Kopieren/Export; keine Secrets/Privatnotizen/fremden Projekte; keine automatische Veröffentlichung | MEM-01, CFG-01, OBS-01 | P |
| MOD-01 | Abschaltbarer 3D-Begleiter | Assets/Lizenzen/Hashes; vorhandener Renderer; echte Zustände; Reduced Motion/Power Saver/2D; GPU/Akku | RUN-01, DEV-01, QA-01 | P |
| MOD-02 | Separates optionales Video-Studio | Getrennte Medien/Projekte; kontrollierter Export; kein Anbieteraufruf/Kosten/Publizieren ohne Auftrag | OUT-01, INT-01, MEM-01 | P |
| INT-01 | Kontrollierte Provider/portable Daten | Identität/Revision/Löschen/Konflikte; Config/Login startet nichts; autorisierte Daten-/Kosten-/Credentialgrenzen | OBS-02, SAFE-01, CFG-01, DAT-02 | P |
| QA-01 | Bedienbarkeit und aktuelle Performance | 390 px, Schrift/Tastatur/Fokus/Status, gleiche 2D/3D-Auswahl, Kontextverlust/Lifecycle, echte Messbaseline | Finaler integrierter Build | B/P; Geräteabnahme offen |

## Qualitybefunde präzise abgegrenzt

| Befund | Gezielt korrigiert/geprüft | Noch offen |
| --- | --- | --- |
| R1 | Inaktive Sheet-Portale bei Studio-/Historywechsel; Entwurf bleibt bei Rückkehr | Physisches Android dialog-first Back und Dirty-Discard |
| R2 | Reviewrelevanter Inhalt und transitive Voraussetzungen | Neue Reviewkarten als eigenes Feature |
| R3 | Veraltete/geschlossene Preferencesverbindung, Close-during-save; kein Write-Replay | Reale WebView-/Prozess-/Stromverlustabnahme |
| R4 | Vollständiger Quellenkatalog, eindeutige IDs, richtige Katalogreferenzen, ehrlicher Prüftext | Wahrheit historischer Beschreibungen; produktiver Restore |
| R5 | Vite 8.0.16 mit notwendiger gepinnter Abhängigkeitskette | Frisches npm ci, Gesamttests und Webbuild |
| R6 | Nodevertrag ^22.18.0 oder ^24.0.0 | Lauf auf tatsächlichen erklärten Minima; ausgeführt wurde 24.19.0 |

## Sieben Freigabegates

| Gate | Erforderlicher Nachweis | Aktueller Stand / Konsequenz |
| --- | --- | --- |
| G0 Herkunft | Vollständige Quellkette, exakte Bytes und Inventar | Kandidatenkette hashgebunden; vollständig materialisierte Zielkopie offen |
| G1 Review | Reproduzierte Befunde, passende Regressionen, unabhängige Prüfung finaler Bytes | Quality, Diagnose und Branding gezielt gegengeprüft; kein allgemeiner Vollrelease |
| G2 Daten und Rechte | Import/CAS, Isolation, Shadow-/Review-/Berechtigungsgrenzen des Lieferumfangs | Bestehende lokale Grenzen gezielt geprüft; neue Werkstattfunktionen noch geplant |
| G3 Gesamtintegration | Vollständige aktuelle Standardsuite/serielle Verifikation, Typecheck, frischer Webbuild | Typecheck gezielt grün; Gesamtsuite/Installation/Build offen |
| G4 Native Ausgabe | Sync, vollständiger Assetvergleich, Androidtests/Lint/Build, Manifest | Offen; keine neue APKfreigabe |
| G5 Auslieferung | Signatur, Zertifikat, Alignment, Schlüsselverwahrung, getrennte Installation | Offen |
| G6 Gerät | Bedienung, Dateien, Lifecycle, Wiederaufnahme, erforderliche Grafik/AR | Offen |

Jedes Gate gilt für den bezeichneten Umfang. Ein grüner Teiltest ersetzt kein anderes Gate. Eine Anforderungsquote darf nur vollständig abgenommene Anforderungen eines vorab festgelegten Lieferumfangs zählen; Testanzahl ist keine Featureabdeckung.

[Statusnachweis](17-status-evidence.md) · [Arbeitspakete](15-roadmap.md)
