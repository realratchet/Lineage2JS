#include <common>
#include <uv_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>

void main() {
    #include <uv_vertex>
    #include <begin_vertex>
    #include <morphtarget_vertex>
    #include <skinning_vertex>
    #include <project_vertex>
    #include <logdepthbuf_vertex>
    #include <worldpos_vertex>
}