uniform vec3 diffuse;
uniform float opacity;
#ifdef USE_TERRAIN_DECORATION_FADE
    varying float vTerrainDecorationFade;
#endif
#ifndef FLAT_SHADED
    varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>

// extended to match shader-mesh-static.vs's uv2 gating (adds USE_UV2)
#if defined(USE_LIGHTMAP) || defined(USE_AOMAP) || defined(USE_UV2)
    varying vec2 vUv2;
#endif

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

#if defined(USE_UV) && (defined(USE_MAP_DIFFUSE) || defined(USE_MAP_OPACITY) || defined(USE_MAP_SPECULAR) || defined(USE_MAP_SPECULAR_MASK) || defined(USE_MAP_MATERIAL2))
    struct TextureData {
        sampler2D texture;
        vec2 size;
    };

    #define MAX_TRANSFORM_STAGES 2

    struct TransformStage {
        int type; // PAN/ROTATE/OSCILLATE
        mat3 matrix;
        vec2 rate; // pan
        vec3 rotation; // rotate
        int rotationType; // rotate - TR_Fixed/Rotating/Oscillating (0/1/2)
        vec3 oscillationRate; // rotate
        vec3 oscillationAmplitude; // rotate
        vec3 oscillationPhase; // rotate
        float rateU, rateV; // oscillate
        float phaseU, phaseV; // oscillate
        float amplitudeU, amplitudeV; // oscillate
        int typeU, typeV; // oscillate
        float offsetU, offsetV; // rotate + oscillate
    };
#endif

