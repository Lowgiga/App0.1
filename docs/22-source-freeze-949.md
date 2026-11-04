> Historischer Nachweis: Die hier beschriebenen 949 Quelldateien sind im [Commit bf1d4b8](https://github.com/Lowgiga/APP/tree/bf1d4b8c2a8ae199b511c9c8909766f2119a648c/app) erhalten. Der aktuelle app/-Baum enthält inzwischen [FINAL984](23-source-final984.md). Die folgenden Zahlen und Aussagen beziehen sich ausschließlich auf den vorherigen Integrationsschritt.

# Quellfreeze 949: Umfang und Nachweise

Stand dieser Dokumentation: 5. Oktober 2026.

## Zweck dieses Repository-Schritts

Der zuvor reine Dokumentationsbestand wird um den vollständigen, bereits unabhängig geprüften 949-Dateien-Appquellstand unter `app/` ergänzt. Die bestehenden Dokumente bleiben erhalten. README, Änderungsprotokoll und Statusverweis ordnen den neuen Repository-Schritt ein.

Dieser Stand ist ein historischer Integrationspunkt. Die später separat ausgelieferte APK 0.5.3 mit Versionscode 11 stammt aus FINAL984; ihre Quelle ist hier noch nicht integriert. Auch die frühere APK aus Stand 930 ist kein nativer Build von Freeze 949.

## Integrität

- Dateien: 949
- Gesamtgröße: 13.028.745 Bytes
- SHA-256 der sortierten SHA-256-Dateiliste: `98da772b5229ca6588b0393d6d0183a30c9a0c69b01e2b3118f0e362ea44b96e`
- Git-Tree von app/: `35b9a4f36295a60eec27eb6ac5d50d21f8109f5b`
- Remotevergleich: alle 949 Pfade, Git-Blob-SHAs und Dateimodi stimmen mit dem lokalen Freeze überein; keine zusätzlichen oder fehlenden Quelldateien
- Quellbytes unverändert, einschließlich originaler Zeilenenden und gebündelter Binärassets

Das Inventar liegt in [NEXT-files.sha256](reference/freeze-949/NEXT-files.sha256). Es verwendet Pfade relativ zu app/. Ein Build kann generierte Dateien verändern; deshalb zuerst das unveränderte Checkout verifizieren.

## Ausgeführte Prüfung dieses Kandidaten

Der vorliegende [Prüfbeleg](reference/freeze-949/NEXT-Pruefbeleg.json) und das [vollständige Log](reference/freeze-949/verify-serial.log) dokumentieren `npm run verify:serial`, Exit 0:

- Testgruppen: 211 + 744 + 19 + 220 + 30 + 7 = 1.231 Tests
- 1.231 bestanden, 0 Fehler, 0 übersprungen, 0 act-Warnungen
- Zusätzlich 18 Renderer-Szenarien
- TypeScript, Drift-, Vendor-, native Domain- und Webbuildprüfungen bestanden
- Webbuild: 58 Dateien, 5.930.267 Bytes
- Buildinventar-SHA-256: `4b956ee3553a7464219eabe6d3b257d6ca5ef5b8311ff975fd18141b840299a8`

Die Veröffentlichung wiederholt nicht die Testausführung: Sie überträgt den identischen geprüften Freeze und verifiziert dessen Remote-Inhalt. Historische Prüflogs innerhalb app/ werden nicht nachträglich als aktuelle Tests ausgegeben. Ein historischer React-act-Timingfehler aus dem früheren 930-Workflow bleibt dokumentiert; Tests wurden für diese Veröffentlichung nicht abgeschwächt.

## Enthalten und bewusst getrennt

Enthalten: Kontext-/Graphassistenz, persistente persönliche Entwürfe und letzte Projektansicht, Budgeteingabekorrektur sowie wahrheitsgemäße Formulierungen bei fehlenden Beratungsentwurfsdaten. Der Appkern enthält außerdem die bestehenden 2D/3D-/AR-Funktionen, Begleiter, lokale Arbeitsbereiche und Android-Hülle.

Nicht enthalten: spätere Header-/Motion-Erweiterungen, native AR-Korrekturen und neue Qualitätsgate-Implementierung. Diese gehören zu späteren Quellständen und benötigen einen gesonderten, nachvollziehbaren Delta-Import.

Für Freeze 949 nicht durchgeführt: frische APK-Erstellung, reale Browser-/Geräte-/GPU-/Kamera-AR-Abnahme. Die Softwaretests sind kein Hardware-, Akku- oder Leistungsnachweis.

## Übertragungsumfang und Schutz

Die vollständige Originalquelle einschließlich ihrer mitgelieferten Entwicklungsdokumentation und ursprünglichen Hosting-/Projektzuordnung ist ausschließlich für dieses private Repository freigegeben. Die Hostingmetadaten sind keine Zugangsdaten und lösen keine Bereitstellung aus.

Nicht übertragen: node_modules, generierte dist-Verzeichnisse, private Signierschlüssel/Keystores, .env-Dateien, lokale SDK-Konfiguration, APKs oder die gesondert bereitgestellten privaten Designreferenzfotos. Die eigenen README-Grafiken bleiben als Konzeptgrafiken gekennzeichnet.

Die App verwendet ein gebündeltes Begleiter-GLB; Herkunft und Lizenzangaben stehen in [der Begleiterdokumentation](../app/src/companion/README.md). Quelle und bestehende Dokumentationshistorie werden nicht gelöscht oder durch neuere ungeprüfte Integrationen ersetzt.
