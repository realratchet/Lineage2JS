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
struct TransformedSpecular {
    mat3 uvSpecularTransform;
    float specularTransformRate;
    vec2 mapSpecularSize;
};

uniform TransformedSpecular transformSpecular;
varying vec2 vUvSpecular;

#endif

void main() {
    #include <uv_vertex>
    #include <uv2_vertex>

    #ifdef USE_TRANSFORMED_SPECULAR
        mat3 matrix = transformSpecular.uvSpecularTransform;
        vUvSpecular = uv;
        #ifdef USE_SPECULAR_PAN
            matrix[2].xy *= (transformSpecular.specularTransformRate * globalTime) / transformSpecular.mapSpecularSize;
        #endif
        #ifdef USE_SPECULAR_ROTATE
        // matrix = mat3(
        //     1, 1, 0,
        //     0, 1, 0,
        //     0, 0, 1
        // );
        // matrix[2].xy *= (10.0 * globalTime) / transformSpecular.mapSpecularSize;
        // vUvSpecular = uv * globalTime;
        vUvSpecular -= vec2(25) / transformSpecular.mapSpecularSize;

        vec2 xy = globalTime / transformSpecular.mapSpecularSize;

        matrix[0].xy += vec2(+cos(xy.x), -sin(xy.y));
        matrix[1].xy += vec2(+sin(xy.x), +cos(xy.y));

        vUvSpecular = (matrix * vec3(vUvSpecular, 1)).xy;
        vUvSpecular += vec2(25) / transformSpecular.mapSpecularSize;
        #endif
        vUvSpecular = (matrix * vec3(vUvSpecular, 1)).xy;
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