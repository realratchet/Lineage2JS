import Terrain from "./terrain";
import { Box3, BufferGeometry, Camera, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry, InstancedMesh, Material, Scene, StaticDrawUsage, Vector3, WebGLRenderer } from "three";
import type { ITerrainDecorationDecodeInfo } from "@l2js/engine/contracts/terrain";
import { ESortOrder_T } from "../assets/unreal/un-deco-layer";

const tmpVec = new Vector3();
let tmpSortKeys = new Float64Array(0);
let tmpSortSource = new Float32Array(0);
let sortCandidate: TerrainDecoration = null;
let sortCandidateScore = 0;

function reorderInstances(array: Float32Array | Uint8Array | Uint32Array, itemSize: number, count: number) {
    for (let i = 0, len = count * itemSize; i < len; i++) tmpSortSource[i] = array[i];

    for (let i = 0; i < count; i++) {
        const source = (tmpSortKeys[i] % count) * itemSize, target = i * itemSize;

        for (let j = 0; j < itemSize; j++) array[target + j] = tmpSortSource[source + j];
    }
}

export function sortTerrainDecorations(cameraPosition: Vector3) {
    if (sortCandidate) sortCandidate.sortInstances(cameraPosition);

    sortCandidate = null;
    sortCandidateScore = 0;
}

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
    public readonly drawOrder: ESortOrder_T;
    public readonly bounds = new Box3();

    protected readonly colorMultipliers: Uint8Array;
    protected readonly colorAttribute: InstancedBufferAttribute;
    protected readonly terrainVertexIndices?: Uint16Array;
    protected readonly instanceOrder?: Uint32Array;
    protected readonly sortPosition = new Vector3(Infinity, Infinity, Infinity);
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
        this.renderOrder = 1; // after world translucency
        this.drawOrder = info.drawOrder;
        this.colorMultipliers = info.colors;
        this.terrainVertexIndices = info.terrainVertexIndices;
        this.visible = false;

        (this.instanceMatrix.array as Float32Array).set(info.matrices);
        this.instanceMatrix.setUsage(this.drawOrder === ESortOrder_T.SORT_NoSort ? StaticDrawUsage : DynamicDrawUsage);
        this.instanceMatrix.needsUpdate = true;

        this.colorAttribute = new InstancedBufferAttribute(info.colors.slice(), 3, true);
        if (this.terrainVertexIndices || this.drawOrder !== ESortOrder_T.SORT_NoSort) this.colorAttribute.setUsage(DynamicDrawUsage);
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

        if (this.drawOrder !== ESortOrder_T.SORT_NoSort) {
            this.instanceOrder = new Uint32Array(instanceCount);
            for (let i = 0; i < instanceCount; i++) this.instanceOrder[i] = i;
        }
    }

    public sortInstances(cameraPosition: Vector3) {
        const matrices = this.instanceMatrix.array as Float32Array, count = this.count;
        let sorted = true;

        if (tmpSortKeys.length < count) {
            tmpSortKeys = new Float64Array(count);
            tmpSortSource = new Float32Array(count * 16);
        }

        const keys = tmpSortKeys.subarray(0, count);

        for (let i = 0; i < count; i++) {
            const dx = matrices[i * 16 + 12] - cameraPosition.x;
            const dy = matrices[i * 16 + 13] - cameraPosition.y;
            const dz = matrices[i * 16 + 14] - cameraPosition.z;

            keys[i] = Math.floor(dx * dx + dy * dy + dz * dz) * count + i;
        }

        keys.sort();
        if (this.drawOrder === ESortOrder_T.SORT_BackToFront) keys.reverse();

        this.sortPosition.copy(cameraPosition);

        for (let i = 0; i < count && sorted; i++) sorted = keys[i] % count === i;
        if (sorted) return;

        reorderInstances(matrices, 16, count);
        reorderInstances(this.colorAttribute.array as Uint8Array, 3, count);
        reorderInstances(this.instanceOrder, 1, count);

        this.instanceMatrix.needsUpdate = true;
        this.colorAttribute.needsUpdate = true;
    }

    public setTerrain(terrain: Terrain) {
        this.terrain = terrain;
        terrain.decorations.push(this);
        this.updateLighting();
    }

    public getDecoLayerAlpha(location: Vector3, radius: number = 0): number {
        const matrices = this.instanceMatrix.array;
        const range = radius > 0 ? radius : 64;
        let count = 0;

        for (let i = 0; i < this.count; i++) {
            const dx = matrices[i * 16 + 12] - location.x;
            const dy = matrices[i * 16 + 13] - location.y;

            if (Math.sqrt(dx * dx + dy * dy) < range) count++;
        }
        return count;
    }

    public updateLighting() {
        if (!this.terrain || !this.terrainVertexIndices || this.lightingRevision === this.terrain.lightingRevision) return;

        const terrain = this.terrain;
        const geometry = terrain.batchGeometry || terrain.geometry;
        const source = geometry.getAttribute("color").array as Uint8ClampedArray;
        const sourceVertexOffset = terrain.batchVertexOffset;
        const target = this.colorAttribute.array as Uint8Array;

        for (let i = 0; i < this.terrainVertexIndices.length; i++) {
            const instance = this.instanceOrder ? this.instanceOrder[i] : i;
            const sourceOffset = (sourceVertexOffset + this.terrainVertexIndices[instance]) * 3;
            const multiplierOffset = instance * 3;
            const targetOffset = i * 3;

            target[targetOffset + 0] = source[sourceOffset + 0] * this.colorMultipliers[multiplierOffset + 0] / 255;
            target[targetOffset + 1] = source[sourceOffset + 1] * this.colorMultipliers[multiplierOffset + 1] / 255;
            target[targetOffset + 2] = source[sourceOffset + 2] * this.colorMultipliers[multiplierOffset + 2] / 255;
        }

        this.colorAttribute.needsUpdate = true;
        this.lightingRevision = terrain.lightingRevision;
    }

    public updateVisibility(cameraPosition: Vector3, terrainVisible: boolean, renderDeco: boolean = true) {
        const visible = terrainVisible && (this.forceRender || renderDeco && this.bounds.distanceToPoint(cameraPosition) <= this.fadeoutRadius[1]);

        this.visible = visible;
        if (this.visible) this.updateLighting();
    }

    public offerSort(cameraPosition: Vector3) {
        if (!this.visible || !this.instanceOrder) return;

        const moved = this.sortPosition.distanceTo(cameraPosition);
        if (moved === 0) return;

        const score = Math.min(moved, Number.MAX_VALUE) / Math.max(this.bounds.distanceToPoint(cameraPosition), 1);

        if (score > sortCandidateScore) {
            sortCandidate = this;
            sortCandidateScore = score;
        }
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
