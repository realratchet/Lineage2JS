#ifdef USE_SKILL_LIGHTS
uniform int skillLightCount;
uniform vec4 skillLightPositions[8];
uniform vec3 skillLightColors[8];
varying vec3 vSkillLightPosition;
varying vec3 vSkillLightNormal;

vec3 getSkillLight() {
    if (skillLightCount == 0) return vec3(0.0);
    vec3 color = vec3(0.0);
    vec3 normal = normalize(vSkillLightNormal);
    #ifdef DOUBLE_SIDED
        normal *= gl_FrontFacing ? 1.0 : -1.0;
    #endif
    for (int i = 0; i < 8; i++) {
        if (i >= skillLightCount) break;
        vec3 offset = skillLightPositions[i].xyz - vSkillLightPosition;
        float distance = length(offset);
        float alpha = distance / skillLightPositions[i].w;
        float attenuation = max(0.0, 1.0 - alpha);
        float incidence = max(0.0, dot(normal, offset / max(distance, 0.0001)));
        color += skillLightColors[i] * (4.0 * attenuation * attenuation * (1.0 + 2.0 * alpha) * incidence);
    }
    return color;
}
#endif
