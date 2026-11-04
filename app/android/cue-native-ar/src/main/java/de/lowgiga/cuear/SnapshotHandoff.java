package de.lowgiga.cuear;
import java.util.UUID;
/** One-shot process-local handoff. No Binder payload, file, database or saved state. */
final class SnapshotHandoff {
    static final SnapshotHandoff INSTANCE=new SnapshotHandoff();
    private String token;
    private GraphSnapshot snapshot;
    synchronized String put(GraphSnapshot value) {
        if (snapshot!=null || value==null) throw new IllegalStateException("AR handoff busy");
        token=UUID.randomUUID().toString(); snapshot=value; return token;
    }
    synchronized GraphSnapshot take(String key) {
        if (key==null || !key.equals(token)) return null;
        GraphSnapshot result=snapshot; snapshot=null; token=null; return result;
    }
    synchronized void clear(String key) { if (key!=null && key.equals(token)) { snapshot=null; token=null; } }
}
