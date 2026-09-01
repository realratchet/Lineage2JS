import Terrain from "./terrain";
import { Box3, BufferGeometry, Camera, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry, InstancedMesh, Material, Scene, StaticDrawUsage, Vector3, WebGLRenderer } from "three";
import type { ITerrainDecorationDecodeInfo } from "@l2js/engine/contracts/terrain";

const tmpVec = new Vector3();

function makeGeometry(source: BufferGeometry) {
    const geometry = new InstancedBufferGeometry();

    geometry.index = source.index;
    Object.keys(source.attributes).forEach(name => geometry.setAttribute(name, source.getAttribute(name)));
    source.groups.forEach(group => geometry.addGroup(group.start, group.count, group.materialIndex));
    geometry.boundingBox = source.boundingBox;
    geometry.boundingSphere = source.boundingSphere;

    return geometry;
}

export class TerrainDecoration extends InstancedMesh {
    public readonly isTerrainDecoration = true;
    public readonly terrainSegment: string;
    public readonly fadeoutRadius: [number, number];
    public readonly forceRender: boolean;
    public readonly bounds = new Box3();

    protected readonly colorMultipliers: Uint8Array;
    protected readonly colorAttribute: InstancedBufferAttribute;
    protected readonly terrainVertexIndices?: Uint16Array;
    protected terrain?: Terrain;
    protected lightingRevision = -1;

    public constructor(geometry: BufferGeometry, material: Material | Material[], info: ITerrainDecorationDecodeInfo) {
        if (!geometry.boundingSphere) geometry.computeBoundingSphere();

        const instanceGeometry = makeGeometry(geometry);
        const instanceCount = info.matrices.length / 16;
        const geometryRadius = geometry.boundingSphere.center.length() + geometry.boundingSphere.radius;
        let boundsPadding = 0;

        super(instanceGeometry, material, instanceCount);

        this.name = info.name;
        this.terrainSegment = info.terrainSegment;
        this.fadeoutRadius = info.fadeoutRadius;
        this.forceRender = info.forceRender;
        this.renderOrder = info.drawOrder;
        this.colorMultipliers = info.colors;
        this.terrainVertexIndices = info.terrainVertexIndices;
        this.visible = false;

        (this.instanceMatrix.array as Float32Array).set(info.matrices);
        this.instanceMatrix.setUsage(StaticDrawUsage);
        this.instanceMatrix.needsUpdate = true;

        this.colorAttribute = new InstancedBufferAttribute(info.colors.slice(), 3, true);
        if (this.terrainVertexIndices) this.colorAttribute.setUsage(DynamicDrawUsage);
        instanceGeometry.setAttribute("colorInstance", this.colorAttribute);

        for (let i = 0; i < instanceCount; i++) {
            const offset = i * 16;
            const scaleX = Math.hypot(info.matrices[offset + 0], info.matrices[offset + 1], info.matrices[offset + 2]);
            const scaleY = Math.hypot(info.matrices[offset + 4], info.matrices[offset + 5], info.matrices[offset + 6]);
            const scaleZ = Math.hypot(info.matrices[offset + 8], info.matrices[offset + 9], info.matrices[offset + 10]);

            boundsPadding = Math.max(boundsPadding, geometryRadius * Math.max(scaleX, scaleY, scaleZ));
            this.bounds.expandByPoint(tmpVec.fromArray(info.matrices, offset + 12));
        }

        this.bounds.expandByScalar(boundsPadding);
    }

    public setTerrain(terrain: Terrain) {
        this.terrain = terrain;
        this.updateLighting();
    }

    public updateLighting() {
        if (!this.terrain || !this.terrainVertexIndices || this.lightingRevision === this.terrain.lightingRevision) return;

        const terrain = this.terrain;
        const geometry = terrain.batchGeometry || terrain.geometry;
        const source = geometry.getAttribute("color").array as Uint8ClampedArray;
        const sourceVertexOffset = terrain.batchVertexOffset;
        const target = this.colorAttribute.array as Uint8Array;

        for (let i = 0; i < this.terrainVertexIndices.length; i++) {
            const sourceOffset = (sourceVertexOffset + this.terrainVertexIndices[i]) * 3;
            const targetOffset = i * 3;

            target[targetOffset + 0] = source[sourceOffset + 0] * this.colorMultipliers[targetOffset + 0] / 255;
            target[targetOffset + 1] = source[sourceOffset + 1] * this.colorMultipliers[targetOffset + 1] / 255;
            target[targetOffset + 2] = source[sourceOffset + 2] * this.colorMultipliers[targetOffset + 2] / 255;
        }

        this.colorAttribute.needsUpdate = true;
        this.lightingRevision = terrain.lightingRevision;
    }

    public updateVisibility(cameraPosition: Vector3, terrainVisible: boolean) {
        const visible = terrainVisible && (this.forceRender || this.bounds.distanceToPoint(cameraPosition) <= this.fadeoutRadius[1]);

        this.visible = visible;
        if (this.visible) this.updateLighting();
    }

    public onBeforeRender = (_renderer: WebGLRenderer, _scene: Scene, _camera: Camera, _geometry: BufferGeometry, material: Material) => {
        const uniforms = (material as any).uniforms;
        const uniform = uniforms && uniforms.terrainDecorationFadeRange;

        if (uniform) {
            if (this.forceRender) uniform.value.set(1e20, 1e20);
            else uniform.value.fromArray(this.fadeoutRadius);
        }
    };
}

export default TerrainDecoration;
