package de.lowgiga.cuear;
import org.junit.Test;
import org.json.*;
import static org.junit.Assert.*;
public class GraphSnapshotTest {
    static String valid() { return "{\"version\":1,\"snapshotRevision\":\"r1\",\"title\":\"Lernnetz\",\"nodes\":[{\"id\":\"a\",\"label\":\"Alpha\",\"detail\":\"Nur lesen\",\"x\":-1,\"y\":0,\"z\":1},{\"id\":\"b\",\"label\":\"Beta\",\"x\":1,\"y\":1,\"z\":-1}],\"edges\":[{\"from\":0,\"to\":1}]}"; }
    static void rejected(String json) { assertThrows(IllegalArgumentException.class, () -> GraphSnapshot.parse(json)); }
    @Test public void acceptsStrictSnapshot() { GraphSnapshot s=GraphSnapshot.parse(valid()); assertEquals(2,s.nodes.size()); assertEquals("r1",s.revision); assertEquals(1,s.edges.get(0).to); assertEquals("",s.nodes.get(1).detail); }
    @Test public void rejectsUnknownFields() { rejected(valid().replace("\"version\":1", "\"version\":1,\"secret\":\"no\"")); }
    @Test public void rejectsWrongVersionsAndTypes() { rejected(valid().replace("\"version\":1", "\"version\":2")); rejected(valid().replace("\"version\":1", "\"version\":\"1\"")); rejected(valid().replace("\"x\":-1", "\"x\":\"-1\"")); rejected(valid().replace("\"from\":0", "\"from\":0.5")); }
    @Test public void rejectsOutsideBoundsAndNonfinite() { rejected(valid().replace("\"x\":-1", "\"x\":-1.0001")); rejected(valid().replace("\"x\":-1", "\"x\":1e309")); }
    @Test public void rejectsBadNodeIdsAndText() { rejected(valid().replace("\"id\":\"b\"", "\"id\":\"a\"")); rejected(valid().replace("Alpha", " ")); rejected(valid().replace("Alpha", "a".repeat(121))); rejected(valid().replace("Alpha", "bad\\u0000")); rejected(valid().replace("Alpha", "bad\\ud800")); }
    @Test public void rejectsInvalidEdges() { rejected(valid().replace("\"to\":1", "\"to\":2")); rejected(valid().replace("\"to\":1", "\"to\":0")); }
    @Test public void rejectsTrailingInputMissingFieldsAndDeepUnknowns() { rejected(valid()+"true"); rejected(valid().replace("\"y\":0,", "")); rejected(valid().replace("\"label\":\"Alpha\"", "\"label\":\"Alpha\",\"url\":\"https://example.org\"")); rejected("[]"); }
    @Test public void enforcesByteLimitBeforeParsing() { rejected(" ".repeat(GraphSnapshot.MAX_BYTES+1)); rejected(valid().replace("Lernnetz", "é".repeat(GraphSnapshot.MAX_BYTES/2))); }
    @Test public void supportsMaximumCountsAndRejectsOverflow() throws Exception {
        JSONObject o=new JSONObject(valid()); JSONArray nodes=new JSONArray(); for(int i=0;i<256;i++) nodes.put(new JSONObject().put("id","n"+i).put("label","N"+i).put("x",0).put("y",0).put("z",0)); o.put("nodes",nodes);
        JSONArray edges=new JSONArray(); for(int a=0;a<256&&edges.length()<4096;a++) for(int b=0;b<256&&edges.length()<4096;b++) if(a!=b) edges.put(new JSONObject().put("from",a).put("to",b)); o.put("edges",edges);
        assertEquals(4096,GraphSnapshot.parse(o.toString()).edges.size()); edges.put(new JSONObject().put("from",255).put("to",254)); rejected(o.toString()); o.put("edges",new JSONArray()); nodes.put(nodes.get(0)); rejected(o.toString());
    }
    @Test public void immutableCollectionsAndSelectionMembership() { GraphSnapshot s=GraphSnapshot.parse(valid()); assertThrows(UnsupportedOperationException.class,()->s.nodes.clear()); assertTrue(s.hasNode("a")); assertFalse(s.hasNode("other")); }
    @Test public void preservesLegitimateParallelEdgesAndInputOrder() throws Exception {
        JSONObject o=new JSONObject(valid());
        o.put("edges",new JSONArray("[{\"from\":0,\"to\":1},{\"from\":1,\"to\":0},{\"from\":0,\"to\":1}]"));
        GraphSnapshot graph=GraphSnapshot.parse(o.toString());
        assertEquals(3,graph.edges.size());
        assertEquals(0,graph.edges.get(0).from); assertEquals(1,graph.edges.get(0).to);
        assertEquals(1,graph.edges.get(1).from); assertEquals(0,graph.edges.get(1).to);
        assertEquals(0,graph.edges.get(2).from); assertEquals(1,graph.edges.get(2).to);
    }
    @Test public void accepts4096ParallelEdgesButRejects4097() throws Exception {
        JSONObject o=new JSONObject(valid()); JSONArray edges=new JSONArray();
        for(int i=0;i<4096;i++)edges.put(new JSONObject().put("from",0).put("to",1));
        o.put("edges",edges); assertEquals(4096,GraphSnapshot.parse(o.toString()).edges.size());
        edges.put(new JSONObject().put("from",0).put("to",1)); rejected(o.toString());
    }
}
