import { Plane, Vector3 } from "three";
import { PolyFlags_T } from "../assets/unreal/un-polys";
import type { SectorObject } from "../objects/zone-object";

type Rect_T = { minX: number, minY: number, maxX: number, maxY: number };
type Portal_T = { node: SectorObject["bspNodes"][number], rect: Rect_T, source: number, target: number, visible: boolean };
const arrZoneBits = Array.from({ length: 64 }, (_, index) => 1n << BigInt(index));
const arrMin = [0, 0, 0], arrMax = [0, 0, 0];
const tmpVertex = new Vector3();
const tmpIntersection = new Vector3();

export class ZoneVisibility {
    protected nodes: SectorObject["bspNodes"];
    protected readonly portals: Portal_T[] = [];
    protected readonly rects: Rect_T[] = [];
    protected readonly planes: Plane[][] = [];
    protected readonly queue: number[] = [];
    protected readonly zones: number[] = [];
    protected readonly queued = new Uint8Array(64);
    protected mask = 0n;
    protected cameraZone = -1;
    public active = false;

    public prepare(sector: SectorObject, position: THREE.Vector3, frustum: THREE.Frustum, mask: bigint): bigint {
        const cameraZone = sector.findPositionZone(position);
        this.active = false;
        if (cameraZone === null || cameraZone <= 0 || cameraZone >= 64 || sector.outdoorZoneMask & (1n << BigInt(cameraZone))) return mask;

        if (this.nodes !== sector.bspNodes) {
            this.nodes = sector.bspNodes;
            this.portals.length = 0;
            for (const node of this.nodes) {
                if (!(node.surfFlags & PolyFlags_T.PF_Portal) || node.zones[0] === node.zones[1]) continue;
                if (node.zones.some(zone => zone < 0 || zone >= 64)) { this.nodes = null; return mask; }
                this.portals.push({ node, rect: { minX: 0, minY: 0, maxX: 1, maxY: 1 }, source: 0, target: 0, visible: false });
            }
        }

        const planes = frustum.planes, near = planes[5];
        for (const portal of this.portals) {
            const node = portal.node, vertices = node.portalVertices, rect = portal.rect;
            const distance = node.plane.x * position.x + node.plane.y * position.y + node.plane.z * position.z - node.plane.w;
            portal.source = node.zones[distance > 0 ? 1 : 0];
            portal.target = node.zones[distance > 0 ? 0 : 1];
            rect.minX = rect.minY = 0;
            rect.maxX = rect.maxY = 1;
            portal.visible = true;
            if (!vertices || vertices.length < 9 || Math.abs(distance) < 1) continue;

            rect.minX = rect.minY = Infinity;
            rect.maxX = rect.maxY = -Infinity;
            tmpVertex.fromArray(vertices, vertices.length - 3);
            let previousDistance = near.distanceToPoint(tmpVertex);
            for (let i = 0; i < vertices.length; i += 3) {
                const x = vertices[i], y = vertices[i + 1], z = vertices[i + 2];
                const currentDistance = near.normal.x * x + near.normal.y * y + near.normal.z * z + near.constant;
                if ((previousDistance >= 0) !== (currentDistance >= 0)) {
                    const alpha = previousDistance / (previousDistance - currentDistance);
                    tmpIntersection.set(x, y, z).sub(tmpVertex).multiplyScalar(alpha).add(tmpVertex);
                    this.expandRect(rect, tmpIntersection, planes);
                }
                tmpVertex.set(x, y, z);
                if (currentDistance >= 0) this.expandRect(rect, tmpVertex, planes);
                previousDistance = currentDistance;
            }
            rect.minX = Math.max(0, rect.minX - 0.00001);
            rect.minY = Math.max(0, rect.minY - 0.00001);
            rect.maxX = Math.min(1, rect.maxX + 0.00001);
            rect.maxY = Math.min(1, rect.maxY + 0.00001);
            portal.visible = rect.minX <= rect.maxX && rect.minY <= rect.maxY;
        }

        for (let i = 0; i < 64; i++) {
            const rect = this.rects[i] || (this.rects[i] = { minX: 0, minY: 0, maxX: 0, maxY: 0 });
            rect.minX = rect.minY = Infinity;
            rect.maxX = rect.maxY = -Infinity;
        }
        const view = this.rects[cameraZone];
        view.minX = view.minY = 0;
        view.maxX = view.maxY = 1;
        this.queue.length = 0;
        this.queue.push(cameraZone);
        this.queued.fill(0);
        this.queued[cameraZone] = 1;
        this.mask = 1n << BigInt(cameraZone);
        for (let i = 0; i < this.queue.length; i++) {
            const source = this.queue[i], from = this.rects[source];
            this.queued[source] = 0;
            for (const portal of this.portals) {
                if (!portal.visible || portal.source !== source || !(mask & (1n << BigInt(portal.target)))) continue;
                const rect = portal.rect, target = this.rects[portal.target];
                const minX = Math.max(from.minX, rect.minX), minY = Math.max(from.minY, rect.minY), maxX = Math.min(from.maxX, rect.maxX), maxY = Math.min(from.maxY, rect.maxY);
                if (minX > maxX || minY > maxY) continue;
                if (minX >= target.minX && minY >= target.minY && maxX <= target.maxX && maxY <= target.maxY) continue;
                target.minX = Math.min(target.minX, minX);
                target.minY = Math.min(target.minY, minY);
                target.maxX = Math.max(target.maxX, maxX);
                target.maxY = Math.max(target.maxY, maxY);
                this.mask |= 1n << BigInt(portal.target);
                if (!this.queued[portal.target]) { this.queue.push(portal.target); this.queued[portal.target] = 1; }
            }
        }

        this.zones.length = 0;
        for (let zone = 0; zone < 64; zone++) {
            if (!(this.mask & arrZoneBits[zone])) continue;
            this.zones.push(zone);
            const rect = this.rects[zone], clipped = this.planes[zone] || (this.planes[zone] = [new Plane(), new Plane(), new Plane(), new Plane()]);
            this.clipPlane(clipped[0], planes[1], planes[0], rect.minX);
            this.clipPlane(clipped[1], planes[0], planes[1], 1 - rect.maxX);
            this.clipPlane(clipped[2], planes[2], planes[3], rect.minY);
            this.clipPlane(clipped[3], planes[3], planes[2], 1 - rect.maxY);
        }
        this.cameraZone = cameraZone;
        this.active = true;
        return this.mask;
    }