#ifdef USE_DIFFUSE
    #if defined(USE_UV) && defined(USE_MAP_DIFFUSE)
        #ifdef USE_MAP_DIFFUSE_TRANSFORM
            varying vec2 vUvTransformedDiffuse;
            
            struct TransformDiffuseData {
                mat3 matrix;
                #if USE_MAP_DIFFUSE_TRANSFORM == PAN
                    vec2 rate;
                #elif USE_MAP_DIFFUSE_TRANSFORM == ROTATE
                    vec3 rotation;
                    float offsetU;
                    float offsetV;
                    int type;
                    vec3 oscillationRate;
                    vec3 oscillationAmplitude;
                    vec3 oscillationPhase;
                #elif USE_MAP_DIFFUSE_TRANSFORM == OSCILLATE
                    float rateU;
                    float rateV;
                    float phaseU;
                    float phaseV;
                    float amplitudeU;
                    float amplitudeV;
                    int typeU;
                    int typeV;
                    float offsetU;
                    float offsetV;
                #endif
            };
        #endif

        struct DiffuseData {
            #ifdef USE_MAP_DIFFUSE
                TextureData map;

                #if defined(USE_MAP_DIFFUSE_TRANSFORM) && USE_MAP_DIFFUSE_TRANSFORM != ENVMAP && USE_MAP_DIFFUSE_TRANSFORM != ENVMAPWORLD
                TransformDiffuseData transform;

                #ifdef USE_MAP_DIFFUSE_TRANSFORM_CHAIN
                    TransformStage innerTransforms[MAX_TRANSFORM_STAGES];
                    int numInnerTransforms;
                #endif
                #endif
            #endif
        };

        uniform DiffuseData shDiffuse;
    #endif

    #ifdef USE_UV
        #if defined(USE_MAP_DIFFUSE) && defined(USE_MAP_DIFFUSE_TRANSFORM)
            #define UV_DIFFUSE vUvTransformedDiffuse
        #elif defined(USE_MAP_DIFFUSE_UV2)
            #define UV_DIFFUSE vUv2
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
                mat3 matrix;
                #if USE_MAP_OPACITY_TRANSFORM == PAN
                    vec2 rate;
                #elif USE_MAP_OPACITY_TRANSFORM == ROTATE
                    vec3 rotation;
                    float offsetU;
                    float offsetV;
                    int type;
                    vec3 oscillationRate;
                    vec3 oscillationAmplitude;
                    vec3 oscillationPhase;
                #elif USE_MAP_OPACITY_TRANSFORM == OSCILLATE
                    float rateU;
                    float rateV;
                    float phaseU;
                    float phaseV;
                    float amplitudeU;
                    float amplitudeV;
                    int typeU;
                    int typeV;
                    float offsetU;
                    float offsetV;
                #endif
            };
        #endif


        struct OpacityData {
            #ifdef USE_MAP_OPACITY
                TextureData map;
            #endif
            #if defined(USE_MAP_OPACITY_TRANSFORM) && USE_MAP_OPACITY_TRANSFORM != ENVMAP && USE_MAP_OPACITY_TRANSFORM != ENVMAPWORLD
                TransformOpacityData transform;

                #ifdef USE_MAP_OPACITY_TRANSFORM_CHAIN
                    TransformStage innerTransforms[MAX_TRANSFORM_STAGES];
                    int numInnerTransforms;
                #endif
            #endif
        };

        uniform OpacityData shOpacity;
    #endif

    #ifdef USE_UV
        #if defined(USE_MAP_OPACITY) && defined(USE_MAP_OPACITY_TRANSFORM)
            #define UV_OPACITY vUvTransformedOpacity
        #elif defined(USE_MAP_OPACITY_UV2)
            #define UV_OPACITY vUv2
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
                float phase;
                int fadeType;
            };
        #endif

        #ifdef USE_MAP_SPECULAR_TRANSFORM
            varying vec2 vUvTransformedSpecular;
            
            struct TransformSpecularData {
                mat3 matrix;
                #if USE_MAP_SPECULAR_TRANSFORM == PAN
                    vec2 rate;
                #elif USE_MAP_SPECULAR_TRANSFORM == ROTATE
                    vec3 rotation;
                    float offsetU;
                    float offsetV;
                    int type;
                    vec3 oscillationRate;
                    vec3 oscillationAmplitude;
                    vec3 oscillationPhase;
                #elif USE_MAP_SPECULAR_TRANSFORM == OSCILLATE
                    float rateU;
                    float rateV;
                    float phaseU;
                    float phaseV;
                    float amplitudeU;
                    float amplitudeV;
                    int typeU;
                    int typeV;
                    float offsetU;
                    float offsetV;
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

            #if defined(USE_MAP_SPECULAR_TRANSFORM) && USE_MAP_SPECULAR_TRANSFORM != ENVMAP && USE_MAP_SPECULAR_TRANSFORM != ENVMAPWORLD
                TransformSpecularData transform;

                #ifdef USE_MAP_SPECULAR_TRANSFORM_CHAIN
                    TransformStage innerTransforms[MAX_TRANSFORM_STAGES];
                    int numInnerTransforms;
                #endif
            #endif
        };

        uniform SpecularData shSpecular;
    #endif

    #ifdef USE_UV
        #if defined(USE_MAP_SPECULAR) && defined(USE_MAP_SPECULAR_TRANSFORM)
            #define UV_SPECULAR vUvTransformedSpecular
        #elif defined(USE_MAP_SPECULAR_UV2)
            #define UV_SPECULAR vUv2
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
                mat3 matrix;
                #if USE_MAP_SPECULAR_MASK_TRANSFORM == PAN
                    vec2 rate;
                #elif USE_MAP_SPECULAR_MASK_TRANSFORM == ROTATE
                    vec3 rotation;
                    float offsetU;
                    float offsetV;
                    int type;
                    vec3 oscillationRate;
                    vec3 oscillationAmplitude;
                    vec3 oscillationPhase;
                #elif USE_MAP_SPECULAR_MASK_TRANSFORM == OSCILLATE
                    float rateU;
                    float rateV;
                    float phaseU;
                    float phaseV;
                    float amplitudeU;
                    float amplitudeV;
                    int typeU;
                    int typeV;
                    float offsetU;
                    float offsetV;
                #endif
            };
        #endif

        struct SpecularMaskData {
            #ifdef USE_MAP_SPECULAR_MASK
                TextureData map;
            #endif
            #if defined(USE_MAP_SPECULAR_MASK_TRANSFORM) && USE_MAP_SPECULAR_MASK_TRANSFORM != ENVMAP && USE_MAP_SPECULAR_MASK_TRANSFORM != ENVMAPWORLD
                TransformSpecularMaskData transform;

                #ifdef USE_MAP_SPECULAR_MASK_TRANSFORM_CHAIN
                    TransformStage innerTransforms[MAX_TRANSFORM_STAGES];
                    int numInnerTransforms;
                #endif
            #endif
        };

        uniform SpecularMaskData shSpecularMask;
    #endif

    #ifdef USE_UV
        #if defined(USE_MAP_SPECULAR_MASK) && defined(USE_MAP_SPECULAR_MASK_TRANSFORM)
            #define UV_SPECULAR_MASK vUvTransformedSpecularMask
        #elif defined(USE_MAP_SPECULAR_MASK_UV2)
            #define UV_SPECULAR_MASK vUv2
        #else
            #define UV_SPECULAR_MASK vUv
        #endif
    #endif
