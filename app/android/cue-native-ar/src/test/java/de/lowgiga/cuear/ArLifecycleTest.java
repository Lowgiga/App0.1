package de.lowgiga.cuear;
import java.util.*;
import org.junit.Test;
import static org.junit.Assert.*;
public class ArLifecycleTest {
 @Test public void neverStartsBeforeExplicitRequestAndForeground() { ArLifecycle l=new ArLifecycle(); l.foreground(); assertFalse(l.maySetup()); l.requestStart(); assertTrue(l.maySetup()); l.background(); assertFalse(l.maySetup()); }
 @Test public void cameraAndSurfaceOrderAndExactlyOnceRelease() throws Exception { List<String> e=new ArrayList<>(); ArLifecycle l=new ArLifecycle(); l.foreground(); l.requestStart(); l.attach(new ArLifecycle.Resources(){public void resumeSession(){e.add("session+");}public void resumeSurface(){e.add("surface+");}public void pauseSurface(){e.add("surface-");}public void pauseSession(){e.add("session-");}public void release(){e.add("release");}}); l.resume(); l.resume(); l.background(); l.background(); l.foreground(); l.resume(); l.destroy(); l.destroy(); assertEquals(Arrays.asList("session+","surface+","surface-","session-","session+","surface+","surface-","session-","release"),e); assertFalse(l.maySetup()); }
 @Test public void failedResumeDoesNotResumeSurfaceAndStillReleases() { List<String> e=new ArrayList<>(); ArLifecycle l=new ArLifecycle();l.foreground();l.requestStart();l.attach(new ArLifecycle.Resources(){public void resumeSession()throws Exception{e.add("session+");throw new Exception();}public void resumeSurface(){e.add("surface+");}public void pauseSurface(){e.add("surface-");}public void pauseSession(){e.add("session-");}public void release(){e.add("release");}});assertThrows(Exception.class,l::resume);l.destroy();assertEquals(Arrays.asList("session+","session-","release"),e); }
 @Test public void rejectsAttachBeforeStartAndAfterDestroy() { ArLifecycle l=new ArLifecycle(); assertThrows(IllegalStateException.class,()->l.attach(null));l.destroy();l.foreground();l.requestStart();assertFalse(l.maySetup()); }
 @Test public void partialSurfaceResumeIsPausedBeforeSessionAndRelease() {
  List<String> events=new ArrayList<>(); ArLifecycle l=new ArLifecycle();l.foreground();l.requestStart();
  l.attach(new ArLifecycle.Resources(){
   public void resumeSession(){events.add("session+");}
   public void resumeSurface(){events.add("surface+");throw new IllegalStateException("Partial GL start");}
   public void pauseSurface(){events.add("surface-");}
   public void pauseSession(){events.add("session-");}
   public void release(){events.add("release");}
  });
  assertThrows(IllegalStateException.class,l::resume);l.destroy();
  assertEquals(Arrays.asList("session+","surface+","surface-","session-","release"),events);
 }
}
