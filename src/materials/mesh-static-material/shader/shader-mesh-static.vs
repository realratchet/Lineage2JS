#include <common>
#include <uv_pars_vertex>

// three's uv2 chunk only gates on USE_LIGHTMAP/USE_AOMAP, extended with USE_UV2
#if defined(USE_LIGHTMAP) || defined(USE_AOMAP) || defined(USE_UV2)
    attribute vec2 uv2;
    varying vec2 vUv2;
    uniform mat3 uv2Transform;
#endif

#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

#if defined(USE_GLOBAL_TIME_SECONDS) || defined(USE_SWAY)
    uniform float globalTimeSeconds;
#endif

#ifdef USE_SWAY
    attribute vec4 sway;
#endif

#if defined(USE_UV) && (defined(USE_MAP_DIFFUSE) || defined(USE_MAP_OPACITY) || defined(USE_MAP_SPECULAR) || defined(USE_MAP_SPECULAR_MASK))
    #if defined(USE_MAP_DIFFUSE_TRANSFORM) || defined(USE_MAP_OPACITY_TRANSFORM) || defined(USE_MAP_SPECULAR_TRANSFORM) || defined(USE_MAP_SPECULAR_MASK_TRANSFORM)
        struct TextureData {
            sampler2D texture;
            vec2 size;
        };

        #define MAX_TRANSFORM_STAGES 2

        // nested UV transforms, flattened innermost-first by material-decoder.ts
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

        struct DiffuseData {
            #ifdef USE_MAP_DIFFUSE
                TextureData map;

                #ifdef USE_MAP_DIFFUSE_TRANSFORM
                    TransformDiffuseData transform;

                    #ifdef USE_MAP_DIFFUSE_TRANSFORM_CHAIN
                        TransformStage innerTransforms[MAX_TRANSFORM_STAGES];
                        int numInnerTransforms;
                    #endif
                #endif
            #endif
            #ifdef USE_COLOR_MODIFIER
                vec4 modifierColor;
            #endif
        };

        uniform DiffuseData shDiffuse;
    #endif

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

        struct OpacityData {
            #ifdef USE_MAP_OPACITY
                TextureData map;

                #ifdef USE_MAP_OPACITY_TRANSFORM
                TransformOpacityData transform;

                #ifdef USE_MAP_OPACITY_TRANSFORM_CHAIN
                    TransformStage innerTransforms[MAX_TRANSFORM_STAGES];
                    int numInnerTransforms;
                #endif
                #endif
            #endif
            #ifdef USE_COLOR_MODIFIER
                vec4 modifierColor;
            #endif
        };

        uniform OpacityData shOpacity;
    #endif

    #ifdef USE_MAP_SPECULAR_TRANSFORM
        varying vec2 vUvTransformedSpecular;

        #ifdef USE_FADE
            struct FadeData {
                vec3 color1;
                vec3 color2;
                float period;
                float phase;
                int fadeType;
            };
        #endif
        
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

        struct SpecularData {
            #ifdef USE_MAP_SPECULAR
                TextureData map;

                #ifdef USE_FADE
                    FadeData fadeColors;
                #endif

                #ifdef USE_MAP_SPECULAR_TRANSFORM
                    TransformSpecularData transform;

                    #ifdef USE_MAP_SPECULAR_TRANSFORM_CHAIN
                        TransformStage innerTransforms[MAX_TRANSFORM_STAGES];
                        int numInnerTransforms;
                    #endif
                #endif
            #endif
            #ifdef USE_COLOR_MODIFIER
                vec4 modifierColor;
            #endif
        };

        uniform SpecularData shSpecular;
    #endif

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

        struct SpecularMaskData {
            #ifdef USE_MAP_SPECULAR_MASK
                TextureData map;

                #ifdef USE_MAP_SPECULAR_MASK_TRANSFORM
                TransformSpecularMaskData transform;

                #ifdef USE_MAP_SPECULAR_MASK_TRANSFORM_CHAIN
                    TransformStage innerTransforms[MAX_TRANSFORM_STAGES];
                    int numInnerTransforms;
                #endif
                #endif
            #endif
            #ifdef USE_COLOR_MODIFIER
                vec4 modifierColor;
            #endif
        };

        uniform SpecularMaskData shSpecularMask;
    #endif
