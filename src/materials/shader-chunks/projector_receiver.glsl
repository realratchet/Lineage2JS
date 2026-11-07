uniform samplerCube shadowAttenuation;
uniform mat3 shadowNormalMatrix;
uniform vec2 shadowDepthRange;
varying vec3 vProjectorNormal;
#ifdef NUM_PROJECTOR_INSTANCES
uniform mat3 shadowNormalMatrices[NUM_PROJECTOR_INSTANCES];
uniform vec2 shadowDepthRanges[NUM_PROJECTOR_INSTANCES];
#define shadowNormalMatrix shadowNormalMatrices[vShadowInstance]
#define shadowDepthRange shadowDepthRanges[vShadowInstance]
float getShadowAlpha(vec2 uv) {
    if (vShadowInstance == 0) return texture2D(shadowMaps[0], uv).a;
    if (vShadowInstance == 1) return texture2D(shadowMaps[1], uv).a;
    if (vShadowInstance == 2) return texture2D(shadowMaps[2], uv).a;
    return texture2D(shadowMaps[3], uv).a;
}
#endif

vec4 getProjectorShadow() {
    float depth = vShadowCoord.z;
    if (depth < shadowDepthRange.x || depth > shadowDepthRange.y) discard;
    vec2 uv = vShadowCoord.xy / depth;
    if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) discard;
    #ifdef NUM_PROJECTOR_INSTANCES
    float alpha = getShadowAlpha(vec2(uv.x, 1.0 - uv.y));
    #else
    float alpha = texture2D(shadowMap, vec2(uv.x, 1.0 - uv.y)).a;
    #endif
    alpha *= textureCube(shadowAttenuation, shadowNormalMatrix * normalize(vProjectorNormal)).a;
    return vec4(0.0, 0.0, 0.0, alpha * shadowDarkness);
}
