#include <common>
#include <uv_pars_vertex>
#include <uv2_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

#ifdef USE_GLOBAL_TIME
uniform float globalTime;
#endif

#ifdef USE_TRANSFORMED_SPECULAR
uniform mat3 uvSpecularTransform;
uniform float specularTransformRate;
varying vec2 vUvSpecular;
#endif

void main() {
    #include <uv_vertex>
    #include <uv2_vertex>

    #ifdef USE_TRANSFORMED_SPECULAR
        vUvSpecular = (uvTransform * vec3(uv, 1)).xy;
        vUvSpecular += vec2(0.1 * globalTime, 0.0);
        // vUvSpecular = (uvSpecularTransform * vec3(uv, 1)).xy;// * (specularTransformRate * globalTime);
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