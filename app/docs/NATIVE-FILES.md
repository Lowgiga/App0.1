# Native Dateien und Zwischenablage

## Vertrag

`src/platform/files.ts` ist eine explizite, dependency-injected Schnittstelle. Native Android-Ausführung nutzt ausschließlich den registrierten `CueFiles`-Pluginpfad; bei nativem Fehler erfolgt kein stiller Blob-Fallback. `saved` wird erst nach erfolgreichem Schreiben, Flush und Schließen des Zielstreams geliefert. `cancelled` ist kein Erfolg. Browser-Fallback meldet nur `dispatched`, nicht einen verifiziert gespeicherten Datenträgerzustand.

Android verwendet `ACTION_CREATE_DOCUMENT` und eine einzelne nutzergewählte Content-URI. Kein READ/WRITE/MANAGE_EXTERNAL_STORAGE, kein Verzeichnisgrant und keine persistente URI-Berechtigung. Daten sind auf 8 MiB UTF-8 beschränkt. Dateiname und MIME-Typ folgen einer festen Allowlist. JSON-/Markdown-Inhalte bleiben vor der Zielwahl ausschließlich in privatem App-Cache. Der Picker-Intent trägt nur MIME und Dateiname. Payload wird auch aus `PluginCall` entfernt, da Capacitor in seinem Bridge-Lifecycle andernfalls die Optionen in ein Bundle schreiben könnte.

Eine exportierende Instanz erlaubt nur einen offenen Aufruf. Cache-Dateien werden beim Erfolg, Abbruch, Fehler und Destroy gelöscht; alte unterbrochene Dateien werden beim nächsten Pluginstart bereinigt. Nach Activity-/Prozessverlust erfolgt keine automatische Wiederaufnahme oder Erfolgsmeldung. Während eines unterbrochenen Zielwrites kann eine partielle Datei am gewählten Ort verbleiben; das wird im Fehlertext genannt. Solche Dateien werden nicht ungefragt gelöscht.

Clipboard ist auf 1 MiB UTF-8 begrenzt. Activity-Verfügbarkeit wird vor Dispatch und erneut im UI-Callback geprüft. Fehlgeschlagenes Kopieren löst weder Datei-Export noch eine falsche Erfolgsmeldung aus.

## Abnahmegrenzen

Die TypeScript-Vertragsprüfungen und statischen Java-Sourceguards sind keine native Ausführung. Java-Compile, Android-Lint und Unit-Tests werden unabhängig in einer separaten Nativeprüfung durchgeführt. Noch offen auf echtem Android: Picker geöffnet/abgebrochen, lokales und Cloud-Ziel, fehlender Provider, Speicher voll, Mehrfachklick, Rotation/Activity-Neuerstellung, Prozessverlust, Clipboard nach Rückkehr, korrektes Unicode und 8-MiB-Randwert. Kein GPU-/AR-Nachweis folgt daraus.

## Primärquellen

- Android Storage Access Framework: https://developer.android.com/training/data-storage/shared/documents-files
- Capacitor Android-Plugins: https://capacitorjs.com/docs/plugins/android
- Installierte, gepinnte Capacitor-8.5.2-Quellen von Plugin.java, Bridge.java und PluginCall.java wurden zusätzlich geprüft
