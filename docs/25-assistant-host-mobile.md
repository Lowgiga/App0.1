> Historischer Assistant-/Mobile-Nachtrag zur Quelle f57200cd. Die bestehende Funktion bleibt erhalten; der aktuelle [K1-Nachtrag](26-k1-continuation.md) ergänzt die geprüfte lesende Projektfortsetzung ohne Versionsanhebung.

# Laufende 0.5.4-Entwicklung: Assistant-Host und Mobile

Kein Versionssprung, keine neue Prototyp-/APK-Ausgabe und kein Deployment. Die Beratung bleibt eine Offline-Simulation ohne angeschlossene echte LLM-Engine.

## Geprüfter Delta

Basis: `76e222d09b301f2acf5ec6c1db010f8e0bf13be8`. Vollständiger Publisherpatch: 98.444 Bytes, SHA-256 `28d23deb7ec34430c340754a80c7ed491a3974581ab5143d4b2901dd99b81fc1`.

19 Quelldateien: 17 Assistant-/Mobile-Code-, Test- und Dokumentationsdateien sowie die zwei bewusst angenommenen Qualitymetadateien. Fünf neue Dateien, 14 Änderungen, keine Löschung. Alle Hunks wurden gegen die echten Remote-Basisblobs geprüft; keine alten Teilpatches zusätzlich angewendet.

- quality-source-v1: `f57200cd8e13f840f2bffb12ffc43d2ace1dcab3dc4a8abaab67b17721588429`, 1.018 Scope-Dateien
- Vollständiger app/-Baum: 1.020 Dateien einschließlich zwei unveränderter historischer Scope-Ausnahmen
- App-Git-Tree: `0b7a8fd66200a998543303dcd6bdf1abe91c6768`
- Externer Contractpin: `7d4b3aa380bafa20ad846eab77e2e5b1684a5a0096ecf2efcac26975d9f2fe36`
- 29 Schutzgruppen: die bisherigen 23 byte-/strukturgetreu erhalten, genau sechs unabhängig geprüfte Gruppen ergänzt; exceptions bleibt leer
- Baseline: 1.016 Einträge, SHA-256 `c97a698668fa5f34c6232f6102d0f28f950d7504c8052a0a76ffa6998a9b15a7`

[Inventar](reference/assistant-host-mobile/source-after.json) · [Delta](reference/assistant-host-mobile/publisher-source-diff.json) · [Adoption](reference/assistant-host-mobile/adoption-checks.json)

## Verhalten und Autoritätsgrenzen

Vorschläge und externe Aussagen werden nur nach vorhandener Validierung getrennt als React-Text dargestellt. Kein HTML, keine automatisch erzeugten Aktionslinks, keine automatische Übernahme. Quellenlose Aussagen bleiben als solche sichtbar; Quellenreferenzen sind keine Wahrheitsbestätigung. Bestätigte Hostaussagen bleiben getrennt.

Herkunftsmetadaten beruhen auf der geprüften Produzentenbindung. Die vorhandene projektbezogene Detail-Einstellung öffnet oder schließt Quelldetails. Es gibt keine zweite Einstellungsdatenbank.

Stop, Timeout, Superseded, Projektwechsel und stale Arbeitsstände verwerfen Ergebnisse beziehungsweise Zustimmungsvorschauen. Noch offene Adapterpromises werden bis zum tatsächlichen Settlement separat gezählt. Weder Ergebnisverwerfen noch Promise-Abschluss attestieren ein externes Engine-Ende. Keine Token-, Kosten- oder CPU-Abrechnung wird behauptet.

Die hostseitige Adapterfactory ist eine geprüfte Test-/Integrationsnaht, kein aktivierter Provider. Der Produktionshook verwendet unverändert den Simulator. Reale lokale und entfernte Modelle bleiben gesperrt. Zustimmungs-, Commit- und separat gelesene Receipt-Kette sowie bestehende Autoritätsgrenzen werden nicht durch Modelltext erweitert.

Die mobile Aktionsleiste bleibt nach dem Ende eines Eingabefokus zurückgehalten, solange beteiligte Pointer oder die entsprechende Maustaste noch gehalten werden. Mehrzeigerfälle, Abbruch, verlorener Pointer-Capture ohne tatsächliches Loslassen und Kompatibilitätsmausereignisse sind berücksichtigt. Dadurch wird eine beabsichtigte Speicheraktion nicht von zu früh eingeblendeter Navigation abgefangen.

[Ausführliche Hostdokumentation](../app/docs/assistant-advisory-host.md)

## Nachweise

Gepinnter Cloudlauf: Exit 0, web-built. Fünf Phasen preflight, qualityTests, verifySerial, postflight und sourceStability PASS; 1.401 App-/Laufzeittests plus 50 Qualitytests, TypeScript, Generatoren und Webbuild erfolgreich. Quelle vor/nach unverändert.

61 Webassets, Inhaltshash `cb66e214f4a406b450701006cdcc40d4b3f632152bb95defa306b7c8fbde7fd6`, identisch zum browsergeprüften kombinierten Stand. Die abschließende Adoption änderte nur die zwei Qualitymetadatendateien; keine erneute Browser-/Geräteprüfung durch den Publisher behauptet.

[Prüfzusammenfassung](reference/assistant-host-mobile/verification-summary.json) · [Vollständiges Log](reference/assistant-host-mobile/verify-quality.log) · [Buildinventar](reference/assistant-host-mobile/build-manifest.json) · [Patchreproduktion](reference/assistant-host-mobile/publisher-reproduction.json)

Die mitgelieferten Browserbelege für veraltete Ergebnisse, mobile Speicheraktivierung und Multitouch bleiben getrennt vom Qualitywrapper. Dessen native/manuelle not-run-Felder sind unverändert. Die unabhängigen Reviewbefunde sind im freigegebenen Gesamtstand behoben; keine fachliche Assertion wurde zur Grünfärbung entfernt.

## Weiterhin offen

Native Compile-/Test-/Lint-/APK- und physische Android-/IME-/Notch-/GPU-/Kamera-/Akku-Gates. Keine Geräte-, Modell- oder Produktionsfreigabe. Keine neue LLM-Engine, Berechtigung, Schlüsselübertragung oder Sicherheitsänderung.

Die vorhandenen Speicher- und Backupgrenzen gelten weiter. Diese Aktualisierung führt die Entwicklung innerhalb PR9 fort; main und FINAL984 bleiben unverändert, solange kein gesondert autorisierter Merge erfolgt.
