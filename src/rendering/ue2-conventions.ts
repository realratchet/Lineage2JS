import { Object3D, PerspectiveCamera } from "three";

/*
 * UE2 is left-handed, Three.js is right-handed, and all world data here is
 * native UE2 (no swizzle) — so the render is mirrored unless something
 * compensates. A quaternion can't hold that fix (it can only represent proper
 * rotations, never a reflection), so it goes in the projection matrix instead,
 * patched once on the prototype so every camera picks it up.
 */
Object3D.DefaultUp.set(0, 0, 1);

const originalUpdateProjectionMatrix = PerspectiveCamera.prototype.updateProjectionMatrix;

PerspectiveCamera.prototype.updateProjectionMatrix = function () {
    originalUpdateProjectionMatrix.call(this);

    /* Flip X in clip space: te[0] is the X scale, te[8] the (usually zero) X skew. */
    const te = this.projectionMatrix.elements;
    te[0] = -te[0];
    te[8] = -te[8];

    this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
};
