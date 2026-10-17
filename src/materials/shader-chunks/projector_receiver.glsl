uniform samplerCube shadowAttenuation;
uniform mat3 shadowNormalMatrix;
uniform vec2 shadowDepthRange;
varying vec3 vProjectorNormal;

vec4 getProjectorShadow() {
    float depth = vShadowCoord.z;
    if (depth < shadowDepthRange.x || depth > shadowDepthRange.y) discard;
    vec2 uv = vShadowCoord.xy / depth;
    if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) discard;
    float alpha = texture2D(shadowMap, vec2(uv.x, 1.0 - uv.y)).a;
    alpha *= textureCube(shadowAttenuation, shadowNormalMatrix * normalize(vProjectorNormal)).a;
    return vec4(0.0, 0.0, 0.0, alpha * shadowDarkness);
}