    protected expandRect(rect: Rect_T, vertex: THREE.Vector3, planes: THREE.Plane[]): void {
        const left = planes[1].distanceToPoint(vertex), right = planes[0].distanceToPoint(vertex), bottom = planes[2].distanceToPoint(vertex), top = planes[3].distanceToPoint(vertex);
        const x = left / (left + right), y = bottom / (bottom + top);
        rect.minX = Math.min(rect.minX, x); rect.maxX = Math.max(rect.maxX, x);
        rect.minY = Math.min(rect.minY, y); rect.maxY = Math.max(rect.maxY, y);
    }

    protected clipPlane(target: Plane, a: Plane, b: Plane, edge: number): void {
        target.normal.copy(a.normal).multiplyScalar(1 - edge).addScaledVector(b.normal, -edge);
        target.constant = a.constant * (1 - edge) - b.constant * edge;
        target.normalize();
        target.constant += 1;
    }

    public intersectsBox(mask: bigint, box: THREE.Box3): boolean {
        box.min.toArray(arrMin); box.max.toArray(arrMax);
        return this.intersectsBounds(mask, arrMin, arrMax);
    }

    public intersectsBounds(mask: bigint, min: ArrayLike<number>, max: ArrayLike<number>): boolean {
        if (!this.active || !mask || mask & arrZoneBits[this.cameraZone]) return true;
        mask &= this.mask;
        for (const zone of this.zones) {
            if (!(mask & arrZoneBits[zone])) continue;
            let visible = true;
            for (const plane of this.planes[zone]) {
                const n = plane.normal;
                if (n.x * (n.x > 0 ? max[0] : min[0]) + n.y * (n.y > 0 ? max[1] : min[1]) + n.z * (n.z > 0 ? max[2] : min[2]) + plane.constant < 0) { visible = false; break; }
            }
            if (visible) return true;
        }
        return false;
    }
}

export default ZoneVisibility;
