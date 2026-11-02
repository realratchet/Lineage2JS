#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
#ifdef USE_PARTICLE_INSTANCING
attribute mat4 instanceTransform;
attribute vec4 instanceTint;
varying vec4 vInstanceTint;
#endif

void main() {
    vUv = uv;
    #include <color_vertex>
    #include <begin_vertex>
    #include <morphtarget_vertex>
    #ifdef USE_PARTICLE_INSTANCING
        transformed = (instanceTransform * vec4(transformed, 1.0)).xyz;
        vInstanceTint = instanceTint;
    #endif
    #include <project_vertex>
    #include <logdepthbuf_vertex>
    #include <clipping_planes_vertex>
    #include <worldpos_vertex>
    #include <fog_vertex>
}
