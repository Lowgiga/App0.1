package de.lowgiga.cuear;

/** Explicit opaque native button tints; arrays are the actual ColorStateList inputs used by the Activity. */
final class ButtonPalette {
    private ButtonPalette() {}
    // Disabled first; enabled, pressed and focused states use the fallback while native ripple/focus stays intact.
    static int[][] states(){return new int[][]{new int[]{-android.R.attr.state_enabled},new int[]{}};}
    static int[] backgroundColors(){return new int[]{0xffa5b7ac,0xffa9f2c4};}
    static int[] textColors(){return new int[]{0xff24392d,0xff082316};}
}
