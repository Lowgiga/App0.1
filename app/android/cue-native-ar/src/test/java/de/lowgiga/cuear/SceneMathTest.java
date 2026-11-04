package de.lowgiga.cuear;
import org.junit.Test;
import static org.junit.Assert.*;
public class SceneMathTest {
 @Test public void scaleIsFiniteAndBounded() { assertEquals(.25f,SceneMath.scale(-5),0); assertEquals(2f,SceneMath.scale(9),0); assertEquals(1f,SceneMath.scale(Float.NaN),0); }
 @Test public void projectionRejectsBehindOrOutsideClip() { float[] m={1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1}; assertNotNull(SceneMath.project(m,0,0,0,100,200)); assertNull(SceneMath.project(m,0,0,2,100,200)); m[15]=-1; assertNull(SceneMath.project(m,0,0,0,100,200)); }
 @Test public void projectsScreenCenterAndIgnoresInvalidPoints() { float[] m={1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1}; float[] p=SceneMath.project(m,0,0,0,100,200); assertArrayEquals(new float[]{50,100,0},p,0); assertNull(SceneMath.project(m,Float.NaN,0,0,100,200)); assertNull(SceneMath.project(m,0,0,0,0,200)); }
 @Test public void pickerUsesNearestScreenPointAndDepthTieBreak() { float[][] p={{10,10,.5f},{10,10,.1f},{50,50,0},null}; assertEquals(1,SceneMath.pick(p,10,10,20)); assertEquals(2,SceneMath.pick(p,49,49,20)); assertEquals(-1,SceneMath.pick(p,90,90,20)); assertEquals(-1,SceneMath.pick(p,Float.NaN,0,20)); }
}
