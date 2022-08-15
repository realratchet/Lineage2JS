uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
    varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
// #include <uv_pars_fragment>
// #include <uv2_pars_fragment>
// #include <map_pars_fragment>
// #include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <fog_pars_fragment>
// #include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

#ifdef USE_UV_TEXTURE
    #pragma params_include_layers

    vec4 addLayer(vec4 foreground, vec4 background) {
        return foreground * foreground.a + background * (1.0 - foreground.a);
    }

    varying vec2 vUv[UV_COUNT];
#endif

void main() {
    #include <clipping_planes_fragment>
    vec4 diffuseColor = vec4( diffuse, opacity );
    #include <logdepthbuf_fragment>

    #ifdef USE_UV_TEXTURE
        // vec2 uv;
        vec4 layer, layerMask;
        vec4 texelDiffuse;

        #pragma include_layers
    #else
        vec4 texelDiffuse = vec4(1.0);
    #endif

    diffuseColor.rgb *= texelDiffuse.rgb;

    #include <color_fragment>
    

    // #include <alphamap_fragment>


    #include <alphatest_fragment>
    // #include <specularmap_fragment>
    ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
    // accumulation (baked indirect lighting only)
    #ifdef USE_LIGHTMAP
        vec4 lightMapTexel= texture2D( lightMap, vUv2 );
        reflectedLight.indirectDiffuse += lightMapTexelToLinear( lightMapTexel ).rgb * lightMapIntensity;
    #else
        reflectedLight.indirectDiffuse += vec3( 1.0 );
    #endif
    // modulation
    #include <aomap_fragment>
    reflectedLight.indirectDiffuse *= diffuseColor.rgb;
    vec3 outgoingLight = reflectedLight.indirectDiffuse;
    #include <envmap_fragment>
    #include <output_fragment>
    #include <tonemapping_fragment>
    #include <encodings_fragment>
    #include <fog_fragment>
    #include <premultiplied_alpha_fragment>
    #include <dithering_fragment>

    // #ifdef USE_MAP_SPECULAR
    // // gl_FragColor = vec4(vUvSpecular.x, vUvSpecular.y, 0.0, 1.0);
    // // vec4 texelSpecular = texture2D(mapSpecular, vUv).aaaa;
    // // gl_FragColor = vec4(specularColor.rgb, 1.0);
    // #endif

    // gl_FragColor = vec4(texture2D(shDiffuse.map.texture, vUv).rgb, 1.0);

    // gl_FragColor = vec4(vUv, 0.0, 1.0);

    // gl_FragColor = vec4(vVertexIndex / float(VERTEX_COUNT), 0.0, 0.0, 1.0);

    // gl_FragColor = vec4(vUv[MASK_UV_INDEX], 0.0, 1.0);
    // gl_FragColor = addLayer(vec4(texture2D(layer1.map.texture, vUv[MASK_UV_INDEX]).rgb, 1.0), texelDiffuse) * texture2D(layer0.alphaMap.texture, vUv[MASK_UV_INDEX]).r;

    // gl_FragColor = vec4(vColor, 1.0);
}