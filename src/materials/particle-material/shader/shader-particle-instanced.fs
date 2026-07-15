varying vec2 vUv;
varying vec4 vColor;

#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

    #include <clipping_planes_fragment>

    vec4 diffuseColor = vColor;

    #include <logdepthbuf_fragment>
    #include <map_fragment>
    #include <alphamap_fragment>
    #include <alphatest_fragment>

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
        gl_FragColor.a = max(gl_FragColor.a, 0.0);
    #endif

    #include <premultiplied_alpha_fragment>

}
