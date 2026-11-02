import { DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry, Matrix4, Mesh, type BufferGeometry, type Event, type Quaternion, type Vector3, type Vector4 } from "three";
import type MeshEmitterMaterial from "../../materials/mesh-emitter-material/mesh-emitter-material";

const tmpMatrix = new Matrix4();

export class InstancedMeshParticles extends Mesh<InstancedBufferGeometry, MeshEmitterMaterial> {
    public readonly isWorldBatchCandidate = false;
    protected readonly source: BufferGeometry;
    protected readonly transformAttr: InstancedBufferAttribute;
    protected readonly tintAttr: InstancedBufferAttribute;
    protected renderCount = 0;

    public constructor(source: BufferGeometry, material: MeshEmitterMaterial, capacity: number) {
        const geometry = new InstancedBufferGeometry();

        if (source.index) geometry.setIndex(source.index);
        for (const name of Object.keys(source.attributes)) geometry.setAttribute(name, source.getAttribute(name));
        geometry.instanceCount = 0;
        geometry.addEventListener("dispose", onGeometryDispose);

        super(geometry, material);

        this.source = source;
        this.transformAttr = new InstancedBufferAttribute(new Float32Array(capacity * 16), 16).setUsage(DynamicDrawUsage);
        this.tintAttr = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(DynamicDrawUsage);
        geometry.setAttribute("instanceTransform", this.transformAttr);
        geometry.setAttribute("instanceTint", this.tintAttr);

        this.frustumCulled = false;

        (this as any).isInstancedMeshParticles = true;
    }

    public withCapacity(capacity: number): InstancedMeshParticles { return new InstancedMeshParticles(this.source, this.material, capacity); }

    public setInstance(index: number, position: Vector3, quaternion: Quaternion, scale: Vector3, color: Vector4) {
        tmpMatrix.compose(position, quaternion, scale).toArray(this.transformAttr.array, index * 16);
        this.tintAttr.setXYZW(index, color.x, color.y, color.z, color.w);
        this.renderCount = Math.max(this.renderCount, index + 1);
    }

    public setInactive(index: number) {
        (this.transformAttr.array as Float32Array).fill(0, index * 16, index * 16 + 16);
    }

    public commit() {
        const count = this.renderCount;

        this.geometry.instanceCount = count;
        this.renderCount = 0;
        if (count === 0) return;

        for (const [attribute, size] of [[this.transformAttr, 16], [this.tintAttr, 4]] as const) {
            attribute.clearUpdateRanges();
            attribute.addUpdateRange(0, count * size);
            attribute.needsUpdate = true;
        }
    }

    public clearInstances() {
        this.renderCount = 0;
        this.geometry.instanceCount = 0;
    }

    public raycast() { }
}

function onGeometryDispose(event: Event): void {
    const geometry = event.target as InstancedBufferGeometry;

    geometry.setIndex(null); // WebGLGeometries deletes every attached attribute, the emitter's mesh geometry outlives this batch
    for (const name of Object.keys(geometry.attributes))
        if (name !== "instanceTransform" && name !== "instanceTint") geometry.deleteAttribute(name);
}

export default InstancedMeshParticles;
