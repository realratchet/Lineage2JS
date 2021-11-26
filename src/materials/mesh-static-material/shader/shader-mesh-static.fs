uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
    varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <uv2_pars_fragment>
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

#ifdef USE_SPECULAR
    #ifdef USE_FADE
        struct FadeData {
            vec3 color1;
            vec3 color2;
            float period;
        };
    #endif

    struct SpecularData {
        #ifdef USE_FADE
            FadeData fadeColors;
        #endif
        #ifdef USE_MAP_SPECULAR
            uniform sampler2D map;
        #endif
    };

    uniform SpecularData shSpecular;
#endif

#ifdef USE_DIFFUSE
    struct DiffuseData {
        #ifdef USE_MAP_DIFFUSE
            uniform sampler2D map;
        #endif
    };

    uniform DiffuseData shDiffuse;
#endif

#ifdef USE_MAP_OPACITY
uniform sampler2D mapOpacity;
#endif

#ifdef USE_MAP_SPECULAR
uniform sampler2D mapSpecular;
#endif

#ifdef USE_MAP_SPECULAR_MASK
uniform sampler2D mapSpecularMask;
#endif

#ifdef USE_GLOBAL_TIME
uniform float globalTime;
#endif

#ifdef USE_TRANSFORMED_SPECULAR
varying vec2 vUvSpecular;
#endif

void main() {
    #include <clipping_planes_fragment>
    vec4 diffuseColor = vec4( diffuse, opacity );
    #include <logdepthbuf_fragment>
    
    // #include <map_fragment>
    // boomer tech
    #ifdef USE_MAP_DIFFUSEs
        vec4 texelDiffuse = texture2D(mapDiffuse, vUv);
        // texelDiffuse = mapTexelToLinear(texelDiffuse);
        diffuseColor.rgb *= texelDiffuse.rgb;
    #endif


    #ifdef USE_SPECULAR
        vec3 specularColor = vec3(1.0);

        #ifdef USE_FADE
            float mixValue = (sin(globalTime) + 1.0) / 2.0;
            specularColor = mix(shSpecular.fadeColors.color1, shSpecular.fadeColors.color2, mixValue) * 2.0;
        #else
            #ifdef USE_MAP_SPECULAR
                vec4 texelSpecular = texture2D(mapSpecular, vUvSpecular);
                specularColor = texelSpecular.rgb;
            #endif
        #endif

        
        #ifdef USE_MAP_SPECULAR_MASK
            vec4 texelSpecularMask = texture2D(mapSpecularMask, vUv);
            diffuseColor.rgb += texelSpecularMask.a * specularColor;
        #else
            diffuseColor.rgb *= specularColor;
        #endif
    #endif

    #ifdef USE_MAP_OPACITY
    vec4 texelOpacity = texture2D(mapOpacity, vUv);
    diffuseColor.rgba *= texelOpacity.a;
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
}