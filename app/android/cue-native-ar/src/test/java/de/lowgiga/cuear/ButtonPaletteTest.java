package de.lowgiga.cuear;
import org.junit.Test;
import static org.junit.Assert.*;
/** Tests the same state/color arrays passed to native ColorStateList; no screenshot/OEM claim. */
public class ButtonPaletteTest {
    @Test public void labelsMeetContrastInEnabledAndDisabledPalette() {
        int[] backgrounds=ButtonPalette.backgroundColors(), texts=ButtonPalette.textColors();
        assertEquals(2,backgrounds.length); assertEquals(2,texts.length);
        for(int i=0;i<2;i++) {
            assertEquals(255,backgrounds[i]>>>24);assertEquals(255,texts[i]>>>24);
            assertTrue("State "+i+" label contrast must be at least 4.5:1",contrast(backgrounds[i],texts[i])>=4.5);
        }
    }
    @Test public void enabledIsLightGreenDisabledIsDistinctAndMuted() {
        int[] backgrounds=ButtonPalette.backgroundColors(), texts=ButtonPalette.textColors();
        assertNotEquals(backgrounds[0],backgrounds[1]);assertNotEquals(texts[0],texts[1]);
        int enabledGreen=(backgrounds[1]>>8)&255, enabledRed=(backgrounds[1]>>16)&255;
        int disabledGreen=(backgrounds[0]>>8)&255, disabledRed=(backgrounds[0]>>16)&255;
        assertTrue(enabledGreen>200);assertTrue(enabledGreen-enabledRed>50);
        assertTrue(disabledGreen-disabledRed<30);
    }
    @Test public void negativeEnabledStateComesFirstThenNativePressedFocusFallback() {
        int[][] states=ButtonPalette.states();
        assertEquals(2,states.length);assertArrayEquals(new int[]{-android.R.attr.state_enabled},states[0]);
        // All enabled states, including pressed and focused, use the fallback tint. Native RippleDrawable stays intact.
        assertArrayEquals(new int[]{},states[1]);
    }
    @Test public void returnedArraysCannotMutateSubsequentStateLists() {
        int[] colors=ButtonPalette.backgroundColors();colors[0]=0;
        assertNotEquals(0,ButtonPalette.backgroundColors()[0]);
        int[][] states=ButtonPalette.states();states[0][0]=0;
        assertEquals(-android.R.attr.state_enabled,ButtonPalette.states()[0][0]);
    }
    static double contrast(int first,int second) {double a=luminance(first),b=luminance(second);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);}
    static double luminance(int c){return .2126*linear((c>>16)&255)+.7152*linear((c>>8)&255)+.0722*linear(c&255);}
    static double linear(int c){double s=c/255.0;return s<=.04045?s/12.92:Math.pow((s+.055)/1.055,2.4);}
}
