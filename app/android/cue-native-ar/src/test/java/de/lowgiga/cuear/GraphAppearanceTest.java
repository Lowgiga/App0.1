package de.lowgiga.cuear;
import org.junit.Test;import org.json.*;import static org.junit.Assert.*;
public class GraphAppearanceTest {
 @Test public void legacySnapshotDefaultsToNoMotionAndExistingGreen(){GraphSnapshot s=GraphSnapshot.parse(GraphSnapshotTest.valid());assertFalse(s.motionAllowed);assertEquals(0x6befa5,s.nodes.get(0).color);}
 @Test public void explicitRgbAndBooleanArePreserved()throws Exception{JSONObject o=new JSONObject(GraphSnapshotTest.valid());o.put("motionAllowed",true);o.getJSONArray("nodes").getJSONObject(0).put("color",0xaabbcc);GraphSnapshot s=GraphSnapshot.parse(o.toString());assertTrue(s.motionAllowed);assertEquals(0xaabbcc,s.nodes.get(0).color);}
 @Test public void invalidColorTypesAndRangeAreRejected()throws Exception{for(Object value:new Object[]{-1,16777216,1.5,"255",true,JSONObject.NULL}){JSONObject o=new JSONObject(GraphSnapshotTest.valid());o.getJSONArray("nodes").getJSONObject(0).put("color",value);assertThrows(IllegalArgumentException.class,()->GraphSnapshot.parse(o.toString()));}}
 @Test public void policyDoesNotCoerceStringsNumbersOrNull()throws Exception{for(Object value:new Object[]{"true",1,JSONObject.NULL}){JSONObject o=new JSONObject(GraphSnapshotTest.valid());o.put("motionAllowed",value);assertThrows(IllegalArgumentException.class,()->GraphSnapshot.parse(o.toString()));}}
 static JSONObject v2()throws Exception{JSONObject o=new JSONObject(GraphSnapshotTest.valid());o.put("version",2);for(int i=0;i<o.getJSONArray("nodes").length();i++)o.getJSONArray("nodes").getJSONObject(i).put("appearance",new JSONObject("{\"core\":\"#123456\",\"shell\":\"#ABCDEF\",\"orbit\":\"#778899\",\"shape\":\"cube\",\"size\":\"large\",\"motion\":\"breathe\"}"));return o;}
 @Test public void acceptsVersionTwoWithCompleteAppearance()throws Exception{GraphSnapshot s=GraphSnapshot.parse(v2().toString());assertEquals(2,s.nodes.size());}
 @Test public void versionOneStillRejectsAppearanceAndFutureVersionsFail()throws Exception{JSONObject o=v2();o.put("version",1);assertThrows(IllegalArgumentException.class,()->GraphSnapshot.parse(o.toString()));o.put("version",3);assertThrows(IllegalArgumentException.class,()->GraphSnapshot.parse(o.toString()));}
 @Test public void versionTwoRejectsPartialUnknownAndInvalidFields()throws Exception{
  for(String key:new String[]{"core","shell","orbit","shape","size","motion"}){JSONObject o=v2();o.getJSONArray("nodes").getJSONObject(0).getJSONObject("appearance").remove(key);assertThrows(key,IllegalArgumentException.class,()->GraphSnapshot.parse(o.toString()));}
  Object[][] invalid={{"core","red"},{"core","#fff"},{"core","#1234567"},{"core",255},{"core",JSONObject.NULL},{"shell","#gg0000"},{"orbit","#112233\n"},{"shape","sphere"},{"size",1},{"motion",true},{"motion","spin"},{"future",true}};
  for(Object[] entry:invalid){JSONObject o=v2();o.getJSONArray("nodes").getJSONObject(0).getJSONObject("appearance").put((String)entry[0],entry[1]);assertThrows(entry[0].toString(),IllegalArgumentException.class,()->GraphSnapshot.parse(o.toString()));}
  for(Object value:new Object[]{JSONObject.NULL,new JSONArray(),true,"cube"}){JSONObject o=v2();o.getJSONArray("nodes").getJSONObject(0).put("appearance",value);assertThrows(IllegalArgumentException.class,()->GraphSnapshot.parse(o.toString()));}
 }
 @Test public void allVersionTwoChannelsSurviveWithoutMovingCentersOrEdges()throws Exception{
  GraphSnapshot s=GraphSnapshot.parse(v2().toString());GraphSnapshot.Appearance a=s.nodes.get(0).appearance;assertEquals(2,s.version);assertEquals(0x123456,a.core);assertEquals(0xabcdef,a.shell);assertEquals(0x778899,a.orbit);assertEquals("cube",a.shape);assertEquals("large",a.size);assertEquals("breathe",a.motion);
  GraphSnapshot legacy=GraphSnapshot.parse(GraphSnapshotTest.valid());for(int i=0;i<s.nodes.size();i++){assertEquals(legacy.nodes.get(i).x,s.nodes.get(i).x,0);assertEquals(legacy.nodes.get(i).y,s.nodes.get(i).y,0);assertEquals(legacy.nodes.get(i).z,s.nodes.get(i).z,0);}assertEquals(legacy.edges.get(0).from,s.edges.get(0).from);assertEquals(legacy.edges.get(0).to,s.edges.get(0).to);
 }
 @Test public void legacyAppearanceHasExistingColorAndStaticNormalPolyhedron()throws Exception{
  JSONObject o=new JSONObject(GraphSnapshotTest.valid());o.getJSONArray("nodes").getJSONObject(0).put("color",0xaabbcc);GraphSnapshot s=GraphSnapshot.parse(o.toString());GraphSnapshot.Appearance a=s.nodes.get(0).appearance;assertEquals(1,s.version);assertEquals(0xaabbcc,a.core);assertEquals(a.core,a.shell);assertEquals(a.core,a.orbit);assertEquals("polyhedron",a.shape);assertEquals("normal",a.size);assertEquals("off",a.motion);
 }
 @Test public void versionTwoRejectsMissingAppearance()throws Exception{JSONObject o=v2();o.getJSONArray("nodes").getJSONObject(0).remove("appearance");assertThrows(IllegalArgumentException.class,()->GraphSnapshot.parse(o.toString()));}
}


