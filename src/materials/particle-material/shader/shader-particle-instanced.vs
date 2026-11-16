attribute vec3 instancePosition;
#ifndef USE_WORLD_PARTICLE_BATCH
attribute vec2 instanceScale;
attribute float instanceSpin;
#endif
attribute vec4 instanceColor;
attribute vec4 instanceUV;
#ifdef USE_SUBDIVISION_BLEND
attribute vec3 instanceUVBlend;
varying vec3 vSubdivisionBlend;
#endif
#ifdef USE_VELOCITY_UP
attribute vec3 instanceDirection;
uniform vec3 particleViewLocation;
#endif
#ifdef USE_WORLD_PARTICLE_BATCH
attribute vec3 instanceRight;
attribute vec3 instanceUp;
#endif

varying vec2 vUv;
varying vec4 vColor;

uniform vec3 cameraBillboardRight;
uniform vec3 cameraBillboardUp;
uniform vec3 particleProjectionNormal;

#include <common>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

void main() {
    vUv = uv * instanceUV.zw + instanceUV.xy;
    #ifdef USE_SUBDIVISION_BLEND
    vSubdivisionBlend = vec3(uv * instanceUV.zw + instanceUVBlend.xy, instanceUVBlend.z);
    #endif
    vColor = instanceColor;

    #ifdef USE_WORLD_PARTICLE_BATCH
        vec3 worldPosition = instancePosition + instanceRight * position.x + instanceUp * position.y;
    #elif defined(USE_VELOCITY_UP)
        vec3 viewCross = cross(instancePosition - particleViewLocation, instanceDirection);
        float viewCrossLength = length(viewCross);
        vec3 localRight = viewCrossLength > 0.0 ? viewCross / viewCrossLength : vec3(0.0);
        vec3 localUp = instanceDirection;
        float s = sin(instanceSpin);
        float c = cos(instanceSpin);
        vec3 right = -(localRight * c + localUp * s);
        vec3 up = -(localUp * c - localRight * s);
        vec3 worldPosition = (modelMatrix * vec4(instancePosition + right * (position.x * instanceScale.x) + up * (position.y * instanceScale.y), 1.0)).xyz;
    #else
        mat3 modelBasis = mat3(modelMatrix);
    #ifdef USE_FIXED_NORMAL
        vec3 direction = normalize(particleProjectionNormal);
        vec3 nonParallel = abs(direction.x) < 0.5 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
        vec3 localUp = normalize(cross(nonParallel, direction));
        vec3 localRight = normalize(cross(localUp, direction));
        vec3 baseRight = -localRight;
        vec3 baseUp = -localUp;
    #else
        vec3 axisX = normalize(modelBasis[0]);
        vec3 axisY = normalize(modelBasis[1]);
        vec3 axisZ = normalize(modelBasis[2]);
        vec3 rowX = cross(axisY, axisZ);
        vec3 rowY = cross(axisZ, axisX);
        vec3 rowZ = cross(axisX, axisY);
        float determinant = dot(axisX, rowX);
        vec3 baseRight = -normalize(vec3(dot(rowX, cameraBillboardRight), dot(rowY, cameraBillboardRight), dot(rowZ, cameraBillboardRight)) / determinant);
        vec3 baseUp = -normalize(vec3(dot(rowX, cameraBillboardUp), dot(rowY, cameraBillboardUp), dot(rowZ, cameraBillboardUp)) / determinant);
    #endif

    float s = sin(instanceSpin);
    float c = cos(instanceSpin);
    vec3 right = baseRight * c + baseUp * s;
    vec3 up = baseUp * c - baseRight * s;

        vec3 anchorWorld = (modelMatrix * vec4(instancePosition, 1.0)).xyz;
        vec3 worldPosition = anchorWorld + modelBasis * (right * (position.x * instanceScale.x) + up * (position.y * instanceScale.y));
    #endif

    vec4 mvPosition = viewMatrix * vec4(worldPosition, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    #include <logdepthbuf_vertex>
    #include <clipping_planes_vertex>
    #include <fog_vertex>
}