#endif


#if NUM_SPOT_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_HEMI_LIGHTS > 0
    #define HAS_LIGHTS
    #include <lights_pars_begin>
#endif

#ifdef USE_INSTANCED_ATTRIBUTES
    attribute vec3 colorInstance;
    varying vec3 vColorInstance;
#endif

#ifdef USE_LIT_ATTRIBUTES
    attribute vec3 lighting;
    varying vec3 vLitColor;
#endif

// #ifdef USE_DIRECTIONAL_AMBIENT
//     // varying vec3 vViewPosition;
//     // varying vec3 vNormal;

//     varying vec3 vLightFront;
//     varying vec3 vIndirectFront;

//     #ifdef DOUBLE_SIDED
//         varying vec3 vLightBack;
//         varying vec3 vIndirectBack;
//     #endif

//      struct DirectionalAmbientLight {
//         vec3 direction;
//         vec3 color;
//         float brightness;
//     };

//     void getDirectionalAmbientLightInfo( const in DirectionalAmbientLight directionalLight, const in GeometricContext geometry, out IncidentLight light ) {
//         light.color = directionalLight.color;
//         light.direction = directionalLight.direction;
//         light.visible = true;
//     }

//     IncidentLight directLight;
//     uniform DirectionalAmbientLight directionalAmbient;
// #endif

vec2 rotateUV(vec2 uv, vec3 rotation, vec3 oscillationRate, vec3 oscillationAmplitude, vec3 oscillationPhase, float offsetU, float offsetV, float timeSeconds, int type, vec2 size) {
    float angle = 0.0;
    // UTexRotator::GetMatrix uses rotation units per second (UnMaterial.cpp line 537).
    float rotationAngle = (rotation.x + rotation.y + rotation.z) * PI / 32768.0;

    if (type == 1) { // Rotating
        angle = rotationAngle * timeSeconds;
    } else if (type == 2) { // Oscillating - UTexRotator::GetMatrix TR_OscillatingRotation (UnMaterial.cpp line 550-558)
        vec3 s = timeSeconds * oscillationRate / 65535.0;
        vec3 d = oscillationAmplitude * sin(PI2 * (fract(s) + oscillationPhase));
        angle = rotationAngle + (d.x + d.y + d.z) * PI / 32768.0;
    } else { // Fixed
        angle = rotationAngle;
    }
    
    vec2 center = vec2(offsetU, offsetV) / size;
    float s = sin(angle);
    float c = cos(angle);
    uv -= center;
    vec2 rotated = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);
    return rotated + center;
}

float oscillateAxis(float val, float rate, float phase, float amplitude, float offset, int type, float timeSeconds, float size) {
    // UTexOscillator::GetMatrix uses TimeSeconds * OscillationRate (UnMaterial.cpp line 637).
    float s = timeSeconds * rate;
    float cycle = type == 2 ? PI_HALF : PI2;
    float osc = amplitude * sin(cycle * fract(s) + PI2 * phase);
    float off = offset / size;
    if (type == 0) { // Pan — UE2: M.M[2][0] = du (direct UV translation, no division by size)
        return val + osc;
    } else if (type == 1 || type == 2) { // Stretch — UE2: M.M[0][0] = 1.0 + du
        return (val - off) * (1.0 + osc) + off;
    } else if (type == 3) { // Jitter — UE2: M.M[2][0] = random * amplitude
        return val + amplitude;
    }
    return val;
}

