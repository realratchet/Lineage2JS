import { Plane, Vector3 } from "three";
import { PolyFlags_T } from "../assets/unreal/un-polys";
import type { BSPBrushPolygonDecodeInfo_T } from "../assets/unreal/bsp/un-bsp-node";
import type { AntiPortalActor, ActorAntiPortalVolume_T } from "../objects/anti-portal-actor";
import type { SectorObject } from "../objects/zone-object";
import { BSPAntiPortalVolume, getPolygonArea, planesContainBounds } from "./anti-portal-volume";

type Rect_T = { minX: number, minY: number, maxX: number, maxY: number };
type Portal_T = { node: SectorObject["bspNodes"][number], rect: Rect_T, source: number, target: number, visible: boolean };
type PortalPolygon_T = { vertices: Vector3[], area: number };
const arrZoneBits = Array.from({ length: 64 }, (_, index) => 1n << BigInt(index));
const arrMin = [0, 0, 0], arrMax = [0, 0, 0];
const tmpVertex = new Vector3();
const tmpIntersection = new Vector3();

function portalDistance(node: Portal_T["node"], position: Vector3): number {
    return node.plane.x * position.x + node.plane.y * position.y + node.plane.z * position.z - node.plane.w;
}

export class ZoneVisibility {
    protected nodes: SectorObject["bspNodes"];
    protected readonly portals: Portal_T[] = [];
    protected readonly rects: Rect_T[] = [];
    protected readonly planes: Plane[][] = [];
    protected readonly queue: number[] = [];
    protected readonly zones: number[] = [];
    protected readonly queued = new Uint8Array(64);
    protected mask = 0n;
    protected cameraMask = 0n;
    protected readonly antiPortals: ActorAntiPortalVolume_T[] = [];
    protected readonly cacheActorVolumes = new WeakMap<AntiPortalActor, ActorAntiPortalVolume_T>();
    protected readonly bspAntiPortals: BSPAntiPortalVolume[] = [];
    protected readonly cacheBSPAntiPortals = new WeakMap<BSPBrushPolygonDecodeInfo_T, BSPAntiPortalVolume>();
    protected readonly cacheBSPPortalPolygons = new WeakMap<BSPBrushPolygonDecodeInfo_T, PortalPolygon_T>();
    protected readonly bspPortalVisibility = new Map<number, boolean>();
    protected antiPortalMask = 0n;
    public active = false;
    public get hasAntiPortals() { return this.antiPortals.length !== 0 || this.bspAntiPortals.length !== 0; }
    public get hasActorAntiPortals() { return this.antiPortals.length !== 0; }
    public get hasBSPAntiPortals() { return this.bspAntiPortals.length !== 0; }

    public reset(): void {
        this.active = false;
        this.antiPortals.length = 0;
        for (const portal of this.bspAntiPortals) portal.zoneMask = 0n;
        this.bspAntiPortals.length = 0;
        this.bspPortalVisibility.clear();
    }

    public addBSPAntiPortal(info: BSPBrushPolygonDecodeInfo_T, position: Vector3, rangeOrigin: Vector3, range: number, sphere: THREE.Sphere, zoneMask: bigint): void {
        if (!zoneMask) return;
        let portal = this.cacheBSPAntiPortals.get(info);
        if (!portal) {
            portal = new BSPAntiPortalVolume(info);
            this.cacheBSPAntiPortals.set(info, portal);
        }

        if (!portal.zoneMask && portal.extrude(position, rangeOrigin, range, sphere, zoneMask))
            this.bspAntiPortals.push(portal);
    }

    public isBSPSphereOccluded(zoneMask: bigint, sphere: THREE.Sphere): boolean {
        for (const portal of this.bspAntiPortals)
            if (portal.zoneMask & zoneMask && portal.containsSphere(sphere)) return true;
        return false;
    }

