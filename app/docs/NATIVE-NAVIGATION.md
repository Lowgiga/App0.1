# Android-System-Back

MainActivity bindet System-Back ausdrücklich an `OnBackPressedDispatcher` mit Activity-Lifecycle. Solange die eingebettete WebView einen vorherigen Historieneintrag hat, wird `goBack()` verwendet. Damit werden auch lokale, gleichseitige JavaScript-Historyeinträge der Arbeitsbereiche berücksichtigt. Am tatsächlichen Root delegiert der Callback vorübergehend deaktiviert an Androids Standardverhalten; die App erfindet keine zusätzliche Zurücktaste.

Das ist keine Geräteabnahme. Reale Android-Backgesten, Tastatur, Dialoge und unterbrochene Dateiauswahl sind auf dem Zielgerät zu prüfen. Aktuell ist keine gesonderte native Prioritätsbrücke implementiert, die Web-Dialoge vor einem Historyschritt schließt; hierfür bleiben die sichtbaren Dialog-Schließen-/Abbrechen-Bedienelemente verfügbar.

Primärquelle: https://developer.android.com/guide/navigation/navigation-custom-back