#endif

#ifdef USE_MATERIAL2
    #if defined(USE_UV) && defined(USE_MAP_MATERIAL2)
        #ifdef USE_MAP_MATERIAL2_TRANSFORM
            varying vec2 vUvTransformedMaterial2;
            
            struct TransformMaterial2Data {
                mat3 matrix;
                #if USE_MAP_MATERIAL2_TRANSFORM == PAN
                    float rate;
                #elif USE_MAP_MATERIAL2_TRANSFORM == ROTATE
                    vec3 rotation;
                    float offsetU;
                    float offsetV;
                    int type;
                    vec3 oscillationRate;
                    vec3 oscillationAmplitude;
                    vec3 oscillationPhase;
                #elif USE_MAP_MATERIAL2_TRANSFORM == OSCILLATE
                    float rateU;
                    float rateV;
                    float phaseU;
                    float phaseV;
                    float amplitudeU;
                    float amplitudeV;
                    int typeU;
                    int typeV;
                    float offsetU;
                    float offsetV;
                #endif
            };
        #endif

        struct Material2Data {
            #ifdef USE_MAP_MATERIAL2
                TextureData map;

                #ifdef USE_MAP_MATERIAL2_TRANSFORM
                TransformMaterial2Data transform;
                #endif
            #endif
        };

        uniform Material2Data shMaterial2;
    #endif

    #ifdef USE_UV
        #if defined(USE_MAP_MATERIAL2) && defined(USE_MAP_MATERIAL2_TRANSFORM)
            #define UV_MATERIAL2 vUvTransformedMaterial2
        #elif defined(USE_MAP_MATERIAL2_UV2)
            #define UV_MATERIAL2 vUv2
        #else
            #define UV_MATERIAL2 vUv
        #endif
    #endif
#endif

#ifdef USE_COMBINER
    struct CombinerData {
        int combineMode;
        bool invertMask;
        bool alphaFrom1;
        bool alphaFrom2;
    };
    uniform CombinerData combiner;
#endif

#ifdef USE_GLOBAL_TIME_SECONDS
    uniform float globalTimeSeconds;
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

#if defined(USE_LIT_ATTRIBUTES) || defined(USE_ACTOR_LIGHTS)
    varying vec3 vLitColor;
#endif

