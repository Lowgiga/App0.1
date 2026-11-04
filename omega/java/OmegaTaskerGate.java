// Referenz der Empfaengerpruefung fuer omega.tasker/v1 (HTTP-Transport) in reinem Java:
// Body = kanonisches JSON ohne "mac", Header X-Omega-Mac = HMAC-SHA256(Geheimnis, Body) als base64url.
// Reihenfolge wie TaskerCommandGate.admit in runtime/tasker-bridge.mjs: zuerst MAC (zeitkonstant),
// dann Allowlist. Vorlage fuer die OmegaBridge (Capacitor-Plugin) und Taskers Java-Code-Aktion;
// Replay-, Lease- und Fencing-Pruefung folgen dort mit org.json (Android) nach demselben Muster.
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public final class OmegaTaskerGate {
    public static final Set<String> ALLOWLIST = Set.of(
        "OMEGA_KILL", "OMEGA_ADB_OFF", "OMEGA_STATUS", "OMEGA_ADB_ON", "OMEGA_WIFI_ON", "OMEGA_NOTIFY", "OMEGA_SCENE_APPROVAL");
    // Kanonisches JSON sortiert die Schluessel: "action" steht immer an erster Stelle.
    private static final Pattern ACTION = Pattern.compile("^\\{\"action\":\"(OMEGA_[A-Z_]{1,40})\",");
    private static final Pattern MAC_FORMAT = Pattern.compile("^[A-Za-z0-9_-]{43}$");

    private OmegaTaskerGate() {
    }

    public static String mac(byte[] secret, byte[] body) throws Exception {
        if (secret.length < 32) {
            throw new IllegalArgumentException("Geheimnis kuerzer als 32 Byte");
        }
        Mac hmac = Mac.getInstance("HmacSHA256");
        hmac.init(new SecretKeySpec(secret, "HmacSHA256"));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(hmac.doFinal(body));
    }

    public static boolean verifyMac(byte[] secret, byte[] body, String macHeader) throws Exception {
        if (macHeader == null || !MAC_FORMAT.matcher(macHeader).matches()) {
            return false;
        }
        byte[] expected = mac(secret, body).getBytes(StandardCharsets.US_ASCII);
        return MessageDigest.isEqual(expected, macHeader.getBytes(StandardCharsets.US_ASCII));
    }

    /** Aktion aus der Allowlist oder null - nur nach erfolgreicher MAC-Pruefung aufrufen. */
    public static String allowlistedAction(String body) {
        Matcher matcher = ACTION.matcher(body);
        if (!matcher.find()) {
            return null;
        }
        String action = matcher.group(1);
        return ALLOWLIST.contains(action) ? action : null;
    }

    /** Exitcodes: 0 gueltig (Aktion auf stdout), 1 MAC falsch, 2 nicht erlaubt, 64 Aufruf falsch. */
    public static void main(String[] args) throws Exception {
        if (args.length != 3) {
            System.err.println("Aufruf: OmegaTaskerGate <geheimnis-base64url> <body-datei> <mac>");
            System.exit(64);
        }
        byte[] secret = Base64.getUrlDecoder().decode(args[0]);
        byte[] body = Files.readAllBytes(Path.of(args[1]));
        if (!verifyMac(secret, body, args[2])) {
            System.out.println("bad-mac");
            System.exit(1);
        }
        String action = allowlistedAction(new String(body, StandardCharsets.UTF_8));
        if (action == null) {
            System.out.println("action-not-allowlisted");
            System.exit(2);
        }
        System.out.println(action);
    }
}
