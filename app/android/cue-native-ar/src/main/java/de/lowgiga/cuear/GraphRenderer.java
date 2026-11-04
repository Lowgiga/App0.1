package de.lowgiga.cuear;

import android.opengl.GLES11Ext;
import android.opengl.GLES20;
import android.opengl.GLSurfaceView;
import android.opengl.Matrix;
import com.google.ar.core.Anchor;
import com.google.ar.core.Camera;
import com.google.ar.core.Coordinates2d;
import com.google.ar.core.Frame;
import com.google.ar.core.HitResult;
import com.google.ar.core.Plane;
import com.google.ar.core.Session;
import com.google.ar.core.TrackingState;
import com.google.ar.core.TrackingFailureReason;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

/** Small GLES2 live-camera renderer. All ARCore/GL drawing and anchor changes happen on the GL thread. */
final class GraphRenderer implements GLSurfaceView.Renderer {
    interface Listener { void onSceneState(ArTrackingStatus scene);void onPlacementDecision(ArTrackingStatus.PlacementDecision decision);void onSelected(int index);void onFailure(); }
    private final GraphSnapshot graph;
    private final Listener listener;
    private final float density;
    private final FloatBuffer quad=buffer(new float[]{-1,-1,1,-1,-1,1,1,1});
    private final FloatBuffer uv=buffer(new float[8]);
    private final FloatBuffer edges;
    private final FloatBuffer shell=buffer(HologramGeometry.shellLines()),core=buffer(HologramGeometry.coreTriangles()),orbit=buffer(HologramGeometry.orbitLines());
    private final HologramMotion motion=new HologramMotion();
    private final float[] local,model=new float[16],view=new float[16],projection=new float[16],pv=new float[16],mvp=new float[16],viewModel=new float[16];
    private volatile Session session;
    private Anchor anchor;
    private volatile int rotation,selected=-1;
    private volatile float scale=1f;
    private volatile boolean placeRequested,resetRequested,everPlaced,suspended=true;
    private volatile boolean motionAllowed;
    private volatile float[] tap;
    private int width,height,texture,cameraProgram,graphProgram;
    private ArTrackingStatus lastSceneStatus;
    private boolean textureDirty=true,failed;

    GraphRenderer(GraphSnapshot graph,Listener listener,float density) {
        this.graph=graph;this.listener=listener;this.density=density;
        local=new float[graph.nodes.size()*3];
        for(int i=0;i<graph.nodes.size();i++){GraphSnapshot.Node n=graph.nodes.get(i);local[i*3]=n.x*.45f;local[i*3+1]=.35f+n.y*.3f;local[i*3+2]=n.z*.45f;}
        // Two vertices per relationship, with a bounded 0..1 dash coordinate. No per-frame expansion.
        float[] links=new float[graph.edges.size()*8];int offset=0;
        for(GraphSnapshot.Edge edge:graph.edges){System.arraycopy(local,edge.from*3,links,offset,3);links[offset+3]=0;System.arraycopy(local,edge.to*3,links,offset+4,3);links[offset+7]=1;offset+=8;}
        edges=buffer(links);
    }
    void resumeRendering(){suspended=false;}
    void suspendRendering(){suspended=true;motion.reset();}
    /** UI policy owns permission. Missing/old snapshots and a newly created renderer stay still. */
    void setMotionAllowed(boolean value){motionAllowed=value;if(!value)motion.reset();}
    void setSession(Session value){session=value;textureDirty=true;}
    void rotation(int value){rotation=value;}
    void scale(float value){scale=SceneMath.scale(value);}
    void place(){placeRequested=true;}
    void reset(){resetRequested=true;}
    void tap(float x,float y){tap=new float[]{x,y};}
    void clearCommands(){placeRequested=false;resetRequested=false;tap=null;lastSceneStatus=null;}
    void select(int index){if(index>=0 && index<graph.nodes.size())selected=index;}
    boolean wasPlaced(){return everPlaced;}
    String selectedId(){int i=selected;return i>=0 && i<graph.nodes.size()?graph.nodes.get(i).id:null;}
    /** Called only after GLSurfaceView.onPause has stopped the GL thread. */
    void detachSession(){detachAnchor();session=null;tap=null;placeRequested=false;resetRequested=false;}
    private void detachAnchor(){if(anchor!=null){anchor.detach();anchor=null;}}

