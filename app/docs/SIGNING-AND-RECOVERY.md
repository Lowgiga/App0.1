# Journal-Prototyp 0.5.5 vom 4. November 2026

Aktueller Quellkandidat: `0.5.5-prototype-20261104`. Android-Versionscode: `13`. App-ID `de.lowgiga.cuecommandmesh.next` und bisheriger Debugsigner bleiben vorgesehen; die Signaturkontinuität ist am neu gebauten Artefakt erneut zu prüfen. Dieser Kandidat ändert gegenüber 0.5.4 nur das Laufjournal (N2): Nach einem unerwarteten Schließen der IndexedDB-Verbindung durch Android oder die WebView wird es ohne App-Neustart wieder benutzbar (`src/studio/workflow-journal.ts`, Regressionstest `tests/recovery-journal-lifecycle.test.mjs`). Jeder Öffnungsversuch ist ein eigenes Token; Lesen wird nach Verbindungsverlust höchstens einmal mit frischer Verbindung wiederholt, Schreiben nie automatisch. Außerdem sind zwei bereits in 0.5.4 zeitabhängig fehlschlagende Tests gehärtet: `tests/system/workflow-recovery-ui.test.tsx` (Lesezugriffe bei eingehängtem Panel laufen jetzt in `act`) und `tests/system/local-collaboration-ui.test.tsx` (Klick wartet begrenzt auf den Button); das Produktverhalten ändert sich dadurch nicht. Keine neuen Funktionen, Abhängigkeiten oder Berechtigungen. Tests, Build und Geräteabnahme gelten nur mit neuen eigenen Nachweisen.

Die folgenden Abschnitte bleiben als historischer Bericht erhalten und bestätigen diesen neuen Kandidaten nicht.

# Appearance-Prototyp 0.5.4 vom 5. Oktober 2026

Aktueller Quellkandidat: `0.5.4-prototype-20261005`. Android-Versionscode: `12`. App-ID `de.lowgiga.cuecommandmesh.next` und bisheriger Debugsigner bleiben vorgesehen; die Signaturkontinuität ist am neu gebauten Artefakt erneut zu prüfen. Dieser Kandidat erweitert die lokalen Hologramm-Darstellungen. Gemeinsame Projektion, Vorschau und Speichergrenzen: [Appearance-Spezifikation](superpowers/specs/2026-10-05-appearance.md). Individuelle Darstellungen sind nicht im bisherigen Projektbackup enthalten; Wiederherstellung bleibt reine Vorschau. Tests, Build und Geräteabnahme gelten nur mit neuen eigenen Nachweisen.

Die folgenden Abschnitte bleiben als historischer Bericht erhalten und bestätigen diesen neuen Kandidaten nicht.

# Signatur und Sicherung: Preview-Bestand und Cue Command Mesh Next

Stand: 4. Oktober 2026. Dieses Dokument beschreibt die vereinbarte Planung. Es bestätigt weder eine abgeschlossene Schlüsselübergabe noch eine geprüfte zweite Sicherung, eine fertig signierte APK oder eine native Freigabe. Die tatsächlichen Ergebnisse gehören in den gesonderten Prüfbericht der jeweiligen Auslieferung.

Update-Nachtrag vom 5. Oktober 2026: Der Folgeprototyp verwendet die oben und unten benannten Paketdaten. Er erhöht Next von Versionscode 10 auf 11; Signaturkontinuität, tatsächlicher APK-Inhalt und Geräteverhalten sind am neuen Artefakt gesondert zu prüfen. Dies ist keine Produktionsfreigabe. Die historische Sicherungsplanung vom 4. Oktober bleibt erhalten.

## 1. Bestehende Installation und genehmigte Next-Variante

Die bestehende Preview-Installation verwendet die App-ID `de.lowgiga.cuecommandmesh.preview`. Ihre Daten und die bereits geprüfte Preview-Quellbasis sollen erhalten bleiben.

Für die weitere Auslieferung ist eine getrennte Variante derselben weiterentwickelten Codebasis genehmigt:

- App-ID: `de.lowgiga.cuecommandmesh.next`
- Sichtbarer Name: `LowQuantFlow`
- Geplante Version: `0.5.3-prototype-20261005`
- Geplanter Android-Versionscode: `11`

Next erhält einen eigenen Android-Datenspeicher und kann neben Preview installiert werden. Es gibt keine automatische Übernahme von Arbeitsdaten, Einstellungen, Workflow-Journalen oder Berechtigungen. Next ist kein direktes Update der installierten Preview-App. Die tatsächlichen Paketdaten müssen am fertigen Artefakt geprüft werden.

