package de.lowgiga.cuear;
import java.util.Objects;
import java.util.Set;
import java.util.HashSet;
import java.util.Arrays;
/** Bounded state-only diagnostics. No images, poses, node text, identifiers or locations. */
public final class ArTrackingStatus {
 public enum Phase { SCANNING, READY, PLACED, CAMERA_PAUSED, CAMERA_STOPPED, CAMERA_UNKNOWN, ANCHOR_PAUSED, ANCHOR_STOPPED, ANCHOR_UNKNOWN }
 public enum PlacementDecision { IGNORE, WAIT_TRACKING, WAIT_SURFACE, ALREADY_PLACED, PLACE }
 private static final Set<String> STATES=new HashSet<>(Arrays.asList("TRACKING","PAUSED","STOPPED"));
 private static final Set<String> REASONS=new HashSet<>(Arrays.asList("NONE","BAD_STATE","INSUFFICIENT_LIGHT","EXCESSIVE_MOTION","INSUFFICIENT_FEATURES","CAMERA_UNAVAILABLE"));
 public final String cameraState,failureReason,anchorState;
 public final boolean tracking,canPlace,placed;
 public final Phase phase;
 private ArTrackingStatus(String camera,String reason,String anchor,boolean hasAnchor,boolean freshHit) {
  cameraState=camera!=null&&STATES.contains(camera)?camera:"UNKNOWN";
  failureReason=reason!=null&&REASONS.contains(reason)?reason:"UNKNOWN";
  anchorState=!hasAnchor?"NONE":anchor!=null&&STATES.contains(anchor)?anchor:"UNKNOWN";
  placed=hasAnchor;tracking="TRACKING".equals(cameraState)&&(!hasAnchor||"TRACKING".equals(anchorState));
  canPlace=tracking&&!hasAnchor&&freshHit;
  if(!"TRACKING".equals(cameraState))phase="PAUSED".equals(cameraState)?Phase.CAMERA_PAUSED:"STOPPED".equals(cameraState)?Phase.CAMERA_STOPPED:Phase.CAMERA_UNKNOWN;
  else if(hasAnchor&&!"TRACKING".equals(anchorState))phase="PAUSED".equals(anchorState)?Phase.ANCHOR_PAUSED:"STOPPED".equals(anchorState)?Phase.ANCHOR_STOPPED:Phase.ANCHOR_UNKNOWN;
  else phase=hasAnchor?Phase.PLACED:freshHit?Phase.READY:Phase.SCANNING;
 }
 public static ArTrackingStatus observe(String camera,String reason,String anchor,boolean hasAnchor,boolean freshHit){return new ArTrackingStatus(camera,reason,anchor,hasAnchor,freshHit);}
 /** PLACE is a decision only: report it to the UI only after createAnchor succeeds. */
 public static PlacementDecision placementDecision(boolean requested,boolean cameraTracking,boolean hasAnchor,boolean freshHit){
  if(!requested)return PlacementDecision.IGNORE;
  if(!cameraTracking)return PlacementDecision.WAIT_TRACKING;
  if(hasAnchor)return PlacementDecision.ALREADY_PLACED;
  return freshHit?PlacementDecision.PLACE:PlacementDecision.WAIT_SURFACE;
 }
 public String diagnostic(int nodeCount,PlacementDecision lastAction){return "AR{camera="+cameraState+",reason="+failureReason+",anchor="+anchorState+",phase="+phase.name()+",nodes="+(nodeCount>=0&&nodeCount<=256?Integer.toString(nodeCount):"unknown")+",lastAction="+(lastAction==null?"IGNORE":lastAction.name())+"}";}
 public static String safeMessage(String value){
  if(value==null||value.length()>1500||value.trim().isEmpty())return null;
  for(int i=0;i<value.length();i++){char c=value.charAt(i);if(Character.isISOControl(c)&&c!='\n'&&c!='\t')return null;if(Character.isHighSurrogate(c)){if(++i>=value.length()||!Character.isLowSurrogate(value.charAt(i)))return null;}else if(Character.isLowSurrogate(c))return null;}
  return value;
 }
 @Override public boolean equals(Object other){if(!(other instanceof ArTrackingStatus))return false;ArTrackingStatus s=(ArTrackingStatus)other;return cameraState.equals(s.cameraState)&&failureReason.equals(s.failureReason)&&anchorState.equals(s.anchorState)&&phase==s.phase&&tracking==s.tracking&&canPlace==s.canPlace&&placed==s.placed;}
 @Override public int hashCode(){return Objects.hash(cameraState,failureReason,anchorState,phase,tracking,canPlace,placed);}
}
