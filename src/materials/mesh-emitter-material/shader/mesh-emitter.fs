uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D map;

varying vec2 vUv;

#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {
    #include <clipping_planes_fragment>
    
    vec4 texelColor = texture2D( map, vUv );
    vec4 diffuseColor = vec4( diffuse, opacity );
    
    diffuseColor *= texelColor;
    
    #include <logdepthbuf_fragment>
    #include <color_fragment>
    
    gl_FragColor = diffuseColor;
    
    #include <l2_fog_fragment>
    
    #include <tonemapping_fragment>
    #include <encodings_fragment>
}
