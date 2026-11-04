package de.lowgiga.cuear;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.IntentFilter;
import android.database.ContentObserver;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.widget.CheckBox;
import androidx.core.content.ContextCompat;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.hardware.display.DisplayManager;
import android.net.Uri;
import android.opengl.GLSurfaceView;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.google.ar.core.ArCoreApk;
import com.google.ar.core.Config;
import com.google.ar.core.Session;
import com.google.ar.core.exceptions.CameraNotAvailableException;
import com.google.ar.core.exceptions.UnavailableException;
import com.google.ar.core.exceptions.UnavailableUserDeclinedInstallationException;

/** Private foreground-only, explicit-start AR viewer. Does not edit or persist user work. */
public final class CueArActivity extends ComponentActivity implements GraphRenderer.Listener {
    static final String TOKEN="cue.ar.token";
    private final ArLifecycle lifecycle=new ArLifecycle();
    private GraphSnapshot graph;
    private GraphRenderer renderer;
    private GLSurfaceView surface;
    private TextView status, reticle, placementFeedback;
    private Button start, place, reset, openDetailsButton;
    private LinearLayout notice, panelContent, settingsContent;
    private ArDetailsState detailsState;
    private Button gear;
    private String requestedDetailsId;
    private CheckBox motionToggle;
    private TextView motionExplanation;
    private boolean motionOptIn, foreground, receiverObserved, scaleObserved;
    private final ContentObserver motionObserver=new ContentObserver(new Handler(Looper.getMainLooper())){
        @Override public void onChange(boolean selfChange){refreshMotionPolicy();}
    };
    private final BroadcastReceiver powerObserver=new BroadcastReceiver(){
        @Override public void onReceive(Context context,Intent intent){refreshMotionPolicy();}
    };
    private Spinner picker;
    private ScrollView controlsScroll;
    private DisplayManager displays;
    private boolean permissionPending, installRequested, terminal, resultSent;
    private String terminalStatus="closed", selected;
    private boolean everPlaced;
    private String terminalMessage;
    private volatile ArTrackingStatus sceneStatus=ArTrackingStatus.observe(null,null,null,false,false);
    private volatile ArTrackingStatus.PlacementDecision lastPlacementDecision=ArTrackingStatus.PlacementDecision.IGNORE;
    private final ActivityResultLauncher<String> permission=registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
        permissionPending=false;
        if (terminal || isFinishing()) return;
        if (!granted) { stopWith("permission-denied",R.string.cue_ar_permission); return; }
        attemptSetup();
    });
    private final DisplayManager.DisplayListener displayListener=new DisplayManager.DisplayListener() {
        @Override public void onDisplayAdded(int id) {}
        @Override public void onDisplayRemoved(int id) {}
        @Override public void onDisplayChanged(int id) { updateRotation(); }
    };
    @Override protected void onCreate(Bundle savedState) {
        super.onCreate(savedState);
        // Token is single-use: Activity/process recreation has no graph and never restarts the camera.
        graph=SnapshotHandoff.INSTANCE.take(getIntent().getStringExtra(TOKEN));
        if (graph==null || savedState!=null) { finishResult("error"); return; }
        detailsState=new ArDetailsState(graph);
        buildUi();
        displays=(DisplayManager)getSystemService(DISPLAY_SERVICE);
        getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() { if(detailsState.closePanel()){renderPanel();return;} finishResult(terminalStatus); }
        });
    }
    private void buildUi() {
        int green=Color.rgb(107,239,165), silver=Color.rgb(214,224,220), dark=Color.rgb(11,25,20);
        FrameLayout root=new FrameLayout(this);root.setBackgroundColor(dark);
        ViewCompat.setOnApplyWindowInsetsListener(root,(v,insets)->{
            Insets bars=insets.getInsets(WindowInsetsCompat.Type.systemBars()|WindowInsetsCompat.Type.displayCutout());
            v.setPadding(bars.left,bars.top,bars.right,bars.bottom);return insets;
        });
        surface=new GraphSurfaceView(this,(x,y)->{if(renderer!=null)renderer.tap(x,y);});surface.setEGLContextClientVersion(2);surface.setEGLConfigChooser(8,8,8,8,16,0);
        surface.setPreserveEGLContextOnPause(false);renderer=new GraphRenderer(graph,this,getResources().getDisplayMetrics().density);
        surface.setRenderer(renderer);surface.onPause();surface.setContentDescription(getString(R.string.cue_ar_pick));
        root.addView(surface,new FrameLayout.LayoutParams(-1,-1));
        reticle=text("+",green,36);reticle.setGravity(Gravity.CENTER);reticle.setContentDescription(getString(R.string.cue_ar_scan));
        root.addView(reticle,new FrameLayout.LayoutParams(dp(48),dp(48),Gravity.CENTER));reticle.setVisibility(View.GONE);
        LinearLayout chrome=new LinearLayout(this);chrome.setOrientation(LinearLayout.VERTICAL);
        root.addView(chrome,new FrameLayout.LayoutParams(-1,-1));
        LinearLayout top=new LinearLayout(this);top.setOrientation(LinearLayout.VERTICAL);top.setBackgroundColor(Color.argb(232,11,25,20));top.setClickable(true);
        LinearLayout header=new LinearLayout(this);header.setGravity(Gravity.CENTER_VERTICAL);header.setPadding(dp(8),0,dp(8),0);
        TextView title=text(getString(R.string.cue_ar_title),silver,18);header.addView(title,new LinearLayout.LayoutParams(0,dp(48),1));
        gear=button(R.string.cue_ar_gear);gear.setContentDescription(getString(R.string.cue_ar_settings));gear.setOnClickListener(v->{detailsState.toggleSettings();renderPanel();});header.addView(gear,new LinearLayout.LayoutParams(dp(56),dp(48)));
        Button close=button(R.string.cue_ar_close);close.setOnClickListener(v->finishResult(terminalStatus));header.addView(close);top.addView(header);
        status=text(getString(R.string.cue_ar_before_start),green,15);status.setPadding(dp(12),0,dp(12),dp(4));status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);top.addView(status);
        placementFeedback=text("",silver,14);placementFeedback.setPadding(dp(12),0,dp(12),dp(4));placementFeedback.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);placementFeedback.setVisibility(View.GONE);top.addView(placementFeedback);chrome.addView(top);
        FrameLayout center=new FrameLayout(this);chrome.addView(center,new LinearLayout.LayoutParams(-1,0,1));
        notice=new LinearLayout(this);notice.setOrientation(LinearLayout.VERTICAL);notice.setPadding(dp(16),dp(8),dp(16),dp(8));notice.setBackgroundColor(dark);
        addDisclosure(notice,silver);
        ScrollView noticeScroll=new ScrollView(this);noticeScroll.addView(notice);center.addView(noticeScroll,new FrameLayout.LayoutParams(-1,-1));
        LinearLayout bottom=new LinearLayout(this);bottom.setOrientation(LinearLayout.VERTICAL);bottom.setBackgroundColor(Color.argb(242,11,25,20));bottom.setClickable(true);chrome.addView(bottom);
        panelContent=new LinearLayout(this);panelContent.setOrientation(LinearLayout.VERTICAL);panelContent.setPadding(dp(12),dp(4),dp(12),dp(4));
        controlsScroll=new ScrollView(this);controlsScroll.setFillViewport(false);controlsScroll.addView(panelContent);bottom.addView(controlsScroll,new LinearLayout.LayoutParams(-1,controlsHeight()));
        settingsContent=new LinearLayout(this);settingsContent.setOrientation(LinearLayout.VERTICAL);
        settingsContent.addView(text(getString(R.string.cue_ar_scale),silver,14));
        SeekBar scale=new SeekBar(this);scale.setMax(175);scale.setProgress(75);scale.setMinimumHeight(dp(48));scale.setContentDescription(getString(R.string.cue_ar_scale));
        scale.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onProgressChanged(SeekBar s,int p,boolean user){renderer.scale((p+25)/100f);}public void onStartTrackingTouch(SeekBar s){}public void onStopTrackingTouch(SeekBar s){}});settingsContent.addView(scale);
        picker=new Spinner(this);picker.setMinimumHeight(dp(48));picker.setContentDescription(getString(R.string.cue_ar_pick));
        String[] labels=new String[graph.nodes.size()+1];labels[0]=getString(R.string.cue_ar_pick);for(int i=0;i<graph.nodes.size();i++)labels[i+1]=graph.nodes.get(i).label;
        ArrayAdapter<String> adapter=new ArrayAdapter<>(this,android.R.layout.simple_spinner_item,labels);adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);picker.setAdapter(adapter);
        picker.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onNothingSelected(android.widget.AdapterView<?> p){}public void onItemSelected(android.widget.AdapterView<?> p,View v,int pos,long id){if(pos>0&&pos==picker.getSelectedItemPosition()&&!graph.nodes.get(pos-1).id.equals(selected)){renderer.select(pos-1);showSelection(pos-1);}}});settingsContent.addView(picker);
        motionToggle=new CheckBox(this);motionToggle.setText(R.string.cue_ar_motion);motionToggle.setTextColor(silver);motionToggle.setMinimumHeight(dp(48));motionToggle.setChecked(false);
        motionToggle.setOnCheckedChangeListener((button,checked)->{motionOptIn=checked;refreshMotionPolicy();});settingsContent.addView(motionToggle);
        motionExplanation=text(getString(R.string.cue_ar_motion_limits),silver,14);settingsContent.addView(motionExplanation);
        Button info=button(R.string.cue_ar_info);info.setOnClickListener(v->{detailsState.show(ArDetailsState.Panel.INFO);renderPanel();});settingsContent.addView(info);
        start=button(R.string.cue_ar_start);start.setOnClickListener(v->{
            if(terminal||permissionPending||lifecycle.hasResources())return;
            lifecycle.requestStart();start.setEnabled(false);noticeScroll.setVisibility(View.GONE);attemptSetup();
        });bottom.addView(start);
        LinearLayout actions=new LinearLayout(this);place=button(R.string.cue_ar_place);reset=button(R.string.cue_ar_reset);
        place.setEnabled(false);reset.setEnabled(false);place.setOnClickListener(v->renderer.place());reset.setOnClickListener(v->renderer.reset());
        actions.addView(place,new LinearLayout.LayoutParams(0,-2,1));actions.addView(reset,new LinearLayout.LayoutParams(0,-2,1));bottom.addView(actions);
        renderPanel();setContentView(root);
    }
    private void observeMotionPolicy(){
        try{ContextCompat.registerReceiver(this,powerObserver,new IntentFilter(PowerManager.ACTION_POWER_SAVE_MODE_CHANGED),ContextCompat.RECEIVER_NOT_EXPORTED);receiverObserved=true;}catch(SecurityException ignored){receiverObserved=false;}
        try{getContentResolver().registerContentObserver(Settings.Global.getUriFor(Settings.Global.ANIMATOR_DURATION_SCALE),false,motionObserver);scaleObserved=true;}catch(SecurityException ignored){scaleObserved=false;}
    }
    private void stopObservingMotionPolicy(){
        if(receiverObserved){unregisterReceiver(powerObserver);receiverObserved=false;}
        if(scaleObserved){getContentResolver().unregisterContentObserver(motionObserver);scaleObserved=false;}
    }
    private void refreshMotionPolicy(){
        if(renderer==null||graph==null)return;
        float systemScale=0f;boolean powerSaver=true;
        try{PowerManager power=(PowerManager)getSystemService(POWER_SERVICE);powerSaver=power==null||power.isPowerSaveMode();systemScale=Settings.Global.getFloat(getContentResolver(),Settings.Global.ANIMATOR_DURATION_SCALE,0f);}catch(SecurityException ignored){systemScale=0f;}
        boolean appAllows=graph.motionAllowed&&receiverObserved&&scaleObserved;
        boolean permitted=ArMotionPolicy.allowed(appAllows,true,systemScale,powerSaver,foreground);
        renderer.setMotionAllowed(ArMotionPolicy.allowed(appAllows,motionOptIn,systemScale,powerSaver,foreground));
        if(motionToggle!=null)motionToggle.setEnabled(permitted);
        if(motionExplanation!=null)motionExplanation.setText(permitted?R.string.cue_ar_motion_limits:R.string.cue_ar_motion_blocked);
    }
    private void addDisclosure(LinearLayout into,int color){
        into.addView(text(getString(R.string.cue_ar_disclosure),color,14));into.addView(text(getString(R.string.cue_ar_required_notice),color,14));
        Button privacy=button(R.string.cue_ar_google_privacy);privacy.setOnClickListener(v->openLink("https://policies.google.com/privacy"));into.addView(privacy);
        Button service=button(R.string.cue_ar_google_service);service.setOnClickListener(v->openLink("https://play.google.com/store/apps/details?id=com.google.ar.core"));into.addView(service);
    }
    private void renderPanel(){
        openDetailsButton=null;panelContent.removeAllViews();ArDetailsState.Panel panel=detailsState.panel();
        controlsScroll.setVisibility(panel==ArDetailsState.Panel.NONE?View.GONE:View.VISIBLE);gear.setSelected(panel==ArDetailsState.Panel.SETTINGS);
        if(panel==ArDetailsState.Panel.NONE)return;
        int silver=Color.rgb(214,224,220);
        LinearLayout heading=new LinearLayout(this);heading.setGravity(Gravity.CENTER_VERTICAL);
        int label=panel==ArDetailsState.Panel.SETTINGS?R.string.cue_ar_settings:panel==ArDetailsState.Panel.INFO?R.string.cue_ar_info:R.string.cue_ar_node_details;
        heading.addView(text(getString(label),silver,18),new LinearLayout.LayoutParams(0,-2,1));
        Button collapse=button(R.string.cue_ar_collapse);collapse.setOnClickListener(v->{detailsState.closePanel();renderPanel();});heading.addView(collapse);panelContent.addView(heading);
        if(panel==ArDetailsState.Panel.SETTINGS){panelContent.addView(settingsContent);return;}
        if(panel==ArDetailsState.Panel.INFO){panelContent.addView(text(getString(R.string.cue_ar_graph_summary,graph.title,graph.nodes.size(),graph.edges.size()),silver,14));addDisclosure(panelContent,silver);return;}
        GraphSnapshot.Node node=detailsState.selectedNode();if(node==null)return;
        TextView nodeText=text(getString(R.string.cue_ar_detail,node.label,node.detail.isEmpty()?getString(R.string.cue_ar_detail_empty):node.detail),silver,16);nodeText.setTextIsSelectable(true);panelContent.addView(nodeText);
        openDetailsButton=button(R.string.cue_ar_open_details);openDetailsButton.setEnabled(!terminal);openDetailsButton.setOnClickListener(v->{if(terminal)return;requestedDetailsId=detailsState.selectedId();finishResult(terminalStatus);});panelContent.addView(openDetailsButton);
        java.util.List<ArDetailsState.Connection> connections=detailsState.connections();
        panelContent.addView(text(getString(connections.isEmpty()?R.string.cue_ar_no_connections:R.string.cue_ar_connections),silver,14));
        for(ArDetailsState.Connection connection:connections){Button related=button(R.string.cue_ar_node_details);related.setText(getString(R.string.cue_ar_connection,graph.nodes.get(connection.index).label,connection.outgoing,connection.incoming));related.setOnClickListener(v->{renderer.select(connection.index);showSelection(connection.index);});panelContent.addView(related);}
        controlsScroll.scrollTo(0,0);
    }
    private TextView text(String value,int color,int sp) { TextView v=new TextView(this);v.setText(value);v.setTextColor(color);v.setTextSize(sp);return v; }
    private Button button(int textId) {
        Button b=new Button(this);b.setText(textId);
        // Tint the existing native background instead of replacing its ripple/focus drawable or touch target.
        b.setBackgroundTintList(new ColorStateList(ButtonPalette.states(),ButtonPalette.backgroundColors()));
        b.setTextColor(new ColorStateList(ButtonPalette.states(),ButtonPalette.textColors()));
        b.setMinHeight(dp(48));return b;
    }
    private int controlsHeight(){return Math.min(dp(300),Math.max(dp(100),getResources().getDisplayMetrics().heightPixels/3));}
    private int dp(int value) { return Math.round(value*getResources().getDisplayMetrics().density); }
    private void openLink(String url) { try { startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url))); } catch(ActivityNotFoundException|SecurityException e) { Toast.makeText(this,R.string.cue_ar_no_browser,Toast.LENGTH_SHORT).show(); } }
    private void attemptSetup() {
        if(terminal || permissionPending || !lifecycle.maySetup())return;
        if(checkSelfPermission(Manifest.permission.CAMERA)!=PackageManager.PERMISSION_GRANTED) {
            permissionPending=true;permission.launch(Manifest.permission.CAMERA);return;
        }
        Session created=null;
        try {
            ArCoreApk.Availability availability=ArCoreApk.getInstance().checkAvailability(this);
            if(availability==ArCoreApk.Availability.UNSUPPORTED_DEVICE_NOT_CAPABLE) { stopWith("unavailable",R.string.cue_ar_unavailable);return; }
            if(ArCoreApk.getInstance().requestInstall(this,!installRequested)==ArCoreApk.InstallStatus.INSTALL_REQUESTED) { installRequested=true;return; }
            created=new Session(this);
            Config config=new Config(created);
            config.setPlaneFindingMode(Config.PlaneFindingMode.HORIZONTAL);
            config.setFocusMode(Config.FocusMode.AUTO);
            config.setCloudAnchorMode(Config.CloudAnchorMode.DISABLED);
            config.setGeospatialMode(Config.GeospatialMode.DISABLED);
            config.setDepthMode(Config.DepthMode.DISABLED);
            config.setInstantPlacementMode(Config.InstantPlacementMode.DISABLED);
            config.setLightEstimationMode(Config.LightEstimationMode.DISABLED);
            created.configure(config);
            final Session session=created;
            renderer.setSession(session);
            lifecycle.attach(new ArLifecycle.Resources(){
                public void resumeSession()throws CameraNotAvailableException{session.resume();}
                public void resumeSurface(){renderer.resumeRendering();surface.onResume();getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);}
                public void pauseSurface(){renderer.suspendRendering();surface.queueEvent(renderer::releaseGl);surface.onPause();renderer.clearCommands();getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);}
                public void pauseSession(){session.pause();}
                public void release(){try{renderer.detachSession();}finally{closeOffMain(session);}}
            });
            created=null;
            lifecycle.resume();start.setVisibility(View.GONE);reticle.setVisibility(View.VISIBLE);status.setText(R.string.cue_ar_scan);
        } catch(UnavailableUserDeclinedInstallationException e) { stopWith("unavailable",R.string.cue_ar_install_declined); }
        catch(UnavailableException e) { stopWith("unavailable",R.string.cue_ar_unavailable); }
        catch(CameraNotAvailableException e) { stopWith("error",R.string.cue_ar_camera_busy); }
        catch(Exception e) { stopWith("error",R.string.cue_ar_interrupted); }
        finally { if(created!=null) { created.pause();closeOffMain(created); } }
    }
    private void closeOffMain(Session session) { new Thread(session::close,"cue-ar-close").start(); }
    private void stopWith(String result,int message) {
        if(terminal)return;terminal=true;terminalStatus=result;terminalMessage=getString(message);
        lifecycle.destroy();
        if(openDetailsButton!=null)openDetailsButton.setEnabled(false);
        if(status!=null){status.setText(message);start.setVisibility(View.GONE);place.setEnabled(false);reset.setEnabled(false);reticle.setVisibility(View.GONE);}
    }
    @Override protected void onResume(){super.onResume();foreground=true;observeMotionPolicy();refreshMotionPolicy();lifecycle.foreground();if(displays!=null)displays.registerDisplayListener(displayListener,null);updateRotation();
        if(lifecycle.hasResources()) { try{lifecycle.resume();}catch(Exception e){stopWith("error",R.string.cue_ar_camera_busy);} }
        else attemptSetup();
    }
    @Override protected void onPause(){foreground=false;refreshMotionPolicy();stopObservingMotionPolicy();lifecycle.background();if(displays!=null)displays.unregisterDisplayListener(displayListener);super.onPause();}
    @Override protected void onDestroy(){foreground=false;refreshMotionPolicy();stopObservingMotionPolicy();lifecycle.destroy();super.onDestroy();}
    @Override public void onConfigurationChanged(@NonNull Configuration configuration){super.onConfigurationChanged(configuration);updateRotation();if(controlsScroll!=null){controlsScroll.getLayoutParams().height=controlsHeight();controlsScroll.requestLayout();}}
    @SuppressWarnings("deprecation") private void updateRotation(){if(renderer!=null)renderer.rotation(getWindowManager().getDefaultDisplay().getRotation());}
    private void finishResult(String value) {
        if(resultSent)return;
        if(terminal)value=terminalStatus;
        resultSent=true;terminal=true;
        // Stop the GL thread before capturing the terminal selection/placement. A frame may
        // have been completing an already-requested operation when Close was pressed.
        lifecycle.destroy();
        if(renderer!=null){everPlaced|=renderer.wasPlaced();String latest=renderer.selectedId();if(latest!=null)selected=latest;}
        boolean openDetails="closed".equals(value)&&requestedDetailsId!=null&&graph!=null&&graph.hasNode(requestedDetailsId);
        if(openDetails)selected=requestedDetailsId;
        Intent result=new Intent().putExtra("openDetails",openDetails).putExtra("status",value).putExtra("placed",everPlaced).putExtra("message",diagnosticSummary());
        if(selected!=null && graph!=null && graph.hasNode(selected))result.putExtra("selectedNodeId",selected);
        setResult(RESULT_OK,result);finish();
    }
    private String reasonText(String reason){
        int id;
        switch(reason){
            case "NONE":id=R.string.cue_ar_reason_none;break;
            case "BAD_STATE":id=R.string.cue_ar_reason_bad_state;break;
            case "INSUFFICIENT_LIGHT":id=R.string.cue_ar_reason_insufficient_light;break;
            case "EXCESSIVE_MOTION":id=R.string.cue_ar_reason_excessive_motion;break;
            case "INSUFFICIENT_FEATURES":id=R.string.cue_ar_reason_insufficient_features;break;
            case "CAMERA_UNAVAILABLE":id=R.string.cue_ar_reason_camera_unavailable;break;
            default:id=R.string.cue_ar_reason_unknown;
        }
        return getString(id);
    }
    private String sceneMessage(ArTrackingStatus scene){
        switch(scene.phase){
            case SCANNING:return getString(R.string.cue_ar_scan);
            case READY:return getString(R.string.cue_ar_ready);
            case PLACED:return getString(R.string.cue_ar_placed);
            case ANCHOR_PAUSED:return getString(R.string.cue_ar_anchor_paused);
            case ANCHOR_STOPPED:return getString(R.string.cue_ar_anchor_stopped);
            case ANCHOR_UNKNOWN:return getString(R.string.cue_ar_anchor_unknown);
            case CAMERA_STOPPED:return getString(R.string.cue_ar_camera_stopped,reasonText(scene.failureReason));
            case CAMERA_PAUSED:return getString(R.string.cue_ar_camera_paused,reasonText(scene.failureReason));
            default:return getString(R.string.cue_ar_camera_unknown,reasonText(scene.failureReason));
        }
    }
    private String diagnosticSummary(){
        ArTrackingStatus captured=sceneStatus;
        ArTrackingStatus.PlacementDecision action=lastPlacementDecision;
        String message=terminalMessage!=null?terminalMessage:status==null?getString(R.string.cue_ar_interrupted):sceneMessage(captured);
        return message+"\n"+captured.diagnostic(graph==null?0:graph.nodes.size(),action);
    }
    @Override public void onSceneState(ArTrackingStatus scene){
        // Capture GL observations before dispatch. Close reads them after surface pause stops GL.
        sceneStatus=scene;
        runOnUiThread(()->{
        if(terminal || isFinishing())return;
        everPlaced|=scene.placed;place.setEnabled(scene.canPlace);reset.setEnabled(scene.placed);
        reticle.setVisibility(scene.placed?View.GONE:View.VISIBLE);reticle.setAlpha(scene.canPlace?1f:.35f);
        status.setText(sceneMessage(scene));
    });}
    @Override public void onPlacementDecision(ArTrackingStatus.PlacementDecision decision){
        if(decision!=ArTrackingStatus.PlacementDecision.IGNORE)lastPlacementDecision=decision;
        runOnUiThread(()->{
        if(terminal || isFinishing() || decision==ArTrackingStatus.PlacementDecision.IGNORE)return;
        int id;
        switch(decision){
            case PLACE:id=R.string.cue_ar_place_ack;break;
            case WAIT_TRACKING:id=R.string.cue_ar_place_no_tracking;break;
            case WAIT_SURFACE:id=R.string.cue_ar_place_no_hit;break;
            case ALREADY_PLACED:id=R.string.cue_ar_place_existing;break;
            default:return;
        }
        placementFeedback.setText(id);placementFeedback.setVisibility(View.VISIBLE);
    });}
    @Override public void onSelected(int index){runOnUiThread(()->{if(!terminal&&index>=0&&index<graph.nodes.size()&&graph.nodes.get(index).id.equals(renderer.selectedId()))showSelection(index);});}
    private void showSelection(int index){if(!detailsState.select(index))return;selected=detailsState.selectedId();if(picker.getSelectedItemPosition()!=index+1)picker.setSelection(index+1);renderPanel();}
    @Override public void onFailure(){runOnUiThread(()->stopWith("error",R.string.cue_ar_render_error));}
}