    @Override public void onSurfaceCreated(GL10 unused,EGLConfig config){
        // Context is not preserved across pause; stale GL names are never reused.
        texture=0;cameraProgram=0;graphProgram=0;textureDirty=true;failed=false;motion.reset();
        try {
            int[] names=new int[1];GLES20.glGenTextures(1,names,0);texture=names[0];
            GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES,texture);
            GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES,GLES20.GL_TEXTURE_MIN_FILTER,GLES20.GL_LINEAR);
            GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES,GLES20.GL_TEXTURE_MAG_FILTER,GLES20.GL_LINEAR);
            GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES,GLES20.GL_TEXTURE_WRAP_S,GLES20.GL_CLAMP_TO_EDGE);
            GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES,GLES20.GL_TEXTURE_WRAP_T,GLES20.GL_CLAMP_TO_EDGE);
            cameraProgram=program("attribute vec2 position;attribute vec2 texcoord;varying vec2 uv;void main(){gl_Position=vec4(position,0.0,1.0);uv=texcoord;}",
                "#extension GL_OES_EGL_image_external : require\nprecision mediump float;uniform samplerExternalOES camera;varying vec2 uv;void main(){gl_FragColor=texture2D(camera,uv);}");
            graphProgram=program(HologramShader.VERTEX,HologramShader.FRAGMENT);
            GLES20.glClearColor(.02f,.05f,.035f,1f);
        }catch(RuntimeException e){releaseGl();fail();}
    }
    @Override public void onSurfaceChanged(GL10 unused,int width,int height){this.width=width;this.height=height;GLES20.glViewport(0,0,width,height);}
    @Override public void onDrawFrame(GL10 unused){
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT|GLES20.GL_DEPTH_BUFFER_BIT);
        Session current=session;
        if(current==null || suspended || failed || width<=0 || height<=0)return;
        boolean requested=placeRequested;placeRequested=false;
        float[] touch=tap;tap=null;
        try {
            if(resetRequested){resetRequested=false;detachAnchor();requested=false;}
            current.setDisplayGeometry(rotation,width,height);
            if(textureDirty){current.setCameraTextureName(texture);textureDirty=false;}
            Frame frame=current.update();
            if(frame.getTimestamp()!=0)drawCamera(frame);
            Camera camera=frame.getCamera();
            TrackingState cameraState=camera.getTrackingState();
            TrackingFailureReason reason=camera.getTrackingFailureReason();
            String cameraName=cameraState==null?null:cameraState.name(),reasonName=reason==null?null:reason.name();
            if(cameraState!=TrackingState.TRACKING){
                ArTrackingStatus.PlacementDecision decision=ArTrackingStatus.placementDecision(requested,false,anchor!=null,false);
                if(decision!=ArTrackingStatus.PlacementDecision.IGNORE)listener.onPlacementDecision(decision);
                publish(ArTrackingStatus.observe(cameraName,reasonName,anchor==null?null:anchor.getTrackingState().name(),anchor!=null,false));return;
            }
            HitResult target=null;
            if(anchor==null){
                for(HitResult hit:frame.hitTest(width*.5f,height*.5f)){
                    if(hit.getTrackable() instanceof Plane){Plane p=(Plane)hit.getTrackable();
                        if(p.getType()==Plane.Type.HORIZONTAL_UPWARD_FACING && p.getTrackingState()==TrackingState.TRACKING && p.isPoseInPolygon(hit.getHitPose()) && camera.getPose().ty()>hit.getHitPose().ty()) {target=hit;break;}
                    }
                }
                // Recheck the current frame at command consumption; never place on a stale hit.
                // Decision and acknowledgement follow the fresh-hit scan below.
            }
            ArTrackingStatus.PlacementDecision decision=ArTrackingStatus.placementDecision(requested,true,anchor!=null,target!=null);
            if(decision==ArTrackingStatus.PlacementDecision.PLACE){anchor=target.createAnchor();everPlaced=true;}
            if(decision!=ArTrackingStatus.PlacementDecision.IGNORE)listener.onPlacementDecision(decision);
            ArTrackingStatus scene=ArTrackingStatus.observe(cameraName,reasonName,anchor==null?null:anchor.getTrackingState().name(),anchor!=null,target!=null);
            publish(scene);
            if(anchor==null || !scene.tracking)return;
            anchor.getPose().toMatrix(model,0);float s=scale;Matrix.scaleM(model,0,s,s,s);
            camera.getViewMatrix(view,0);camera.getProjectionMatrix(projection,0,.05f,100f);
            Matrix.multiplyMM(pv,0,projection,0,view,0);Matrix.multiplyMM(mvp,0,pv,0,model,0);
            if(touch!=null){
                float[][] projected=new float[graph.nodes.size()][];
                for(int i=0;i<projected.length;i++)projected[i]=SceneMath.project(mvp,local[i*3],local[i*3+1],local[i*3+2],width,height);
                int found=SceneMath.pick(projected,touch[0],touch[1],28f*density);
                if(found>=0){selected=found;listener.onSelected(found);}
            }
            drawGraph();
            if(GLES20.glGetError()!=GLES20.GL_NO_ERROR)fail();
        }catch(Exception e){fail();}
    }
    private void drawCamera(Frame frame){
        quad.position(0);uv.position(0);
        frame.transformCoordinates2d(Coordinates2d.OPENGL_NORMALIZED_DEVICE_COORDINATES,quad,Coordinates2d.TEXTURE_NORMALIZED,uv);
        GLES20.glDisable(GLES20.GL_DEPTH_TEST);GLES20.glDepthMask(false);
        GLES20.glUseProgram(cameraProgram);
        int p=GLES20.glGetAttribLocation(cameraProgram,"position"),t=GLES20.glGetAttribLocation(cameraProgram,"texcoord");
        quad.position(0);uv.position(0);GLES20.glEnableVertexAttribArray(p);GLES20.glEnableVertexAttribArray(t);
        GLES20.glVertexAttribPointer(p,2,GLES20.GL_FLOAT,false,0,quad);GLES20.glVertexAttribPointer(t,2,GLES20.GL_FLOAT,false,0,uv);
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0);GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES,texture);GLES20.glUniform1i(GLES20.glGetUniformLocation(cameraProgram,"camera"),0);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP,0,4);GLES20.glDisableVertexAttribArray(p);GLES20.glDisableVertexAttribArray(t);GLES20.glDepthMask(true);
    }
    private void drawGraph(){
        GLES20.glEnable(GLES20.GL_DEPTH_TEST);GLES20.glDepthFunc(GLES20.GL_LEQUAL);GLES20.glDepthMask(true);
        GLES20.glDisable(GLES20.GL_BLEND);GLES20.glDisable(GLES20.GL_CULL_FACE);GLES20.glUseProgram(graphProgram);
        GLES20.glUniformMatrix4fv(GLES20.glGetUniformLocation(graphProgram,"transform"),1,false,mvp,0);
        Matrix.multiplyMM(viewModel,0,view,0,model,0);
        GLES20.glUniformMatrix4fv(GLES20.glGetUniformLocation(graphProgram,"viewModel"),1,false,viewModel,0);
        int p=GLES20.glGetAttribLocation(graphProgram,"position"),dash=GLES20.glGetAttribLocation(graphProgram,"dashCoordinate");
        int color=GLES20.glGetUniformLocation(graphProgram,"color"),layer=GLES20.glGetUniformLocation(graphProgram,"layer");
        int center=GLES20.glGetUniformLocation(graphProgram,"center"),radius=GLES20.glGetUniformLocation(graphProgram,"radius");
        GLES20.glEnableVertexAttribArray(p);
        GLES20.glDisableVertexAttribArray(dash);GLES20.glVertexAttrib1f(dash,0);
        final int chosen=selected;
        final float breath=motion.sample(motionAllowed && !suspended,System.nanoTime());
        // Opaque, truly three-dimensional cores write depth first, including the low-detail nodes.
        bind(p,core);GLES20.glUniform1i(layer,2);
        for(int i=0;i<graph.nodes.size();i++){
            nodeColor(color,i,i==chosen);GLES20.glUniform3f(center,local[i*3],local[i*3+1],local[i*3+2]);
            GLES20.glUniform1f(radius,HologramGeometry.RADIUS*HologramGeometry.CORE_RADIUS);
            GLES20.glDrawArrays(GLES20.GL_TRIANGLES,0,core.capacity()/3);
        }
        // Decorative layers test against cores, but do not hide each other with depth writes.
        GLES20.glEnable(GLES20.GL_BLEND);GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA,GLES20.GL_ONE_MINUS_SRC_ALPHA);GLES20.glDepthMask(false);GLES20.glLineWidth(1f);
        if(!graph.edges.isEmpty()){
            edges.position(0);GLES20.glVertexAttribPointer(p,3,GLES20.GL_FLOAT,false,4*4,edges);
            edges.position(3);GLES20.glEnableVertexAttribArray(dash);GLES20.glVertexAttribPointer(dash,1,GLES20.GL_FLOAT,false,4*4,edges);
            GLES20.glUniform3f(center,0,0,0);GLES20.glUniform1f(radius,1);GLES20.glUniform1i(layer,0);GLES20.glUniform4f(color,.63f,.76f,.73f,.30f);
            GLES20.glDrawArrays(GLES20.GL_LINES,0,graph.edges.size()*2);
            GLES20.glDisableVertexAttribArray(dash);GLES20.glVertexAttrib1f(dash,0);
        }
        for(int i=0;i<graph.nodes.size();i++)if(HologramGeometry.detailed(i,graph.nodes.size(),chosen)){
            nodeColor(color,i,false);GLES20.glUniform3f(center,local[i*3],local[i*3+1],local[i*3+2]);
            // Pulsation affects decoration only. Local centers, solid cores and the 28dp picker stay fixed.
            GLES20.glUniform1f(radius,HologramGeometry.RADIUS*breath);
            bind(p,shell);GLES20.glUniform1i(layer,1);GLES20.glDrawArrays(GLES20.GL_LINES,0,shell.capacity()/3);
            bind(p,orbit);GLES20.glUniform1i(layer,3);GLES20.glDrawArrays(GLES20.GL_LINES,0,orbit.capacity()/3);
        }
        GLES20.glDepthMask(true);GLES20.glDisable(GLES20.GL_BLEND);
        GLES20.glDisableVertexAttribArray(p);
    }
    private void nodeColor(int uniform,int index,boolean selectedCore){
        int rgb=graph.nodes.get(index).color;
        if(selectedCore)GLES20.glUniform4f(uniform,.94f,1f,.96f,1f);
        else GLES20.glUniform4f(uniform,((rgb>>>16)&255)/255f,((rgb>>>8)&255)/255f,(rgb&255)/255f,1f);
    }
    private static void bind(int attribute,FloatBuffer data){data.position(0);GLES20.glVertexAttribPointer(attribute,3,GLES20.GL_FLOAT,false,0,data);}
    private void publish(ArTrackingStatus scene){if(!scene.equals(lastSceneStatus)){lastSceneStatus=scene;listener.onSceneState(scene);}}
    private void fail(){if(!failed){failed=true;listener.onFailure();}}
    /** Queued before surface pause; context destruction is the fallback if no GL surface exists. */
    void releaseGl(){if(cameraProgram!=0)GLES20.glDeleteProgram(cameraProgram);if(graphProgram!=0)GLES20.glDeleteProgram(graphProgram);if(texture!=0)GLES20.glDeleteTextures(1,new int[]{texture},0);cameraProgram=0;graphProgram=0;texture=0;textureDirty=true;}
    private static FloatBuffer buffer(float[] value){FloatBuffer b=ByteBuffer.allocateDirect(value.length*4).order(ByteOrder.nativeOrder()).asFloatBuffer();b.put(value).position(0);return b;}
    private static int shader(int type,String source){int id=GLES20.glCreateShader(type);GLES20.glShaderSource(id,source);GLES20.glCompileShader(id);int[] ok=new int[1];GLES20.glGetShaderiv(id,GLES20.GL_COMPILE_STATUS,ok,0);if(ok[0]==0){GLES20.glDeleteShader(id);throw new IllegalStateException("Shader compile failed");}return id;}
    private static int program(String vertex,String fragment){int v=0,f=0,p=0;try{v=shader(GLES20.GL_VERTEX_SHADER,vertex);f=shader(GLES20.GL_FRAGMENT_SHADER,fragment);p=GLES20.glCreateProgram();GLES20.glAttachShader(p,v);GLES20.glAttachShader(p,f);GLES20.glLinkProgram(p);int[] ok=new int[1];GLES20.glGetProgramiv(p,GLES20.GL_LINK_STATUS,ok,0);if(ok[0]==0)throw new IllegalStateException("Shader link failed");return p;}catch(RuntimeException e){if(p!=0)GLES20.glDeleteProgram(p);throw e;}finally{if(v!=0)GLES20.glDeleteShader(v);if(f!=0)GLES20.glDeleteShader(f);}}
}
