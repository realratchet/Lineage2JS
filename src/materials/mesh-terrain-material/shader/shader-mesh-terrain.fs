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

#if defined(USE_LAYER_1) || defined(USE_LAYER_2) || defined(USE_LAYER_3) || defined(USE_LAYER_4) || defined(USE_LAYER_5) || defined(USE_LAYER_6) || defined(USE_LAYER_7) || defined(USE_LAYER_8) || defined(USE_LAYER_9)
    struct TextureData {
        sampler2D texture;
        vec2 size;
    };
#endif

#ifdef USE_LAYER_1
    struct Layer1Data {
        #ifdef USE_LAYER_1_DIFFUSE
            TextureData map;
        #endif
        #ifdef USE_LAYER_1_OPACITY
            TextureData alphaMap;
        #endif
    };

    varying vec2 vUv;
    uniform Layer1Data layer1;
#endif

#ifdef USE_LAYER_2
    struct Layer2Data {
        #ifdef USE_LAYER_2_DIFFUSE
            TextureData map;
        #endif
        #ifdef USE_LAYER_2_OPACITY
            TextureData alphaMap;
        #endif
    };

    varying vec2 vUv2;
    uniform Layer2Data layer2;
#endif

#ifdef USE_LAYER_3
    struct Layer3Data {
        #ifdef USE_LAYER_3_DIFFUSE
            TextureData map;
        #endif
        #ifdef USE_LAYER_3_OPACITY
            TextureData alphaMap;
        #endif
    };

    varying vec2 vUv3;
    uniform Layer3Data layer3;
#endif

// #ifdef USE_LAYER_4
//     varying vec2 vUv4;
//     uniform LayerData layer4;
// #endif

// #ifdef USE_LAYER_5
//     varying vec2 vUv5;
//     uniform LayerData layer5;
// #endif

// #ifdef USE_LAYER_6
//     varying vec2 vUv6;
//     uniform LayerData layer6;
// #endif

// #ifdef USE_LAYER_7
//     varying vec2 vUv7;
//     uniform LayerData layer7;
// #endif

// #ifdef USE_LAYER_8
//     varying vec2 vUv8;
//     uniform LayerData layer8;
// #endif

// #ifdef USE_LAYER_9
//     varying vec2 vUv9;
//     uniform LayerData layer9;
// #endif

vec4 addLayer(vec4 foreground, vec4 background) {
    return foreground * foreground.a + background * (1.0 - foreground.a);
}

void main() {
    #include <clipping_planes_fragment>
    vec4 diffuseColor = vec4( diffuse, opacity );
    #include <logdepthbuf_fragment>

    #if defined(USE_LAYER_1) || defined(USE_LAYER_2) || defined(USE_LAYER_3) || defined(USE_LAYER_4) || defined(USE_LAYER_5) || defined(USE_LAYER_6) || defined(USE_LAYER_7) || defined(USE_LAYER_8) || defined(USE_LAYER_9)
        vec4 layer;
        vec4 texelDiffuse = vec4(0.0);
    #endif

    #ifdef USE_LAYER_1
        layer = vec4(texture2D(layer1.map.texture, vUv).rgb, 1.0) * texture2D(layer1.alphaMap.texture, vUv).r;

        texelDiffuse = addLayer(layer, texelDiffuse);
    #endif

    // #ifdef USE_LAYER_1
    //     vec4 layer1 = vec4(texture2D(layer1.map.texture, vUv).rgb, 1.0) * texture2D(layer1.alphaMap.texture, vUv).r;
    //     vec4 layer2 = vec4(texture2D(layer2.map.texture, vUv).rgb, 1.0) * texture2D(layer2.alphaMap.texture, vUv).r;
        

    //     vec4 texelDiffuse = layer(layer2, layer1);

    //     // vec4 texelDiffuse1 = texture2D(layer1.map.texture, vUv) * texture2D(layer1.alphaMap.texture, vUv);
    //     // vec4 texelDiffuse2 = texture2D(layer2.map.texture, vUv) * texture2D(layer2.alphaMap.texture, vUv);
    //     // texelDiffuse = mapTexelToLinear(texelDiffuse);
    //     diffuseColor.rgb *= texelDiffuse.rgb;
    //     // dicks;
    // #endif

    #if defined(USE_LAYER_1) || defined(USE_LAYER_2) || defined(USE_LAYER_3) || defined(USE_LAYER_4) || defined(USE_LAYER_5) || defined(USE_LAYER_6) || defined(USE_LAYER_7) || defined(USE_LAYER_8) || defined(USE_LAYER_9)
    #endif


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
}