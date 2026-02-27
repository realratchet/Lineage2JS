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

#if defined(USE_UV) && (defined(USE_MAP_DIFFUSE) || defined(USE_MAP_OPACITY) || defined(USE_MAP_SPECULAR) || defined(USE_MAP_SPECULAR_MASK))
    #if defined(USE_MAP_DIFFUSE_TRANSFORM) || defined(USE_MAP_OPACITY_TRANSFORM) || defined(USE_MAP_SPECULAR_TRANSFORM) || defined(USE_MAP_SPECULAR_MASK_TRANSFORM)
        struct TextureData {
            sampler2D texture;
            vec2 size;
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

vec2 rotateUV(vec2 uv, vec3 rotation, float offsetU, float offsetV, float time, int type, vec2 size) {
    float angle = 0.0;
    // Unreal rotation units: 65536 = 360 degrees. 
    // We use Yaw (rotation.y) as the primary axis for texture rotation speed in L2.
    float speed = (rotation.x + rotation.y + rotation.z); 
    float radSpeed = speed * (3.14159 / 32768.0) * 0.2;
    
    if (type == 1) { // Rotating
        angle = radSpeed * time;
    } else if (type == 2) { // Oscillating
        angle = radSpeed * sin(time);
    } else { // Fixed
        angle = radSpeed;
    }
    
    vec2 center = vec2(offsetU, offsetV) / size;
    float s = sin(angle);
    float c = cos(angle);
    uv -= center;
    vec2 rotated = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);
    return rotated + center;
}

