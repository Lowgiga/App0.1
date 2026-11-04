> Fortschreibung: K2 mit gezieltem Öffnen einer gespeicherten Revision, History-/Routenschutz und konkreter Änderungsvorschau ist im [bezeichneten Webumfang geprüft](27-product-continuation-context.md). Bewusste Vorschlagsübernahme und separate Bestätigung bleiben getrennt; keine autonome Fortsetzung oder Gesamtanforderungsabnahme.

> Fortschreibung: K1 ist im [bezeichneten lesenden Webumfang geprüft](26-k1-continuation.md). Das erfüllt weder die gesamte Entwicklungsbegleitung noch native/physische Gerätegates. Folgearbeit bleibt separat abzugrenzen.

# Arbeitspakete und Reihenfolge

Keine Kalenderzusage wird aus diesem Plan abgeleitet. Reihenfolge richtet sich nach Abhängigkeiten und überprüfbaren Ergebnissen. Die erste Kern-APK ist eine Zwischenlieferung.

## Aktuelle Reihenfolge auf dem geprüften Stand

Die Pakete A–F und ihre Anforderungen bleiben erhalten. Der frühere Stand vom4.Oktober ist unten ausdrücklich historisch; aktuelle Quelle ist `c123f8ab5f155c61382a9b58208bb73e04b91a3188f8159241d588bd17285869`. [Statusgenaue27er-Matrix](16-acceptance-matrix.md) und [Gates](17-status-evidence.md#aktueller-geprüfter-stand) sind maßgeblich.

1. **Bereits geprüft:** gemeinsame Webquelle, Appearance, projektgebundenes Gedächtnis/persönliche Drafts, deterministische Kontextberatung und Mobilkorrekturen. Das schließt weder Gesamtwerkstatt noch native Gates ab.
2. **Im abgegrenzten lesenden Webumfang geprüft:** [K1 – belegte Kontextberatung zur Projektfortsetzung](25-context-continuation-work-package.md). Gespeicherte Draftmetadaten sind lesend angebunden; bestätigte nächste Schritte und bewusste Navigation sind im abgegrenzten Webumfang geprüft. Keine Enginewahl/Downloads oder neue Ausführungsrechte.
3. **Separater Nativepfad aus A:** vollständiges JDK21/Gradle-Auflösung, danach Sync/native Tests/Lint/APK und Gerät. Blocker lösen benötigt keine Erweiterung des K1-Scope.
4. **Danach B/C in kleinen Nutzerwegen:** vier Profilbereiche ordnen; Aufgabenkonstruktor für einen Typ; darauf Wirkungsanalyse, Variantenvergleich und allgemeine Reviewkarten. Bestehende Teilfunktionen wiederverwenden.
5. **D erst auf diesen Verträgen:** ein isolierter Shadow-Plantyp, danach explizit begrenzte Ausführung über vorhandenen Runner. Keine automatische Wiederaufnahme oder zweite Engine.
6. **E/F bleiben eigene Lose:** Companion-Renderer gegen ADR-007 klären; lokales Storyboard; isolierter Restore vor produktiver Datenübernahme. Sprachen/Embleme anhand der Matrix jeweils als eigene Darstellungserweiterung; kein stiller Zusatz zu K1.

## Paket A · Quell- und Releasegrundlage

**Umfang:** REL-01–04, bestehende Import-/Recoverygrenzen erhalten.

**Nächste Schritte:** finale Quellkette materialisieren; gepinnte Pakete frisch installieren; vollständige Tests/Webbuild; native Dialog-/Zurückgrenzen klären; Sync und Assetvergleich; Androidtests/Lint/Build; kontrollierte Signierung; parallele Installation und Geräteprüfung.

**Ergebnis:** konkrete installierbare Next-/LowQuantFlow-APK mit belegtem Umfang. Kein zusätzlicher Cloudanbieter oder Rewrite.

**Historischer Blockerstand, 4. Oktober 2026, 12:30 UTC; durch den aktuellen Statusnachweis überholt:** Die neue Cloudumgebung kann schreiben/starten und reguläres HTTPS über den vorhandenen Proxy nutzen. Android SDK 36, Build Tools 35.0.0 und Gradle 8.14.3 sind prüfsummenverifiziert installiert. Der offizielle Quelltransfer scheitert weiterhin ohne verfügbaren HTTP-Status; separate Hostproben zeigen Proxy-CONNECT 403 für beide benötigten Library-Speicherhosts. Gezielte Freigabe ist angefordert. Das vorhandene Java-21-Compilermodul startet, die reguläre Offline-Gradle-JavaCompile-Probe scheitert jedoch an der Toolchain-Erkennung. Eine vollständige JDK-21-Installation wird benötigt. Die frühere pauschale DNS-/Netzblockerdiagnose ist korrigiert. Noch kein Appbuild; neue Signier-/Sicherungsstrecke und Gesamt-/Geräteabnahme sind nicht nachgewiesen.

## Paket B · Lokale Werkstattbasis

**Umfang:** OBS-01/02, MEM-01, CFG-01, WRK-01.

Diagnose, projektgebundenes Gedächtnis und persönliche Entwurfsfortsetzung sind inzwischen integriert und im Webstand geprüft. Vier umfassende Einstellungsbereiche und der vollständige Aufgabenkonstruktor bleiben offen. Nicht erneut ein paralleles Gedächtnis bauen; nächste Integration ist K1.

**Ergebnis:** Projekt und Auftrag eindeutig, Herkunft sichtbar, keine Vermischung. Cancel schreibt nichts; Speicherung startet keinen Agenten.

## Paket C · Wirkung und Review

**Umfang:** WRK-02, DEC-01, REV-01, DEV-01.

Bestehende Aufgabenänderungsvorschau, transitive Reviewinvalidierung und geprüfte Assistant-Configtransaktion sind Teilbausteine, noch keine vollständigen Werkstattkarten. Deterministische Wirkungsanalyse vor Variantenvergleich. Gleiche Vergleichskriterien und explizite Annahmen. Reviewkarten hängen an konkreter gespeicherter Revision. Entwicklungsbegleitung erklärt belegten Zustand und nächsten sicheren Schritt.

**Ergebnis:** Entscheidungen und Auswirkungen nachvollziehbar, Unbekanntes nicht erfunden.

## Paket D · Begrenzte Arbeitsweise und Ansichten

**Umfang:** SIM-01, AUT-01, UX-01/02, OUT-01, SAFE-01.

Begrenzte lokale Offline-Prüfpläne mit dauerhaftem Journal und explizitem Resume sind vorhanden. Allgemeiner Shadow auf getrennter Kopie und daraus abgeleitete Autopilot-Pläne bleiben offen. Sechs Modi und drei Layouts nutzen denselben Auftrag. Ergebnisprojektion enthält nur erlaubte Felder.

**Ergebnis:** keine Doppelrunner, keine zusätzlichen Befugnisse, keine ungewollte Außenwirkung. Reload startet nichts.

## Paket E · Gewünschte optionale Module

**Umfang:** MOD-01 und MOD-02.

Der optionale Begleiter ist integriert; Asset-/Status-/Lifecycleprüfungen liegen vor. Sein eigener Renderer pro Panel erfüllt die ursprüngliche Vorgabe derselben Graphinstanz noch nicht. ADR-007 bleibt erhalten; diese Differenz und Geräteverbrauch gesondert klären. Separates Video-Studio zunächst lokal; externer Anbieter nur nach eigener Entscheidung und Autorisierung.

**Ergebnis:** beide Module abschaltbar beziehungsweise optional nutzbar; 2D/Kernarbeitsweg bleibt vollständig verwendbar. Beide gehören zum Ausbau, sind aber keine Voraussetzung für Paket A.

## Paket F · Datenübernahme und Integrationen

**Umfang:** DAT-02, INT-01.

Isolierten Restore belegen. Danach produktive Migration oder Sync erst mit Identität, Revisions-/Lösch-/Konfliktvertrag und erforderlichen Freigaben. Keine ungeprüften Anbieter nur zur Vervollständigung einer Katalogliste verbinden.

## Durchgehend

DAT-01, RUN-01, LEARN-01 und QA-01 schützen vorhandenes Verhalten über jede Stufe. Kosten, Rechte, Datenisolation, Zugänglichkeit und tatsächliche Plattformnachweise sind keine nachgelagerten Dekorationsaufgaben.

## Abschluss eines Arbeitspakets

- Lieferumfang und betroffene Anforderungen eindeutig
- Exakte Quelle und tatsächlich ausgeführte Prüfungen genannt
- Offene Blocker und nicht durchgeführte Prüfungen sichtbar
- Regressions-/Rücknahmeweg dokumentiert
- Kein Status „fertig“ allein wegen vorhandener UI oder Dateinamen
- Keine künstliche 90-%-Qualitätszahl; Anforderungsquote nur mit festgelegtem Nenner und vollständig bestandenen Kriterien

[27 Anforderungen](16-acceptance-matrix.md) · [Aktueller Status](17-status-evidence.md)
