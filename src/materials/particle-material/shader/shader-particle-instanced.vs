attribute vec3 instancePosition;
#if !defined(USE_WORLD_PARTICLE_BATCH) || !defined(USE_FIXED_NORMAL)
attribute vec2 instanceScale;
attribute float instanceSpin;
#endif
attribute vec4 instanceColor;
// texture-atlas subdivision cell for this instance (xy = offset, zw = scale) - see
// shader-particle.vs's uvOffsetScale for the legacy-path equivalent
attribute vec4 instanceUV;
#ifdef USE_WORLD_PARTICLE_BATCH
#ifdef USE_FIXED_NORMAL
attribute vec3 instanceRight;
attribute vec3 instanceUp;
#endif
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
    vColor = instanceColor;

    #ifdef USE_WORLD_PARTICLE_BATCH
    #ifdef USE_FIXED_NORMAL
        vec3 worldPosition = instancePosition + instanceRight * position.x + instanceUp * position.y;
    #else
        float s = sin(instanceSpin);
        float c = cos(instanceSpin);
        vec3 right = cameraBillboardRight * c + cameraBillboardUp * s;
        vec3 up = cameraBillboardUp * c - cameraBillboardRight * s;
        vec3 worldPosition = instancePosition + right * (position.x * instanceScale.x) + up * (position.y * instanceScale.y);
    #endif
    #else
    #ifdef USE_FIXED_NORMAL
        // PTDU_Normal has one emitter-local basis for every particle. Transform it
        // into world space here, matching ParticleMesh's local quaternion followed
        // by its emitter parent's model matrix.
        vec3 direction = normalize(particleProjectionNormal);
        vec3 nonParallel = abs(direction.x) < 0.5 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
        vec3 localUp = normalize(cross(nonParallel, direction));
        vec3 localRight = normalize(cross(localUp, direction));
        vec3 baseRight = normalize(mat3(modelMatrix) * -localRight);
        vec3 baseUp = normalize(mat3(modelMatrix) * -localUp);
    #else
        vec3 baseRight = cameraBillboardRight;
        vec3 baseUp = cameraBillboardUp;
    #endif

    // per-instance roll around the shared billboard basis (matches the CPU path's
    // newRight = right*cos + up*sin; newUp = up*cos - right*sin in sprite-emitter.ts)
    float s = sin(instanceSpin);
    float c = cos(instanceSpin);
    vec3 right = baseRight * c + baseUp * s;
    vec3 up = baseUp * c - baseRight * s;

    // instancePosition is emitter-local (matches the old per-particle Object3D's
    // .position, a child of the emitter) - modelMatrix carries the emitter's own
    // placement/rotation/drawScale, same as the scene graph used to do implicitly.
    // The billboard offset itself is already in world space: camera-facing bases
    // start there, while fixed-normal bases were transformed above. instanceScale
    // has the emitter's 1/drawScale baked in on the JS side to compensate for not
    // applying modelMatrix's scale to the offset here.
        vec3 anchorWorld = (modelMatrix * vec4(instancePosition, 1.0)).xyz;
        vec3 worldPosition = anchorWorld + right * (position.x * instanceScale.x) + up * (position.y * instanceScale.y);
    #endif

    vec4 mvPosition = viewMatrix * vec4(worldPosition, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    #include <logdepthbuf_vertex>
    #include <clipping_planes_vertex>
    #include <fog_vertex>
}
