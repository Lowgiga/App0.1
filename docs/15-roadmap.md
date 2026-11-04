# Arbeitspakete und Reihenfolge

Keine Kalenderzusage wird aus diesem Plan abgeleitet. Reihenfolge richtet sich nach Abhängigkeiten und überprüfbaren Ergebnissen. Die erste Kern-APK ist eine Zwischenlieferung.

## Paket A · Quell- und Releasegrundlage

**Umfang:** REL-01–04, bestehende Import-/Recoverygrenzen erhalten.

**Nächste Schritte:** finale Quellkette materialisieren; gepinnte Pakete frisch installieren; vollständige Tests/Webbuild; native Dialog-/Zurückgrenzen klären; Sync und Assetvergleich; Androidtests/Lint/Build; kontrollierte Signierung; parallele Installation und Geräteprüfung.

**Ergebnis:** konkrete installierbare Next-/LowQuantFlow-APK mit belegtem Umfang. Kein zusätzlicher Cloudanbieter oder Rewrite.

**Blocker/offene Nachweise, 4. Oktober 2026, 12:30 UTC:** Die neue Cloudumgebung kann schreiben/starten und reguläres HTTPS über den vorhandenen Proxy nutzen. Android SDK 36, Build Tools 35.0.0 und Gradle 8.14.3 sind prüfsummenverifiziert installiert. Der offizielle Quelltransfer scheitert weiterhin ohne verfügbaren HTTP-Status; separate Hostproben zeigen Proxy-CONNECT 403 für beide benötigten Library-Speicherhosts. Gezielte Freigabe ist angefordert. Das vorhandene Java-21-Compilermodul startet, die reguläre Offline-Gradle-JavaCompile-Probe scheitert jedoch an der Toolchain-Erkennung. Eine vollständige JDK-21-Installation wird benötigt. Die frühere pauschale DNS-/Netzblockerdiagnose ist korrigiert. Noch kein Appbuild; neue Signier-/Sicherungsstrecke und Gesamt-/Geräteabnahme sind nicht nachgewiesen.

## Paket B · Lokale Werkstattbasis

**Umfang:** OBS-01/02, MEM-01, CFG-01, WRK-01.

Diagnose ist bereits als gezielt geprüfter Quellnachtrag vorhanden. Auf der endgültigen Appbasis erneut integrieren. Danach projektgebundenes Gedächtnis, vier getrennte Einstellungsbereiche und Aufgabenkonstruktor mit verlustfreiem Migrationsvertrag ergänzen.

**Ergebnis:** Projekt und Auftrag eindeutig, Herkunft sichtbar, keine Vermischung. Cancel schreibt nichts; Speicherung startet keinen Agenten.

## Paket C · Wirkung und Review

**Umfang:** WRK-02, DEC-01, REV-01, DEV-01.

Deterministische Wirkungsanalyse vor Variantenvergleich. Gleiche Vergleichskriterien und explizite Annahmen. Reviewkarten hängen an konkreter gespeicherter Revision. Entwicklungsbegleitung erklärt belegten Zustand und nächsten sicheren Schritt.

**Ergebnis:** Entscheidungen und Auswirkungen nachvollziehbar, Unbekanntes nicht erfunden.

## Paket D · Begrenzte Arbeitsweise und Ansichten

**Umfang:** SIM-01, AUT-01, UX-01/02, OUT-01, SAFE-01.

Shadow auf getrennter Kopie, danach ausdrücklich gestartete begrenzte lokale Prüfpläne. Sechs Modi und drei Layouts nutzen denselben Auftrag. Ergebnisprojektion enthält nur erlaubte Felder.

**Ergebnis:** keine Doppelrunner, keine zusätzlichen Befugnisse, keine ungewollte Außenwirkung. Reload startet nichts.

## Paket E · Gewünschte optionale Module

**Umfang:** MOD-01 und MOD-02.

3D-Begleiter erst nach Asset-/Lizenz-/Adapterprüfung in denselben Renderer. Separates Video-Studio zunächst lokal; externer Anbieter nur nach eigener Entscheidung und Autorisierung.

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
