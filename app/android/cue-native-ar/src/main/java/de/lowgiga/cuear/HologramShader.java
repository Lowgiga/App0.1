package de.lowgiga.cuear;

/** GLES2 shader shared by the native draw path and the offscreen verification fixture. */
final class HologramShader {
    private HologramShader() {}
    static final String VERTEX=
        "attribute vec3 position;attribute float dashCoordinate;"+
        "uniform mat4 transform;uniform mat4 viewModel;uniform vec3 center;uniform float radius;"+
        "varying float facing;varying float light;varying float dash;"+
        "void main(){gl_Position=transform*vec4(center+radius*position,1.0);"+
        "vec3 n=(viewModel*vec4(position,0.0)).xyz;n/=max(length(n),0.00001);"+
        "facing=n.z;light=max(dot(n,normalize(vec3(-0.4,0.6,1.0))),0.0);dash=dashCoordinate;}";
    static final String FRAGMENT=
        "precision mediump float;uniform vec4 color;uniform int layer;"+
        "varying float facing;varying float light;varying float dash;"+
        "void main(){"+
        "if(layer==0){if(fract(dash*12.0)>0.48)discard;gl_FragColor=color;}"+
        "else if(layer==2){gl_FragColor=vec4(mix(color.rgb,vec3(1.0),0.30)*(0.76+0.24*light),1.0);} " +
        "else {float front=clamp(facing*0.5+0.5,0.0,1.0);"+
        "float alpha=layer==3?0.34:0.34+0.52*front;"+
        "gl_FragColor=vec4(color.rgb*(0.72+0.28*front),alpha*color.a);}}";
}
