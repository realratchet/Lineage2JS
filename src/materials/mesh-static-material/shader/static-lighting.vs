#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp usampler2D;

layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;
layout(location = 2) in float glow;
layout(location = 3) in vec3 initialColor;
uniform usampler2D offsets;
uniform usampler2D indices;
uniform sampler2D lights;
uniform mat4 matrix;
uniform uint textureWidth;
flat out uint packedLighting;

#include <actor_light>

ivec2 address(uint index) {
    return ivec2(int(index % textureWidth), int(index / textureWidth));
}

void main() {
    uint start = texelFetch(offsets, address(uint(gl_VertexID)), 0).x;
    uint end = texelFetch(offsets, address(uint(gl_VertexID) + 1u), 0).x;
    vec3 p = (matrix * vec4(position, 1.0)).xyz;
    vec3 n = normalize(mat3(matrix) * normal);
    vec3 color = initialColor;

    for (uint i = start; i < end; i++) {
        uint index = texelFetch(indices, address(i), 0).x * 3u;
        vec4 a = texelFetch(lights, address(index), 0);
        vec4 b = texelFetch(lights, address(index + 1u), 0);
        vec4 c = texelFetch(lights, address(index + 2u), 0);
        ActorLight light;
        light.position = a.xyz;
        light.radius = a.w;
        light.direction = b.xyz;
        light.cone = b.w;
        light.color = c.xyz;
        light.effect = int(c.w);
        light.isHardwareLight = false;
        light.attenuation = vec2(0.0);
        float intensity = glow * 0.5 * actorLightIntensity(light, p, n);

        if (intensity > 0.0) color = clamp(color + floor(light.color * intensity), 0.0, 255.0);
    }

    uvec3 bytes = uvec3(color);
    packedLighting = bytes.x | (bytes.y << 8u) | (bytes.z << 16u);
    gl_Position = vec4(0.0);
    gl_PointSize = 1.0;
}
