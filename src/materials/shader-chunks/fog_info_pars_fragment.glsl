#if defined(USE_FOG) && defined(USE_FOG_INFO)
    uniform sampler2D fogInfoMap;
    uniform vec3 fogInfoTexel;
    uniform float fogInfoRange;
    uniform float fogInfoOpacity;

    vec4 sampleFogInfo(vec2 uv, float tile) { return texture2D(fogInfoMap, vec2(uv.x, (clamp(uv.y, fogInfoTexel.z, 1.0 - fogInfoTexel.z) + tile) / 3.0)); }

    vec4 getFogInfo() {
        if (fogInfoOpacity <= 0.0) return vec4(0.0);

        vec2 uv = gl_FragCoord.xy * fogInfoTexel.xy;
        float slice = 64.0 * clamp(vFogDepth / fogInfoRange, 0.0, 1.0);
        float depth = dot(sampleFogInfo(uv, 0.0), clamp(slice - vec4(0.0, 1.0, 4.0, 9.0), vec4(0.0), vec4(1.0, 3.0, 5.0, 7.0))) + dot(sampleFogInfo(uv, 1.0), clamp(slice - vec4(16.0, 25.0, 36.0, 49.0), vec4(0.0), vec4(9.0, 11.0, 13.0, 15.0)));
        vec4 tint = sampleFogInfo(uv, 2.0);

        return vec4(tint.rgb / max(tint.a, 0.0001), min(depth, 1.0) * fogInfoOpacity);
    }
#endif
