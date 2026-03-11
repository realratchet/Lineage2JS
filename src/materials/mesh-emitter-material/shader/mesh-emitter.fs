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
    
    #ifdef USE_FOG
        #ifdef FOG_EXP2
            float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
        #else
            float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
        #endif

        #ifdef USE_ADDITIVE_FOG
            vec3 fogMixColor = vec3(0.0);
        #else
            vec3 fogMixColor = fogColor;
        #endif

        gl_FragColor.rgb = mix( gl_FragColor.rgb, fogMixColor, fogFactor );
    #endif
    
    #include <tonemapping_fragment>
    #include <encodings_fragment>
}
