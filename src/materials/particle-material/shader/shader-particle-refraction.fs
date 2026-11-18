varying vec2 vUv;
#ifdef REFRACTION_INSTANCED
varying vec4 vColor;
#else
uniform vec3 diffuse;
uniform float opacity;
#endif
#ifndef REFRACTION_MASK
uniform sampler2D map;
uniform sampler2D refractionScene;
uniform vec2 refractionScale;
#endif
uniform float rangeFade;

#include <common>
#include <clipping_planes_pars_fragment>
#include <logdepthbuf_pars_fragment>

void main() {
    #include <clipping_planes_fragment>
    #include <logdepthbuf_fragment>
    if (rangeFade < 1.0 && rangeFade <= fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) discard;

    #ifdef REFRACTION_INSTANCED
    vec4 color = vColor;
    #else
    vec4 color = vec4(diffuse, opacity);
    #endif

    #ifdef REFRACTION_MASK
    gl_FragColor = vec4(0.0, 0.0, 0.0, color.a);
    #else
    // D3DDrv.dll SetParticleMaterial::Refraction, S_1 background and S_2 coverage.
    vec4 bump = 2.0 * texture2D(map, vUv) - 1.0;
    if (bump.a < 127.0 / 255.0) discard;
    vec2 screen = gl_FragCoord.xy / vec2(textureSize(refractionScene, 0));
    vec2 scale = min(0.4 * min(screen, 1.0 - screen), 0.5 * refractionScale);
    vec2 offset = bump.rg * color.rg * scale * vec2(1.0, -1.0);
    vec4 displaced = texture2D(refractionScene, screen + offset);
    gl_FragColor = vec4(mix(texture2D(refractionScene, screen).rgb, displaced.rgb, displaced.a), bump.a);
    #endif
}
