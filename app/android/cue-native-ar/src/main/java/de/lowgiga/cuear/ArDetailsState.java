package de.lowgiga.cuear;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Session-only presentation state; connections are derived from the immutable snapshot. */
final class ArDetailsState {
    enum Panel { NONE, DETAILS, SETTINGS, INFO }
    static final class Connection {
        final int index, incoming, outgoing;
        Connection(int index,int incoming,int outgoing){this.index=index;this.incoming=incoming;this.outgoing=outgoing;}
    }
    private final GraphSnapshot graph;
    private Panel panel=Panel.NONE;
    private int selected=-1;
    ArDetailsState(GraphSnapshot graph){this.graph=graph;}
    Panel panel(){return panel;}
    GraphSnapshot.Node selectedNode(){return selected<0?null:graph.nodes.get(selected);}
    String selectedId(){GraphSnapshot.Node node=selectedNode();return node==null?null:node.id;}
    boolean select(int index){if(index<0||index>=graph.nodes.size())return false;selected=index;panel=Panel.DETAILS;return true;}
    void show(Panel value){if(value!=Panel.DETAILS||selected>=0)panel=value;}
    void toggleSettings(){panel=panel==Panel.SETTINGS?Panel.NONE:Panel.SETTINGS;}
    boolean closePanel(){if(panel==Panel.NONE)return false;panel=Panel.NONE;return true;}
    List<Connection> connections(){
        if(selected<0)return Collections.emptyList();
        int[] incoming=new int[graph.nodes.size()],outgoing=new int[graph.nodes.size()];
        for(GraphSnapshot.Edge edge:graph.edges){if(edge.from==selected)outgoing[edge.to]++;if(edge.to==selected)incoming[edge.from]++;}
        List<Connection> result=new ArrayList<>();
        for(int i=0;i<incoming.length;i++)if(incoming[i]+outgoing[i]>0)result.add(new Connection(i,incoming[i],outgoing[i]));
        return Collections.unmodifiableList(result);
    }
}
