package de.lowgiga.cuear;
import org.junit.Test;import org.json.*;import static org.junit.Assert.*;
public class GraphAppearanceTest {
 @Test public void legacySnapshotDefaultsToNoMotionAndExistingGreen(){GraphSnapshot s=GraphSnapshot.parse(GraphSnapshotTest.valid());assertFalse(s.motionAllowed);assertEquals(0x6befa5,s.nodes.get(0).color);}
 @Test public void explicitRgbAndBooleanArePreserved()throws Exception{JSONObject o=new JSONObject(GraphSnapshotTest.valid());o.put("motionAllowed",true);o.getJSONArray("nodes").getJSONObject(0).put("color",0xaabbcc);GraphSnapshot s=GraphSnapshot.parse(o.toString());assertTrue(s.motionAllowed);assertEquals(0xaabbcc,s.nodes.get(0).color);}
 @Test public void invalidColorTypesAndRangeAreRejected()throws Exception{for(Object value:new Object[]{-1,16777216,1.5,"255",true,JSONObject.NULL}){JSONObject o=new JSONObject(GraphSnapshotTest.valid());o.getJSONArray("nodes").getJSONObject(0).put("color",value);assertThrows(IllegalArgumentException.class,()->GraphSnapshot.parse(o.toString()));}}
 @Test public void policyDoesNotCoerceStringsNumbersOrNull()throws Exception{for(Object value:new Object[]{"true",1,JSONObject.NULL}){JSONObject o=new JSONObject(GraphSnapshotTest.valid());o.put("motionAllowed",value);assertThrows(IllegalArgumentException.class,()->GraphSnapshot.parse(o.toString()));}}
}
