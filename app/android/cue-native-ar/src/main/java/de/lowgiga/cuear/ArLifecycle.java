package de.lowgiga.cuear;
/** Main-thread resource owner; controls the actual Activity's camera/surface ordering. */
public final class ArLifecycle {
    public interface Resources {
        void resumeSession() throws Exception;
        void resumeSurface();
        void pauseSurface();
        void pauseSession();
        /** Detach anchors after surface is paused; close session off-main. */
        void release();
    }
    private boolean foreground, requested, running, destroyed;
    private Resources resources;
    public void foreground() { if (!destroyed) foreground=true; }
    public void requestStart() { if (!destroyed) requested=true; }
    public boolean maySetup() { return foreground && requested && !destroyed && resources==null; }
    public boolean hasResources() { return resources!=null; }
    public boolean isRunning() { return running; }
    public void attach(Resources value) {
        if (value==null || !maySetup()) throw new IllegalStateException("AR setup is not allowed");
        resources=value;
    }
    public void resume() throws Exception {
        if (!foreground || !requested || destroyed || running || resources==null) return;
        boolean surfaceAttempted=false;
        try {
            resources.resumeSession();
            surfaceAttempted=true;
            resources.resumeSurface();
            running=true;
        } catch (Exception error) {
            // resumeSurface may throw after waking GL; stop it before pausing/releasing its session.
            try { if (surfaceAttempted) resources.pauseSurface(); }
            finally { resources.pauseSession(); }
            throw error;
        }
    }
    public void background() {
        foreground=false;
        if (running) {
            running=false;
            try { resources.pauseSurface(); } finally { resources.pauseSession(); }
        }
    }
    public void destroy() {
        if (destroyed) return;
        destroyed=true;
        try { background(); } finally { if (resources!=null) { Resources old=resources; resources=null; old.release(); } }
    }
}