float oscillateAxis(float val, float rate, float phase, float amplitude, float offset, int type, float time, float size) {
    // UE2 UTexOscillator::GetMatrix: S = time * rate; osc = amplitude * sin(2π * frac(S) + 2π * phase)
    float s = time * rate;
    float osc = amplitude * sin(2.0 * 3.14159265 * fract(s) + 2.0 * 3.14159265 * phase);
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

void main() {
    #ifdef USE_INSTANCED_ATTRIBUTES
        vColorInstance = colorInstance;
    #endif
    
    #ifdef USE_LIT_ATTRIBUTES
        vLitColor = lighting;
    #endif

    #include <uv_vertex>
    #include <uv2_vertex>

    #if defined(USE_UV) && defined(USE_MAP_DIFFUSE) && defined(USE_MAP_DIFFUSE_TRANSFORM)
        vUvTransformedDiffuse = uv;
        #if USE_MAP_DIFFUSE_TRANSFORM == PAN
            mat3 transformDiffuseMatrix = shDiffuse.transform.matrix;
            transformDiffuseMatrix[2].xy += (shDiffuse.transform.rate * globalTime);
            vUvTransformedDiffuse = (transformDiffuseMatrix * vec3(vUvTransformedDiffuse, 1)).xy;
        #elif USE_MAP_DIFFUSE_TRANSFORM == ROTATE
            vUvTransformedDiffuse = rotateUV(vUvTransformedDiffuse, shDiffuse.transform.rotation, shDiffuse.transform.offsetU, shDiffuse.transform.offsetV, globalTime, shDiffuse.transform.type, shDiffuse.map.size);
            vUvTransformedDiffuse = (shDiffuse.transform.matrix * vec3(vUvTransformedDiffuse, 1)).xy;
        #elif USE_MAP_DIFFUSE_TRANSFORM == OSCILLATE
            vUvTransformedDiffuse.x = oscillateAxis(vUvTransformedDiffuse.x, shDiffuse.transform.rateU, shDiffuse.transform.phaseU, shDiffuse.transform.amplitudeU, shDiffuse.transform.offsetU, shDiffuse.transform.typeU, globalTime, shDiffuse.map.size.x);
            vUvTransformedDiffuse.y = oscillateAxis(vUvTransformedDiffuse.y, shDiffuse.transform.rateV, shDiffuse.transform.phaseV, shDiffuse.transform.amplitudeV, shDiffuse.transform.offsetV, shDiffuse.transform.typeV, globalTime, shDiffuse.map.size.y);
            vUvTransformedDiffuse = (shDiffuse.transform.matrix * vec3(vUvTransformedDiffuse, 1)).xy;
        #endif
    #endif

    #if defined(USE_UV) && defined(USE_MAP_OPACITY) && defined(USE_MAP_OPACITY_TRANSFORM)
        vUvTransformedOpacity = uv;
        #if USE_MAP_OPACITY_TRANSFORM == PAN
            mat3 transformOpacityMatrix = shOpacity.transform.matrix;
            transformOpacityMatrix[2].xy += (shOpacity.transform.rate * globalTime);
            vUvTransformedOpacity = (transformOpacityMatrix * vec3(vUvTransformedOpacity, 1)).xy;
        #elif USE_MAP_OPACITY_TRANSFORM == ROTATE
            vUvTransformedOpacity = rotateUV(vUvTransformedOpacity, shOpacity.transform.rotation, shOpacity.transform.offsetU, shOpacity.transform.offsetV, globalTime, shOpacity.transform.type, shOpacity.map.size);
            vUvTransformedOpacity = (shOpacity.transform.matrix * vec3(vUvTransformedOpacity, 1)).xy;
        #elif USE_MAP_OPACITY_TRANSFORM == OSCILLATE
            vUvTransformedOpacity.x = oscillateAxis(vUvTransformedOpacity.x, shOpacity.transform.rateU, shOpacity.transform.phaseU, shOpacity.transform.amplitudeU, shOpacity.transform.offsetU, shOpacity.transform.typeU, globalTime, shOpacity.map.size.x);
            vUvTransformedOpacity.y = oscillateAxis(vUvTransformedOpacity.y, shOpacity.transform.rateV, shOpacity.transform.phaseV, shOpacity.transform.amplitudeV, shOpacity.transform.offsetV, shOpacity.transform.typeV, globalTime, shOpacity.map.size.y);
            vUvTransformedOpacity = (shOpacity.transform.matrix * vec3(vUvTransformedOpacity, 1)).xy;
        #endif
    #endif

    #if defined(USE_UV) && defined(USE_MAP_SPECULAR) && defined(USE_MAP_SPECULAR_TRANSFORM)
        vUvTransformedSpecular = uv;
        #if USE_MAP_SPECULAR_TRANSFORM == PAN
            mat3 transformSpecularMatrix = shSpecular.transform.matrix;
            transformSpecularMatrix[2].xy += (shSpecular.transform.rate * globalTime);
            vUvTransformedSpecular = (transformSpecularMatrix * vec3(vUvTransformedSpecular, 1)).xy;
        #elif USE_MAP_SPECULAR_TRANSFORM == ROTATE
            vUvTransformedSpecular = rotateUV(vUvTransformedSpecular, shSpecular.transform.rotation, shSpecular.transform.offsetU, shSpecular.transform.offsetV, globalTime, shSpecular.transform.type, shSpecular.map.size);
            vUvTransformedSpecular = (shSpecular.transform.matrix * vec3(vUvTransformedSpecular, 1)).xy;
        #elif USE_MAP_SPECULAR_TRANSFORM == OSCILLATE
            vUvTransformedSpecular.x = oscillateAxis(vUvTransformedSpecular.x, shSpecular.transform.rateU, shSpecular.transform.phaseU, shSpecular.transform.amplitudeU, shSpecular.transform.offsetU, shSpecular.transform.typeU, globalTime, shSpecular.map.size.x);
            vUvTransformedSpecular.y = oscillateAxis(vUvTransformedSpecular.y, shSpecular.transform.rateV, shSpecular.transform.phaseV, shSpecular.transform.amplitudeV, shSpecular.transform.offsetV, shSpecular.transform.typeV, globalTime, shSpecular.map.size.y);
            vUvTransformedSpecular = (shSpecular.transform.matrix * vec3(vUvTransformedSpecular, 1)).xy;
        #endif
    #endif

    #if defined(USE_UV) && defined(USE_MAP_SPECULAR_MASK) && defined(USE_MAP_SPECULAR_MASK_TRANSFORM)
        vUvTransformedSpecularMask = uv;
        #if USE_MAP_SPECULAR_MASK_TRANSFORM == PAN
            mat3 transformSpecularMaskMatrix = shSpecularMask.transform.matrix;
            transformSpecularMaskMatrix[2].xy += (shSpecularMask.transform.rate * globalTime);
            vUvTransformedSpecularMask = (transformSpecularMaskMatrix * vec3(vUvTransformedSpecularMask, 1)).xy;
        #elif USE_MAP_SPECULAR_MASK_TRANSFORM == ROTATE
            vUvTransformedSpecularMask = rotateUV(vUvTransformedSpecularMask, shSpecularMask.transform.rotation, shSpecularMask.transform.offsetU, shSpecularMask.transform.offsetV, globalTime, shSpecularMask.transform.type, shSpecularMask.map.size);
            vUvTransformedSpecularMask = (shSpecularMask.transform.matrix * vec3(vUvTransformedSpecularMask, 1)).xy;
        #elif USE_MAP_SPECULAR_MASK_TRANSFORM == OSCILLATE
            vUvTransformedSpecularMask.x = oscillateAxis(vUvTransformedSpecularMask.x, shSpecularMask.transform.rateU, shSpecularMask.transform.phaseU, shSpecularMask.transform.amplitudeU, shSpecularMask.transform.offsetU, shSpecularMask.transform.typeU, globalTime, shSpecularMask.map.size.x);
            vUvTransformedSpecularMask.y = oscillateAxis(vUvTransformedSpecularMask.y, shSpecularMask.transform.rateV, shSpecularMask.transform.phaseV, shSpecularMask.transform.amplitudeV, shSpecularMask.transform.offsetV, shSpecularMask.transform.typeV, globalTime, shSpecularMask.map.size.y);
            vUvTransformedSpecularMask = (shSpecularMask.transform.matrix * vec3(vUvTransformedSpecularMask, 1)).xy;
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