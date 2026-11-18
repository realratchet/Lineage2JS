uniform sampler2D projectorMap;
uniform int materialBlending;

vec4 getProjectorColor(vec4 vProjection, vec3 diffuse, float facing) {
    vec4 texel = texture2D(projectorMap, vProjection.xy / vProjection.w);
    if (materialBlending == PB_Modulate) texel.rgb = min(texel.rgb * diffuse * 2.0, vec3(1.0));
    if (materialBlending == PB_AlphaBlend) texel.rgb = mix(diffuse, texel.rgb, texel.a);
    #ifdef USE_FOG
        float fog = smoothstep(fogNear, fogFar, vFogDepth);
    #else
        float fog = 0.0;
    #endif

    #ifdef PROJECTOR_ALPHA
        #ifdef USE_FOG
            texel.rgb = mix(texel.rgb, fogColor, fog);
        #endif
        return vec4(texel.rgb, texel.a * facing);
    #elif defined(PROJECTOR_ADD)
        return vec4(texel.rgb * facing * (1.0 - fog), texel.a);
    #else
        return vec4(mix(vec3(127.0 / 255.0), texel.rgb, facing * (1.0 - fog)), texel.a);
    #endif
}
