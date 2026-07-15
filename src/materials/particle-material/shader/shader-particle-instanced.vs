attribute vec3 instancePosition;
attribute vec2 instanceScale;
attribute float instanceSpin;
attribute vec4 instanceColor;
// texture-atlas subdivision cell for this instance (xy = offset, zw = scale) - see
// shader-particle.vs's uvOffsetScale for the legacy-path equivalent
attribute vec4 instanceUV;

varying vec2 vUv;
varying vec4 vColor;

uniform vec3 cameraBillboardRight;
uniform vec3 cameraBillboardUp;

#include <common>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

void main() {
    vUv = uv * instanceUV.zw + instanceUV.xy;
    vColor = instanceColor;

    // per-instance roll around the shared camera-facing basis (matches the CPU path's
    // newRight = right*cos + up*sin; newUp = up*cos - right*sin in sprite-emitter.ts)
    float s = sin(instanceSpin);
    float c = cos(instanceSpin);
    vec3 right = cameraBillboardRight * c + cameraBillboardUp * s;
    vec3 up = cameraBillboardUp * c - cameraBillboardRight * s;

    // instancePosition is emitter-local (matches the old per-particle Object3D's
    // .position, a child of the emitter) - modelMatrix carries the emitter's own
    // placement/rotation/drawScale, same as the scene graph used to do implicitly.
    // The billboard offset itself is added in already-world space (not run through
    // modelMatrix) so it stays camera-facing regardless of the emitter's own
    // rotation; instanceScale has the emitter's 1/drawScale baked in on the JS side
    // to compensate for skipping modelMatrix's scale here.
    vec3 anchorWorld = (modelMatrix * vec4(instancePosition, 1.0)).xyz;
    vec3 worldPosition = anchorWorld + right * (position.x * instanceScale.x) + up * (position.y * instanceScale.y);

    vec4 mvPosition = viewMatrix * vec4(worldPosition, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    #include <logdepthbuf_vertex>
    #include <clipping_planes_vertex>
    #include <fog_vertex>
}
