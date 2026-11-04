package de.lowgiga.cuear;
import org.junit.Test;import static org.junit.Assert.*;
public class ArMotionPolicyTest {
 @Test public void allFiveGuardsAreRequired(){for(int mask=0;mask<32;mask++){boolean app=(mask&1)!=0,optIn=(mask&2)!=0,os=(mask&4)!=0,power=(mask&8)!=0,foreground=(mask&16)!=0;assertEquals(app&&optIn&&os&&!power&&foreground,ArMotionPolicy.allowed(app,optIn,os?1f:0f,power,foreground));}}
 @Test public void invalidOrUnavailableSystemAnimationScaleFailsClosed(){for(float scale:new float[]{Float.NaN,Float.POSITIVE_INFINITY,Float.NEGATIVE_INFINITY,-1,0})assertFalse(ArMotionPolicy.allowed(true,true,scale,false,true));assertTrue(ArMotionPolicy.allowed(true,true,.5f,false,true));}
}
