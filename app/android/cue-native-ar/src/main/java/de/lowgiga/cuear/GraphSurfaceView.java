package de.lowgiga.cuear;
import android.content.Context;
import android.opengl.GLSurfaceView;
import android.view.MotionEvent;
/** Touch selection plus a center-point accessibility click; the native picker is the text alternative. */
public final class GraphSurfaceView extends GLSurfaceView {
    interface Tap { void accept(float x,float y); }
    private final Tap tap;
    private float x=Float.NaN,y=Float.NaN;
    public GraphSurfaceView(Context context){this(context,(x,y)->{});}
    GraphSurfaceView(Context context,Tap tap){super(context);this.tap=tap;setClickable(true);}
    @Override public boolean onTouchEvent(MotionEvent event){
        if(event.getAction()==MotionEvent.ACTION_UP){x=event.getX();y=event.getY();performClick();}
        else if(event.getAction()==MotionEvent.ACTION_CANCEL){x=Float.NaN;y=Float.NaN;}
        return true;
    }
    @Override public boolean performClick(){super.performClick();tap.accept(Float.isFinite(x)?x:getWidth()*.5f,Float.isFinite(y)?y:getHeight()*.5f);x=Float.NaN;y=Float.NaN;return true;}
}
