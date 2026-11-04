# 34 - Tasker-Bruecke (OMG-09): Plug & Play, Kill-Switch, Freigabe-Overlay

Stand: 2026-11-04 (ueberarbeitet: Lease-Ablauf, Replay je Absender, Java-Referenz, CLI). Referenzimplementierung: [`omega/runtime/tasker-bridge.mjs`](../omega/runtime/tasker-bridge.mjs),
Vertrag: [`omega/contracts/omega.tasker.v1.schema.json`](../omega/contracts/omega.tasker.v1.schema.json),
Windows-Gegenstueck: [`omega/windows/Start-OmegaLink.ps1`](../omega/windows/Start-OmegaLink.ps1).

> Hinweis: Die Tasker-Schritte sind als Klick-Anleitung formuliert, nicht als Import-Datei.
> Auf dem Geraet sind sie noch nicht abgenommen (Gate G1). Funktionen aus Tasker 6.7
> (Scenes V2, Ereignis "Wifi Changed") stammen aus den Release Notes und sind ungetestet.

## 1. Rollen

Tasker ist Sensor und Aktor des Android-Knotens, nicht das Gehirn. Entscheidungen trifft der
Trust Kernel; Tasker fuehrt nur Tasks mit Praefix `OMEGA_` aus der Allowlist aus.

| Task | Klasse | Parameter | Wirkung |
|---|---|---|---|
| `OMEGA_KILL` | safety | - | Alles stoppen, ADB aus, Profile aus |
| `OMEGA_ADB_OFF` | safety | - | Kabelloses Debugging aus |
| `OMEGA_STATUS` | observe | - | Status melden |
| `OMEGA_ADB_ON` | reversible | `minutes` 1-30 | Kabelloses Debugging an, Auto-Aus |
| `OMEGA_WIFI_ON` | reversible | - | WLAN an |
| `OMEGA_NOTIFY` | reversible | `title` <=80, `text` <=500 | Benachrichtigung |
| `OMEGA_SCENE_APPROVAL` | reversible | `approvalId`, `title`, `summary`, `risk` 1-10, `timeoutSec` 10-600 | Freigabe-Dialog |

## 2. Einmalige Vorbereitung (Handy)

1. Tasker (6.7) und Shizuku installieren; Shizuku starten (Fork mit TCP-Modus/Start beim Booten optional).
2. Tasker die Berechtigung fuer Systemeinstellungen geben (einmalig per PC oder Shizuku):
   `adb shell pm grant net.dinglisch.android.taskerm android.permission.WRITE_SECURE_SETTINGS`
3. Samsung: Einstellungen > Akku > Hintergrundnutzungsgrenzen > **Nie schlafende Apps**: Tasker und Shizuku eintragen.
4. Tasker > Einstellungen > Verschiedenes: **Externen Zugriff erlauben** nur aktivieren, wenn LowQuantFlow/OmegaBridge Tasks starten soll.
5. Einmal koppeln: Entwickleroptionen > Kabelloses Debugging > Mit Kopplungscode koppeln; am PC `adb pair IP:PORT CODE`.

## 3. Tasks (in Tasker anlegen)

**OMEGA_ADB_OFF**
1. Einstellungen > Benutzerdefinierte Einstellung: Typ *Global*, Name `adb_wifi_enabled`, Wert `0`
2. Variable loeschen `%OmegaAdbUntil`
3. Benachrichtigung abbrechen: Titel `OMEGA`

**OMEGA_ADB_ON** (Parameter 1 = Minuten, Standard 15)
1. Wenn `%OmegaKilled` = `1`: Stopp (Kill-Switch hat Vorrang)
2. Variable setzen `%minutes` auf `%par1`; wenn leer oder > 30: `15`
3. Variable setzen `%OmegaAdbUntil` auf `%TIMES + %minutes * 60` (Rechnen aktivieren)
4. Benutzerdefinierte Einstellung: *Global* `adb_wifi_enabled` = `1`
5. Benachrichtigung (dauerhaft): Titel `OMEGA`, Text `Debugging aktiv bis %OmegaAdbUntil`, Aktion: Task `OMEGA_ADB_OFF`

**OMEGA_KILL**
1. Variable setzen `%OmegaKilled` = `1`
2. Task ausfuehren `OMEGA_ADB_OFF`
3. Profilstatus: `OMEGA Plug` und `OMEGA Auto-Aus` **aus**
4. Benachrichtigung: `OMEGA gestoppt - Freigabe nur manuell`

Freigabe nach dem Kill-Switch nur von Hand: `%OmegaKilled` loeschen und Profile wieder aktivieren
(entspricht `releaseKillSwitch({ confirmedByHuman: true })`, danach Stufe E1).

## 4. Profile

