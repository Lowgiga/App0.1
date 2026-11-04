package de.lowgiga.cuear;
/** Pure projection/picking shared by tests and the GLES renderer. Column-major matrices. */
public final class SceneMath {
    private SceneMath() {}
    public static float scale(float value) { return Float.isFinite(value) ? Math.max(.25f, Math.min(2f, value)) : 1f; }
    public static float[] project(float[] m, float x, float y, float z, int width, int height) {
        if (m == null || m.length != 16 || width <= 0 || height <= 0) return null;
        float cx=m[0]*x+m[4]*y+m[8]*z+m[12], cy=m[1]*x+m[5]*y+m[9]*z+m[13];
        float cz=m[2]*x+m[6]*y+m[10]*z+m[14], cw=m[3]*x+m[7]*y+m[11]*z+m[15];
        if (!Float.isFinite(cx) || !Float.isFinite(cy) || !Float.isFinite(cz) || !Float.isFinite(cw) || cw <= 0) return null;
        cx/=cw; cy/=cw; cz/=cw;
        if (Math.abs(cx)>1 || Math.abs(cy)>1 || Math.abs(cz)>1) return null;
        return new float[]{(cx+1)*.5f*width,(1-cy)*.5f*height,cz};
    }
    public static int pick(float[][] points, float x, float y, float radius) {
        if (!Float.isFinite(x) || !Float.isFinite(y) || !Float.isFinite(radius) || radius <= 0) return -1;
        int best=-1; float distance=radius*radius, depth=Float.POSITIVE_INFINITY;
        for(int i=0;i<points.length;i++) {
            float[] p=points[i]; if(p==null || p.length!=3) continue;
            float d=(p[0]-x)*(p[0]-x)+(p[1]-y)*(p[1]-y);
            if(d<distance || (d==distance && p[2]<depth)) { best=i; distance=d; depth=p[2]; }
        }
        return best;
    }
}
