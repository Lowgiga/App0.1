package de.lowgiga.cuecommandmesh.preview;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.Logger;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CueFilesPlugin.class);
        registerPlugin(de.lowgiga.cuear.CueNativeARPlugin.class);
        super.onCreate(savedInstanceState);
        if (bridge == null) return;
        // Capacitor without an App plugin does not bind Android Back to same-document web history.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                WebView webView = bridge == null ? null : bridge.getWebView();
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                    return;
                }
                // At the actual root, preserve Android's system-defined Back behavior.
                setEnabled(false);
                try { getOnBackPressedDispatcher().onBackPressed(); }
                finally { if (!isFinishing() && !isDestroyed()) setEnabled(true); }
            }
        });
        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (openExternalWebUrl(request.getUrl())) return true;
                return super.shouldOverrideUrlLoading(view, request);
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (openExternalWebUrl(Uri.parse(url))) return true;
                return bridge.launchIntent(Uri.parse(url));
            }
        });
    }

    private boolean openExternalWebUrl(Uri url) {
        if (!NavigationPolicy.requiresExternalBrowser(url.toString())) return false;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, url).addCategory(Intent.CATEGORY_BROWSABLE));
        } catch (ActivityNotFoundException | SecurityException error) {
            // Stay in the app rather than load an external origin into the bridge.
            Logger.warn("No external browser available for this link");
        }
        return true;
    }
}