#if defined(USE_MAP_DIFFUSE_TRANSFORM_CHAIN) || defined(USE_MAP_OPACITY_TRANSFORM_CHAIN) || defined(USE_MAP_SPECULAR_TRANSFORM_CHAIN) || defined(USE_MAP_SPECULAR_MASK_TRANSFORM_CHAIN)
    vec2 applyTransformStage(vec2 uv, TransformStage stage, float timeSeconds, vec2 size) {
        if (stage.type == PAN) {
            mat3 m = stage.matrix;
            m[2].xy += (stage.rate * timeSeconds);
            return (m * vec3(uv, 1)).xy;
        } else if (stage.type == ROTATE) {
            uv = rotateUV(uv, stage.rotation, stage.oscillationRate, stage.oscillationAmplitude, stage.oscillationPhase, stage.offsetU, stage.offsetV, timeSeconds, stage.rotationType, size);
            return (stage.matrix * vec3(uv, 1)).xy;
        } else if (stage.type == OSCILLATE) {
            uv.x = oscillateAxis(uv.x, stage.rateU, stage.phaseU, stage.amplitudeU, stage.offsetU, stage.typeU, timeSeconds, size.x);
            uv.y = oscillateAxis(uv.y, stage.rateV, stage.phaseV, stage.amplitudeV, stage.offsetV, stage.typeV, timeSeconds, size.y);
            return (stage.matrix * vec3(uv, 1)).xy;
        }
        return uv;
    }
#endif