    public clipBSPPortal(info: BSPBrushPolygonDecodeInfo_T, source: bigint, target: bigint): boolean {
        const seen = this.bspPortalVisibility.get(info.surface);
        if (seen !== undefined) return seen;
        this.bspPortalVisibility.set(info.surface, true);

        if (!this.hasBSPAntiPortals) return true;
        let polygon = this.cacheBSPPortalPolygons.get(info);
        if (!polygon) {
            const vertices = info.vertices.map(vertex => new Vector3().fromArray(vertex));
            polygon = { vertices, area: getPolygonArea(vertices) };
            this.cacheBSPPortalPolygons.set(info, polygon);
        }

        // Engine.dll 0x91c83c clips the original brush polygon in camera-side occluders.
        for (let i = this.bspAntiPortals.length - 1; i >= 0; i--) {
            const portal = this.bspAntiPortals[i];
            if (!(portal.zoneMask & source)) continue;

            const area = portal.clipPolygon(polygon.vertices, polygon.area);
            if (area >= polygon.area) {
                this.bspPortalVisibility.set(info.surface, false);
                return false;
            }
            if (area > 0) portal.zoneMask |= target;
        }
        return true;
    }

    public hideBSPPortal(info: BSPBrushPolygonDecodeInfo_T): void { this.bspPortalVisibility.set(info.surface, false); }

    public prepareAntiPortals(sector: SectorObject, position: THREE.Vector3, frustum: THREE.Frustum, mask: bigint): void {
        this.antiPortalMask = mask;
        if (!sector.antiPortals.length) return;

        const dot = frustum.planes[2].normal.dot(frustum.planes[3].normal);
        const tanHalfFov = Math.sqrt((1 + dot) / (1 - dot));
        for (const portal of sector.antiPortals) {
            if (!(portal.zoneMask & mask) || !this.intersectsBox(portal.zoneMask, portal.bounds, false)) continue;

            let volume = this.cacheActorVolumes.get(portal);
            if (!volume) {
                volume = portal.createVolume();
                this.cacheActorVolumes.set(portal, volume);
            }
            if (portal.extrude(position, frustum, tanHalfFov, volume)) this.antiPortals.push(volume);
        }
    }

    public isOccluded(mask: bigint, min: ArrayLike<number>, max: ArrayLike<number>, includeBSP = true): boolean {
        if (!this.hasAntiPortals) return false;
        mask &= this.antiPortalMask;
        if (!mask) return false;

        for (const portal of this.antiPortals) {
            if (!(mask & portal.zoneMask) || !planesContainBounds(portal.planes, min, max)) continue;

            mask &= ~portal.zoneMask;
            if (!mask) return true;
        }
        if (includeBSP) for (const portal of this.bspAntiPortals) {
            if (!(mask & portal.zoneMask) || !portal.containsBounds(min, max)) continue;

            mask &= ~portal.zoneMask;
            if (!mask) return true;
        }
        return false;
    }

