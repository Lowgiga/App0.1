package de.lowgiga.cuear;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.json.JSONTokener;

/** Immutable, bounded, read-only bridge boundary. No URLs, files or executable fields. */
public final class GraphSnapshot {
    public static final int MAX_BYTES = 512 * 1024, MAX_NODES = 256, MAX_EDGES = 4096;
    public final String revision, title;
    public final boolean motionAllowed;
    public final List<Node> nodes;
    public final List<Edge> edges;
    private GraphSnapshot(String revision, String title, List<Node> nodes, List<Edge> edges, boolean motionAllowed) {
        this.motionAllowed=motionAllowed;
        this.revision = revision; this.title = title;
        this.nodes = Collections.unmodifiableList(nodes); this.edges = Collections.unmodifiableList(edges);
    }
    public static final class Node {
        public final String id, label, detail;
        public final float x, y, z;
        public final int color;
        private Node(String id, String label, String detail, float x, float y, float z, int color) {
            this.color=color;
            this.id = id; this.label = label; this.detail = detail; this.x = x; this.y = y; this.z = z;
        }
    }
    public static final class Edge {
        public final int from, to;
        private Edge(int from, int to) { this.from = from; this.to = to; }
    }
    public boolean hasNode(String id) {
        if (id != null) for (Node node : nodes) if (node.id.equals(id)) return true;
        return false;
    }
    public static GraphSnapshot parse(String json) {
        if (json == null || json.length() > MAX_BYTES || json.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES)
            throw invalid("Snapshot exceeds 512 KiB");
        checkDepth(json);
        try {
            JSONTokener tokener = new JSONTokener(json);
            Object parsed = tokener.nextValue();
            if (!(parsed instanceof JSONObject) || tokener.nextClean() != 0) throw invalid("Object required");
            JSONObject root = (JSONObject) parsed;
            keys(root, "version", "snapshotRevision", "title", "nodes", "edges", "motionAllowed");
            Object motion=root.has("motionAllowed")?root.get("motionAllowed"):Boolean.FALSE;
            if(!(motion instanceof Boolean))throw invalid("Boolean motion policy required");
            if (integer(root.get("version")) != 1) throw invalid("Unsupported version");
            String revision = text(root.get("snapshotRevision"), 128, false, false);
            String title = text(root.get("title"), 120, false, false);
            JSONArray nodeArray = root.getJSONArray("nodes"), edgeArray = root.getJSONArray("edges");
            if (nodeArray.length() < 1 || nodeArray.length() > MAX_NODES || edgeArray.length() > MAX_EDGES)
                throw invalid("Graph count limit");
            List<Node> nodes = new ArrayList<>(); Set<String> ids = new HashSet<>();
            for (int i = 0; i < nodeArray.length(); i++) {
                JSONObject n = nodeArray.getJSONObject(i);
                keys(n, "id", "label", "detail", "x", "y", "z", "color");
                int color=n.has("color")?integer(n.get("color")):0x6befa5;
                if(color<0||color>0xffffff)throw invalid("RGB color out of range");
                String id = text(n.get("id"), 128, false, false);
                if (!ids.add(id)) throw invalid("Duplicate node ID");
                nodes.add(new Node(id, text(n.get("label"), 120, false, false),
                    n.has("detail") ? text(n.get("detail"), 1000, true, true) : "",
                    coordinate(n.get("x")), coordinate(n.get("y")), coordinate(n.get("z")),color));
            }
            List<Edge> edges = new ArrayList<>();
            for (int i = 0; i < edgeArray.length(); i++) {
                JSONObject e = edgeArray.getJSONObject(i); keys(e, "from", "to");
                int from = integer(e.get("from")), to = integer(e.get("to"));
                if (from < 0 || to < 0 || from >= nodes.size() || to >= nodes.size() || from == to)
                    throw invalid("Invalid edge");
                // Distinct semantic relations may share endpoints; preserve every bounded entry in order.
                edges.add(new Edge(from, to));
            }
            return new GraphSnapshot(revision, title, nodes, edges,(Boolean)motion);
        } catch (JSONException e) { throw invalid("Malformed snapshot"); }
    }
    private static void keys(JSONObject o, String... allowed) {
        Set<String> names = new HashSet<>(); Collections.addAll(names, allowed);
        Iterator<String> iterator = o.keys();
        while (iterator.hasNext()) if (!names.contains(iterator.next())) throw invalid("Unknown field");
    }
    private static int integer(Object value) {
        if (!(value instanceof Number)) throw invalid("Integer required");
        double n = ((Number) value).doubleValue();
        if (!Double.isFinite(n) || n != Math.rint(n) || n < Integer.MIN_VALUE || n > Integer.MAX_VALUE) throw invalid("Integer required");
        return (int) n;
    }
    private static float coordinate(Object value) {
        if (!(value instanceof Number)) throw invalid("Number required");
        double n = ((Number) value).doubleValue();
        if (!Double.isFinite(n) || n < -1 || n > 1) throw invalid("Coordinate outside [-1,1]");
        return (float) n;
    }
    private static String text(Object value, int max, boolean empty, boolean multiline) {
        if (!(value instanceof String)) throw invalid("Text required");
        String s = (String) value;
        if (s.length() > max || (!empty && s.trim().isEmpty())) throw invalid("Text length");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (Character.isISOControl(c) && !(multiline && (c == '\n' || c == '\t'))) throw invalid("Control in text");
            if (Character.isHighSurrogate(c)) {
                if (++i >= s.length() || !Character.isLowSurrogate(s.charAt(i))) throw invalid("Invalid Unicode");
            } else if (Character.isLowSurrogate(c)) throw invalid("Invalid Unicode");
        }
        return s;
    }
    private static void checkDepth(String json) {
        int depth = 0; boolean quoted = false, escaped = false;
        for (int i = 0; i < json.length(); i++) {
            char c = json.charAt(i);
            if (quoted) { if (escaped) escaped = false; else if (c == '\\') escaped = true; else if (c == '"') quoted = false; }
            else if (c == '"') quoted = true;
            else if (c == '[' || c == '{') { if (++depth > 8) throw invalid("Excessive JSON depth"); }
            else if (c == ']' || c == '}') { if (--depth < 0) throw invalid("Malformed JSON"); }
        }
        if (quoted || depth != 0) throw invalid("Malformed JSON");
    }
    private static IllegalArgumentException invalid(String message) { return new IllegalArgumentException(message); }
}
