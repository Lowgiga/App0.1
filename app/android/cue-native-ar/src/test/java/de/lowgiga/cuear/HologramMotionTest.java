package de.lowgiga.cuear;
import org.junit.Test;
import static org.junit.Assert.*;
public class HologramMotionTest {
 @Test public void motionIsOffUnlessExplicitlyAllowed(){HologramMotion m=new HologramMotion();for(long t:new long[]{0,1500000000L,Long.MAX_VALUE})assertEquals(1f,m.sample(false,t),0);}
 @Test public void breathingIsSlowFiniteAndBounded(){HologramMotion m=new HologramMotion();assertEquals(1f,m.sample(true,0),0);assertEquals(1.035f,m.sample(true,1500000000L),.000001f);assertEquals(.965f,m.sample(true,4500000000L),.000001f);for(long t=0;t<12000000000L;t+=1000000L){float s=m.sample(true,t);assertTrue(Float.isFinite(s));assertTrue(s>=.965f && s<=1.035f);}}
 @Test public void disablingAndBackgroundResetImmediatelyRestoreBaseline(){HologramMotion m=new HologramMotion();m.sample(true,0);assertNotEquals(1f,m.sample(true,1500000000L),0);assertEquals(1f,m.sample(false,1500000000L),0);assertEquals(1f,m.sample(true,9000000000L),0);m.sample(true,10500000000L);m.reset();assertEquals(1f,m.sample(true,999999999999L),0);}
 @Test public void backwardsAndHugeClocksRemainFinite(){HologramMotion m=new HologramMotion();m.sample(true,100);assertEquals(1f,m.sample(true,99),0);assertTrue(Float.isFinite(m.sample(true,Long.MAX_VALUE)));}
}