Der ursprüngliche private Preview-Signierschlüssel wurde bislang nicht gefunden oder als verfügbar nachgewiesen. Als öffentliche Referenz wurde für die frühere 0.5.0-APK dieser SHA-256-Fingerabdruck des Signaturzertifikats ermittelt:

`0249696cc8c6fc4aa7f60bf90c62d32bc50cfd080792c19a152f2e19e9d0fd92`

Das ist die Preview-Referenz und ausdrücklich nicht der noch zu prüfende Next-Fingerabdruck. Ein APK-Zertifikat oder Prüfbericht enthält nicht den zugehörigen privaten Schlüssel und stellt ihn nicht wieder her.

## 2. Bedeutung des neuen Signierschlüssels

Die Genehmigung eines neuen privaten Schlüssels betrifft die Next-Variante. Ein neuer Schlüssel ermöglicht kein direktes Update der bisherigen Preview-Installation; auch ein höherer Versionscode behebt eine abweichende Signatur nicht. Für zukünftige Next-Updates müssen Paketidentität und Signaturkontinuität erhalten bleiben. Eine besondere Schlüsselrotation oder ein anderer kompatibler Übergang ist derzeit nicht nachgewiesen. Der tatsächliche Next-Zertifikatsfingerabdruck wird erst nach erfolgreicher Prüfung eingetragen. Grundlage: [Android-App-Signierung](https://developer.android.com/studio/publish/app-signing).

Dieses Dokument enthält keine Schlüssel, Passwörter oder Befehle, die Schlüssel automatisch erzeugen, ersetzen oder ändern.

## 3. Dauerhafte Aufbewahrung und zweite Sicherung

Folgende Zielaufbewahrung ist vereinbart und noch praktisch nachzuweisen:

1. **Primärkopie auf dem Nutzerrechner:** Ein passwortgeschützter Keystore liegt außerhalb von Git, Projektordnern und Build-Ausgaben, auf einem verschlüsselten Datenträger mit Zugriff nur für den Nutzer.
2. **Zweite verschlüsselte Offlinekopie:** Derselbe Keystore wird auf einem eigenen Datenträger gesichert, räumlich getrennt aufbewahrt und nach der Prüfung wieder getrennt. Ein weiterer Ordner auf demselben Laufwerk ist keine unabhängige Sicherung.
3. **Passwörter getrennt aufbewahren:** Keystore-/Schlüsselpasswort und gegebenenfalls das Passwort des verschlüsselten Sicherungsmediums werden im nutzerkontrollierten Passwortmanager mit eigener Wiederherstellungsmöglichkeit verwahrt. Sie gehören nicht in Projektdateien, Gradle-Konfigurationen, Shell-Verlauf, Chat, Protokolle oder unverschlüsselte gemeinsame Archive.
4. **Keine Weitergabe über Auslieferungswege:** Private Schlüssel und Passwörter gehören nicht in Library, GitHub, Quellcode-ZIP, APK-Auslieferungsordner, Tickets oder Chat. Öffentliche Zertifikatsdaten dürfen im Prüfinventar stehen.
5. **Build und Schlüsselverwahrung getrennt halten:** Unsigned Builds und native Prüfungen können auf dem Cloudcomputer erfolgen. Das dauerhafte Ziel ist eine nutzerkontrollierte lokale Signierung. Falls der genehmigte Next-Schlüssel zunächst geschützt auf LOWs Cloudcomputer entsteht, ist diese Arbeitskopie noch keine nachgewiesene dauerhafte Sicherung auf dem Nutzerrechner.

Die geschützte Übergabe an den Nutzer und die zweite, unabhängig geprüfte Offlinekopie sind offen. Dieses Dokument bestätigt nicht, dass diese Schritte bereits erfolgt sind.

## 4. Inventar ohne Geheimnisse

Für Preview und Next werden getrennte Einträge geführt. Ein Eintrag umfasst:

- App-ID, sichtbaren Namen und zugehörige Version
- Vollständigen SHA-256-Zertifikatsfingerabdruck, Referenz-APK und Prüfdatum
- Keystore-Dateinamen, Alias und Eintragstyp: privater Schlüsseleintrag oder lediglich Zertifikat
- Private Verweise auf Primärablage und Offline-Sicherungsmedium
- SHA-256 des Keystore-Inhalts sowie Datum und Ergebnis der unabhängigen Lese- und Signierprüfung beider Kopien
- Verweis auf den Passwortmanager-Eintrag, niemals das Passwort selbst

Next-Fingerabdruck, Alias, tatsächliche Ablagen und Lesbarkeit bleiben als unbestätigt markiert, bis sie real geprüft wurden. Private Ablageangaben werden nicht in öffentliche Auslieferungsberichte übernommen.

## 5. Beide Kopien unabhängig prüfen

Die Prüfung wird auf dem nutzerkontrollierten Rechner durchgeführt. Passwörter werden über einen geschützten lokalen Eingabeweg eingegeben, nicht als sichtbare Kommandozeilenargumente oder Chatnachricht.

1. Die Primärkopie öffnen und Alias, privaten Schlüsseleintrag und Zertifikatsfingerabdruck prüfen.
2. Die Offlinekopie unabhängig öffnen. Dabei tatsächlich auf die zweite Datei zugreifen, nicht erneut auf die Primärkopie.
3. Die Hashes der entschlüsselten Keystore-Dateien vergleichen. Unterschiedliche äußere Verschlüsselungscontainer können trotz identischem Keystore unterschiedliche Hashes haben.
4. Eine lesbare Datei und ein sichtbares Zertifikat beweisen noch nicht, dass der private Schlüssel verwendbar ist. Im Rahmen einer ausdrücklich freigegebenen lokalen Prüfung wird deshalb mit jeder Kopie eine isolierte Test-APK signiert und deren Signatur geprüft. Eine Installation oder Löschung von App-Daten ist dafür nicht erforderlich.
5. Die Ergebnisse und das Prüfdatum getrennt für beide Kopien dokumentieren und das Offline-Sicherungsmedium wieder trennen.

Eine bestehende APK lässt sich mit `apksigner verify --verbose --print-certs` lesend prüfen. Der Befehl benötigt zusätzlich den tatsächlichen APK-Pfad; er signiert oder installiert nichts. Maßgeblich sind der erfolgreiche Prüfstatus und die ausgegebenen Zertifikatsdaten. Siehe [offizielle apksigner-Dokumentation](https://developer.android.com/tools/apksigner).

Solange die unabhängigen Prüfungen fehlen, bleibt der Sicherungsstatus unbestätigt.

## 6. Erste Next-Installation und spätere Updates

Vor einer ersten Next-Auslieferung werden App-ID, Name, Versionscode, native Prüfergebnisse und die tatsächliche APK-Signatur kontrolliert. Erst der real geprüfte neue Zertifikatsfingerabdruck wird als Next-Referenz gespeichert. Die vorhandene Preview-Installation bleibt erhalten; eine Gleichheit ihrer Daten mit Next wird nicht zugesagt.

Vor jedem späteren Next-Update werden geprüft:

- Die APK trägt exakt die Next-App-ID und den vorgesehenen höheren Versionscode
- Ihre Signaturprüfung ist erfolgreich
- Das Zertifikat entspricht der tatsächlich installierten Next-Version und dem bestätigten Inventar
- Für die Signierung wurde der dazugehörige verifizierte Schlüssel verwendet

Bei fehlendem Schlüssel oder ungeklärter Zertifikatsabweichung wird kein Ersatzschlüssel automatisch erzeugt und keine Deinstallation als Update-Lösung durchgeführt. Ein direktes Preview-Update bleibt ohne ursprünglichen Schlüssel oder gesondert nachgewiesenen kompatiblen Übergang offen.

## 7. App-Daten und Wiederherstellung

Vor Installations- oder Übergabeschritten werden verfügbare Arbeitsdaten, Verlauf und zugehörige Dokumente außerhalb der App exportiert und die erzeugten Dateien geöffnet beziehungsweise geprüft. Ein vorhandener Export allein ist kein Nachweis, dass sämtliche App-Daten wiederhergestellt werden können.

Der aktuelle System-Backup-Pfad bietet eine Importvorschau, keinen vollständigen Restore. Der Legacy-Import ergänzt ausgewählte Arbeitsdaten. Das dauerhafte Workflow-Journal wird bewusst nicht als portable Wiederaufnahmeberechtigung exportiert oder importiert.

Eine Übernahme von Preview nach Next muss gesondert auf Format, Vollständigkeit und Ziel geprüft und ausdrücklich bestätigt werden. Eine automatische Migration ist nicht implementiert. Die bestehende App zu deinstallieren oder ihre Daten zu löschen ist kein vorgesehener Weg, um Signatur- oder Importprobleme zu lösen.

Native Build-, Signatur- und Gerätetests werden erst nach ihrer tatsächlichen Durchführung im jeweiligen Prüfbericht bestätigt. Diese Planung nimmt deren Ergebnis nicht vorweg.
