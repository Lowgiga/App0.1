> Historischer Appearance-/Web-Prüfpunkt zum [Commit 76e222d](https://github.com/Lowgiga/APP/tree/76e222d09b301f2acf5ec6c1db010f8e0bf13be8/app). Die laufende Entwicklung ergänzt inzwischen den [Assistant-/Mobile-Nachtrag](25-assistant-host-mobile.md), ohne Versionsanhebung oder neue Ausgabe. Die folgenden Zahlen und Pins bleiben dem vorherigen Stand zugeordnet.

# 0.5.4 · unabhängig geprüfter Webgesamtstand

Version: `0.5.4-prototype-20261005`, Android-Code 12. Stand: 5. Oktober 2026. Native Compile-/Test-/Lint-/APK- und Gerätegates bleiben offen.

## Exakte Quelle

Basis dieser abschließenden Übernahme: `857cc78761c799e2b843d7418f736d51cb3baa8b`. Gegenüber dieser Basis werden genau neun Appdateien übernommen: zwei Label-/Three-Overlaydateien, der Graphgenerator, die Assistant-Transaktionskorrektur, drei neue Hilfs-/Testdateien und die zwei bewusst angenommenen Qualitymetadateien. Keine weiteren Appdateien oder Abhängigkeiten geändert.

Publisherpatch: 68.274 Bytes, SHA-256 `ea57c21d6bb29519fa84a8ed325e5dda743324d2a2473e9736a4b49b5edfa268`. Alle Hunks wurden gegen die echten Basisblobs aus GitHub im Speicher geprüft; ältere Teilpatches wurden nicht zusätzlich angewendet.

- Quality-Source-SHA-256: `eb2cd9999c02906d86054ae3b2127d26b45c8812022e68ed69800a2c526f11d4`
- Scope: quality-source-v1, 1.013 Dateien
- Vollständiger app/-Baum: 1.015 Dateien; die zwei historischen Dokumentationsmanifeste außerhalb dieses Scopes bleiben unverändert erhalten
- App-Git-Tree: `c73d287a39670197a285d6ea0385c2bcc5cb2537`
- Alle Sourcepfade, Git-Blob-SHAs und Modi werden gegen dieses gebundene Inventar geprüft

## Bewusst angenommener Qualitätsvertrag

- Baseline: 1.011 Einträge, 114.410 Bytes, SHA-256 `3ed87d4406c9bec03032890a4b6ec8cd7c00689cefc3fbfa08794c9ef2605597`
- Contract: 23 Schutzgruppen, 10.543 Bytes
- Unabhängig angenommener externer Pin: `592525a78c17468c61cb82776e22131076d9f6491359a4be8cfb5d5e6ca6de87`
- Baseline entspricht exakt dem vollständigen Sourceinventar ohne die zwei Qualitymetadatendateien
- Keine aktive Ausnahme, automatische Selbstadoption oder Abschwächung von Tests
- Checker und Runner unverändert; kein manipulationssicherer Selbstnachweis oder verpflichtender Remote-Branchschutz behauptet

[Inventar](reference/appearance-054/source-inventory.json) · [Adoptionsvalidierung](reference/appearance-054/adoption-validation.json) · [Unabhängige Patchreproduktion](reference/appearance-054/publisher-replay.json)

## Tatsächlich abgeschlossene Webprüfung

Der finale gepinnte verify:quality-Lauf endet mit Exit 0, PASS, web-built. Alle fünf Phasen preflight, qualityTests, verifySerial, postflight und sourceStability sind grün.

- 50 Qualitytests
- 246 + 845 + 19 + 220 + 30 + 7 = 1.367 Node-Laufzeittests
- Zusätzlich das separate Level-Rendererskript erfolgreich
- TypeScript, Generatoren und Vite erfolgreich
- Keine Sourceänderung durch den Prüflauf
- 61 Webassets, Inhaltshash `61630478600df1644a24e8f8bc8d40fe04c646fcda6b1534d5d2896d3ace3f73`

[Freeze](reference/appearance-054/freeze.json) · [Vollständiges Log](reference/appearance-054/verify-quality.log) · [Buildinventar](reference/appearance-054/build-manifest.json)

## Browserregression, getrennt vom Qualitywrapper

Appearance wurde bei 1440×1000 und 390×844 Browserviewport geprüft: drei Farbkanäle, Form/Größe, ungespeicherte Vorschau, Abbrechen, Save/Reload, Reset als Entwurf, stabile WebGL-Canvas-/Labelprojektion und keine horizontale Überbreite. Beide Läufe PASS.

Der erfolgreiche gezielte Desktop-Raum-Wiederholungslauf belegt individuelle Raumbindung, Save/Reload und pixelidentische Rückkehr nach Abbruch einer Vorschau bei erhaltener gedrehter Canvas. Der ursprüngliche Roomfehler bleibt als Erstlauf dokumentiert.

Diese Browserbelege wurden am identischen Appcode vor der reinen letzten Metadatenadoption erstellt. Der finale Build ist in allen 61 Dateien identisch. Der Qualitywrapper führt selbst keine Browser- oder nativen Tests aus; seine not-run-Felder bleiben deshalb unverändert.

[Appearance-Browserbeleg](reference/appearance-054/browser-results.json) · [Room-Wiederholung](reference/appearance-054/room-results.json) · [Room-Erstlauf](reference/appearance-054/room-first-run.json) · [Pixelvergleich](reference/appearance-054/pixel-evidence.json) · [Buildbindung](reference/appearance-054/browser-freeze-verification.json)

## Offene native und reale Gerätegates

Für diesen 0.5.4-Gesamtstand werden native Compile-/Test-/Lint-/APK-Gates nicht als erledigt ausgegeben. Eine neue APK, Signatur oder Geräteinstallation ist nicht Bestandteil dieses Commits. Die ältere ausgelieferte APK 0.5.3 gehört zu FINAL984.

ReadPixels-/GPU-Stall-, vorhandene Build- und Umgebungswarnungen wurden nicht ausgeblendet. Keine physische S25-/Touch-/Kamera-/Tracking-/GPU-Abnahme, Bildraten- oder Akkumessung behauptet. Browser-Viewporttests ersetzen keine Telefonprüfung.

Individuelle Darstellungen sind lokal getrennt gespeichert und nicht im bisherigen Projektbackup enthalten. Source/Belege werden privat veröffentlicht; keine Signierschlüssel, APKs, privaten Referenzfotos oder zusätzlichen Zugriffsrechte.
