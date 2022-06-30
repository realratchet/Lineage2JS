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
            #if USE_MAP_DIFFUSE_TRANSFORM == PAN
                mat3 matrix;
                float rate;
            #endif
        };

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

    #ifdef USE_MAP_OPACITY_TRANSFORM
        varying vec2 vUvTransformedOpacity;
        
        struct TransformOpacityData {
            #if USE_MAP_OPACITY_TRANSFORM == PAN
                mat3 matrix;
                float rate;
            #endif
        };

        struct OpacityData {
            #ifdef USE_MAP_OPACITY
                TextureData map;

                #ifdef USE_MAP_OPACITY_TRANSFORM
                TransformOpacityData transform;
                #endif
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
            #if USE_MAP_SPECULAR_TRANSFORM == PAN
                mat3 matrix;
                float rate;
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
        };

        uniform SpecularData shSpecular;
    #endif

    #ifdef USE_MAP_SPECULAR_MASK_TRANSFORM
        varying vec2 vUvTransformedSpecularMask;
        
        struct TransformSpecularMaskData {
            #if USE_MAP_SPECULAR_MASK_TRANSFORM == PAN
                mat3 matrix;
                float rate;
            #endif
        };

        struct SpecularMaskData {
            #ifdef USE_MAP_SPECULAR_MASK
                TextureData map;

                #ifdef USE_MAP_SPECULAR_MASK_TRANSFORM
                TransformSpecularMaskData transform;
                #endif
            #endif
        };

        uniform SpecularMaskData shSpecularMask;
    #endif
#endif

#ifdef USE_DIRECTIONAL_AMBIENT
    // varying vec3 vViewPosition;
    // varying vec3 vNormal;
    #include <lights_pars_begin>

    varying vec3 vLightFront;
    varying vec3 vIndirectFront;

    #ifdef DOUBLE_SIDED
        varying vec3 vLightBack;
        varying vec3 vIndirectBack;
    #endif

     struct DirectionalAmbientLight {
        vec3 direction;
        vec3 color;
        float brightness;
    };

    void getDirectionalAmbientLightInfo( const in DirectionalAmbientLight directionalLight, const in GeometricContext geometry, out IncidentLight light ) {
        light.color = directionalLight.color;
        light.direction = directionalLight.direction;
        light.visible = true;
    }

    IncidentLight directLight;
    uniform DirectionalAmbientLight directionalAmbient;
#endif

void main() {
    #include <uv_vertex>
    #include <uv2_vertex>

    #if defined(USE_UV) && defined(USE_MAP_DIFFUSE) && defined(USE_MAP_DIFFUSE_TRANSFORM)
        mat3 transformDiffuseMatrix = shDiffuse.transform.matrix;
        
        vUvTransformedDiffuse = uv;

        #if USE_MAP_DIFFUSE_TRANSFORM == PAN
            transformDiffuseMatrix[2].xy *= (shDiffuse.transform.rate * globalTime) / shDiffuse.map.size;
        #endif

        vUvTransformedDiffuse = (transformDiffuseMatrix * vec3(vUvTransformedDiffuse, 1)).xy;
    #endif

    #if defined(USE_UV) && defined(USE_MAP_OPACITY) && defined(USE_MAP_OPACITY_TRANSFORM)
        mat3 transformOpacityMatrix = shOpacity.transform.matrix;
        
        vUvTransformedOpacity = uv;

        #if USE_MAP_OPACITY_TRANSFORM == PAN
            transformOpacityMatrix[2].xy *= (shOpacity.transform.rate * globalTime) / shOpacity.map.size;
        #endif

        vUvTransformedOpacity = (transformOpacityMatrix * vec3(vUvTransformedOpacity, 1)).xy;
    #endif

    #if defined(USE_UV) && defined(USE_MAP_SPECULAR) && defined(USE_MAP_SPECULAR_TRANSFORM)
        mat3 transformSpecularMatrix = shSpecular.transform.matrix;

        vUvTransformedSpecular = uv;

        #if USE_MAP_SPECULAR_TRANSFORM == PAN
            transformSpecularMatrix[2].xy *= (shSpecular.transform.rate * globalTime) / shSpecular.map.size;
        #endif

        vUvTransformedSpecular = (transformSpecularMatrix * vec3(vUvTransformedSpecular, 1)).xy;
    #endif

    #if defined(USE_UV) && defined(USE_MAP_SPECULAR_MASK) && defined(USE_MAP_SPECULAR_MASK_TRANSFORM)
        mat3 transformSpecularMaskMatrix = shSpecularMask.transform.matrix;
        
        vUvTransformedSpecularMask = uv;

        #if USE_MAP_SPECULAR_MASK_TRANSFORM == PAN
            transformSpecularMaskMatrix[2].xy *= (shSpecularMask.transform.rate * globalTime) / shSpecularMask.map.size;
        #endif

        vUvTransformedSpecularMask = (transformSpecularMaskMatrix * vec3(vUvTransformedSpecularMask, 1)).xy;
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
    #if defined ( USE_ENVMAP ) || defined ( USE_SKINNING ) || defined( USE_DIRECTIONAL_AMBIENT )
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

    #ifdef USE_DIRECTIONAL_AMBIENT
        // vViewPosition = -mvPosition.xyz;
        #include <lights_lambert_vertex>

        getDirectionalAmbientLightInfo( directionalAmbient, geometry, directLight );
        
        vec3 lightDir = -normalize(mat3(viewMatrix) * directLight.direction);

        dotNL = dot( geometry.normal, lightDir );
        directLightColor_Diffuse = directLight.color * directionalAmbient.brightness;
        vLightFront += saturate( dotNL ) * directLightColor_Diffuse;
        #ifdef DOUBLE_SIDED
            vLightBack += saturate( - dotNL ) * directLightColor_Diffuse;
        #endif
    #endif

    #include <fog_vertex>
}