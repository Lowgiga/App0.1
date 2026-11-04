# Optionaler Offline-Projektbegleiter

Diese reine Darstellungsschicht ist über `src/studio/AssistantCompanion.tsx` mit `AssistantPanel` verbunden. Sie führt keine Aufträge aus, speichert selbst keine Optionen und bietet weder Modellprovider noch einen GLB-Importer oder AR an. Die Hostintegration übernimmt vorhandene Einstellungen und geprüfte Sitzungsereignisse.

## Host-Schnittstelle

`CompanionPanel` aus `./CompanionPanel.tsx` nimmt `enabled` (Default false), `motionEnabled` (Default false), `powerSaver` (Default false), `maxAnimationRate` (Default 24, Limit 1–30) und `event` entgegen. Optionen aus dem bestehenden Host-Settingsstate ableiten, keinen zweiten Store anlegen. `maxAnimationRate` ist eine Obergrenze, keine Geräte-FPS-Zusage.

Ereignisse aus `./state.ts` enthalten `eventId` und `requestId`. Neue Arbeit mit einer neuen Request-ID beginnen. Alte Request-ID-Ergebnisse werden danach ignoriert. Ein identisches Startereignis verlängert keinen Auftrag. `idle` beendet die aktuelle Darstellung und behält deren entwertete Identität; späte Ereignisse können sie nicht wieder öffnen. Nur ein neuer Start mit neuer Request-ID aktiviert sie wieder. Beim erstmaligen Mount kann ein Nicht-Start-Ereignis den aktuellen Hoststatus darstellen. `requestStarted` benötigt ein ausdrückliches `simulation`-Flag. Weitere Ereignisse: `awaitingConfirmation`, `simulatedResult` mit optionalem reinem `summary`-Text, `error`, `idle`. Warnungen werden nicht durch Simulationsergebnisse verdrängt. Nach 30 Sekunden ohne Abschluss wird ein Arbeitsstatus zu „Status noch offen“ und die Think-Animation beendet; der eigentliche Auftrag wird dadurch nicht abgebrochen.

Für einen echten lokalen Speicherbeleg ausschließlich `await verifiedCommitEvent({eventId, requestId, context, operationId}, hostReadReceiptResponse)` verwenden. Der Helper prüft die vorhandenen Assistant-Receipt-/Configverträge, Kontext, Operation, Revision und SHA-256 des nachgelesenen Configzustands. Nur `verification: verified` ist zulässig; fehlende oder superseded Belege liefern null. Der Host muss nach dem await seine aktuelle Request-/Unmount-Generation prüfen, bevor er das Event publiziert. Das resultierende Event darf nicht JSON-serialisiert werden. Diese kleine Laufzeitmarkierung verhindert versehentliche Konstruktion aus Modelltext, ist jedoch keine Autorisierungs- oder Server-Sicherheitsgrenze. Ein überprüfter Readback darf einen zuvor ungewissen Vorgang als bestätigt darstellen. Die Komponente führt selbst keinen Readback aus.

Status und Simulationshinweis stehen immer in HTML. Die Sprechblase besitzt keine Apply-, Freigabe- oder Navigationsaktionen. Der Pauseknopf stoppt ausschließlich die Begleiterbewegung. Links zur Attribution werden nur durch den Nutzer geöffnet.

## Rendering und Grenzen

Ein Controller besitzt pro Mount einen Scene-Owner mit einem Renderer und einem Mixer. Ereignisse wechseln Clips, ohne GLB-Neuladen. GLB-Bytes werden mit dem expliziten Vite-Assetimport `?url&inline` in das lokale Modul eingebettet, ohne Asset-fetch dekodiert und mit der bereits vorhandenen Three.js 0.186.1 GLTFLoader.parseAsync geparst. Ein vorgeschalteter Budget-/Containercheck und ein LoadingManager sperren externe Ressourcen. Es gibt keine Remote-URL-Ladefunktion und keine Importoberfläche. Der unvollständige Mini-Importer und CPU-Software-Renderer aus dem Quellpaket wurden nicht übernommen.

