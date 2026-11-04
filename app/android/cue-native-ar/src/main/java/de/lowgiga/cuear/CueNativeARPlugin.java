package de.lowgiga.cuear;

import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.ar.core.ArCoreApk;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import java.util.Collections;
import java.util.WeakHashMap;

/** Read-only native AR bridge. Register from the host's BridgeActivity before super.onCreate. */
@CapacitorPlugin(name="CueNativeAR")
public final class CueNativeARPlugin extends Plugin {
    // Weak keys retain idempotence while a callback instance exists without retaining old Activities/calls.
    private final Set<PluginCall> settledCalls=Collections.newSetFromMap(new WeakHashMap<>());
    private PluginCall pending;
    private GraphSnapshot snapshot;
    private String token;
    private volatile boolean destroyed;

    @PluginMethod public void getAvailability(PluginCall call) {
        if (destroyed) { call.reject("AR activity unavailable", "AR_ACTIVITY_LOST"); return; }
        // Does not request camera/install. ARCore itself may perform a compatibility network lookup.
        try {
            ArCoreApk.Availability a=ArCoreApk.getInstance().checkAvailability(getContext());
            String status;
            switch(a) {
                case SUPPORTED_INSTALLED: status="supported-installed"; break;
                case SUPPORTED_NOT_INSTALLED: status="supported-not-installed"; break;
                case SUPPORTED_APK_TOO_OLD: status="supported-outdated"; break;
                case UNSUPPORTED_DEVICE_NOT_CAPABLE: status="unsupported"; break;
                case UNKNOWN_CHECKING: status="checking"; break;
                default: status="unknown";
            }
            call.resolve(new JSObject().put("available",a.isSupported()).put("status",status));
        } catch (RuntimeException error) { call.resolve(new JSObject().put("available",false).put("status","unknown")); }
    }
    @PluginMethod public synchronized void open(PluginCall call) {
        JSObject input=call.getObject("snapshot");
        boolean validEnvelope=call.getData().length()==1 && call.getData().has("snapshot");
        // Capacitor saves pending call options; retain no payload or unknown large extras.
        List<String> keys=new ArrayList<>();
        Iterator<String> iterator=call.getData().keys();
        while(iterator.hasNext()) keys.add(iterator.next());
        for(String key:keys) call.getData().remove(key);
        if(!validEnvelope) { call.reject("Only snapshot is accepted", "AR_INVALID_SNAPSHOT"); return; }
        if (destroyed || getActivity()==null || getActivity().isFinishing()) { call.reject("AR activity unavailable", "AR_ACTIVITY_LOST"); return; }
        if (pending!=null) { call.reject("Another AR window is open", "AR_BUSY"); return; }
        try {
            snapshot=GraphSnapshot.parse(input==null ? null : input.toString());
            token=SnapshotHandoff.INSTANCE.put(snapshot); pending=call;
        } catch (IllegalArgumentException error) { snapshot=null; call.reject(error.getMessage(),"AR_INVALID_SNAPSHOT"); return; }
        catch (IllegalStateException error) { snapshot=null; call.reject("AR is busy", "AR_BUSY"); return; }
        final String launchToken=token;
        getActivity().runOnUiThread(() -> {
            synchronized (CueNativeARPlugin.this) {
                if (destroyed || pending!=call) return;
                try { startActivityForResult(call,new Intent(getActivity(),CueArActivity.class).putExtra(CueArActivity.TOKEN,launchToken),"arClosed"); }
                catch (RuntimeException error) { finishPending("error",false,null,"AR konnte nicht geöffnet werden"); }
            }
        });
    }
    @ActivityCallback private synchronized void arClosed(PluginCall call, ActivityResult result) {
        if (call!=null && settledCalls.contains(call)) return;
        if (destroyed) { clear(); return; }
        if (call==null) { finishPending("error",false,null,"AR wurde unterbrochen"); return; }
        if (call!=pending || snapshot==null) { settledCalls.add(call); call.reject("AR was interrupted; open it again", "AR_INTERRUPTED"); return; }
        Intent data=result.getData();
        if (result.getResultCode()!=Activity.RESULT_OK || data==null) { finishPending("error",false,null,"AR wurde unterbrochen"); return; }
        String status=data.getStringExtra("status");
        if (!("closed".equals(status)||"unavailable".equals(status)||"permission-denied".equals(status)||"error".equals(status))) status="error";
        String selected=data.getStringExtra("selectedNodeId");
        if (selected!=null && !snapshot.hasNode(selected)) { finishPending("error",false,null,"Ungültige AR-Auswahl"); return; }
        finishPending(status,data.getBooleanExtra("placed",false),selected,ArTrackingStatus.safeMessage(data.getStringExtra("message")),data.getBooleanExtra("openDetails",false));
    }
    private void finishPending(String status, boolean placed, String selected, String message) {finishPending(status,placed,selected,message,false);}
    private void finishPending(String status, boolean placed, String selected, String message, boolean openDetails) {
        PluginCall call=pending; GraphSnapshot graph=snapshot;
        JSObject result=new JSObject().put("status",status).put("placed",placed);
        if (graph!=null) result.put("snapshotRevision",graph.revision);
        if (selected!=null) result.put("selectedNodeId",selected);
        if (message!=null) result.put("message",message);
        if (openDetails&&"closed".equals(status)&&graph!=null&&graph.hasNode(selected))result.put("openDetails",true);
        clear(); if (call!=null && settledCalls.add(call)) call.resolve(result);
    }
    private void clear() { SnapshotHandoff.INSTANCE.clear(token); token=null; snapshot=null; pending=null; }
    @Override protected synchronized void handleOnDestroy() {
        destroyed=true; finishPending("error",false,null,"AR wurde unterbrochen");
    }
}
