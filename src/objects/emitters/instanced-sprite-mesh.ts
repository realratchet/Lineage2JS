import { CustomBlending, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, OneFactor, PlaneGeometry, Vector3, Vector4, ZeroFactor } from "three";
import InstancedParticleMaterial from "@client/materials/particle-material/instanced-particle-material";

// shared per-vertex quad data - only instance attributes differ per emitter
const baseGeometry = new PlaneGeometry(2, 2);

class InstancedSpriteMesh extends Mesh<InstancedBufferGeometry, InstancedParticleMaterial> {
    public readonly isWorldBatchCandidate: boolean;
    private readonly positionAttr: InstancedBufferAttribute;
    private readonly scaleAttr: InstancedBufferAttribute;
    private readonly spinAttr: InstancedBufferAttribute;
    private readonly colorAttr: InstancedBufferAttribute;
    private readonly uvAttr: InstancedBufferAttribute;
    private renderCount = 0;

    constructor(material: InstancedParticleMaterial, capacity: number) {
        const geometry = new InstancedBufferGeometry();
        geometry.setIndex(baseGeometry.index);
        geometry.setAttribute("position", baseGeometry.attributes.position);
        geometry.setAttribute("uv", baseGeometry.attributes.uv);
        geometry.instanceCount = 0;

        super(geometry, material);

        this.positionAttr = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(DynamicDrawUsage);
        this.scaleAttr = new InstancedBufferAttribute(new Float32Array(capacity * 2), 2).setUsage(DynamicDrawUsage);
        this.spinAttr = new InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(DynamicDrawUsage);
        this.colorAttr = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(DynamicDrawUsage);

        // default to the identity cell - an all-zero buffer would collapse every UV sample onto one texel
        const uvData = new Float32Array(capacity * 4);
        for (let i = 0; i < capacity; i++) { uvData[i * 4 + 2] = 1; uvData[i * 4 + 3] = 1; }
        this.uvAttr = new InstancedBufferAttribute(uvData, 4).setUsage(DynamicDrawUsage);

        geometry.setAttribute("instancePosition", this.positionAttr);
        geometry.setAttribute("instanceScale", this.scaleAttr);
        geometry.setAttribute("instanceSpin", this.spinAttr);
        geometry.setAttribute("instanceColor", this.colorAttr);
        geometry.setAttribute("instanceUV", this.uvAttr);

        // vertex shader computes world offsets from a camera-facing basis, invisible to three's bounding-sphere culling
        this.frustumCulled = false;

        (this as any).isInstancedSpriteMesh = true;

        // One/One RGB addition is order-independent.
        this.isWorldBatchCandidate = material.blending === CustomBlending
            && material.blendSrc === OneFactor
            && material.blendDst === OneFactor
            && material.blendSrcAlpha === ZeroFactor
            && material.blendDstAlpha === OneFactor;
    }

    public setInstance(index: number, position: Vector3, scaleX: number, scaleY: number, spin: number, color: Vector4, uvOffsetX: number, uvOffsetY: number, uvScaleX: number, uvScaleY: number) {
        this.positionAttr.setXYZ(index, position.x, position.y, position.z);
        this.scaleAttr.setXY(index, scaleX, scaleY);
        this.spinAttr.setX(index, spin);
        this.colorAttr.setXYZW(index, color.x, color.y, color.z, color.w);
        this.uvAttr.setXYZW(index, uvOffsetX, uvOffsetY, uvScaleX, uvScaleY);
        this.renderCount = Math.max(this.renderCount, index + 1);
    }

    public setInactive(index: number) {
        this.scaleAttr.setXY(index, 0, 0);
    }

    public commit() {
        this.geometry.instanceCount = this.renderCount;
        const count = this.renderCount;
        this.renderCount = 0;
        if (count === 0) return;

        this.markUpdated(this.positionAttr, count * 3);
        this.markUpdated(this.scaleAttr, count * 2);
        this.markUpdated(this.spinAttr, count);
        this.markUpdated(this.colorAttr, count * 4);
        this.markUpdated(this.uvAttr, count * 4);
    }

    private markUpdated(attribute: InstancedBufferAttribute, count: number) {
        attribute.updateRange.offset = 0;
        attribute.updateRange.count = count;
        attribute.needsUpdate = true;
    }

    public clearInstances() {
        this.renderCount = 0;
        this.geometry.instanceCount = 0;
    }

    // Nothing raycasts individual particle visualizers today, and per-instance
    // picking against a shader-driven billboard offset isn't implemented.
    raycast() { }
}

export default InstancedSpriteMesh;
export { InstancedSpriteMesh };
