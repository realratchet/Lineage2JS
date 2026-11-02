import { Box3, Plane, Vector3 } from "three";
import { PolyFlags_T } from "../assets/unreal/un-polys";
import { SectorObject } from "../objects/zone-object";
import MeshBounds from "./mesh-bounds";

type Portal_T = { vertices: Vector3[], center: Vector3, plane: Plane };
type Sector_T = { nodes: SectorObject["bspNodes"], outdoor: bigint, zones: Map<number, Portal_T[] | null> };
const tmpBox = new Box3();

export class PortalVisibility {
    public enabled = false;
    public rejected = 0;
    protected readonly cacheSectors = new WeakMap<SectorObject, Sector_T>();
    protected readonly arrPlanes: Plane[][] = [];
    protected planeCount = 0;

    public constructor(protected readonly bounds: MeshBounds) {}

    protected getExits(sector: SectorObject, zone: number): Portal_T[] | null {
        let cache = this.cacheSectors.get(sector);
        if (!cache || cache.nodes !== sector.bspNodes || cache.outdoor !== sector.outdoorZoneMask) {
            cache = { nodes: sector.bspNodes, outdoor: sector.outdoorZoneMask, zones: new Map() };
            this.cacheSectors.set(sector, cache);
        }
        if (cache.zones.has(zone)) return cache.zones.get(zone);

        const zones = new Set([zone]), exits = new Set<SectorObject["bspNodes"][number]>(), portals: Portal_T[] = [];
        for (const current of zones) for (const node of sector.bspNodes) {
            if (!(node.surfFlags & PolyFlags_T.PF_Portal) || node.zones[0] === node.zones[1]) continue;
            if (node.zones[0] !== current && node.zones[1] !== current) continue;
            const other = node.zones[0] === current ? node.zones[1] : node.zones[0];
            if (other < 0 || other >= 64) {
                cache.zones.set(zone, null);
                return null;
            }
            if (cache.outdoor & (1n << BigInt(other))) exits.add(node);
            else zones.add(other);
        }
        for (const node of exits) {
            if (!node.portalVertices || node.portalVertices.length < 9) {
                cache.zones.set(zone, null);
                return null;
            }
            const vertices: Vector3[] = [], center = new Vector3(), plane = new Plane(new Vector3(node.plane.x, node.plane.y, node.plane.z), -node.plane.w).normalize();
            for (let i = 0; i < node.portalVertices.length; i += 3) {
                const vertex = new Vector3().fromArray(node.portalVertices, i);
                vertices.push(vertex); center.add(vertex);
            }
            center.multiplyScalar(1 / vertices.length);
            portals.push({ vertices, center, plane });
        }
        cache.zones.set(zone, portals);
        return portals;
    }

    public prepare(camera: THREE.Camera, sector: SectorObject): boolean {
        this.rejected = this.planeCount = 0;
        if (!this.enabled || !sector || !(camera as THREE.PerspectiveCamera).isPerspectiveCamera) return false;
        const zone = sector.findPositionZone(camera.position);
        if (zone === null || zone <= 0 || zone >= 64 || sector.outdoorZoneMask & (1n << BigInt(zone))) return false;
        const exits = this.getExits(sector, zone);
        if (!exits || !exits.length) return false;

        for (const portal of exits) {
            if (Math.abs(portal.plane.distanceToPoint(camera.position)) < 1) return false;
            const planes = this.arrPlanes[this.planeCount] || (this.arrPlanes[this.planeCount] = []), vertices = portal.vertices;
            for (let i = 0; i < vertices.length; i++) {
                const plane = planes[i] || (planes[i] = new Plane());
                plane.setFromCoplanarPoints(camera.position, vertices[i], vertices[(i + 1) % vertices.length]);
                if (plane.distanceToPoint(portal.center) < 0) plane.negate();
                for (const vertex of vertices) if (plane.distanceToPoint(vertex) < -0.01) return false;
                plane.constant += 1;
            }
            const plane = planes[vertices.length] || (planes[vertices.length] = new Plane());
            plane.copy(portal.plane);
            if (plane.distanceToPoint(camera.position) > 0) plane.negate();
            plane.constant += 1;
            planes.length = vertices.length + 1;
            this.planeCount++;
        }
        return true;
    }

    protected isVisible(item: any, currentSector: SectorObject): boolean {
        const object = item.object, material = item.material, geometry = item.geometry;
        let sector = object;
        while (sector && !sector.isSectorObject) sector = sector.parent;
        if (!sector || sector === currentSector) return true;
        if ((!material.isStaticMeshMaterial && !material.isTerrainMaterial) || object.actorRenderable || object.isSkinnedMesh || object.morphTargetInfluences || (object.isInstancedMesh || geometry.isInstancedBufferGeometry) && !object.isTerrainDecoration) return true;

        if (!this.bounds.getBounds(item, tmpBox)) return true;
        for (let i = 0; i < this.planeCount; i++) {
            let visible = true;
            for (const plane of this.arrPlanes[i]) {
                const n = plane.normal;
                if (n.x * (n.x > 0 ? tmpBox.max.x : tmpBox.min.x) + n.y * (n.y > 0 ? tmpBox.max.y : tmpBox.min.y) + n.z * (n.z > 0 ? tmpBox.max.z : tmpBox.min.z) + plane.constant < 0) { visible = false; break; }
            }
            if (visible) return true;
        }
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
