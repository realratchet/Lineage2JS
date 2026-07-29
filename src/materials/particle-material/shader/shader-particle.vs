varying vec2 vUv;

// texture-atlas subdivision (ParticleEmitter TextureUSubdivisions/VSubdivisions) - which
// cell of the atlas this particle shows. xy = offset, zw = scale. Identity (0,0,1,1) for
// unsubdivided textures.
uniform vec4 uvOffsetScale;

#include <common>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

void main() {
    vUv = uv * uvOffsetScale.zw + uvOffsetScale.xy;

    #include <uv_vertex>
    #include <color_vertex>
    #include <morphcolor_vertex>

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
