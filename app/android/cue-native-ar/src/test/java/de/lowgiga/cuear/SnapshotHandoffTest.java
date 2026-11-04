package de.lowgiga.cuear;
import org.junit.Test;
import static org.junit.Assert.*;
public class SnapshotHandoffTest {
 @Test public void singleUseTokenAndBoundedStore() { SnapshotHandoff h=new SnapshotHandoff(); GraphSnapshot s=GraphSnapshot.parse(GraphSnapshotTest.valid()); String token=h.put(s); assertTrue(token.matches("[0-9a-f-]{36}"));assertThrows(IllegalStateException.class,()->h.put(s));assertNull(h.take("bad")); assertSame(s,h.take(token));assertNull(h.take(token));String t=h.put(s); h.clear("bad");assertSame(s,h.take(t)); }
 @Test public void clearRemovesOnlyMatchingSnapshot() { SnapshotHandoff h=new SnapshotHandoff();String t=h.put(GraphSnapshot.parse(GraphSnapshotTest.valid()));h.clear(t);assertNull(h.take(t)); }
}