    public prepare(sector: SectorObject, position: THREE.Vector3, frustum: THREE.Frustum, mask: bigint, exterior = false): bigint {
        const cameraZone = sector.findPositionZone(position);
        this.active = false;
        if (!exterior && (cameraZone === null || cameraZone <= 0 || cameraZone >= 64 || sector.outdoorZoneMask & (1n << BigInt(cameraZone)))) return mask;

        if (this.nodes !== sector.bspNodes) {
            this.nodes = sector.bspNodes;
            this.portals.length = 0;
            for (const node of this.nodes) {
                if (!(node.surfFlags & PolyFlags_T.PF_Portal) || node.zones[0] === node.zones[1]) continue;
                if (node.zones.some(zone => zone < 0 || zone >= 64)) {
                    this.nodes = null;
                    return mask;
                }
                this.portals.push({ node, rect: { minX: 0, minY: 0, maxX: 1, maxY: 1 }, source: 0, target: 0, visible: false });
            }
        }

        if (exterior) {
            let visible = false;
            for (const { node } of this.portals) {
                const distance = portalDistance(node, position);
                const source = node.zones[distance > 0 ? 1 : 0], target = node.zones[distance > 0 ? 0 : 1];
                if (!(sector.outdoorZoneMask & arrZoneBits[source]) || sector.outdoorZoneMask & arrZoneBits[target]) continue;
                if (frustum.intersectsSphere(node.exclusiveSphereBound)) { visible = true; break; }
            }
            if (!visible) return sector.outdoorZoneMask;
        }

        const planes = frustum.planes, near = planes[5];
        for (const portal of this.portals) {
            const node = portal.node, vertices = node.portalVertices, rect = portal.rect;
            const distance = portalDistance(node, position);
            portal.source = node.zones[distance > 0 ? 1 : 0];
            portal.target = node.zones[distance > 0 ? 0 : 1];
            rect.minX = rect.minY = 0;
            rect.maxX = rect.maxY = 1;
            portal.visible = (!node.portalPolygon || this.bspPortalVisibility.get(node.portalPolygon.surface) !== false) && (!exterior || frustum.intersectsSphere(node.exclusiveSphereBound));
            if (!portal.visible) continue;
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
        this.queue.length = 0;
        this.queued.fill(0);
        this.cameraMask = exterior ? sector.outdoorZoneMask : 1n << BigInt(cameraZone);
        this.mask = this.cameraMask;
        for (let zone = 0; zone < 64; zone++) {
            if (!(this.cameraMask & arrZoneBits[zone])) continue;
            const view = this.rects[zone];
            view.minX = view.minY = 0;
            view.maxX = view.maxY = 1;
            this.queue.push(zone);
            this.queued[zone] = 1;
        }
        for (let i = 0; i < this.queue.length; i++) {
            const source = this.queue[i], from = this.rects[source];
            this.queued[source] = 0;
            for (const portal of this.portals) {
                if (!portal.visible || portal.source !== source || !(mask & (1n << BigInt(portal.target)))) continue;
                const rect = portal.rect, target = this.rects[portal.target];
                const minX = Math.max(from.minX, rect.minX),
                    minY = Math.max(from.minY, rect.minY),
                    maxX = Math.min(from.maxX, rect.maxX),
                    maxY = Math.min(from.maxY, rect.maxY);
                if (minX > maxX || minY > maxY) continue;
                if (minX >= target.minX && minY >= target.minY && maxX <= target.maxX && maxY <= target.maxY) continue;
                target.minX = Math.min(target.minX, minX);
                target.minY = Math.min(target.minY, minY);
                target.maxX = Math.max(target.maxX, maxX);
                target.maxY = Math.max(target.maxY, maxY);
                this.mask |= 1n << BigInt(portal.target);
                if (!this.queued[portal.target]) {
                    this.queue.push(portal.target);
                    this.queued[portal.target] = 1;
                }
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
        this.active = true;
        return this.mask;
    }

    protected expandRect(rect: Rect_T, vertex: THREE.Vector3, planes: THREE.Plane[]): void {
        const left = planes[1].distanceToPoint(vertex),
            right = planes[0].distanceToPoint(vertex),
            bottom = planes[2].distanceToPoint(vertex),
            top = planes[3].distanceToPoint(vertex);
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

    public intersectsBox(mask: bigint, box: THREE.Box3, includeBSP = true): boolean {
        box.min.toArray(arrMin); box.max.toArray(arrMax);
        return this.intersectsBounds(mask, arrMin, arrMax, includeBSP);
    }

    public intersectsBounds(mask: bigint, min: ArrayLike<number>, max: ArrayLike<number>, includeBSP = true): boolean {
        if (this.isOccluded(mask, min, max, includeBSP)) return false;
        if (!this.active || !mask || mask & this.cameraMask) return true;
        mask &= this.mask;
        for (const zone of this.zones) {
            if (!(mask & arrZoneBits[zone])) continue;
            let visible = true;
            for (const plane of this.planes[zone]) {
                const n = plane.normal;
                if (n.x * (n.x > 0 ? max[0] : min[0]) + n.y * (n.y > 0 ? max[1] : min[1]) + n.z * (n.z > 0 ? max[2] : min[2]) + plane.constant < 0) {
                    visible = false;
                    break;
                }
            }
            if (visible) return true;
        }
        return false;
    }
}

export default ZoneVisibility;