#if !defined(USE_ACTOR_LIGHTS) && !defined(NO_SHADOW_RECEIVE)
    uniform sampler2D shadowMap;
    uniform float shadowDarkness;
    uniform float shadowActive;
    varying vec4 vShadowCoord;
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

    #ifdef USE_COMBINER
        vec3 color1 = diffuseColor.rgb;
        float alpha1 = diffuseColor.a;
        
        vec4 color2 = vec4(1.0);
        #ifdef USE_MATERIAL2
            #ifdef USE_MAP_MATERIAL2
                color2 = texture2D(shMaterial2.map.texture, UV_MATERIAL2);
            #endif
        #endif
        
        float maskVal = 1.0;
        #ifdef USE_SPECULAR
            #ifdef USE_MAP_SPECULAR
                 maskVal = texture2D(shSpecular.map.texture, UV_SPECULAR).g;
            #endif
        #endif
        
        if (combiner.invertMask) maskVal = 1.0 - maskVal;
        
        if (combiner.combineMode == 1) { // Modulate
            diffuseColor.rgb = color1 * color2.rgb;
        } else if (combiner.combineMode == 2) { // Modulate2X
            diffuseColor.rgb = color1 * color2.rgb * 2.0;
        } else if (combiner.combineMode == 3) { // Modulate4X
            diffuseColor.rgb = color1 * color2.rgb * 4.0;
        } else if (combiner.combineMode == 4) { // Add
            diffuseColor.rgb = color1 + color2.rgb;
        } else if (combiner.combineMode == 5) { // Subtract
            diffuseColor.rgb = color1 - color2.rgb;
        } else if (combiner.combineMode == 6) { // AlphaBlend
            diffuseColor.rgb = mix(color2.rgb, color1, maskVal);
        } else if (combiner.combineMode == 7) { // Use Color From Material2
            diffuseColor.rgb = color2.rgb;
        }
        
        if (combiner.alphaFrom1) diffuseColor.a = alpha1;
        else if (combiner.alphaFrom2) diffuseColor.a = color2.a;
    #endif


    #ifdef USE_OPACITY
        #ifdef USE_MAP_OPACITY
            vec4 texelOpacity = texture2D(shOpacity.map.texture, UV_OPACITY);
            
            diffuseColor.a *= texelOpacity.a;
        #endif
    #endif


    #include <color_fragment>

    
    // #ifdef USE_LIT_ATTRIBUTES
    //     diffuseColor.rgb += vLitColor;
    // #endif

    // #include <alphamap_fragment>


    #include <alphatest_fragment>
    // #include <specularmap_fragment>
    
    // accumulation (baked indirect lighting only)
    #ifdef USE_LIGHTMAP
        vec4 lightMapTexel = texture2D( lightMap, vUv2 );
        // reflectedLight.indirectDiffuse += lightMapTexelToLinear( lightMapTexel ).rgb * lightMapIntensity;
        reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity;
    #else
        #if !defined(USE_AMBIENT) && !defined(USE_INSTANCED_ATTRIBUTES) && !defined(USE_LIT_ATTRIBUTES) && !defined(USE_ACTOR_LIGHTS)
            reflectedLight.indirectDiffuse += vec3( 1.0 );
        #endif

        // D3DTOP_MODULATE2X: static mesh relight dispatcher (0x90d33d) passes EnableLighting Modulate2X=1
        #if defined(USE_LIT_ATTRIBUTES) || defined(USE_ACTOR_LIGHTS)
            reflectedLight.indirectDiffuse += vLitColor * 2.0;
        #endif

        #ifdef USE_INSTANCED_ATTRIBUTES
            reflectedLight.indirectDiffuse += vColorInstance * 2.0;
        #endif
    #endif

    #ifdef USE_AMBIENT
        reflectedLight.indirectDiffuse += ambient.brightness * ambient.color * 2.0;
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
            // UFadeColor::GetColor (UnMaterial.cpp line 332): Time = (TimeSeconds + FadePhase) / FadePeriod
            float fadeTime = (globalTimeSeconds + shSpecular.fadeColors.phase) / shSpecular.fadeColors.period;
            float fadePercent;

            if (shSpecular.fadeColors.fadeType == 1) {
                fadePercent = 0.5 + cos(fadeTime * PI * 0.5) * 0.5;
            } else {
                float fadeCycle = floor(fadeTime);
                float fadeFrac = fadeTime - fadeCycle;
                fadePercent = (mod(fadeCycle, 2.0) != 0.0) ? fadeFrac : 1.0 - fadeFrac;
            }

            float mixValue = 1.0 - fadePercent;
            specularColor = mix(shSpecular.fadeColors.color1, shSpecular.fadeColors.color2, mixValue) * 2.0;
        #else
            #ifdef USE_MAP_SPECULAR
                vec4 texelSpecular = texture2D(shSpecular.map.texture, UV_SPECULAR);
                specularColor = texelSpecular.rgb;
            #endif
        #endif

        
        #ifdef USE_MAP_SPECULAR_MASK
            vec4 texelSpecularMask = texture2D(shSpecularMask.map.texture, UV_SPECULAR_MASK);
            #ifdef USE_SELF_ILLUMINATION
                // D3DTOP_BLENDCURRENTALPHA over CURRENT, which is indirectDiffuse here - directDiffuse is 0 unlit
                reflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, specularColor, texelSpecularMask.a);
                // that op's alpha comes from D3DTOP_SELECTARG1, D3DTA_TEXTURE on the mask stage
                diffuseColor.a = texelSpecularMask.a;
            #else
                reflectedLight.directDiffuse += texelSpecularMask.a * specularColor;
            #endif
        #else
            reflectedLight.directDiffuse *= specularColor;
        #endif
    #endif

    vec3 outgoingLight = reflectedLight.indirectDiffuse + reflectedLight.directDiffuse;

    #if !defined(USE_ACTOR_LIGHTS) && !defined(NO_SHADOW_RECEIVE)
        if ( shadowActive > 0.0 && vShadowCoord.w > 0.0 ) {
            vec3 shadowCoord = vShadowCoord.xyz / vShadowCoord.w;

            if ( all( greaterThanEqual( shadowCoord, vec3( 0.0 ) ) ) && all( lessThanEqual( shadowCoord, vec3( 1.0 ) ) ) )
                outgoingLight *= 1.0 - texture2D( shadowMap, shadowCoord.xy ).a * shadowDarkness;
        }
    #endif
    
    #include <envmap_fragment>
    #include <output_fragment>
    #include <tonemapping_fragment>
    #include <encodings_fragment>

    #ifdef USE_TERRAIN_DECORATION_FADE
        gl_FragColor.a *= vTerrainDecorationFade;
    #endif

    #include <l2_fog_fragment>

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
