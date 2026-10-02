uniform vec3 diffuse;
uniform float opacity;
varying vec2 vUv;
#ifdef USE_SUBDIVISION_BLEND
varying vec3 vSubdivisionBlend;
#endif

#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

    #include <clipping_planes_fragment>

    vec4 diffuseColor = vec4( diffuse, opacity );

    #include <logdepthbuf_fragment>
    #if defined(USE_MAP) && defined(USE_SUBDIVISION_BLEND)
    // D3DDrv.dll RVA 0xa912..0xaa2d: texture interpolation replaces alpha, then diffuse modulates RGB only.
    vec4 sampledDiffuseColor = mix(texture2D(map, vUv), texture2D(map, vSubdivisionBlend.xy), vSubdivisionBlend.z);
    diffuseColor = vec4(diffuseColor.rgb * sampledDiffuseColor.rgb, sampledDiffuseColor.a);
    #else
    #include <map_fragment>
    #endif
    #include <color_fragment>
    #include <alphamap_fragment>
    #include <alphatest_fragment>

    gl_FragColor = diffuseColor;

    #include <l2_fog_fragment>
    
    #include <premultiplied_alpha_fragment>

}
