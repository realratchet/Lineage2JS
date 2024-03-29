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

#if defined(USE_UV) && (defined(USE_MAP_DIFFUSE) || defined(USE_MAP_OPACITY) || defined(USE_MAP_SPECULAR) || defined(USE_MAP_SPECULAR_MASK))
    struct TextureData {
        sampler2D texture;
        vec2 size;
    };
#endif

#ifdef USE_DIFFUSE
    #if defined(USE_UV) && defined(USE_MAP_DIFFUSE)
        #ifdef USE_MAP_DIFFUSE_TRANSFORM
            varying vec2 vUvTransformedDiffuse;
            
            struct TransformDiffuseData {
                #if USE_MAP_DIFFUSE_TRANSFORM == PAN
                    mat3 matrix;
                    float rate;
                #endif
            };
        #endif

        struct DiffuseData {
            #ifdef USE_MAP_DIFFUSE
                TextureData map;

                #ifdef USE_MAP_DIFFUSE_TRANSFORM
                TransformDiffuseData transform;
                #endif
            #endif
        };

        uniform DiffuseData shDiffuse;
    #endif

    #ifdef USE_UV
        #if defined(USE_MAP_DIFFUSE) && defined(USE_MAP_DIFFUSE_TRANSFORM)
            #define UV_DIFFUSE vUvTransformedDiffuse
        #else
            #define UV_DIFFUSE vUv
        #endif
    #endif
#endif

#ifdef USE_OPACITY
    #if defined(USE_MAP_OPACITY)
        #ifdef USE_MAP_OPACITY_TRANSFORM
            varying vec2 vUvTransformedOpacity;
            
            struct TransformOpacityData {
                #if USE_MAP_OPACITY_TRANSFORM == PAN
                    mat3 matrix;
                    float rate;
                #endif
            };
        #endif


        struct OpacityData {
            #ifdef USE_MAP_OPACITY
                TextureData map;
            #endif
            #ifdef USE_MAP_OPACITY_TRANSFORM
                TransformOpacityData transform;
            #endif
        };

        uniform OpacityData shOpacity;
    #endif

    #ifdef USE_UV
        #if defined(USE_MAP_OPACITY) && defined(USE_MAP_OPACITY_TRANSFORM)
            #define UV_OPACITY vUvTransformedOpacity
        #else
            #define UV_OPACITY vUv
        #endif
    #endif
#endif

#ifdef USE_SPECULAR
    #if defined(USE_MAP_SPECULAR) || defined(USE_FADE)
        #ifdef USE_FADE
            struct FadeData {
                vec3 color1;
                vec3 color2;
                float period;
            };
        #endif

        #ifdef USE_MAP_SPECULAR_TRANSFORM
            varying vec2 vUvTransformedSpecular;
            
            struct TransformSpecularData {
                #if USE_MAP_SPECULAR_TRANSFORM == PAN
                    mat3 matrix;
                    float rate;
                #endif
            };
        #endif

        struct SpecularData {
            #ifdef USE_FADE
                FadeData fadeColors;
            #endif

            #ifdef USE_MAP_SPECULAR
                TextureData map;
            #endif

            #ifdef USE_MAP_SPECULAR_TRANSFORM
                TransformSpecularData transform;
            #endif
        };

        uniform SpecularData shSpecular;
    #endif

    #ifdef USE_UV
        #if defined(USE_MAP_SPECULAR) && defined(USE_MAP_SPECULAR_TRANSFORM)
            #define UV_SPECULAR vUvTransformedSpecular
        #else
            #define UV_SPECULAR vUv
        #endif
    #endif
#endif

#ifdef USE_SPECULAR_MASK
    #if defined(USE_MAP_SPECULAR_MASK)

        #ifdef USE_MAP_SPECULAR_MASK_TRANSFORM
            varying vec2 vUvTransformedSpecularMask;
            
            struct TransformSpecularMaskData {
                #if USE_MAP_SPECULAR_MASK_TRANSFORM == PAN
                    mat3 matrix;
                    float rate;
                #endif
            };
        #endif

        struct SpecularMaskData {
            #ifdef USE_MAP_SPECULAR_MASK
                TextureData map;
            #endif
            #ifdef USE_MAP_SPECULAR_MASK_TRANSFORM
                TransformSpecularMaskData transform;
            #endif
        };

        uniform SpecularMaskData shSpecularMask;
    #endif

    #ifdef USE_UV
        #if defined(USE_MAP_SPECULAR_MASK) && defined(USE_MAP_SPECULAR_MASK_TRANSFORM)
            #define UV_SPECULAR_MASK vUvTransformedSpecularMask
        #else
            #define UV_SPECULAR_MASK vUv
        #endif
    #endif
#endif

#ifdef USE_GLOBAL_TIME
    uniform float globalTime;
#endif

#ifdef USE_AMBIENT
    struct AmbientLighting {
        vec3 color;
        float brightness;
    };

    uniform AmbientLighting ambient;
#endif

#include <bsdfs>

#if NUM_SPOT_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_HEMI_LIGHTS > 0
    #define HAS_LIGHTS

    varying vec3 vLightFront;
    varying vec3 vIndirectFront;
    #ifdef DOUBLE_SIDED
        varying vec3 vLightBack;
        varying vec3 vIndirectBack;
    #endif

