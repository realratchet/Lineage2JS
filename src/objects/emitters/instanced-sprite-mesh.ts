import { DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, Vector3, Vector4 } from "three";
import InstancedParticleMaterial from "@client/materials/particle-material/instanced-particle-material";

// Every InstancedSpriteMesh shares this same per-vertex quad data (position/uv/index) -
// only the instance attributes differ per emitter, so there's no reason to duplicate
// the 4-vertex buffer per emitter.
const baseGeometry = new PlaneGeometry(2, 2);

class InstancedSpriteMesh extends Mesh<InstancedBufferGeometry, InstancedParticleMaterial> {
    private readonly positionAttr: InstancedBufferAttribute;
    private readonly scaleAttr: InstancedBufferAttribute;
    private readonly spinAttr: InstancedBufferAttribute;
    private readonly colorAttr: InstancedBufferAttribute;
    private readonly uvAttr: InstancedBufferAttribute;

    constructor(material: InstancedParticleMaterial, capacity: number) {
        const geometry = new InstancedBufferGeometry();
        geometry.setIndex(baseGeometry.index);
        geometry.setAttribute("position", baseGeometry.attributes.position);
        geometry.setAttribute("uv", baseGeometry.attributes.uv);
        geometry.instanceCount = capacity;

        super(geometry, material);

        this.positionAttr = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(DynamicDrawUsage);
        this.scaleAttr = new InstancedBufferAttribute(new Float32Array(capacity * 2), 2).setUsage(DynamicDrawUsage);
        this.spinAttr = new InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(DynamicDrawUsage);
        this.colorAttr = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(DynamicDrawUsage);

        // default to the identity cell (whole texture, no atlas) - a fresh buffer is
        // all-zero, which would collapse every UV sample onto a single texel
        const uvData = new Float32Array(capacity * 4);
        for (let i = 0; i < capacity; i++) { uvData[i * 4 + 2] = 1; uvData[i * 4 + 3] = 1; }
        this.uvAttr = new InstancedBufferAttribute(uvData, 4).setUsage(DynamicDrawUsage);

        geometry.setAttribute("instancePosition", this.positionAttr);
        geometry.setAttribute("instanceScale", this.scaleAttr);
        geometry.setAttribute("instanceSpin", this.spinAttr);
        geometry.setAttribute("instanceColor", this.colorAttr);
        geometry.setAttribute("instanceUV", this.uvAttr);

        // Per-instance world offsets are computed in the vertex shader from a
        // camera-facing basis - three's automatic bounding-sphere culling can't see
        // that and would judge visibility from the raw (tiny, origin-centered) quad
        // geometry. Emitter-level BSP/frustum visibility (zone-object.ts) already
        // gates whether this mesh's parent emitter renders at all.
        this.frustumCulled = false;

        (this as any).isInstancedSpriteMesh = true;
    }

    public setInstance(index: number, position: Vector3, scaleX: number, scaleY: number, spin: number, color: Vector4, uvOffsetX: number, uvOffsetY: number, uvScaleX: number, uvScaleY: number) {
        this.positionAttr.setXYZ(index, position.x, position.y, position.z);
        this.scaleAttr.setXY(index, scaleX, scaleY);
        this.spinAttr.setX(index, spin);
        this.colorAttr.setXYZW(index, color.x, color.y, color.z, color.w);
        this.uvAttr.setXYZW(index, uvOffsetX, uvOffsetY, uvScaleX, uvScaleY);
    }

    public setInactive(index: number) {
        this.scaleAttr.setXY(index, 0, 0);
    }

    public commit() {
        this.positionAttr.needsUpdate = true;
        this.scaleAttr.needsUpdate = true;
        this.spinAttr.needsUpdate = true;
        this.colorAttr.needsUpdate = true;
        this.uvAttr.needsUpdate = true;
    }

    // Nothing raycasts individual particle visualizers today, and per-instance
    // picking against a shader-driven billboard offset isn't implemented.
    raycast() { }
}

export default InstancedSpriteMesh;
export { InstancedSpriteMesh };
