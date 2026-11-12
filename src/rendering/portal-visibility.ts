import { Box3, Frustum, Matrix4, WebGLCoordinateSystem } from "three";
import type { SectorObject } from "../objects/zone-object";
import MeshBounds from "./mesh-bounds";
import ZoneVisibility from "./zone-visibility";

const tmpBox = new Box3();
const tmpMatrix = new Matrix4();
const tmpFrustum = new Frustum();

export class PortalVisibility {
    public enabled = false;
    public rejected = 0;
    protected readonly visibility = new ZoneVisibility();
    protected outdoorMask = 0n;
    protected visibleMask = 0n;

    public constructor(protected readonly bounds: MeshBounds) {}

    public prepare(camera: THREE.Camera, sector: SectorObject): boolean {
        this.rejected = 0;
        this.visibility.active = false;
        if (!this.enabled || !sector || !(camera as THREE.PerspectiveCamera).isPerspectiveCamera) return false;

        tmpFrustum.setFromProjectionMatrix(tmpMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), WebGLCoordinateSystem, camera.reversedDepth);
        this.outdoorMask = sector.outdoorZoneMask;
        this.visibleMask = this.visibility.prepare(sector, camera.position, tmpFrustum, (1n << 64n) - 1n);
        return this.visibility.active;
    }

    public hasExteriorView(): boolean { return !this.visibility.active || !!(this.visibleMask & this.outdoorMask); }

    protected isVisible(item: any, currentSector: SectorObject): boolean {
        const object = item.object, material = item.material, geometry = item.geometry;
        let sector = object;
        while (sector && !sector.isSectorObject) sector = sector.parent;
        if (!sector || sector === currentSector) return true;
        if ((!material.isStaticMeshMaterial && !material.isTerrainMaterial) || object.actorRenderable || object.isSkinnedMesh || object.morphTargetInfluences || (object.isInstancedMesh || geometry.isInstancedBufferGeometry) && !object.isTerrainDecoration) return true;

        if (!this.bounds.getBounds(item, tmpBox) || this.visibility.intersectsBox(this.outdoorMask, tmpBox)) return true;
        this.rejected++;
        return false;
    }

    public filter(items: any[], sector: SectorObject): void {
        let count = 0;
        for (const item of items) if (this.isVisible(item, sector)) items[count++] = item;
        items.length = count;
    }
}

export default PortalVisibility;
