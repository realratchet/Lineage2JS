import { Plane, Vector3, type Sphere } from "three";
import type { BSPBrushPolygonDecodeInfo_T } from "../assets/unreal/bsp/un-bsp-node";

const arrClipVertices: Vector3[][] = [[], []];
const tmpSide = new Vector3(), tmpPreviousSide = new Vector3(), tmpCross = new Vector3();
const SPLIT_POLY_THRESHOLD = 0.25;
const POLY_VERTEX_THRESHOLD = 14;

export function getPolygonArea(vertices: readonly Vector3[], count = vertices.length): number {
    if (count < 3) return 0;

    const origin = vertices[0];
    let area = 0;
    tmpPreviousSide.subVectors(vertices[1], origin);
    for (let i = 2; i < count; i++) {
        tmpSide.subVectors(vertices[i], origin);
        area = Math.fround(area + tmpCross.crossVectors(tmpPreviousSide, tmpSide).length());
        tmpPreviousSide.copy(tmpSide);
    }

    return area;
}

function getClippedPolygonArea(vertices: Vector3[], planes: Plane[], area: number): number {
    let source = vertices, count = source.length;

    // FConvexVolume::ClipPolygon uses FPoly::Split with NoOverflow.
    for (const plane of planes) {
        let front = false, back = false;

        for (let i = 0; i < count; i++) {
            const distance = plane.distanceToPoint(source[i]);
            if (distance < -SPLIT_POLY_THRESHOLD) front = true;
            else if (distance > SPLIT_POLY_THRESHOLD) back = true;
        }
        if (!back) continue;
        if (!front) return 0;
        if (count >= POLY_VERTEX_THRESHOLD) continue;

        const target = arrClipVertices[source === arrClipVertices[0] ? 1 : 0];
        let previous = source[count - 1], previousDistance = plane.distanceToPoint(previous), nextCount = 0;
        for (let i = 0; i < count; i++) {
            const vertex = source[i], distance = plane.distanceToPoint(vertex);
            if ((previousDistance <= 0) !== (distance <= 0)) {
                const point = target[nextCount] || (target[nextCount] = new Vector3());
                point.copy(previous).lerp(vertex, previousDistance / (previousDistance - distance));
                nextCount++;
            }
            if (distance <= 0) {
                const point = target[nextCount] || (target[nextCount] = new Vector3());
                point.copy(vertex);
                nextCount++;
            }
            previous = vertex;
            previousDistance = distance;
        }
        source = target;
        count = nextCount;
        if (count < 3) return 0;
    }

    return source === vertices ? area : getPolygonArea(source, count);
}

export function planesContainBounds(planes: readonly Plane[], min: ArrayLike<number>, max: ArrayLike<number>): boolean {
    if (!planes.length) return false;
    for (const { normal: n, constant } of planes)
        if (n.x * (n.x >= 0 ? max[0] : min[0]) + n.y * (n.y >= 0 ? max[1] : min[1]) + n.z * (n.z >= 0 ? max[2] : min[2]) + constant > 0) return false;
    return true;
}

export class BSPAntiPortalVolume {
    public zoneMask = 0n;
    protected readonly arrPlanes: Plane[];
    protected readonly vertices: Vector3[];
    protected readonly normal: Vector3;

    public constructor(info: BSPBrushPolygonDecodeInfo_T) {
        this.vertices = info.vertices.map(vertex => new Vector3().fromArray(vertex));
        this.normal = new Vector3().fromArray(info.normal).normalize();
        this.arrPlanes = Array.from({ length: Math.min(31, this.vertices.length + 1) }, () => new Plane());
    }

    public extrude(position: Vector3, rangeOrigin: Vector3, range: number, sphere: Sphere, zoneMask: bigint): boolean {
        const vertices = this.vertices, planes = this.arrPlanes, plane = planes[0];
        if (vertices.length < 3 || this.normal.lengthSq() === 0) return false;

        // Engine.dll 0x91bc80 tests the node sphere or any vertex of the original brush polygon.
        if (range < sphere.center.distanceTo(rangeOrigin) - sphere.radius) {
            const rangeSq = range * range;
            if (!vertices.some(vertex => vertex.distanceToSquared(rangeOrigin) < rangeSq)) return false;
        }

        plane.setFromNormalAndCoplanarPoint(this.normal, vertices[0]);
        const distance = plane.distanceToPoint(position);
        if (Math.abs(distance) < 1e-6) return false;
        if (distance < 0) plane.negate();

        for (let i = 1; i < planes.length; i++) {
            const a = vertices[i - 1], b = vertices[i % vertices.length];
            planes[i].setFromCoplanarPoints(position, a, b);
            if (distance < 0) planes[i].negate();
        }

        this.zoneMask = zoneMask;
        return true;
    }

    public containsBounds(min: ArrayLike<number>, max: ArrayLike<number>): boolean {
        return planesContainBounds(this.arrPlanes, min, max);
    }

    public containsSphere(sphere: Sphere): boolean {
        for (const plane of this.arrPlanes)
            if (plane.distanceToPoint(sphere.center) > -sphere.radius) return false;
        return true;
    }

    public clipPolygon(vertices: Vector3[], area: number): number { return getClippedPolygonArea(vertices, this.arrPlanes, area); }
}
