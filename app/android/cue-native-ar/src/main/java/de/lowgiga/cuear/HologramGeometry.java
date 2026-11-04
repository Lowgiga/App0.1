package de.lowgiga.cuear;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Bounded unit meshes for the native renderer. No Android or GL dependency. */
final class HologramGeometry {
    static final int DETAIL_LIMIT=32, ORBIT_SEGMENTS=64;
    static final float RADIUS=.042f, CORE_RADIUS=.24f;
    private static final float[] SHELL, CORE, ORBIT;
    static {
        // One subdivision of an icosahedron: 42 positions, 80 faces, 120 unique edges.
        float t=(float)((1+Math.sqrt(5))/2);
        float[][] seed={{-1,t,0},{1,t,0},{-1,-t,0},{1,-t,0},{0,-1,t},{0,1,t},
            {0,-1,-t},{0,1,-t},{t,0,-1},{t,0,1},{-t,0,-1},{-t,0,1}};
        List<float[]> positions=new ArrayList<>();
        for(float[] p:seed)positions.add(unit(p[0],p[1],p[2]));
        int[][] faces={{0,11,5},{0,5,1},{0,1,7},{0,7,10},{0,10,11},{1,5,9},{5,11,4},
            {11,10,2},{10,7,6},{7,1,8},{3,9,4},{3,4,2},{3,2,6},{3,6,8},{3,8,9},
            {4,9,5},{2,4,11},{6,2,10},{8,6,7},{9,8,1}};
        List<int[]> refined=new ArrayList<>();Map<Long,Integer> midpoint=new LinkedHashMap<>();
        for(int[] f:faces){
            int a=middle(f[0],f[1],positions,midpoint),b=middle(f[1],f[2],positions,midpoint),c=middle(f[2],f[0],positions,midpoint);
            refined.add(new int[]{f[0],a,c});refined.add(new int[]{f[1],b,a});
            refined.add(new int[]{f[2],c,b});refined.add(new int[]{a,b,c});
        }
        Set<Long> edges=new LinkedHashSet<>();CORE=new float[refined.size()*9];int at=0;
        for(int[] f:refined){
            for(int i=0;i<3;i++){float[] p=positions.get(f[i]);System.arraycopy(p,0,CORE,at,3);at+=3;edges.add(key(f[i],f[(i+1)%3]));}
        }
        SHELL=new float[edges.size()*6];at=0;
        for(long edge:edges){System.arraycopy(positions.get((int)(edge>>>32)),0,SHELL,at,3);System.arraycopy(positions.get((int)edge),0,SHELL,at+3,3);at+=6;}
        ORBIT=new float[ORBIT_SEGMENTS*6];
        // A tilted vertical orbit, projected narrowly from the initial view, with real z extent.
        float tilt=(float)Math.toRadians(73);
        for(int i=0;i<ORBIT_SEGMENTS;i++)for(int end=0;end<2;end++){
            double a=2*Math.PI*((i+end)%ORBIT_SEGMENTS)/ORBIT_SEGMENTS;
            float x=(float)Math.cos(a)*1.40f;int k=i*6+end*3;
            ORBIT[k]=x*(float)Math.cos(tilt);ORBIT[k+1]=(float)Math.sin(a)*1.40f;ORBIT[k+2]=-x*(float)Math.sin(tilt);
        }
    }
    private HologramGeometry() {}
    static float[] shellLines() { return SHELL.clone(); }
    static float[] coreTriangles() { return CORE.clone(); }
    static float[] orbitLines() { return ORBIT.clone(); }
    static boolean detailed(int index,int count,int selected) {
        if(index<0 || index>=count)return false;
        boolean extraSelected=selected>=DETAIL_LIMIT && selected<count;
        return index<DETAIL_LIMIT-(extraSelected?1:0) || (extraSelected && index==selected);
    }
    private static long key(int a,int b){return ((long)Math.min(a,b)<<32)|(Math.max(a,b)&0xffffffffL);}
    private static float[] unit(float x,float y,float z){float d=(float)Math.sqrt(x*x+y*y+z*z);return new float[]{x/d,y/d,z/d};}
    private static int middle(int a,int b,List<float[]> positions,Map<Long,Integer> cache){
        long key=key(a,b);Integer old=cache.get(key);if(old!=null)return old;
        float[] p=positions.get(a),q=positions.get(b);int index=positions.size();
        positions.add(unit(p[0]+q[0],p[1]+q[1],p[2]+q[2]));cache.put(key,index);return index;
    }
}
