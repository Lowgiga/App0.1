package de.lowgiga.cuear;
import org.junit.Test;
import static org.junit.Assert.*;
public class ArTrackingStatusTest {
 @Test public void freshHitAndAnchorHaveDistinctPhases() {
  ArTrackingStatus scan=ArTrackingStatus.observe("TRACKING","NONE",null,false,false);
  assertEquals(ArTrackingStatus.Phase.SCANNING,scan.phase);assertFalse(scan.canPlace);assertFalse(scan.placed);
  ArTrackingStatus ready=ArTrackingStatus.observe("TRACKING","NONE",null,false,true);
  assertEquals(ArTrackingStatus.Phase.READY,ready.phase);assertTrue(ready.canPlace);
  ArTrackingStatus placed=ArTrackingStatus.observe("TRACKING","NONE","TRACKING",true,false);
  assertEquals(ArTrackingStatus.Phase.PLACED,placed.phase);assertTrue(placed.tracking);assertTrue(placed.placed);assertFalse(placed.canPlace);
 }
 @Test public void exactCameraFailureReasonsArePreservedWithoutInventingACause() {
  for(String reason:new String[]{"NONE","BAD_STATE","INSUFFICIENT_LIGHT","EXCESSIVE_MOTION","INSUFFICIENT_FEATURES","CAMERA_UNAVAILABLE"}) {
   ArTrackingStatus s=ArTrackingStatus.observe("PAUSED",reason,null,false,true);
   assertEquals(ArTrackingStatus.Phase.CAMERA_PAUSED,s.phase);assertEquals(reason,s.failureReason);assertFalse(s.tracking);assertFalse(s.canPlace);
  }
 }
 @Test public void stoppedUnknownAndAnchorLossStaySeparate() {
  assertEquals(ArTrackingStatus.Phase.CAMERA_STOPPED,ArTrackingStatus.observe("STOPPED","NONE",null,false,false).phase);
  assertEquals(ArTrackingStatus.Phase.CAMERA_UNKNOWN,ArTrackingStatus.observe(null,null,null,false,false).phase);
  assertEquals(ArTrackingStatus.Phase.ANCHOR_PAUSED,ArTrackingStatus.observe("TRACKING","NONE","PAUSED",true,false).phase);
  assertEquals(ArTrackingStatus.Phase.ANCHOR_STOPPED,ArTrackingStatus.observe("TRACKING","NONE","STOPPED",true,false).phase);
  assertEquals(ArTrackingStatus.Phase.ANCHOR_UNKNOWN,ArTrackingStatus.observe("TRACKING","NONE",null,true,false).phase);
 }
 @Test public void allPlacementCombinationsFailClosedAndAcknowledgeEachRequest() {
  for(boolean request:new boolean[]{false,true})for(boolean tracking:new boolean[]{false,true})for(boolean anchor:new boolean[]{false,true})for(boolean hit:new boolean[]{false,true}) {
   ArTrackingStatus.PlacementDecision d=ArTrackingStatus.placementDecision(request,tracking,anchor,hit);
   ArTrackingStatus.PlacementDecision expected=!request?ArTrackingStatus.PlacementDecision.IGNORE:!tracking?ArTrackingStatus.PlacementDecision.WAIT_TRACKING:anchor?ArTrackingStatus.PlacementDecision.ALREADY_PLACED:hit?ArTrackingStatus.PlacementDecision.PLACE:ArTrackingStatus.PlacementDecision.WAIT_SURFACE;
   assertEquals(expected,d);
  }
 }
 @Test public void lostFreshHitDoesNotPlaceAndDoesNotBecomeSilentIgnore() {
  assertEquals(ArTrackingStatus.PlacementDecision.WAIT_SURFACE,ArTrackingStatus.placementDecision(true,true,false,false));
  assertEquals(ArTrackingStatus.PlacementDecision.WAIT_TRACKING,ArTrackingStatus.placementDecision(true,false,false,true));
 }
 @Test public void reasonChangesAreNotSuppressedByBooleanDeduplication() {
  ArTrackingStatus light=ArTrackingStatus.observe("PAUSED","INSUFFICIENT_LIGHT",null,false,false),motion=ArTrackingStatus.observe("PAUSED","EXCESSIVE_MOTION",null,false,false);
  assertNotEquals(light,motion);assertEquals(light,ArTrackingStatus.observe("PAUSED","INSUFFICIENT_LIGHT",null,false,false));assertEquals(light.hashCode(),ArTrackingStatus.observe("PAUSED","INSUFFICIENT_LIGHT",null,false,false).hashCode());
 }
 @Test public void diagnosticContainsOnlyAllowlistedStateAndBoundedCounts() {
  ArTrackingStatus s=ArTrackingStatus.observe("unexpected-detail","untrusted-reason","untrusted-anchor",false,false);String text=s.diagnostic(999,ArTrackingStatus.PlacementDecision.WAIT_SURFACE);
  assertFalse(text.contains("unexpected-detail"));assertFalse(text.contains("untrusted"));assertTrue(text.contains("nodes=unknown"));assertTrue(text.contains("reason=UNKNOWN"));assertTrue(text.length()<300);
  assertTrue(ArTrackingStatus.observe("TRACKING","NONE",null,false,true).diagnostic(12,null).contains("nodes=12"));
 }
 @Test public void returnedMessagesRejectOversizeControlAndMalformedUnicode() {
  assertNull(ArTrackingStatus.safeMessage(null));assertNull(ArTrackingStatus.safeMessage(" "));assertNull(ArTrackingStatus.safeMessage("x".repeat(1501)));assertNull(ArTrackingStatus.safeMessage("bad\u0000text"));assertNull(ArTrackingStatus.safeMessage("bad\uD800text"));assertNull(ArTrackingStatus.safeMessage("bad\uDC00text"));
  assertEquals("Status\nARCore: NONE",ArTrackingStatus.safeMessage("Status\nARCore: NONE"));assertEquals("Knoten 😀",ArTrackingStatus.safeMessage("Knoten 😀"));
 }
}
