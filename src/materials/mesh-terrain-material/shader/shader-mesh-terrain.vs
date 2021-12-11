#include <common>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

#ifdef USE_UV
    varying vec2 vUv;
#endif

#ifdef USE_UV_2
    attribute vec2 uv2;
    varying vec2 vUv2;
#endif

#ifdef USE_UV_3
    attribute vec2 uv3;
    varying vec2 vUv3;
#endif

#ifdef USE_UV_4
    attribute vec2 uv4;
    varying vec2 vUv4;
#endif

#ifdef USE_UV_5
    attribute vec2 uv5;
    varying vec2 vUv5;
#endif

#ifdef USE_UV_6
    attribute vec2 uv6;
    varying vec2 vUv6;
#endif

#ifdef USE_UV_7
    attribute vec2 uv7;
    varying vec2 vUv7;
#endif

#ifdef USE_UV_8
    attribute vec2 uv8;
    varying vec2 vUv8;
#endif

#ifdef USE_UV_9
    attribute vec2 uv9;
    varying vec2 vUv9;
#endif

#if defined(USE_UV) || defined(USE_UV_2) || defined(USE_UV_3) || defined(USE_UV_4) || defined(USE_UV_5) || defined(USE_UV_6) || defined(USE_UV_7) || defined(USE_UV_8) || defined(USE_UV_9)
    uniform mat3 uvTransform;
#endif

void main() {
    #ifdef USE_UV
        vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
    #endif

    #ifdef USE_UV_2
        vUv2 = ( uvTransform * vec3( uv2, 1 ) ).xy;
    #endif

    #ifdef USE_UV_3
        vUv3 = ( uvTransform * vec3( uv3, 1 ) ).xy;
    #endif

    #ifdef USE_UV_4
        vUv4 = ( uvTransform * vec3( uv4, 1 ) ).xy;
    #endif

    #ifdef USE_UV_5
        vUv5 = ( uvTransform * vec3( uv5, 1 ) ).xy;
    #endif

    #ifdef USE_UV_6
        vUv6 = ( uvTransform * vec3( uv6, 1 ) ).xy;
    #endif

    #ifdef USE_UV_7
        vUv7 = ( uvTransform * vec3( uv7, 1 ) ).xy;
    #endif

    #ifdef USE_UV_8
        vUv8 = ( uvTransform * vec3( uv8, 1 ) ).xy;
    #endif

    #ifdef USE_UV_9
        vUv9 = ( uvTransform * vec3( uv9, 1 ) ).xy;
    #endif

    #include <color_vertex>
    #if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
        #include <beginnormal_vertex>
        #include <morphnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <defaultnormal_vertex>
    #endif
    #include <begin_vertex>
    #include <morphtarget_vertex>
    #include <skinning_vertex>
    #include <project_vertex>
    #include <logdepthbuf_vertex>
    #include <clipping_planes_vertex>
    #include <worldpos_vertex>
    #include <envmap_vertex>
    #include <fog_vertex>
}