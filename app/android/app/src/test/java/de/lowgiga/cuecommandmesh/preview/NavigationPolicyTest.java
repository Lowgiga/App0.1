package de.lowgiga.cuecommandmesh.preview;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import org.junit.Test;

public class NavigationPolicyTest {
    @Test public void preservesExactLocalHttpsOrigin() {
        assertFalse(NavigationPolicy.requiresExternalBrowser("https://localhost/"));
        assertFalse(NavigationPolicy.requiresExternalBrowser("https://localhost:443/documents/test.json"));
        assertFalse(NavigationPolicy.requiresExternalBrowser("https://LOCALHOST/assets/test.js#anchor"));
    }

    @Test public void differentPortNeverRemainsInPrivilegedWebView() {
        assertTrue(NavigationPolicy.requiresExternalBrowser("https://localhost:8080/"));
        assertTrue(NavigationPolicy.requiresExternalBrowser("https://localhost:0/"));
        assertTrue(NavigationPolicy.requiresExternalBrowser("http://localhost/"));
    }

    @Test public void remoteOrAmbiguousWebAddressesAreExternal() {
        assertTrue(NavigationPolicy.requiresExternalBrowser("https://example.com/"));
        assertTrue(NavigationPolicy.requiresExternalBrowser("https://localhost.example.com/"));
        assertTrue(NavigationPolicy.requiresExternalBrowser("https://localhost@evil.example/"));
        assertTrue(NavigationPolicy.requiresExternalBrowser("https://user@localhost/"));
        assertTrue(NavigationPolicy.requiresExternalBrowser("https://localhost./"));
        assertTrue(NavigationPolicy.requiresExternalBrowser("https://localhost:443@evil.example/"));
        assertTrue(NavigationPolicy.requiresExternalBrowser("https://localhost/bad space"));
    }

    @Test public void leavesExistingNonNetworkFileFlowsToCapacitor() {
        assertFalse(NavigationPolicy.requiresExternalBrowser("blob:https://localhost/example"));
        assertFalse(NavigationPolicy.requiresExternalBrowser("data:application/json,%7B%7D"));
        assertFalse(NavigationPolicy.requiresExternalBrowser("mailto:test@example.com"));
        assertFalse(NavigationPolicy.requiresExternalBrowser(null));
    }
}