**OMEGA Plug** - Zustand: Hardware > USB verbunden; Bedingung `%OmegaKilled` ist nicht gesetzt
- Eintritt: WLAN an > Warten bis `%WIFII` passt auf `*CONNECTION*` (max. 30 s) > Task `OMEGA_ADB_ON` mit Parameter 1 = `15`
- Austritt: Task `OMEGA_ADB_OFF`

**OMEGA Auto-Aus** - Zeit: alle 2 Minuten; Bedingung `%OmegaAdbUntil` < `%TIMES`
- Task `OMEGA_ADB_OFF` (verlaesslicher als ein langes Warten innerhalb eines Tasks)

**Kill-Kachel** - Schnelleinstellungs-Kachel einrichten, Task `OMEGA_KILL`, Symbol z. B. `block`.

Ablauf mit dem PC: USB-C dran > Profil `OMEGA Plug` > WLAN + Debugging an > am PC
`omega\windows\Start-OmegaLink.ps1` > mDNS > `adb connect` > scrcpy. USB ab > Debugging aus.

## 5. Freigabe-Overlay (Scenes V2)

`OMEGA_SCENE_APPROVAL` zeigt einen Dialog mit Titel, Zusammenfassung, Risiko-Ampel
(gruen < 4, gelb 4-7, rot > 7) und drei Knoepfen: **Ausfuehren**, **Aendern**, **Abbrechen**.

1. Show Scene v2 als Dialog
2. Wait For Scene v2 Result mit Zeitlimit `timeoutSec`
3. Kein Ergebnis oder Abbrechen = **Ablehnung** (nie Zustimmung)
4. Ergebnis als `omega.event/v1` `approval.resolved` mit `approvalId` zurueckmelden

Die WebView-Komponente wird in Freigabe-Scenes **nicht** verwendet (JS-Bruecke kann Tasker-Aktionen aufrufen).

## 6. Befehle von aussen (HTTP)

Nur ueber das private Mesh (Tailscale/Headscale/EasyTier), nie im offenen WLAN.

- Tasker-Ereignis *HTTP Request*, Methode POST, Pfad `/omega`
- Body = kanonisches JSON ohne `mac`; Header `X-Omega-Mac` = HMAC-SHA256(Geheimnis, Body) als base64url
- Pruefreihenfolge wie `TaskerCommandGate.admit` in [`tasker-bridge.mjs`](../omega/runtime/tasker-bridge.mjs):
  1. MAC zeitkonstant pruefen (Java-Referenz: [`OmegaTaskerGate.java`](../omega/java/OmegaTaskerGate.java), `javax.crypto.Mac` "HmacSHA256")
  2. Aktion aus der Allowlist und Parameter streng pruefen
  3. Replay: der HLC-Stempel muss **je Absender** steigen
  4. Lease-Ablauf: `leaseExpiresAt` (im MAC enthalten) muss in der Zukunft liegen
  5. Fencing-Token: nie kleiner als der hoechste bisher gesehene
- Geheimnis: mindestens 32 Byte. Am PC erzeugen mit `node omega/cli/omega.mjs secret --out tasker.secret`
  (schreibt direkt in die Datei, nicht ins Terminal) und einmalig in eine Tasker-Variable uebertragen.

Befehle erzeugt der Windows-Knoten, nicht der Mensch von Hand. Der Trust Kernel prueft dabei schon
beim Absender: Bei Stufe E1 braucht jede umkehrbare Aktion `--confirm`, und bei aktivem Kill-Switch
gehen nur `OMEGA_KILL` und `OMEGA_ADB_OFF` durch.

```bash
node omega/cli/omega.mjs tasker-cmd --secret-file tasker.secret --action OMEGA_ADB_ON --params '{"minutes":15}' --confirm --send http://<TAILNET_IP_HANDY>:<PORT>/omega
```

Der Interop-Test `omega/test/java-interop.test.mjs` belegt: Java akzeptiert genau die Befehle aus Node,
weist manipulierte Bodies ab (Exitcode 1) und lehnt nicht erlaubte Aktionen trotz gueltiger MAC ab (Exitcode 2).

## 7. Risiken

| Risiko | Ampel | Score | Gegenmassnahme |
|---|---|---|---|
| HTTP-Server von Tasker ohne eigene Authentifizierung | Rot | 8 | Nur Mesh + HMAC + Allowlist |
| WebView-JS-Bruecke in Scenes | Rot | 7 | Keine WebView in Freigabe-Scenes |
| Dauerhaft offenes kabelloses Debugging | Gelb | 6 | Auto-Aus (Profil) + Aus beim Trennen |
| Samsung beendet Tasker im Hintergrund | Gelb | 5 | "Nie schlafende Apps" |
| Haengende Warte-Aktionen | Gelb | 4 | Zeitlimit; Ablauf = Ablehnung |