void main() {
    #ifdef USE_INSTANCED_ATTRIBUTES
        vColorInstance = colorInstance;
    #endif
    
    #ifdef USE_LIT_ATTRIBUTES
        vLitColor = lighting;
    #endif

    #include <uv_vertex>

    #if defined(USE_LIGHTMAP) || defined(USE_AOMAP) || defined(USE_UV2)
        vUv2 = ( uv2Transform * vec3( uv2, 1 ) ).xy;
    #endif

    #if defined(USE_UV) && defined(USE_MAP_DIFFUSE) && defined(USE_MAP_DIFFUSE_TRANSFORM)
        #ifdef USE_MAP_DIFFUSE_UV2
            vUvTransformedDiffuse = vUv2;
        #else
            vUvTransformedDiffuse = uv;
        #endif
        #if USE_MAP_DIFFUSE_TRANSFORM == PAN
            mat3 transformDiffuseMatrix = shDiffuse.transform.matrix;
            transformDiffuseMatrix[2].xy += (shDiffuse.transform.rate * globalTimeSeconds);
            vUvTransformedDiffuse = (transformDiffuseMatrix * vec3(vUvTransformedDiffuse, 1)).xy;
        #elif USE_MAP_DIFFUSE_TRANSFORM == ROTATE
            vUvTransformedDiffuse = rotateUV(vUvTransformedDiffuse, shDiffuse.transform.rotation, shDiffuse.transform.oscillationRate, shDiffuse.transform.oscillationAmplitude, shDiffuse.transform.oscillationPhase, shDiffuse.transform.offsetU, shDiffuse.transform.offsetV, globalTimeSeconds, shDiffuse.transform.type, shDiffuse.map.size);
            vUvTransformedDiffuse = (shDiffuse.transform.matrix * vec3(vUvTransformedDiffuse, 1)).xy;
        #elif USE_MAP_DIFFUSE_TRANSFORM == OSCILLATE
            vUvTransformedDiffuse.x = oscillateAxis(vUvTransformedDiffuse.x, shDiffuse.transform.rateU, shDiffuse.transform.phaseU, shDiffuse.transform.amplitudeU, shDiffuse.transform.offsetU, shDiffuse.transform.typeU, globalTimeSeconds, shDiffuse.map.size.x);
            vUvTransformedDiffuse.y = oscillateAxis(vUvTransformedDiffuse.y, shDiffuse.transform.rateV, shDiffuse.transform.phaseV, shDiffuse.transform.amplitudeV, shDiffuse.transform.offsetV, shDiffuse.transform.typeV, globalTimeSeconds, shDiffuse.map.size.y);
            vUvTransformedDiffuse = (shDiffuse.transform.matrix * vec3(vUvTransformedDiffuse, 1)).xy;
        #endif
        #ifdef USE_MAP_DIFFUSE_TRANSFORM_CHAIN
            // UTexModifier::Matrix accumulates outer-to-inner
            for (int i = MAX_TRANSFORM_STAGES - 1; i >= 0; i--) {
                if (i >= shDiffuse.numInnerTransforms) continue;
                vUvTransformedDiffuse = applyTransformStage(vUvTransformedDiffuse, shDiffuse.innerTransforms[i], globalTimeSeconds, shDiffuse.map.size);
            }
        #endif
    #endif

    #if defined(USE_UV) && defined(USE_MAP_OPACITY) && defined(USE_MAP_OPACITY_TRANSFORM)
        #ifdef USE_MAP_OPACITY_UV2
            vUvTransformedOpacity = vUv2;
        #else
            vUvTransformedOpacity = uv;
        #endif
        #if USE_MAP_OPACITY_TRANSFORM == PAN
            mat3 transformOpacityMatrix = shOpacity.transform.matrix;
            transformOpacityMatrix[2].xy += (shOpacity.transform.rate * globalTimeSeconds);
            vUvTransformedOpacity = (transformOpacityMatrix * vec3(vUvTransformedOpacity, 1)).xy;
        #elif USE_MAP_OPACITY_TRANSFORM == ROTATE
            vUvTransformedOpacity = rotateUV(vUvTransformedOpacity, shOpacity.transform.rotation, shOpacity.transform.oscillationRate, shOpacity.transform.oscillationAmplitude, shOpacity.transform.oscillationPhase, shOpacity.transform.offsetU, shOpacity.transform.offsetV, globalTimeSeconds, shOpacity.transform.type, shOpacity.map.size);
            vUvTransformedOpacity = (shOpacity.transform.matrix * vec3(vUvTransformedOpacity, 1)).xy;
        #elif USE_MAP_OPACITY_TRANSFORM == OSCILLATE
            vUvTransformedOpacity.x = oscillateAxis(vUvTransformedOpacity.x, shOpacity.transform.rateU, shOpacity.transform.phaseU, shOpacity.transform.amplitudeU, shOpacity.transform.offsetU, shOpacity.transform.typeU, globalTimeSeconds, shOpacity.map.size.x);
            vUvTransformedOpacity.y = oscillateAxis(vUvTransformedOpacity.y, shOpacity.transform.rateV, shOpacity.transform.phaseV, shOpacity.transform.amplitudeV, shOpacity.transform.offsetV, shOpacity.transform.typeV, globalTimeSeconds, shOpacity.map.size.y);
            vUvTransformedOpacity = (shOpacity.transform.matrix * vec3(vUvTransformedOpacity, 1)).xy;
        #endif
        #ifdef USE_MAP_OPACITY_TRANSFORM_CHAIN
            for (int i = MAX_TRANSFORM_STAGES - 1; i >= 0; i--) {
                if (i >= shOpacity.numInnerTransforms) continue;
                vUvTransformedOpacity = applyTransformStage(vUvTransformedOpacity, shOpacity.innerTransforms[i], globalTimeSeconds, shOpacity.map.size);
            }
        #endif
    #endif

    #if defined(USE_UV) && defined(USE_MAP_SPECULAR) && defined(USE_MAP_SPECULAR_TRANSFORM)
        #ifdef USE_MAP_SPECULAR_UV2
            vUvTransformedSpecular = vUv2;
        #else
            vUvTransformedSpecular = uv;
        #endif
        #if USE_MAP_SPECULAR_TRANSFORM == PAN
            mat3 transformSpecularMatrix = shSpecular.transform.matrix;
            transformSpecularMatrix[2].xy += (shSpecular.transform.rate * globalTimeSeconds);
            vUvTransformedSpecular = (transformSpecularMatrix * vec3(vUvTransformedSpecular, 1)).xy;
        #elif USE_MAP_SPECULAR_TRANSFORM == ROTATE
            vUvTransformedSpecular = rotateUV(vUvTransformedSpecular, shSpecular.transform.rotation, shSpecular.transform.oscillationRate, shSpecular.transform.oscillationAmplitude, shSpecular.transform.oscillationPhase, shSpecular.transform.offsetU, shSpecular.transform.offsetV, globalTimeSeconds, shSpecular.transform.type, shSpecular.map.size);
            vUvTransformedSpecular = (shSpecular.transform.matrix * vec3(vUvTransformedSpecular, 1)).xy;
        #elif USE_MAP_SPECULAR_TRANSFORM == OSCILLATE
            vUvTransformedSpecular.x = oscillateAxis(vUvTransformedSpecular.x, shSpecular.transform.rateU, shSpecular.transform.phaseU, shSpecular.transform.amplitudeU, shSpecular.transform.offsetU, shSpecular.transform.typeU, globalTimeSeconds, shSpecular.map.size.x);
            vUvTransformedSpecular.y = oscillateAxis(vUvTransformedSpecular.y, shSpecular.transform.rateV, shSpecular.transform.phaseV, shSpecular.transform.amplitudeV, shSpecular.transform.offsetV, shSpecular.transform.typeV, globalTimeSeconds, shSpecular.map.size.y);
            vUvTransformedSpecular = (shSpecular.transform.matrix * vec3(vUvTransformedSpecular, 1)).xy;
        #endif
        #ifdef USE_MAP_SPECULAR_TRANSFORM_CHAIN
            for (int i = MAX_TRANSFORM_STAGES - 1; i >= 0; i--) {
                if (i >= shSpecular.numInnerTransforms) continue;
                vUvTransformedSpecular = applyTransformStage(vUvTransformedSpecular, shSpecular.innerTransforms[i], globalTimeSeconds, shSpecular.map.size);
            }
        #endif
    #endif

    #if defined(USE_UV) && defined(USE_MAP_SPECULAR_MASK) && defined(USE_MAP_SPECULAR_MASK_TRANSFORM)
        #ifdef USE_MAP_SPECULAR_MASK_UV2
            vUvTransformedSpecularMask = vUv2;
        #else
            vUvTransformedSpecularMask = uv;
        #endif
        #if USE_MAP_SPECULAR_MASK_TRANSFORM == PAN
            mat3 transformSpecularMaskMatrix = shSpecularMask.transform.matrix;
            transformSpecularMaskMatrix[2].xy += (shSpecularMask.transform.rate * globalTimeSeconds);
            vUvTransformedSpecularMask = (transformSpecularMaskMatrix * vec3(vUvTransformedSpecularMask, 1)).xy;
        #elif USE_MAP_SPECULAR_MASK_TRANSFORM == ROTATE
            vUvTransformedSpecularMask = rotateUV(vUvTransformedSpecularMask, shSpecularMask.transform.rotation, shSpecularMask.transform.oscillationRate, shSpecularMask.transform.oscillationAmplitude, shSpecularMask.transform.oscillationPhase, shSpecularMask.transform.offsetU, shSpecularMask.transform.offsetV, globalTimeSeconds, shSpecularMask.transform.type, shSpecularMask.map.size);
            vUvTransformedSpecularMask = (shSpecularMask.transform.matrix * vec3(vUvTransformedSpecularMask, 1)).xy;
        #elif USE_MAP_SPECULAR_MASK_TRANSFORM == OSCILLATE
            vUvTransformedSpecularMask.x = oscillateAxis(vUvTransformedSpecularMask.x, shSpecularMask.transform.rateU, shSpecularMask.transform.phaseU, shSpecularMask.transform.amplitudeU, shSpecularMask.transform.offsetU, shSpecularMask.transform.typeU, globalTimeSeconds, shSpecularMask.map.size.x);
            vUvTransformedSpecularMask.y = oscillateAxis(vUvTransformedSpecularMask.y, shSpecularMask.transform.rateV, shSpecularMask.transform.phaseV, shSpecularMask.transform.amplitudeV, shSpecularMask.transform.offsetV, shSpecularMask.transform.typeV, globalTimeSeconds, shSpecularMask.map.size.y);
            vUvTransformedSpecularMask = (shSpecularMask.transform.matrix * vec3(vUvTransformedSpecularMask, 1)).xy;
        #endif
        #ifdef USE_MAP_SPECULAR_MASK_TRANSFORM_CHAIN
            for (int i = MAX_TRANSFORM_STAGES - 1; i >= 0; i--) {
                if (i >= shSpecularMask.numInnerTransforms) continue;
                vUvTransformedSpecularMask = applyTransformStage(vUvTransformedSpecularMask, shSpecularMask.innerTransforms[i], globalTimeSeconds, shSpecularMask.map.size);
            }
        #endif
    #endif



    // #ifdef USE_TRANSFORMED_SPECULAR
    //     mat3 matrix = transformSpecular.uvSpecularTransform;
    //     vUvSpecular = uv;
    //     #ifdef USE_SPECULAR_PAN
    //         matrix[2].xy *= (transformSpecular.specularTransformRate * globalTime) / transformSpecular.mapSpecularSize;
    //     #endif
    //     #ifdef USE_SPECULAR_ROTATE
    //     // matrix = mat3(
    //     //     1, 1, 0,
    //     //     0, 1, 0,
    //     //     0, 0, 1
    //     // );
    //     // matrix[2].xy *= (10.0 * globalTime) / transformSpecular.mapSpecularSize;
    //     // vUvSpecular = uv * globalTime;
    //     vUvSpecular -= vec2(25) / transformSpecular.mapSpecularSize;

    //     vec2 xy = globalTime / transformSpecular.mapSpecularSize;

    //     matrix[0].xy += vec2(+cos(xy.x), -sin(xy.y));
    //     matrix[1].xy += vec2(+sin(xy.x), +cos(xy.y));

    //     vUvSpecular = (matrix * vec3(vUvSpecular, 1)).xy;
    //     vUvSpecular += vec2(25) / transformSpecular.mapSpecularSize;
    //     #endif
    //     vUvSpecular = (matrix * vec3(vUvSpecular, 1)).xy;
    // #endif

    #include <color_vertex>
    #if defined ( USE_ENVMAP ) || defined ( USE_SKINNING ) || defined( HAS_LIGHTS )
        #include <beginnormal_vertex>
        #include <morphnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <defaultnormal_vertex>
    #endif
    #include <begin_vertex>
    #ifdef USE_SWAY
        float swayPivotZ = sway.x;
        float swayPeriod = sway.y;
        float swayMaxAngle = sway.z;
        float swayPhase = sway.w;

        if (swayPeriod > 0.0 && swayMaxAngle != 0.0) {
            float swayAngle = sin(globalTimeSeconds / swayPeriod * PI2 + swayPhase) * radians(swayMaxAngle);
            float swayHeight = max(transformed.z - swayPivotZ, 0.0);
            transformed.xy += vec2(cos(swayPhase), sin(swayPhase)) * tan(swayAngle) * swayHeight;
        }
    #endif
    #include <morphtarget_vertex>
    #include <skinning_vertex>
    #include <project_vertex>
    #include <logdepthbuf_vertex>
    #include <clipping_planes_vertex>
    #include <worldpos_vertex>
    #include <envmap_vertex>

    #ifdef HAS_LIGHTS
        #include <lights_lambert_vertex>
    #endif
    // #ifdef USE_DIRECTIONAL_AMBIENT
    ///     #include <lights_lambert_vertex>
    //     // vViewPosition = -mvPosition.xyz;

    //     getDirectionalAmbientLightInfo( directionalAmbient, geometry, directLight );
        
    //     vec3 lightDir = -normalize(mat3(viewMatrix) * directLight.direction);

    //     dotNL = dot( geometry.normal, lightDir );
    //     directLightColor_Diffuse = directLight.color * directionalAmbient.brightness;
    //     vLightFront += saturate( dotNL ) * directLightColor_Diffuse;
    //     #ifdef DOUBLE_SIDED
    //         vLightBack += saturate( - dotNL ) * directLightColor_Diffuse;
    //     #endif
    // #endif

    #include <fog_vertex>
}
