varying vec2 vUv;
varying vec4 vColor;
#ifdef USE_SUBDIVISION_BLEND
varying vec3 vSubdivisionBlend;
#endif

#include <common>
#ifdef USE_MAP
uniform sampler2D map;
#endif
#include <alphatest_pars_fragment>
uniform float rangeFade;
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

    #include <clipping_planes_fragment>
    if (rangeFade < 1.0 && rangeFade <= fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) discard;

    vec4 diffuseColor = vColor;

    #include <logdepthbuf_fragment>
    #if defined(USE_MAP) && defined(USE_SUBDIVISION_BLEND)
    // D3DDrv.dll RVA 0xa912..0xaa2d: texture interpolation replaces alpha, then diffuse modulates RGB only.
    vec4 sampledDiffuseColor = mix(texture2D(map, vUv), texture2D(map, vSubdivisionBlend.xy), vSubdivisionBlend.z);
    diffuseColor = vec4(diffuseColor.rgb * sampledDiffuseColor.rgb, sampledDiffuseColor.a);
    #elif defined(USE_MAP)
    diffuseColor *= texture2D(map, vUv);
    #endif
    #include <alphatest_fragment>

    gl_FragColor = diffuseColor;

    #include <l2_fog_fragment>

    #include <premultiplied_alpha_fragment>

}
