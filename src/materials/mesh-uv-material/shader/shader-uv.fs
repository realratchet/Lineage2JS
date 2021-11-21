#include <common>
#include <uv_pars_fragment>
#include <logdepthbuf_pars_fragment>

void main() {
    #include <logdepthbuf_fragment>

    #if ( defined( USE_UV ) && ! defined( UVS_VERTEX_ONLY ) )
        gl_FragColor = vec4(vUv.x, vUv.y, 0.0, 1.0);
    #else
        gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);
    #endif
}