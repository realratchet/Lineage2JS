import { Box3, Vector3 } from "three";
import type MovableObject from "../objects/movable-object";

type Point_T = [number, number];
type Portal_T = { portalVertices?: number[]; plane: THREE.Vector4; exclusiveSphereBound: THREE.Sphere };

const tmpBox = new Box3();
const tmpVertex = new Vector3();

function cross(a: Point_T, b: Point_T, p: Point_T): number { return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]); }

function area(polygon: Point_T[]): number {
    let value = 0;
    for (let i = 1; i + 1 < polygon.length; i++) value += cross(polygon[0], polygon[i], polygon[i + 1]);
    return Math.abs(value) * 0.5;
}

function clip(polygon: Point_T[], a: Point_T, b: Point_T, inside: boolean): Point_T[] {
    const result: Point_T[] = [];
    let previous = polygon[polygon.length - 1], previousDistance = cross(a, b, previous);

    for (const point of polygon) {
        const distance = cross(a, b, point);
        if ((distance >= 0) !== (previousDistance >= 0)) {
            const alpha = previousDistance / (previousDistance - distance);
            result.push([previous[0] + (point[0] - previous[0]) * alpha, previous[1] + (point[1] - previous[1]) * alpha]);
        }
        if ((distance >= 0) === inside) result.push(point);
        previous = point;
        previousDistance = distance;
    }
    return result;
}

function subtract(polygon: Point_T[], triangle: Point_T[], target: Point_T[][]): void {
    let inside = polygon;
    for (let i = 0; i < 3 && inside.length >= 3; i++) {
        const a = triangle[i], b = triangle[(i + 1) % 3];
        const outside = clip(inside, a, b, false);
        if (outside.length >= 3 && area(outside) > 1e-8) target.push(outside);
        inside = clip(inside, a, b, true);
    }
}

export function isPortalBlocked(portal: Portal_T, doors: MovableObject[]): boolean {
    const vertices = portal.portalVertices;
    if (!vertices || vertices.length < 9 || !doors.length) return false;

    const normal = portal.plane;
    const axis = Math.abs(normal.x) >= Math.abs(normal.y) && Math.abs(normal.x) >= Math.abs(normal.z) ? 0 : Math.abs(normal.y) >= Math.abs(normal.z) ? 1 : 2;
    const x = (axis + 1) % 3, y = (axis + 2) % 3;
    const originX = vertices[x], originY = vertices[y];
    const polygon: Point_T[] = [];
    for (let i = 0; i < vertices.length; i += 3) polygon.push([vertices[i + x] - originX, vertices[i + y] - originY]);
    if (area(polygon) <= 1e-8) return false;
    let uncovered = [polygon];

    for (const door of doors) {
        const geometry = door.geometry;
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        tmpBox.copy(geometry.boundingBox).applyMatrix4(door.matrixWorld);
        if (!portal.exclusiveSphereBound.intersectsBox(tmpBox)) continue;

        const positions = geometry.getAttribute("position"), indices = geometry.index;
        const materials = Array.isArray(door.material) ? door.material : [door.material];
        const groups = Array.isArray(door.material) ? geometry.groups : [{ start: 0, count: indices ? indices.count : positions.count, materialIndex: 0 }];

        for (const group of groups) {
            const material = materials[group.materialIndex] as THREE.ShaderMaterial;
            if ((material as any).isSectorFallbackMaterial || !material.visible || material.transparent || !material.depthWrite || material.alphaTest > 0 || material.defines && "USE_ALPHATEST" in material.defines) continue;

            for (let i = group.start; i + 2 < group.start + group.count; i += 3) {
                const triangle: Point_T[] = [];
                let isNearPortal = true;
                for (let j = 0; j < 3; j++) {
                    tmpVertex.fromBufferAttribute(positions, indices ? indices.getX(i + j) : i + j).applyMatrix4(door.matrixWorld);
                    if (Math.abs(normal.x * tmpVertex.x + normal.y * tmpVertex.y + normal.z * tmpVertex.z - normal.w) > portal.exclusiveSphereBound.radius) isNearPortal = false;
                    triangle.push([tmpVertex.getComponent(x) - originX, tmpVertex.getComponent(y) - originY]);
                }
                if (!isNearPortal) continue;
                const winding = cross(triangle[0], triangle[1], triangle[2]);
                if (Math.abs(winding) < 1e-8) continue;
                if (winding < 0) triangle.reverse();

                const next: Point_T[][] = [];
                for (const piece of uncovered) subtract(piece, triangle, next);
                uncovered = next;
                if (!uncovered.length) return true;
            }
        }
    }

    return false;
}
