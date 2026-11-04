package de.lowgiga.cuecommandmesh.preview;

import java.net.URI;
import java.net.URISyntaxException;

final class NavigationPolicy {
    private NavigationPolicy() {}

    static boolean requiresExternalBrowser(String url) {
        if (url == null) return false;
        try {
            URI uri = new URI(url);
            String scheme = uri.getScheme();
            if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) return false;
            return !("https".equalsIgnoreCase(scheme)
                && "localhost".equalsIgnoreCase(uri.getHost())
                && (uri.getPort() == -1 || uri.getPort() == 443)
                && uri.getRawUserInfo() == null);
        } catch (URISyntaxException error) {
            // An ambiguous web URL must never fall through to the privileged view.
            return url.regionMatches(true, 0, "https:", 0, 6) || url.regionMatches(true, 0, "http:", 0, 5);
        }
    }
}
