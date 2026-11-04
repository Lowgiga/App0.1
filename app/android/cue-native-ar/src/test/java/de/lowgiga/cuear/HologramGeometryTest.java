package de.lowgiga.cuear;
import org.junit.Test;
import static org.junit.Assert.*;
public class HologramGeometryTest {
 @Test public void shellHasBoundedUniqueTriangulatedSphereEdges() {
  float[] shell=HologramGeometry.shellLines();
  assertEquals(120*2*3,shell.length);
  java.util.Set<String> edges=new java.util.HashSet<>();
  for(int i=0;i<shell.length;i+=6){
   String a=point(shell,i),b=point(shell,i+3);assertNotEquals(a,b);
   assertTrue(edges.add(a.compareTo(b)<0?a+":"+b:b+":"+a));
  }
  for(int i=0;i<shell.length;i+=3)assertEquals(1f,length(shell,i),.00001f);
 }
 @Test public void coreHasFiniteOutwardFacesAndNonzeroDepth() {
  float[] core=HologramGeometry.coreTriangles();assertEquals(80*3*3,core.length);
  float min=1,max=-1;
  for(int i=0;i<core.length;i+=9){
   for(int j=0;j<9;j++)assertTrue(Float.isFinite(core[i+j]));
   float ax=core[i+3]-core[i],ay=core[i+4]-core[i+1],az=core[i+5]-core[i+2];
   float bx=core[i+6]-core[i],by=core[i+7]-core[i+1],bz=core[i+8]-core[i+2];
   assertTrue((ay*bz-az*by)*core[i]+(az*bx-ax*bz)*core[i+1]+(ax*by-ay*bx)*core[i+2]>0);
  }
  for(int i=2;i<core.length;i+=3){min=Math.min(min,core[i]);max=Math.max(max,core[i]);}
  assertTrue(min<-.9f);assertTrue(max>.9f);
 }
 @Test public void orbitIsClosedFiniteAndExtendsOutsideShell() {
  float[] orbit=HologramGeometry.orbitLines();assertEquals(64*6,orbit.length);
  float maxY=0;
  for(int i=0;i<orbit.length;i+=6){
   for(int j=0;j<6;j++)assertTrue(Float.isFinite(orbit[i+j]));
   int next=(i+6)%orbit.length;
   for(int j=0;j<3;j++)assertEquals(orbit[i+3+j],orbit[next+j],.00001f);
   maxY=Math.max(maxY,Math.abs(orbit[i+1]));
  }
  assertTrue(maxY>1.3f);assertTrue(maxY<1.5f);
 }
 @Test public void callersCannotMutateSharedGeometry() {
  float[] shell=HologramGeometry.shellLines();float first=shell[0];shell[0]=999;
  assertEquals(first,HologramGeometry.shellLines()[0],0);
 }
 @Test public void detailBudgetRetainsSelectedNodeWithoutExceeding32() {
  for(int count:new int[]{0,1,31,32,33,256})for(int selected:new int[]{-1,0,31,32,255}){
   int detailed=0;for(int i=0;i<count;i++)if(HologramGeometry.detailed(i,count,selected))detailed++;
   assertEquals(Math.min(count,32),detailed);
   if(selected>=0&&selected<count)assertTrue(HologramGeometry.detailed(selected,count,selected));
  }
  assertFalse(HologramGeometry.detailed(-1,10,0));assertFalse(HologramGeometry.detailed(10,10,0));
 }
 @Test public void cubeRegistryKeepsFixedRadiusFiniteDepthAndUniqueTwelveEdges()throws Exception{
  float[] shell=shape("shellLines","cube"),core=shape("coreTriangles","cube");assertEquals(12*6,shell.length);assertEquals(12*9,core.length);
  java.util.Set<String> edges=new java.util.HashSet<>();for(int i=0;i<shell.length;i+=6){String a=point(shell,i),b=point(shell,i+3);assertNotEquals(a,b);assertTrue(edges.add(a.compareTo(b)<0?a+":"+b:b+":"+a));}
  for(float[] mesh:new float[][]{shell,core})for(int i=0;i<mesh.length;i+=3){for(int j=0;j<3;j++)assertTrue(Float.isFinite(mesh[i+j]));assertEquals(1f,length(mesh,i),.00001f);}
  for(int i=0;i<core.length;i+=9){float ax=core[i+3]-core[i],ay=core[i+4]-core[i+1],az=core[i+5]-core[i+2],bx=core[i+6]-core[i],by=core[i+7]-core[i+1],bz=core[i+8]-core[i+2];assertTrue((ay*bz-az*by)*core[i]+(az*bx-ax*bz)*core[i+1]+(ax*by-ay*bx)*core[i+2]>0);}
  float first=shell[0];shell[0]=999;assertEquals(first,shape("shellLines","cube")[0],0);
  assertArrayEquals(HologramGeometry.shellLines(),shape("shellLines","polyhedron"),0);assertArrayEquals(HologramGeometry.coreTriangles(),shape("coreTriangles","polyhedron"),0);
 }
 @Test public void sizeRegistryUsesOnlyTheThreeBoundedFactors(){assertEquals(.8f,size("small"),0);assertEquals(1f,size("normal"),0);assertEquals(1.25f,size("large"),0);}
 private static float[] shape(String method,String name){return "shellLines".equals(method)?HologramGeometry.shellLines(name):HologramGeometry.coreTriangles(name);}
 private static float size(String name){return HologramGeometry.sizeScale(name);}
 private static float length(float[] a,int i){return(float)Math.sqrt(a[i]*a[i]+a[i+1]*a[i+1]+a[i+2]*a[i+2]);}
 private static String point(float[] a,int i){return a[i]+","+a[i+1]+","+a[i+2];}
}
