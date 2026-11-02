#include <common>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
#if defined(USE_LIT_ATTRIBUTES) || defined(USE_ACTOR_LIGHTS)
    varying vec3 vLitColor;
#endif
#ifdef USE_INSTANCED_ATTRIBUTES
    varying vec3 vColorInstance;
#endif

void main() {
    #include <clipping_planes_fragment>
    #include <logdepthbuf_fragment>
    vec3 lighting = vec3(1.0);
    #if defined(USE_LIT_ATTRIBUTES) || defined(USE_ACTOR_LIGHTS)
        lighting = vLitColor * 2.0;
    #elif defined(USE_INSTANCED_ATTRIBUTES)
        lighting = vColorInstance * 2.0;
    #endif
    gl_FragColor = vec4(clamp(lighting * (200.0 / 255.0), 0.0, 1.0), 64.0 / 255.0);
    #include <l2_fog_fragment>
}
