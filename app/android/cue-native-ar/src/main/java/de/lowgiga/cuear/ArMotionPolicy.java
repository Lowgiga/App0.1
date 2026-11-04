package de.lowgiga.cuear;
/** Motion is a visual option, independent from the camera/AR tracking requirement. */
final class ArMotionPolicy {
    private ArMotionPolicy(){}
    static boolean allowed(boolean appAllows,boolean optedIn,float systemScale,boolean powerSaver,boolean foreground){
        return appAllows&&optedIn&&Float.isFinite(systemScale)&&systemScale>0f&&!powerSaver&&foreground;
    }
}