Hemisphere- und zwei gerichtete Lichter beleuchten die PBR-Materialien. Kein Shadowmapping oder neuer Environment-Download. Die Walk-Route ist ein kontinuierliches Links-/Rechts-Pingpong; der +Z-Vorwärtsvektor wird zur tatsächlichen Bewegungsrichtung gedreht. Andere Ereignisse pausieren die Route und nutzen Think, Caution, Idea oder Celebrate. Idea/Celebrate laufen einmal und kehren zu Idle zurück.

Der begrenzte Timer/RAF-Loop läuft nur bei sichtbarem Tab, sichtbarem Panel, aktivierter Bewegung und ohne Reduced Motion, Energiesparmodus oder lokale Pause. Fehlt IntersectionObserver oder matchMedia, bleibt die Darstellung sicher statisch. Hintergrundtabs schedulen keinen Loop. Reduced Motion/PowerSaver verwenden SVG und Text, keinen CPU-3D-Ersatz. GL-Fehler führen zu vollständiger Textansicht. Unmount bricht die Generation ab, entfernt Listener/Observer und gibt spät eintreffende sowie aktive Ressourcen frei.

## Asset und Attribution

Übernommen wurde ausschließlich `PAZ-Companion-3D/assets/paz-companion.glb` aus dem bereitgestellten ZIP. SHA-256: `5f7ebfb79deb100e2210aab170a99e2960b0f09f123105ecdd2e424e32de2992`. 754.252 Bytes, 66 Meshes, 19.128 Dreiecke, sechs Clips: Walk, Idle, Think, Celebrate, Idea, Caution. Die genaue Zahl liegt etwas über 19.000; sie wurde gemessen und wird nicht abgerundet behauptet. Kein Referenz-JPG, Video oder Previewbild wurde übernommen.

Android-Roboter: nach einer von Google bereitgestellten Vorlage modifiziert; Creative Commons Attribution 3.0. Änderungen von PAZ Companion contributors (2026): eigener schwarzer/neongrüner 3D-Körper, Gelenkstruktur, Ketten, Materialien und Animationsclips. Android is a trademark of Google LLC. Keine Verbindung zu oder Bestätigung durch Google.

Quelle: https://developer.android.com/distribute/marketing-tools/brand-guidelines
Lizenz: https://creativecommons.org/licenses/by/3.0/

Das ursprüngliche Paket bezeichnet seinen Programmcode als MIT; der hier neu geschriebene Integrationscode übernimmt weder Mini-Importer noch Renderer. Die Design-Attribution ersetzt keine Prüfung unbekannter Rechte am ursprünglichen Referenzfoto; das Foto ist nicht enthalten. Keine to3D-Konvertierung wird behauptet. Native AR-Dateien bleiben unverändert.

## Prüfen

`node --import ./scripts/register.mjs --test tests/system/companion-*.test.ts tests/system/companion-*.test.tsx`

Die DOM-/Controller-Tests sind simuliert. Die Hostanbindung wird zusätzlich mit `tests/system/assistant-companion-integration.test.tsx` geprüft und ist in die Anwendung integriert. Echte Browser- und Hardware/GPU-Ergebnisse müssen separat im Integrationsprüfbeleg ausgewiesen werden; ein erfolgreicher Projektbuild ersetzt diese Abnahme nicht.

### Verifizierte Umgebungsgrenze am 5. Oktober 2026

Ein normaler Start des vorhandenen Cloud-Chromium über Playwright scheiterte vor der ersten Seitenöffnung mit `socket() failed: Operation not permitted (1)`. Browserchecks und Screenshots sind deshalb **NOT RUN**, ebenso reale GPU-, Samsung-/Android-, Akku- und Touch-Abnahmen. Es wurden keine Flags, Tunnel oder alternativen Hosts zur Umgehung der Verweigerung eingesetzt. Der Renderer-/Observernachweis aus automatisierten Doubles ist keine Hardwareprüfung. Die separate Browserfixture außerhalb des Quellprojekts ist nur ein vorbereiteter Test, kein bestandener Lauf.