#endif

// #ifdef USE_DIRECTIONAL_AMBIENT

//     varying vec3 vLightFront;
//     varying vec3 vIndirectFront;
//     #ifdef DOUBLE_SIDED
//         varying vec3 vLightBack;
//         varying vec3 vIndirectBack;
//     #endif

// #endif

#ifdef USE_INSTANCED_ATTRIBUTES
    varying vec3 vColorInstance;
#endif

void main() {
    #include <clipping_planes_fragment>
    vec4 diffuseColor = vec4( diffuse, opacity );
    #include <logdepthbuf_fragment>

    ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
    
    // #include <map_fragment>
    // boomer tech
    #ifdef USE_DIFFUSE
        #ifdef USE_MAP_DIFFUSE
            vec4 texelDiffuse = texture2D(shDiffuse.map.texture, UV_DIFFUSE);
            // texelDiffuse = mapTexelToLinear(texelDiffuse);
            diffuseColor.rgb *= texelDiffuse.rgb;

            #ifdef USE_MASKING
                diffuseColor.a *= texelDiffuse.a;
            #endif
        #endif
    #endif

    #ifdef USE_OPACITY
        #ifdef USE_MAP_OPACITY
            vec4 texelOpacity = texture2D(shOpacity.map.texture, UV_OPACITY);
            
            diffuseColor.rgba *= texelOpacity.a;
            
            // if (texelOpacity.a < 0.5)
            //     discard;
        #endif
    #endif

    #include <color_fragment>
    

    // #include <alphamap_fragment>


    #include <alphatest_fragment>
    // #include <specularmap_fragment>
    
    // accumulation (baked indirect lighting only)
    #ifdef USE_LIGHTMAP
        vec4 lightMapTexel = texture2D( lightMap, vUv2 );
        // reflectedLight.indirectDiffuse += lightMapTexelToLinear( lightMapTexel ).rgb * lightMapIntensity;
        reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity;
    #else
        #ifdef HAS_LIGHTS
            reflectedLight.indirectDiffuse += vec3( 0.0 );
        #elif !defined(USE_AMBIENT) && !defined(USE_INSTANCED_ATTRIBUTES)
            reflectedLight.indirectDiffuse += vec3( 1.0 );
        #endif

        #ifdef USE_INSTANCED_ATTRIBUTES
            reflectedLight.indirectDiffuse += vColorInstance;
        #endif

        #ifdef USE_AMBIENT
            reflectedLight.indirectDiffuse += ambient.brightness * ambient.color;
        #endif
    #endif

    #ifdef HAS_LIGHTS
        #ifdef DOUBLE_SIDED
            reflectedLight.indirectDiffuse += ( gl_FrontFacing ) ? vIndirectFront : vIndirectBack;
        #else
            reflectedLight.indirectDiffuse += vIndirectFront;
        #endif
        #include <lightmap_fragment>
        reflectedLight.indirectDiffuse *= BRDF_Lambert( diffuseColor.rgb );
        #ifdef DOUBLE_SIDED
            reflectedLight.directDiffuse = ( gl_FrontFacing ) ? vLightFront : vLightBack;
        #else
            reflectedLight.directDiffuse = vLightFront;
        #endif
        reflectedLight.directDiffuse *= BRDF_Lambert( diffuseColor.rgb ) ;//c6c* getShadowMask();
    #endif
    
    // modulation
    #include <aomap_fragment>
    
    reflectedLight.indirectDiffuse *= diffuseColor.rgb;
    
    #ifdef USE_SPECULAR
        vec3 specularColor = vec3(1.0);

        #ifdef USE_FADE
            float mixValue = (sin(globalTime) + 1.0) / 2.0;
            specularColor = mix(shSpecular.fadeColors.color1, shSpecular.fadeColors.color2, mixValue) * 2.0;
        #else
            #ifdef USE_MAP_SPECULAR
                vec4 texelSpecular = texture2D(shSpecular.map.texture, UV_SPECULAR);
                specularColor = texelSpecular.rgb;
            #endif
        #endif

        
        #ifdef USE_MAP_SPECULAR_MASK
            vec4 texelSpecularMask = texture2D(shSpecularMask.map.texture, UV_SPECULAR_MASK);
            reflectedLight.directDiffuse += texelSpecularMask.a * specularColor;
        #else
            reflectedLight.directDiffuse *= specularColor;
        #endif
    #endif

    vec3 outgoingLight = reflectedLight.indirectDiffuse + reflectedLight.directDiffuse;
    
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

    // #ifdef USE_LIGHTMAP
    //     // gl_FragColor = vec4(vUv2, 0.0, 1.0);
    //     // gl_FragColor = texture2D( lightMap, vUv2 );
    // #endif

    // gl_FragColor = vec4((directLight.color * (saturate( dot( geometry.normal, directLight.direction ) ))) * BRDF_Lambert( material.diffuseColor ) * 10.0, 1.0);

    // gl_FragColor.a = texture2D(shDiffuse.map.texture, UV_DIFFUSE).a;
}