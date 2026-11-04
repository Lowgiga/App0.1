package de.lowgiga.cuecommandmesh.preview;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Explicit, bounded user-selected exports. No broad storage permissions or implicit sharing. */
@CapacitorPlugin(name = "CueFiles")
public class CueFilesPlugin extends Plugin {
    private static final int MAX_BYTES = 8 * 1024 * 1024;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private PluginCall pending;
    private File staged;
    private boolean destroyed;

    @Override public void load() {
        // Interrupted exports are never resumed automatically. Expunge only our own private staging files.
        File dir = new File(getContext().getCacheDir(), "cue-saf-staging");
        File[] old = dir.listFiles();
        if (old != null) for (File f : old) if (f.getName().startsWith("export-") && f.isFile()) f.delete();
    }

    @PluginMethod public synchronized void saveText(PluginCall call) {
        if (destroyed) { call.reject("Activity unavailable", "ACTIVITY_DESTROYED"); return; }
        if (pending != null) { call.reject("Another export is pending", "EXPORT_BUSY"); return; }
        String name = call.getString("name"), text = call.getString("text"), mime = call.getString("mime");
        // Capacitor also serializes call options in Bridge.saveInstanceState: remove payload before launching.
        call.getData().remove("text");
        if (name == null || !name.matches("[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}") || text == null ||
            !("application/json".equals(mime) || "text/markdown".equals(mime) || "text/plain".equals(mime))) {
            call.reject("Invalid export metadata", "INVALID_EXPORT"); return;
        }
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_BYTES) { call.reject("Export is too large", "EXPORT_SIZE_LIMIT"); return; }
        pending = call;
        try {
            File dir = new File(getContext().getCacheDir(), "cue-saf-staging");
            if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("Cannot create staging directory");
            staged = File.createTempFile("export-", ".tmp", dir);
            try (FileOutputStream stream = new FileOutputStream(staged)) { stream.write(bytes); stream.getFD().sync(); }
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(mime);
            intent.putExtra(Intent.EXTRA_TITLE, name);
            getActivity().runOnUiThread(() -> {
                synchronized (CueFilesPlugin.this) {
                    if (pending != call || destroyed) return;
                    try { startActivityForResult(call, intent, "documentSelected"); }
                    catch (RuntimeException error) { fail(call, "Could not open file chooser", "CHOOSER_FAILED"); }
                }
            });
        } catch (IOException | RuntimeException error) { fail(call, "Could not stage export", "STAGING_FAILED"); }
    }

    @ActivityCallback private synchronized void documentSelected(PluginCall call, ActivityResult result) {
        if (call == null) { clear(); return; }
        if (call != pending || destroyed || staged == null) { call.reject("Export interrupted; choose the file again", "EXPORT_INTERRUPTED"); return; }
        if (result.getResultCode() == Activity.RESULT_CANCELED) { succeed(call, "cancelled"); return; }
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null || !"content".equals(uri.getScheme())) {
            fail(call, "No valid document selected", "INVALID_DOCUMENT"); return;
        }
        final File source = staged;
        io.execute(() -> {
            try (FileInputStream input = new FileInputStream(source);
                 OutputStream output = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (output == null) throw new IOException("No document stream");
                byte[] buffer = new byte[16384]; int count, total = 0;
                while ((count = input.read(buffer)) != -1) {
                    synchronized (CueFilesPlugin.this) { if (destroyed || pending != call) throw new IOException("Export interrupted"); }
                    total += count; if (total > MAX_BYTES) throw new IOException("Size limit");
                    output.write(buffer, 0, count);
                }
                output.flush();
            } catch (IOException | RuntimeException error) {
                synchronized (CueFilesPlugin.this) { if (pending == call) fail(call, "Write failed; a partial file may remain at the selected location", "WRITE_FAILED"); }
                return;
            }
            synchronized (CueFilesPlugin.this) { if (pending == call && !destroyed) succeed(call, "saved"); }
        });
    }

    @PluginMethod public synchronized void copyText(PluginCall call) {
        String text = call.getString("text"); call.getData().remove("text");
        if (text == null || text.getBytes(StandardCharsets.UTF_8).length > 1024 * 1024) { call.reject("Invalid clipboard text", "CLIPBOARD_LIMIT"); return; }
        final Activity activity = getActivity();
        if (destroyed || activity == null || activity.isFinishing() || activity.isDestroyed()) { call.reject("Activity unavailable", "ACTIVITY_DESTROYED"); return; }
        try {
            activity.runOnUiThread(() -> {
                synchronized (CueFilesPlugin.this) {
                    if (destroyed || getActivity() != activity || activity.isFinishing() || activity.isDestroyed()) { call.reject("Activity unavailable", "ACTIVITY_DESTROYED"); return; }
                    try {
                        ClipboardManager clipboard = (ClipboardManager) activity.getSystemService(Context.CLIPBOARD_SERVICE);
                        if (clipboard == null) throw new IllegalStateException("Clipboard unavailable");
                        clipboard.setPrimaryClip(ClipData.newPlainText("LowQuantFlow", text));
                        JSObject out = new JSObject(); out.put("status", "copied"); call.resolve(out);
                    } catch (RuntimeException error) { call.reject("Clipboard unavailable", "CLIPBOARD_FAILED"); }
                }
            });
        } catch (RuntimeException error) { call.reject("Clipboard dispatch unavailable", "CLIPBOARD_FAILED"); }
    }

    // No body, path or capability is retained across process death. The next app session starts a new export.
    @Override protected Bundle saveInstanceState() { return null; }
    @Override protected synchronized void handleOnDestroy() {
        destroyed = true;
        if (pending != null) fail(pending, "Export interrupted by activity destruction; a partial selected file may remain", "ACTIVITY_DESTROYED");
        io.shutdownNow();
    }
    private void succeed(PluginCall call, String status) { JSObject out = new JSObject(); out.put("status", status); clear(); call.resolve(out); }
    private void fail(PluginCall call, String message, String code) { clear(); call.reject(message, code); }
    private void clear() { if (staged != null) staged.delete(); staged = null; pending = null; }
}
