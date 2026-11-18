import type { Box3, Vector3 } from "three";

const tmpRange: [number, number] = [0, 1];

export function clipAxis(range: [number, number], start: number, delta: number, min: number, max: number): boolean {
    if (Math.abs(delta) < 1e-12) return start >= min && start <= max;

    let a = (min - start) / delta, b = (max - start) / delta;

    if (a > b) [a, b] = [b, a];

    range[0] = Math.max(range[0], a);
    range[1] = Math.min(range[1], b);

    return range[0] <= range[1];
}

export function sweptIntersectsBox(start: Vector3, end: Vector3, extent: Vector3, bounds: Box3): boolean {
    tmpRange[0] = 0;
    tmpRange[1] = 1;

    if (!clipAxis(tmpRange, start.x, end.x - start.x, bounds.min.x - extent.x, bounds.max.x + extent.x)) return false;
    if (!clipAxis(tmpRange, start.y, end.y - start.y, bounds.min.y - extent.y, bounds.max.y + extent.y)) return false;

    return clipAxis(tmpRange, start.z, end.z - start.z, bounds.min.z - extent.z, bounds.max.z + extent.z);
}

export function sweptBounds(start: Vector3, end: Vector3, extent: Vector3, target: Box3): Box3 {
    target.min.set(Math.min(start.x, end.x) - extent.x, Math.min(start.y, end.y) - extent.y, Math.min(start.z, end.z) - extent.z);
    target.max.set(Math.max(start.x, end.x) + extent.x, Math.max(start.y, end.y) + extent.y, Math.max(start.z, end.z) + extent.z);

    return target;
}
