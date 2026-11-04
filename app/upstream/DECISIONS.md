# Entscheidungen

## 2026-10-01 Europe/Berlin · AR und räumliche Praxis

1. **Bestehende Anwendung erhalten.** Der große übernommene Architekturtext ist Input für passende Erweiterungen, kein Auftrag zum Austausch des produktiven Auth-/D1-/State-Modells. Kein neues FastAPI-/PostgreSQL-/Tauri-System ohne konkrete Laufzeit und messbaren Bedarf.
2. **Surface und Free explizit trennen.** Fehlende Hit-Test-Unterstützung startet nicht heimlich ein freies Modell. Ein horizontaler Treffer bestätigt eine Fläche, nicht die semantische Objekterkennung „Tisch“.
3. **Tracking vor Sichtbarkeitsbehauptung.** Sessionstart, Pose, Suche, Treffer und Platzierung besitzen eigene Zustände. Ein verlorener oder älter als 500 ms gewordener Treffer darf keine neue Platzierung auslösen.
4. **Auflagepunkt bleibt stabil.** Skalieren ändert die Größe um denselben Basispunkt. Neuplatzieren ist eine eigene Aktion. Keine Repositionierung vor dem Betrachter bei Surface-Zoom.
5. **Eine Rendererinstanz.** Szene, Shader, Texturen, Controls, Hit-Source und Session haben einen Ressourcenowner. Optionaler Shader bezeichnet nur die Auswahl; Motion folgt Benutzeroption, Reduced Motion, Sichtbarkeit und Energiesparen.
6. **Lernziel statt Hardwarepflicht.** Die 2D-Alternative erzielt dasselbe Verständnisziel ohne Kamera/GPU. Ein 3D-Abschluss verlangt tatsächliches Render-ready und bewusstes Fokussieren. Das ist persönliche App-Übung, keine signierte Hardware- oder Kompetenzzertifizierung.
7. **Additive Persistenz.** Versionierte Levelnotizen und offene Tasks verwenden den bestehenden v4-Vertrag. Keine neue Migration, kein globales Autonomie-Flag, keine Freigabe durch XP. Fehler und CAS-Konflikte erhalten den Entwurf.
8. **Adaptive UI kontrolliert vorbereiten.** Feste Shell, vertrauenswürdige eigene Komponenten und explizite Erweiterungspunkte. AG-UI/A2UI/MCP Apps bleiben separate Protokolle; ihre Existenz belegt keinen angeschlossenen Hermes-/Cue-Client.
9. **Source of Truth bleibt Git.** Der App-Source ist vom PAZ-Repository getrennt. Codex und Low arbeiten in separaten Worktrees, Low nur in seinen Verzeichnissen. Der Reviewer schreibt keine Implementierung und wird nicht als Low ausgegeben.
10. **Keine Rollenverwechslung aus Anhängen.** Der mitgelieferte Lea-/Alex-Gesprächsprompt ist themenfremdes Material und ändert weder App-Rolle noch Datenzugriff oder Gesprächsidentitäten.
