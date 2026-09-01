import { Box3, Matrix3, Matrix4, Vector3 } from "three";
import type { CollisionHull_T, CollisionPrimitive_T, CollisionTriangleIndex_T } from "../objects/objects";

const tmpA = new Vector3();
const tmpB = new Vector3();
const tmpC = new Vector3();
const tmpD = new Vector3();
const tmpE = new Vector3();
const tmpF = new Vector3();
const tmpN = new Vector3();
const tmpN2 = new Vector3();
const tmpA2 = new Vector3();
const tmpB2 = new Vector3();
const tmpIntersection = new Vector3();
const tmpPointStart = new Vector3();
const tmpPointEnd = new Vector3();
const tmpPointExtent = new Vector3();
const tmpLocalStart = new Vector3();
const tmpLocalEnd = new Vector3();
const tmpLocalExtent = new Vector3();
const tmpBounds = new Box3();
const tmpMatrix = new Matrix4();
const tmpNormalMatrix = new Matrix3();
const tmpTriangleHit: PrimitiveHit_T = { time: 1, normal: new Vector3(), item: -1 };
const tmpHullHit: PrimitiveHit_T = { time: 1, normal: new Vector3(), item: -1 };
const tmpBestHit: PrimitiveHit_T = { time: 1, normal: new Vector3(), item: -1 };
const tmpPointHit: PrimitiveHit_T = { time: 0, normal: new Vector3(), item: -1 };
const clipState: ClipState_T = { t0: -1, t1: 1, normal: new Vector3(), item: -1, hit: false };
const arrModelPlanes: HullPlane_T[] = [];
let pointBestDistance = Infinity;
let staticPrimitive: Extract<CollisionPrimitive_T, { kind: "staticMesh" }> = null;
let staticStart: Vector3 = null;
let staticEnd: Vector3 = null;
let staticExtent: Vector3 = null;
let staticWorldStart: Vector3 = null;
let staticWorldEnd: Vector3 = null;
let staticWorldExtent: Vector3 = null;
let staticBestTime = 1;
let staticBestItem = -1;
let bspPrimitive: Extract<CollisionPrimitive_T, { kind: "bsp" }> = null;
let bspStart: Vector3 = null;
let bspEnd: Vector3 = null;
let bspExtent: Vector3 = null;
let bspBestTime = 1;
let bspBestItem = -1;
let terrainPrimitive: Extract<CollisionPrimitive_T, { kind: "terrain" }> = null;
let terrainBestTime = 1;
let terrainBestItem = -1;
let gridClipT0 = 0;
let gridClipT1 = 1;

export type PrimitiveHit_T = { time: number, normal: Vector3, item: number };
type ClipState_T = { t0: number, t1: number, normal: Vector3, item: number, hit: boolean };
type GridCellVisitor_T = (x: number, y: number) => void;
type HullPlane_T = [number, number, number, number, number];

function resetClip(maxTime: number, item: number) {
    clipState.t0 = -1;
    clipState.t1 = maxTime;
    clipState.normal.set(0, 0, 0);
    clipState.item = item;
    clipState.hit = false;
}

function boxPushOut(nx: number, ny: number, nz: number, extent: Vector3): number {
    return Math.abs(nx * extent.x) + Math.abs(ny * extent.y) + Math.abs(nz * extent.z);
}

function clipLine(nx: number, ny: number, nz: number, constant: number, item: number, start: Vector3, end: Vector3, extent: Vector3): boolean {
    const pushOut = boxPushOut(nx, ny, nz, extent);
    const startDist = nx * start.x + ny * start.y + nz * start.z - constant;
    const endDist = nx * end.x + ny * end.y + nz * end.z - constant;
    const difference = startDist - endDist;

    if (difference > 0.00001) {
        const time = (pushOut - startDist) / (endDist - startDist);

        if (time > clipState.t0) {
            clipState.t0 = time;
            clipState.normal.set(nx, ny, nz);
            clipState.item = item;
            clipState.hit = true;
        }
    } else if (difference < -0.00001) {
        const time = (pushOut - startDist) / (endDist - startDist);

        if (time < clipState.t1) clipState.t1 = time;
    } else if (startDist > pushOut && endDist > pushOut) return false;

    return clipState.t0 < clipState.t1 && clipState.t1 > 0;
}

function clipBspPlane(nx: number, ny: number, nz: number, constant: number, item: number, start: Vector3, end: Vector3, extent: Vector3): boolean {
    const pushOut = boxPushOut(nx, ny, nz, extent);
    const d0 = nx * start.x + ny * start.y + nz * start.z - constant;
    const d1 = nx * end.x + ny * end.y + nz * end.z - constant;
    let adjustedD0 = d0 - pushOut;

    if (d0 > d1 && adjustedD0 >= -pushOut && adjustedD0 < 0) adjustedD0 = 0;

    const difference = d0 - d1;
    const time = adjustedD0 / difference;

    if (difference < -0.00001) {
        if (time < clipState.t1) clipState.t1 = time;
    } else if (difference > 0.00001) {
        if (time > clipState.t0) {
            clipState.t0 = time;
            clipState.normal.set(nx, ny, nz);
            clipState.item = item;
            clipState.hit = true;
        }
    } else if (d0 > pushOut && d1 > pushOut) return false;

    return clipState.t0 < clipState.t1;
}

function clipEdge(point: Vector3, direction: Vector3, inward: Vector3, axis: number, start: Vector3, end: Vector3, extent: Vector3): boolean {
    if (axis === 0) tmpN.set(0, -direction.z, direction.y);
    else if (axis === 1) tmpN.set(direction.z, 0, -direction.x);
    else tmpN.set(-direction.y, direction.x, 0);

    tmpN.normalize();

    if (inward.dot(tmpN) < 0) tmpN.multiplyScalar(-1);

    return clipLine(tmpN.x, tmpN.y, tmpN.z, tmpN.dot(point), -1, start, end, extent);
}

function clipTriangleEdge(point: Vector3, next: Vector3, normal: Vector3, start: Vector3, end: Vector3, extent: Vector3): boolean {
    tmpD.copy(next).sub(point);
    tmpE.crossVectors(normal, tmpD);

    if ((tmpD.y !== 0 || tmpD.z !== 0) && !clipEdge(point, tmpD, tmpE, 0, start, end, extent)) return false;
    if ((tmpD.x !== 0 || tmpD.z !== 0) && !clipEdge(point, tmpD, tmpE, 1, start, end, extent)) return false;
    if ((tmpD.x !== 0 || tmpD.y !== 0) && !clipEdge(point, tmpD, tmpE, 2, start, end, extent)) return false;

    return true;
}

// UStaticMesh::LineCheck uses triangles for rays because zero extent collapses box bevel planes.
function lineTriangle(start: Vector3, end: Vector3, a: Vector3, b: Vector3, c: Vector3, item: number, maxTime: number): PrimitiveHit_T | null {
    tmpD.copy(b).sub(a);
    tmpE.copy(c).sub(a);
    tmpN.crossVectors(tmpD, tmpE);

    if (tmpN.lengthSq() < 1e-12) return null;

    tmpN.normalize();
    tmpF.copy(end).sub(start);

    const denominator = tmpN.dot(tmpF);

    if (Math.abs(denominator) < 1e-9) return null;

    const time = (tmpN.dot(a) - tmpN.dot(start)) / denominator;

    if (time < 0 || time > maxTime) return null;

    tmpIntersection.copy(tmpF).multiplyScalar(time).add(start);

    if (!lineTriangleSide(a, b, tmpN)) return null;
    if (!lineTriangleSide(b, c, tmpN)) return null;
    if (!lineTriangleSide(c, a, tmpN)) return null;

    tmpTriangleHit.time = time;
    tmpTriangleHit.normal.copy(tmpN);
    tmpTriangleHit.item = item;

    if (denominator > 0) tmpTriangleHit.normal.multiplyScalar(-1);

    return tmpTriangleHit;
}

function lineTriangleSide(point: Vector3, next: Vector3, normal: Vector3): boolean {
    tmpN2.copy(next).sub(point);
    tmpA2.crossVectors(tmpN2, normal);

    return tmpA2.dot(tmpB2.copy(tmpIntersection).sub(point)) <= 0;
}

function sweptTriangle(start: Vector3, end: Vector3, extent: Vector3, a: Vector3, b: Vector3, c: Vector3, item: number, maxTime: number): PrimitiveHit_T | null {
    if (extent.x === 0 && extent.y === 0 && extent.z === 0) return lineTriangle(start, end, a, b, c, item, maxTime);

    tmpD.copy(b).sub(c);
    tmpE.copy(a).sub(c);
    tmpN.crossVectors(tmpD, tmpE);

    if (tmpN.lengthSq() < 1e-12) return null;

    tmpN.normalize();
    tmpN2.copy(tmpN);
    resetClip(maxTime, item);

    const minX = Math.min(a.x, b.x, c.x), minY = Math.min(a.y, b.y, c.y), minZ = Math.min(a.z, b.z, c.z);
    const maxX = Math.max(a.x, b.x, c.x), maxY = Math.max(a.y, b.y, c.y), maxZ = Math.max(a.z, b.z, c.z);

    if (!clipLine(-1, 0, 0, -minX, -1, start, end, extent)) return null;
    if (!clipLine(1, 0, 0, maxX, -1, start, end, extent)) return null;
    if (!clipLine(0, -1, 0, -minY, -1, start, end, extent)) return null;
    if (!clipLine(0, 1, 0, maxY, -1, start, end, extent)) return null;
    if (!clipLine(0, 0, -1, -minZ, -1, start, end, extent)) return null;
    if (!clipLine(0, 0, 1, maxZ, -1, start, end, extent)) return null;

    const constant = tmpN2.dot(a);

    if (!clipLine(tmpN2.x, tmpN2.y, tmpN2.z, constant, item, start, end, extent)) return null;
    if (!clipLine(-tmpN2.x, -tmpN2.y, -tmpN2.z, -constant, item, start, end, extent)) return null;
    if (!clipTriangleEdge(a, b, tmpN2, start, end, extent)) return null;
    if (!clipTriangleEdge(b, c, tmpN2, start, end, extent)) return null;
    if (!clipTriangleEdge(c, a, tmpN2, start, end, extent)) return null;
    if (!clipState.hit || clipState.t0 < 0 || clipState.t0 > maxTime) return null;

    tmpTriangleHit.time = clipState.t0;
    tmpTriangleHit.normal.copy(clipState.normal);
    tmpTriangleHit.item = clipState.item < 0 ? item : clipState.item;

    return tmpTriangleHit;
}

function terrainSide(point: Vector3, next: Vector3, normal: Vector3, intersection: Vector3, extent: number, winding: number): boolean {
    tmpD.copy(next).sub(point);
    tmpE.crossVectors(tmpD, normal);

    return tmpE.dot(tmpF.copy(intersection).sub(point)) * winding <= extent;
}

function lineTerrainTriangle(start: Vector3, end: Vector3, extent: Vector3, a: Vector3, b: Vector3, c: Vector3, item: number, maxTime: number): PrimitiveHit_T | null {
    a.z += extent.z;
    b.z += extent.z;
    c.z += extent.z;
    tmpD.copy(b).sub(a);
    tmpE.copy(c).sub(a);
    tmpN.crossVectors(tmpD, tmpE);

    if (tmpN.lengthSq() < 1e-12) return null;

    tmpN.normalize();

    const winding = tmpN.z < 0 ? -1 : 1;

    if (winding < 0) tmpN.multiplyScalar(-1);

    tmpD.copy(end).sub(start);

    const denominator = tmpN.dot(tmpD);

    if (denominator >= -0.0001) return null;

    const time = (tmpN.dot(a) - tmpN.dot(start)) / denominator;

    if (time < 0 || time > maxTime) return null;

    tmpIntersection.copy(tmpD).multiplyScalar(time).add(start);

    if (!terrainSide(a, b, tmpN, tmpIntersection, extent.x, winding)) return null;
    if (!terrainSide(b, c, tmpN, tmpIntersection, extent.x, winding)) return null;
    if (!terrainSide(c, a, tmpN, tmpIntersection, extent.x, winding)) return null;

    tmpTriangleHit.time = time;
    tmpTriangleHit.normal.copy(tmpN);
    tmpTriangleHit.item = item;

    return tmpTriangleHit;
}

function transformVertex(primitive: Extract<CollisionPrimitive_T, { kind: "staticMesh" | "terrain" }>, index: number, target: Vector3): Vector3 {
    const vertices = primitive.vertices;

    return target.set(vertices[index * 3], vertices[index * 3 + 1], vertices[index * 3 + 2]).applyMatrix4(primitive.matrixWorld);
}

function clipGridAxis(start: number, delta: number, min: number, max: number): boolean {
    if (Math.abs(delta) < 1e-12) return start >= min && start <= max;

    let a = (min - start) / delta, b = (max - start) / delta;

    if (a > b) [a, b] = [b, a];

    gridClipT0 = Math.max(gridClipT0, a);
    gridClipT1 = Math.min(gridClipT1, b);

    return gridClipT0 <= gridClipT1;
}

export function sweptIntersectsBox(start: Vector3, end: Vector3, extent: Vector3, bounds: Box3): boolean {
    gridClipT0 = 0;
    gridClipT1 = 1;

    if (!clipGridAxis(start.x, end.x - start.x, bounds.min.x - extent.x, bounds.max.x + extent.x)) return false;
    if (!clipGridAxis(start.y, end.y - start.y, bounds.min.y - extent.y, bounds.max.y + extent.y)) return false;

    return clipGridAxis(start.z, end.z - start.z, bounds.min.z - extent.z, bounds.max.z + extent.z);
}

// segment walk; the swept-AABB cell box it replaces grows with the square of the segment length
function walkGridCells(startX: number, startY: number, endX: number, endY: number, padX: number, padY: number, minCellX: number, minCellY: number, maxCellX: number, maxCellY: number, visit: GridCellVisitor_T) {
    gridClipT0 = 0;
    gridClipT1 = 1;

    if (!clipGridAxis(startX, endX - startX, minCellX - padX, maxCellX + 1 + padX)) return;
    if (!clipGridAxis(startY, endY - startY, minCellY - padY, maxCellY + 1 + padY)) return;

    const fromX = startX + (endX - startX) * gridClipT0, fromY = startY + (endY - startY) * gridClipT0;
    const toX = startX + (endX - startX) * gridClipT1, toY = startY + (endY - startY) * gridClipT1;
    const stepX = Math.sign(toX - fromX), stepY = Math.sign(toY - fromY);
    const rateX = stepX !== 0 ? 1 / Math.abs(toX - fromX) : Infinity;
    const rateY = stepY !== 0 ? 1 / Math.abs(toY - fromY) : Infinity;
    const lastX = Math.floor(toX), lastY = Math.floor(toY);
    const maxSteps = (maxCellX - minCellX + 2 * padX) + (maxCellY - minCellY + 2 * padY) + 8;

    let cellX = Math.floor(fromX), cellY = Math.floor(fromY);
    let nextX = stepX > 0 ? (cellX + 1 - fromX) * rateX : stepX < 0 ? (fromX - cellX) * rateX : Infinity;
    let nextY = stepY > 0 ? (cellY + 1 - fromY) * rateY : stepY < 0 ? (fromY - cellY) * rateY : Infinity;

    for (let steps = 0; steps <= maxSteps; steps++) {
        const x0 = Math.max(minCellX, cellX - padX), x1 = Math.min(maxCellX, cellX + padX);
        const y0 = Math.max(minCellY, cellY - padY), y1 = Math.min(maxCellY, cellY + padY);

        for (let y = y0; y <= y1; y++)
            for (let x = x0; x <= x1; x++) visit(x, y);

        if (cellX === lastX && cellY === lastY) return;

        if (nextX <= nextY) {
            if (nextX > 1) return;

            cellX += stepX;
            nextX += rateX;
        } else {
            if (nextY > 1) return;

            cellY += stepY;
            nextY += rateY;
        }
    }

    throw new Error(`Grid walk exceeded ${maxSteps} steps over cells (${minCellX}, ${minCellY})-(${maxCellX}, ${maxCellY}).`);
}

function walkIndexCells(index: CollisionTriangleIndex_T, visit: GridCellVisitor_T) {
    walkGridCells(
        (tmpLocalStart.x - index.minX) / index.cellSizeX,
        (tmpLocalStart.y - index.minY) / index.cellSizeY,
        (tmpLocalEnd.x - index.minX) / index.cellSizeX,
        (tmpLocalEnd.y - index.minY) / index.cellSizeY,
        Math.ceil(tmpLocalExtent.x / index.cellSizeX),
        Math.ceil(tmpLocalExtent.y / index.cellSizeY),
        0, 0, index.sizeX - 1, index.sizeY - 1,
        visit
    );
}

function beginIndexQuery(index: CollisionTriangleIndex_T) {
    index.queryTag++;

    if (index.queryTag === 0xffffffff) {
        index.queryTag = 1;
        index.marks.fill(0);
    }
}

function loadStaticVertex(index: number, target: Vector3): Vector3 {
    const vertices = staticPrimitive.vertices;

    return target.set(vertices[index * 3], vertices[index * 3 + 1], vertices[index * 3 + 2]);
}

function staticNodeIntersects(index: number): boolean {
    const bounds = staticPrimitive.collisionBounds;
    const offset = index * 6;
    let min = bounds[offset] - staticExtent.x, max = bounds[offset + 3] + staticExtent.x;
    let start = staticStart.x, delta = staticEnd.x - staticStart.x;
    let t0 = 0, t1 = staticBestTime;

    if (Math.abs(delta) < 1e-12) {
        if (start < min || start > max) return false;
    } else {
        let a = (min - start) / delta, b = (max - start) / delta;

        if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a);
        t1 = Math.min(t1, b);
        if (t0 > t1) return false;
    }

    min = bounds[offset + 1] - staticExtent.y;
    max = bounds[offset + 4] + staticExtent.y;
    start = staticStart.y;
    delta = staticEnd.y - staticStart.y;

    if (Math.abs(delta) < 1e-12) {
        if (start < min || start > max) return false;
    } else {
        let a = (min - start) / delta, b = (max - start) / delta;

        if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a);
        t1 = Math.min(t1, b);
        if (t0 > t1) return false;
    }

    min = bounds[offset + 2] - staticExtent.z;
    max = bounds[offset + 5] + staticExtent.z;
    start = staticStart.z;
    delta = staticEnd.z - staticStart.z;

    if (Math.abs(delta) < 1e-12) return start >= min && start <= max;

    let a = (min - start) / delta, b = (max - start) / delta;

    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);

    return t0 <= t1;
}

function staticTriangle(index: number): PrimitiveHit_T | null {
    const offset = index * 3;

    loadStaticVertex(staticPrimitive.indices[offset], tmpA);
    loadStaticVertex(staticPrimitive.indices[offset + 1], tmpB);
    loadStaticVertex(staticPrimitive.indices[offset + 2], tmpC);

    tmpA.applyMatrix4(staticPrimitive.matrixWorld);
    tmpB.applyMatrix4(staticPrimitive.matrixWorld);
    tmpC.applyMatrix4(staticPrimitive.matrixWorld);

    return sweptTriangle(staticWorldStart, staticWorldEnd, staticWorldExtent, tmpA, tmpB, tmpC, index, staticBestTime);
}

function queryStaticNode(index: number) {
    const nodes = staticPrimitive.collisionNodes;

    while (index !== -1) {
        if (!staticNodeIntersects(index)) return;

        const offset = index * 4;
        const triangleIndex = nodes[offset + 3];

        loadStaticVertex(staticPrimitive.indices[triangleIndex * 3], tmpA);
        loadStaticVertex(staticPrimitive.indices[triangleIndex * 3 + 1], tmpB);
        loadStaticVertex(staticPrimitive.indices[triangleIndex * 3 + 2], tmpC);
        tmpD.copy(tmpB).sub(tmpC);
        tmpE.copy(tmpA).sub(tmpC);
        tmpN.crossVectors(tmpE, tmpD).normalize();

        const startDistance = tmpN.dot(staticStart) - tmpN.dot(tmpA);
        const endDistance = tmpN.dot(staticEnd) - tmpN.dot(tmpA);
        const pushOut = boxPushOut(tmpN.x, tmpN.y, tmpN.z, staticExtent);

        if (startDistance <= -pushOut && endDistance <= -pushOut) index = nodes[offset];
        else if (startDistance >= pushOut && endDistance >= pushOut) index = nodes[offset + 1];
        else {
            const frontFirst = startDistance >= endDistance ? 1 : 0;

            queryStaticNode(nodes[offset + frontFirst]);
            queryStaticNode(nodes[offset + 2]);

            const hit = staticTriangle(triangleIndex);

            if (hit && hit.time < staticBestTime) {
                staticBestTime = hit.time;
                staticBestItem = hit.item;
                tmpBestHit.normal.copy(hit.normal);
            }

            index = nodes[offset + 1 - frontFirst];
        }
    }
}

function queryStaticTree(primitive: Extract<CollisionPrimitive_T, { kind: "staticMesh" }>, start: Vector3, end: Vector3, extent: Vector3, maxTime: number): PrimitiveHit_T | null {
    tmpMatrix.copy(primitive.matrixWorld).invert();
    tmpLocalStart.copy(start).applyMatrix4(tmpMatrix);
    tmpLocalEnd.copy(end).applyMatrix4(tmpMatrix);

    const elements = tmpMatrix.elements;

    tmpLocalExtent.set(
        Math.abs(elements[0]) * extent.x + Math.abs(elements[4]) * extent.y + Math.abs(elements[8]) * extent.z,
        Math.abs(elements[1]) * extent.x + Math.abs(elements[5]) * extent.y + Math.abs(elements[9]) * extent.z,
        Math.abs(elements[2]) * extent.x + Math.abs(elements[6]) * extent.y + Math.abs(elements[10]) * extent.z
    );

    staticPrimitive = primitive;
    staticStart = tmpLocalStart;
    staticEnd = tmpLocalEnd;
    staticExtent = tmpLocalExtent;
    staticWorldStart = start;
    staticWorldEnd = end;
    staticWorldExtent = extent;
    staticBestTime = maxTime;
    staticBestItem = -1;
    queryStaticNode(0);

    if (staticBestItem < 0) return null;

    tmpBestHit.time = staticBestTime;
    tmpBestHit.item = staticBestItem;

    return tmpBestHit;
}

function queryStaticIndex(primitive: Extract<CollisionPrimitive_T, { kind: "staticMesh" }>, start: Vector3, end: Vector3, extent: Vector3, maxTime: number): PrimitiveHit_T | null {
    tmpMatrix.copy(primitive.matrixWorld).invert();
    tmpLocalStart.copy(start).applyMatrix4(tmpMatrix);
    tmpLocalEnd.copy(end).applyMatrix4(tmpMatrix);

    const elements = tmpMatrix.elements;

    tmpLocalExtent.set(
        Math.abs(elements[0]) * extent.x + Math.abs(elements[4]) * extent.y + Math.abs(elements[8]) * extent.z,
        Math.abs(elements[1]) * extent.x + Math.abs(elements[5]) * extent.y + Math.abs(elements[9]) * extent.z,
        Math.abs(elements[2]) * extent.x + Math.abs(elements[6]) * extent.y + Math.abs(elements[10]) * extent.z
    );

    beginIndexQuery(primitive.index);

    staticPrimitive = primitive;
    staticStart = tmpLocalStart;
    staticEnd = tmpLocalEnd;
    staticExtent = tmpLocalExtent;
    staticWorldStart = start;
    staticWorldEnd = end;
    staticWorldExtent = extent;
    staticBestTime = maxTime;
    staticBestItem = -1;

    walkIndexCells(primitive.index, visitStaticIndexCell);

    if (staticBestItem < 0) return null;

    tmpBestHit.time = staticBestTime;
    tmpBestHit.item = staticBestItem;

    return tmpBestHit;
}

function visitStaticIndexCell(x: number, y: number) {
    const index = staticPrimitive.index;
    const cell = y * index.sizeX + x;

    for (let i = index.offsets[cell]; i < index.offsets[cell + 1]; i++) {
        const triangle = index.triangleIndices[i];

        if (index.marks[triangle] === index.queryTag) continue;

        index.marks[triangle] = index.queryTag;

        const hit = staticTriangle(triangle);

        if (!hit || hit.time >= staticBestTime) continue;

        staticBestTime = hit.time;
        staticBestItem = hit.item;
        tmpBestHit.normal.copy(hit.normal);
    }
}

function queryTerrainIndex(primitive: Extract<CollisionPrimitive_T, { kind: "terrain" }>, start: Vector3, end: Vector3, extent: Vector3, maxTime: number): PrimitiveHit_T | null {
    tmpMatrix.copy(primitive.matrixWorld).invert();
    tmpLocalStart.copy(start).applyMatrix4(tmpMatrix);
    tmpLocalEnd.copy(end).applyMatrix4(tmpMatrix);

    const elements = tmpMatrix.elements;

    tmpLocalExtent.set(
        Math.abs(elements[0]) * extent.x + Math.abs(elements[4]) * extent.y + Math.abs(elements[8]) * extent.z,
        Math.abs(elements[1]) * extent.x + Math.abs(elements[5]) * extent.y + Math.abs(elements[9]) * extent.z,
        Math.abs(elements[2]) * extent.x + Math.abs(elements[6]) * extent.y + Math.abs(elements[10]) * extent.z
    );

    beginIndexQuery(primitive.index);

    terrainPrimitive = primitive;
    terrainBestTime = maxTime;
    terrainBestItem = -1;

    walkIndexCells(primitive.index, visitTerrainIndexCell);

    if (terrainBestItem < 0) return null;

    tmpNormalMatrix.getNormalMatrix(primitive.matrixWorld);
    tmpBestHit.normal.applyMatrix3(tmpNormalMatrix).normalize();
    tmpBestHit.time = terrainBestTime;
    tmpBestHit.item = terrainBestItem;

    return tmpBestHit;
}

function visitTerrainIndexCell(x: number, y: number) {
    const index = terrainPrimitive.index;
    const vertices = terrainPrimitive.vertices;
    const cell = y * index.sizeX + x;

    for (let i = index.offsets[cell]; i < index.offsets[cell + 1]; i++) {
        const triangle = index.triangleIndices[i];

        if (index.marks[triangle] === index.queryTag) continue;

        index.marks[triangle] = index.queryTag;

        const offset = triangle * 3;
        let vertex = terrainPrimitive.indices[offset];

        tmpA.set(vertices[vertex * 3], vertices[vertex * 3 + 1], vertices[vertex * 3 + 2]);
        vertex = terrainPrimitive.indices[offset + 1];
        tmpB.set(vertices[vertex * 3], vertices[vertex * 3 + 1], vertices[vertex * 3 + 2]);
        vertex = terrainPrimitive.indices[offset + 2];
        tmpC.set(vertices[vertex * 3], vertices[vertex * 3 + 1], vertices[vertex * 3 + 2]);

        const hit = lineTerrainTriangle(tmpLocalStart, tmpLocalEnd, tmpLocalExtent, tmpA, tmpB, tmpC, triangle, terrainBestTime);

        if (!hit || hit.time >= terrainBestTime) continue;

        terrainBestTime = hit.time;
        terrainBestItem = hit.item;
        tmpBestHit.normal.copy(hit.normal);
    }
}

function queryTriangles(primitive: Extract<CollisionPrimitive_T, { kind: "staticMesh" | "terrain" }>, start: Vector3, end: Vector3, extent: Vector3, maxTime: number): PrimitiveHit_T | null {
    if (primitive.kind === "staticMesh" && primitive.collisionNodes) return queryStaticTree(primitive, start, end, extent, maxTime);
    if (primitive.kind === "staticMesh" && primitive.index) return queryStaticIndex(primitive, start, end, extent, maxTime);
    if (primitive.kind === "terrain") return queryTerrainIndex(primitive, start, end, extent, maxTime);

    let bestTime = maxTime;
    let bestItem = -1;

    for (let i = 0, len = primitive.indices.length; i < len; i += 3) {
        transformVertex(primitive, primitive.indices[i], tmpA);
        transformVertex(primitive, primitive.indices[i + 1], tmpB);
        transformVertex(primitive, primitive.indices[i + 2], tmpC);

        const hit = sweptTriangle(start, end, extent, tmpA, tmpB, tmpC, i / 3, bestTime);

        if (!hit || hit.time >= bestTime) continue;

        bestTime = hit.time;
        bestItem = hit.item;
        tmpBestHit.normal.copy(hit.normal);
    }

    if (bestItem < 0) return null;

    tmpBestHit.time = bestTime;
    tmpBestHit.item = bestItem;

    return tmpBestHit;
}

function queryCylinder(primitive: Extract<CollisionPrimitive_T, { kind: "cylinder" }>, start: Vector3, end: Vector3, extent: Vector3, maxTime: number): PrimitiveHit_T | null {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const x = start.x - primitive.center.x;
    const y = start.y - primitive.center.y;
    const z = start.z - primitive.center.z;
    const radius = primitive.radius + extent.x;
    const halfHeight = primitive.halfHeight + extent.z;
    const top = primitive.center.z + halfHeight;
    const bottom = primitive.center.z - halfHeight;

    if (start.x > primitive.center.x + radius && end.x > primitive.center.x + radius) return null;
    if (start.x < primitive.center.x - radius && end.x < primitive.center.x - radius) return null;
    if (start.y > primitive.center.y + radius && end.y > primitive.center.y + radius) return null;
    if (start.y < primitive.center.y - radius && end.y < primitive.center.y - radius) return null;
    if (start.z > top && end.z > top) return null;
    if (start.z < bottom && end.z < bottom) return null;

    let t0 = 0;
    let t1 = maxTime;

    if (start.z > top && end.z < top) {
        const time = (top - start.z) / dz;

        if (time > t0) {
            t0 = time;
            tmpBestHit.normal.set(0, 0, 1);
        }
    } else if (start.z < top && end.z > top) t1 = Math.min(t1, (top - start.z) / dz);

    if (start.z < bottom && end.z > bottom) {
        const time = (bottom - start.z) / dz;

        if (time > t0) {
            t0 = time;
            tmpBestHit.normal.set(0, 0, -1);
        }
    } else if (start.z > bottom && end.z < bottom) t1 = Math.min(t1, (bottom - start.z) / dz);

    if (t0 >= t1) return null;

    const a = dx * dx + dy * dy;
    const b = 2 * (x * dx + y * dy);
    const c = x * x + y * y - radius * radius;
    let discriminant = b * b - 4 * a * c;

    if (c < 1 && start.z > bottom && start.z < top) {
        if (dx * x + dy * y >= -0.1) return null;

        tmpBestHit.normal.set(x, y, 0).normalize();
        tmpBestHit.time = 0;
        tmpBestHit.item = -1;

        return tmpBestHit;
    }

    if (discriminant < 0) return null;

    if (a < 0.00000001) {
        if (c > 0) return null;
    } else {
        discriminant = Math.sqrt(discriminant);

        t1 = Math.min(t1, (discriminant - b) * 0.5 / a);

        const time = -(discriminant + b) * 0.5 / a;

        if (time > t0) {
            t0 = time;
            tmpBestHit.normal.set(x + dx * t0, y + dy * t0, 0).normalize();
        }

        if (t0 >= t1) return null;
    }

    tmpBestHit.time = Math.max(0, Math.min(maxTime, t0 - 0.001));
    tmpBestHit.item = -1;

    return tmpBestHit;
}

function pointClip(nx: number, ny: number, nz: number, constant: number, point: Vector3, extent: Vector3): boolean {
    const distance = boxPushOut(nx, ny, nz, extent) - (nx * point.x + ny * point.y + nz * point.z - constant);

    if (distance < pointBestDistance) {
        pointBestDistance = distance;
        tmpPointHit.normal.set(nx, ny, nz);
    }

    return distance > 0;
}

function pointEdge(point: Vector3, direction: Vector3, inward: Vector3, axis: number, location: Vector3, extent: Vector3): boolean {
    if (axis === 0) tmpN.set(0, -direction.z, direction.y);
    else if (axis === 1) tmpN.set(direction.z, 0, -direction.x);
    else tmpN.set(-direction.y, direction.x, 0);

    tmpN.normalize();

    if (inward.dot(tmpN) < 0) tmpN.multiplyScalar(-1);

    return pointClip(tmpN.x, tmpN.y, tmpN.z, tmpN.dot(point), location, extent);
}

function pointTriangleEdge(point: Vector3, next: Vector3, normal: Vector3, location: Vector3, extent: Vector3): boolean {
    tmpD.copy(next).sub(point);
    tmpE.crossVectors(normal, tmpD);

    if ((tmpD.y !== 0 || tmpD.z !== 0) && !pointEdge(point, tmpD, tmpE, 0, location, extent)) return false;
    if ((tmpD.x !== 0 || tmpD.z !== 0) && !pointEdge(point, tmpD, tmpE, 1, location, extent)) return false;
    if ((tmpD.x !== 0 || tmpD.y !== 0) && !pointEdge(point, tmpD, tmpE, 2, location, extent)) return false;

    return true;
}

function pointTriangle(location: Vector3, extent: Vector3, a: Vector3, b: Vector3, c: Vector3, item: number): PrimitiveHit_T | null {
    tmpD.copy(b).sub(c);
    tmpE.copy(a).sub(c);
    tmpN2.crossVectors(tmpD, tmpE);

    if (tmpN2.lengthSq() < 1e-12) return null;

    tmpN2.normalize();
    pointBestDistance = Infinity;

    const minX = Math.min(a.x, b.x, c.x), minY = Math.min(a.y, b.y, c.y), minZ = Math.min(a.z, b.z, c.z);
    const maxX = Math.max(a.x, b.x, c.x), maxY = Math.max(a.y, b.y, c.y), maxZ = Math.max(a.z, b.z, c.z);
    const constant = tmpN2.dot(a);

    if (!pointClip(-1, 0, 0, -minX, location, extent)) return null;
    if (!pointClip(1, 0, 0, maxX, location, extent)) return null;
    if (!pointClip(0, -1, 0, -minY, location, extent)) return null;
    if (!pointClip(0, 1, 0, maxY, location, extent)) return null;
    if (!pointClip(0, 0, -1, -minZ, location, extent)) return null;
    if (!pointClip(0, 0, 1, maxZ, location, extent)) return null;
    if (!pointClip(tmpN2.x, tmpN2.y, tmpN2.z, constant, location, extent)) return null;
    if (!pointClip(-tmpN2.x, -tmpN2.y, -tmpN2.z, -constant, location, extent)) return null;
    if (!pointTriangleEdge(a, b, tmpN2, location, extent)) return null;
    if (!pointTriangleEdge(b, c, tmpN2, location, extent)) return null;
    if (!pointTriangleEdge(c, a, tmpN2, location, extent)) return null;

    tmpPointHit.item = item;

    return tmpPointHit;
}

function pointHull(hull: CollisionHull_T, location: Vector3, extent: Vector3): PrimitiveHit_T | null {
    pointBestDistance = Infinity;

    for (const plane of hull.planes)
        if (!pointClip(plane[0], plane[1], plane[2], plane[3], location, extent)) return null;

    const min = hull.bounds.min, max = hull.bounds.max;

    if (!pointClip(0, 0, -1, 0.1 - min.z, location, extent)) return null;
    if (!pointClip(0, 0, 1, max.z + 0.1, location, extent)) return null;
    if (!pointClip(-1, 0, 0, 0.1 - min.x, location, extent)) return null;
    if (!pointClip(1, 0, 0, max.x - 0.1, location, extent)) return null;
    if (!pointClip(0, -1, 0, 0.1 - min.y, location, extent)) return null;
    if (!pointClip(0, 1, 0, max.y - 0.1, location, extent)) return null;

    for (let i = 0, len = hull.planes.length; i < len; i++) {
        const a = hull.planes[i];

        for (let j = 0; j < i; j++) {
            const b = hull.planes[j];
            const flags = planeFlags(a[0], a[1], a[2]) | planeFlags(b[0], b[1], b[2]);

            if (!intersectPlanes(a, b)) continue;

            if ((flags & 3) === 3) {
                tmpN.set(0, -tmpD.z, tmpD.y).normalize();
                if (a[0] * tmpN.x + a[1] * tmpN.y + a[2] * tmpN.z < 0) tmpN.multiplyScalar(-1);
                if (!pointClip(tmpN.x, tmpN.y, tmpN.z, tmpN.dot(tmpIntersection), location, extent)) return null;
            }
            if ((flags & 12) === 12) {
                tmpN.set(tmpD.z, 0, -tmpD.x).normalize();
                if (a[0] * tmpN.x + a[1] * tmpN.y + a[2] * tmpN.z < 0) tmpN.multiplyScalar(-1);
                if (!pointClip(tmpN.x, tmpN.y, tmpN.z, tmpN.dot(tmpIntersection), location, extent)) return null;
            }
            if ((flags & 48) === 48) {
                tmpN.set(-tmpD.y, tmpD.x, 0).normalize();
                if (a[0] * tmpN.x + a[1] * tmpN.y + a[2] * tmpN.z < 0) tmpN.multiplyScalar(-1);
                if (!pointClip(tmpN.x, tmpN.y, tmpN.z, tmpN.dot(tmpIntersection), location, extent)) return null;
            }
        }
    }

    tmpPointHit.item = -1;

    return tmpPointHit;
}

function pointModelHull(location: Vector3, extent: Vector3): PrimitiveHit_T | null {
    pointBestDistance = Infinity;

    for (const plane of arrModelPlanes)
        if (!pointClip(plane[0], plane[1], plane[2], plane[3], location, extent)) return null;

    for (let i = 0, len = arrModelPlanes.length; i < len; i++) {
        const a = arrModelPlanes[i];

        for (let j = 0; j < i; j++) {
            const b = arrModelPlanes[j];
            const flags = planeFlags(a[0], a[1], a[2]) | planeFlags(b[0], b[1], b[2]);

            if (!intersectPlanes(a, b)) continue;

            if ((flags & 3) === 3) {
                tmpN.set(0, -tmpD.z, tmpD.y).normalize();
                if (a[0] * tmpN.x + a[1] * tmpN.y + a[2] * tmpN.z < 0) tmpN.multiplyScalar(-1);
                if (!pointClip(tmpN.x, tmpN.y, tmpN.z, tmpN.dot(tmpIntersection), location, extent)) return null;
            }
            if ((flags & 12) === 12) {
                tmpN.set(tmpD.z, 0, -tmpD.x).normalize();
                if (a[0] * tmpN.x + a[1] * tmpN.y + a[2] * tmpN.z < 0) tmpN.multiplyScalar(-1);
                if (!pointClip(tmpN.x, tmpN.y, tmpN.z, tmpN.dot(tmpIntersection), location, extent)) return null;
            }
            if ((flags & 48) === 48) {
                tmpN.set(-tmpD.y, tmpD.x, 0).normalize();
                if (a[0] * tmpN.x + a[1] * tmpN.y + a[2] * tmpN.z < 0) tmpN.multiplyScalar(-1);
                if (!pointClip(tmpN.x, tmpN.y, tmpN.z, tmpN.dot(tmpIntersection), location, extent)) return null;
            }
        }
    }

    tmpPointHit.item = -1;

    return tmpPointHit;
}

function findBspCell(x: number, y: number, z: number): number {
    const keys = bspPrimitive.index.keys;
    let min = 0, max = keys.length / 3 - 1;

    while (min <= max) {
        const middle = (min + max) >> 1;
        const offset = middle * 3;
        const difference = keys[offset] - x || keys[offset + 1] - y || keys[offset + 2] - z;

        if (difference < 0) min = middle + 1;
        else if (difference > 0) max = middle - 1;
        else return middle;
    }

    return -1;
}

function queryIndexedHull(index: number) {
    const bspIndex = bspPrimitive.index;

    if (bspIndex.marks[index] === bspIndex.queryTag) return;

    bspIndex.marks[index] = bspIndex.queryTag;

    const hull = bspPrimitive.hulls[index];

    if (!sweptIntersectsBox(bspStart, bspEnd, bspExtent, hull.bounds)) return;

    const hit = queryHull(hull, bspStart, bspEnd, bspExtent, bspBestTime);

    if (!hit || hit.time >= bspBestTime) return;

    bspBestTime = hit.time;
    bspBestItem = hit.item;
    tmpBestHit.normal.copy(hit.normal);
}

function visitBspCell(x: number, y: number) {
    const bspIndex = bspPrimitive.index;
    const cell = findBspCell(x, y, 0);

    if (cell < 0) return;

    for (let i = bspIndex.offsets[cell]; i < bspIndex.offsets[cell + 1]; i++) queryIndexedHull(bspIndex.hullIndices[i]);
}

function queryBsp(primitive: Extract<CollisionPrimitive_T, { kind: "bsp" }>, start: Vector3, end: Vector3, extent: Vector3, maxTime: number): PrimitiveHit_T | null {
    const bspIndex = primitive.index;

    bspIndex.queryTag++;

    if (bspIndex.queryTag === 0xffffffff) {
        bspIndex.queryTag = 1;
        bspIndex.marks.fill(0);
    }

    bspPrimitive = primitive;
    bspStart = start;
    bspEnd = end;
    bspExtent = extent;
    bspBestTime = maxTime;
    bspBestItem = -1;

    const cellSize = bspIndex.cellSize;
    const bounds = primitive.bounds;

    for (const index of bspIndex.largeHullIndices) queryIndexedHull(index);

    walkGridCells(
        start.x / cellSize, start.y / cellSize, end.x / cellSize, end.y / cellSize,
        Math.ceil(extent.x / cellSize), Math.ceil(extent.y / cellSize),
        Math.floor(bounds.min.x / cellSize), Math.floor(bounds.min.y / cellSize),
        Math.floor(bounds.max.x / cellSize), Math.floor(bounds.max.y / cellSize),
        visitBspCell
    );

    if (bspBestItem < 0 && bspBestTime === maxTime) return null;

    tmpBestHit.time = bspBestTime;
    tmpBestHit.item = bspBestItem;

    return tmpBestHit;
}

export function pointPrimitive(primitive: CollisionPrimitive_T, location: Vector3, extent: Vector3): PrimitiveHit_T | null {
    if (primitive.kind === "cylinder") {
        const dz = primitive.center.z - location.z;
        const dx = primitive.center.x - location.x;
        const dy = primitive.center.y - location.y;

        if (dz * dz >= (primitive.halfHeight + extent.z) * (primitive.halfHeight + extent.z)) return null;
        if (dx * dx + dy * dy >= (primitive.radius + extent.x) * (primitive.radius + extent.x)) return null;

        tmpPointHit.normal.set(location.x - primitive.center.x, location.y - primitive.center.y, location.z - primitive.center.z).normalize();
        tmpPointHit.item = -1;

        return tmpPointHit;
    }

    if (primitive.kind === "staticMesh" && primitive.simpleCollisionHulls && primitive.useSimpleBoxCollision)
        return pointModel(primitive, location, extent);

    if (primitive.kind === "bsp") {
        tmpBounds.min.copy(location).sub(extent);
        tmpBounds.max.copy(location).add(extent);

        for (const hull of primitive.hulls) {
            if (!tmpBounds.intersectsBox(hull.bounds)) continue;

            const hit = pointHull(hull, location, extent);

            if (hit) return hit;
        }

        return null;
    }

    if (primitive.kind === "terrain") {
        tmpPointStart.copy(location).setZ(location.z + extent.z);
        tmpPointEnd.copy(location).setZ(location.z - extent.z);
        tmpPointExtent.set(extent.x, extent.y, 0);

        return queryTriangles(primitive, tmpPointStart, tmpPointEnd, tmpPointExtent, 1);
    }

    for (let i = 0, len = primitive.indices.length; i < len; i += 3) {
        transformVertex(primitive, primitive.indices[i], tmpA);
        transformVertex(primitive, primitive.indices[i + 1], tmpB);
        transformVertex(primitive, primitive.indices[i + 2], tmpC);

        const hit = pointTriangle(location, extent, tmpA, tmpB, tmpC, i / 3);

        if (hit) return hit;
    }

    return null;
}

function planeFlags(nx: number, ny: number, nz: number): number {
    return (nx < 0 ? 1 : nx > 0 ? 2 : 0) | (ny < 0 ? 4 : ny > 0 ? 8 : 0) | (nz < 0 ? 16 : nz > 0 ? 32 : 0);
}

function intersectPlanes(a: [number, number, number, number, number], b: [number, number, number, number, number]): boolean {
    tmpN.set(a[0], a[1], a[2]);
    tmpN2.set(b[0], b[1], b[2]);
    tmpD.crossVectors(tmpN, tmpN2);

    const denominator = tmpD.lengthSq();

    if (denominator < 1e-12) return false;

    tmpIntersection.crossVectors(tmpN2, tmpD).multiplyScalar(a[3]);
    tmpIntersection.add(tmpE.crossVectors(tmpD, tmpN).multiplyScalar(b[3])).multiplyScalar(1 / denominator);
    tmpD.normalize();

    return true;
}

function clipHullEdge(a: [number, number, number, number, number], b: [number, number, number, number, number], axis: number, start: Vector3, end: Vector3, extent: Vector3): boolean {
    if (axis === 0) {
        tmpN.set(0, -a[2], a[1]);
        tmpN2.set(0, -b[2], b[1]);
    } else if (axis === 1) {
        tmpN.set(a[2], 0, -a[0]);
        tmpN2.set(b[2], 0, -b[0]);
    } else {
        tmpN.set(-a[1], a[0], 0);
        tmpN2.set(-b[1], b[0], 0);
    }

    if (tmpN.dot(tmpN2) <= 0.001 || !intersectPlanes(a, b)) return true;

    if (axis === 0) tmpN.set(0, -tmpD.z, tmpD.y);
    else if (axis === 1) tmpN.set(tmpD.z, 0, -tmpD.x);
    else tmpN.set(-tmpD.y, tmpD.x, 0);

    tmpN.normalize();

    if (a[0] * tmpN.x + a[1] * tmpN.y + a[2] * tmpN.z < 0) tmpN.multiplyScalar(-1);

    return clipBspPlane(tmpN.x, tmpN.y, tmpN.z, tmpN.dot(tmpIntersection), -1, start, end, extent);
}

function queryHull(hull: CollisionHull_T, start: Vector3, end: Vector3, extent: Vector3, maxTime: number): PrimitiveHit_T | null {
    resetClip(maxTime, -1);

    for (const plane of hull.planes)
        if (!clipBspPlane(plane[0], plane[1], plane[2], plane[3], plane[4], start, end, extent)) return null;

    const min = hull.bounds.min, max = hull.bounds.max;

    if (!clipBspPlane(0, 0, -1, 0.1 - min.z, -1, start, end, extent)) return null;
    if (!clipBspPlane(0, 0, 1, max.z + 0.1, -1, start, end, extent)) return null;
    if (!clipBspPlane(-1, 0, 0, 0.1 - min.x, -1, start, end, extent)) return null;
    if (!clipBspPlane(1, 0, 0, max.x - 0.1, -1, start, end, extent)) return null;
    if (!clipBspPlane(0, -1, 0, 0.1 - min.y, -1, start, end, extent)) return null;
    if (!clipBspPlane(0, 1, 0, max.y - 0.1, -1, start, end, extent)) return null;

    for (let i = 0, len = hull.planes.length; i < len; i++) {
        const a = hull.planes[i];

        for (let j = 0; j < i; j++) {
            const b = hull.planes[j];
            const flags = planeFlags(a[0], a[1], a[2]) | planeFlags(b[0], b[1], b[2]);

            if ((flags & 3) === 3 && !clipHullEdge(a, b, 0, start, end, extent)) return null;
            if ((flags & 12) === 12 && !clipHullEdge(a, b, 1, start, end, extent)) return null;
            if ((flags & 48) === 48 && !clipHullEdge(a, b, 2, start, end, extent)) return null;
        }
    }

    if (!clipState.hit || clipState.t0 < 0 || clipState.t0 >= clipState.t1 || clipState.t1 <= 0) return null;

    tmpHullHit.time = clipState.t0;
    tmpHullHit.normal.copy(clipState.normal);
    tmpHullHit.item = clipState.item;

    return tmpHullHit;
}

function queryModelHull(start: Vector3, end: Vector3, extent: Vector3, maxTime: number): PrimitiveHit_T | null {
    resetClip(maxTime, -1);

    for (const plane of arrModelPlanes)
        if (!clipBspPlane(plane[0], plane[1], plane[2], plane[3], plane[4], start, end, extent)) return null;

    for (let i = 0, len = arrModelPlanes.length; i < len; i++) {
        const a = arrModelPlanes[i];

        for (let j = 0; j < i; j++) {
            const b = arrModelPlanes[j];
            const flags = planeFlags(a[0], a[1], a[2]) | planeFlags(b[0], b[1], b[2]);

            if ((flags & 3) === 3 && !clipHullEdge(a, b, 0, start, end, extent)) return null;
            if ((flags & 12) === 12 && !clipHullEdge(a, b, 1, start, end, extent)) return null;
            if ((flags & 48) === 48 && !clipHullEdge(a, b, 2, start, end, extent)) return null;
        }
    }

    if (!clipState.hit || clipState.t0 < 0 || clipState.t0 >= clipState.t1 || clipState.t1 <= 0) return null;

    tmpHullHit.time = clipState.t0;
    tmpHullHit.normal.copy(clipState.normal);
    tmpHullHit.item = clipState.item;

    return tmpHullHit;
}

function addModelPlane(nx: number, ny: number, nz: number, constant: number, item: number, matrix: Matrix4) {
    tmpN.set(nx, ny, nz);
    tmpIntersection.copy(tmpN).multiplyScalar(constant / tmpN.lengthSq()).applyMatrix4(matrix);
    tmpN.applyMatrix3(tmpNormalMatrix).normalize();
    arrModelPlanes.push([tmpN.x, tmpN.y, tmpN.z, tmpN.dot(tmpIntersection), item]);
}

function loadModelPlanes(hull: CollisionHull_T, matrix: Matrix4) {
    arrModelPlanes.length = 0;
    tmpNormalMatrix.getNormalMatrix(matrix);

    for (const plane of hull.planes) addModelPlane(plane[0], plane[1], plane[2], plane[3], plane[4], matrix);

    const min = hull.bounds.min, max = hull.bounds.max;

    addModelPlane(0, 0, -1, 0.1 - min.z, -1, matrix);
    addModelPlane(0, 0, 1, max.z + 0.1, -1, matrix);
    addModelPlane(-1, 0, 0, 0.1 - min.x, -1, matrix);
    addModelPlane(1, 0, 0, max.x - 0.1, -1, matrix);
    addModelPlane(0, -1, 0, 0.1 - min.y, -1, matrix);
    addModelPlane(0, 1, 0, max.y - 0.1, -1, matrix);
}

function getLocalQuery(matrix: Matrix4, start: Vector3, end: Vector3, extent: Vector3) {
    tmpMatrix.copy(matrix).invert();
    tmpLocalStart.copy(start).applyMatrix4(tmpMatrix);
    tmpLocalEnd.copy(end).applyMatrix4(tmpMatrix);

    const elements = tmpMatrix.elements;

    tmpLocalExtent.set(
        Math.abs(elements[0]) * extent.x + Math.abs(elements[4]) * extent.y + Math.abs(elements[8]) * extent.z,
        Math.abs(elements[1]) * extent.x + Math.abs(elements[5]) * extent.y + Math.abs(elements[9]) * extent.z,
        Math.abs(elements[2]) * extent.x + Math.abs(elements[6]) * extent.y + Math.abs(elements[10]) * extent.z
    );
}

function queryModel(primitive: Extract<CollisionPrimitive_T, { kind: "staticMesh" }>, start: Vector3, end: Vector3, extent: Vector3, maxTime: number): PrimitiveHit_T | null {
    getLocalQuery(primitive.matrixWorld, start, end, extent);

    let bestTime = maxTime;
    let bestItem = -1;

    for (const hull of primitive.simpleCollisionHulls) {
        if (!sweptIntersectsBox(tmpLocalStart, tmpLocalEnd, tmpLocalExtent, hull.bounds)) continue;

        loadModelPlanes(hull, primitive.matrixWorld);

        const hit = queryModelHull(start, end, extent, bestTime);

        if (!hit || hit.time >= bestTime) continue;

        bestTime = hit.time;
        bestItem = hit.item;
        tmpBestHit.normal.copy(hit.normal);
    }

    if (bestItem < 0 && bestTime === maxTime) return null;

    tmpBestHit.time = bestTime;
    tmpBestHit.item = bestItem;

    return tmpBestHit;
}

function pointModel(primitive: Extract<CollisionPrimitive_T, { kind: "staticMesh" }>, location: Vector3, extent: Vector3): PrimitiveHit_T | null {
    getLocalQuery(primitive.matrixWorld, location, location, extent);
    tmpBounds.min.copy(tmpLocalStart).sub(tmpLocalExtent);
    tmpBounds.max.copy(tmpLocalStart).add(tmpLocalExtent);

    for (const hull of primitive.simpleCollisionHulls) {
        if (!tmpBounds.intersectsBox(hull.bounds)) continue;

        loadModelPlanes(hull, primitive.matrixWorld);

        const hit = pointModelHull(location, extent);

        if (hit) return hit;
    }

    return null;
}

export function queryPrimitive(primitive: CollisionPrimitive_T, start: Vector3, end: Vector3, extent: Vector3, maxTime: number = 1): PrimitiveHit_T | null {
    if (primitive.kind === "cylinder") return queryCylinder(primitive, start, end, extent, maxTime);
    if (primitive.kind === "staticMesh" && primitive.simpleCollisionHulls && (extent.lengthSq() === 0 ? primitive.useSimpleLineCollision : primitive.useSimpleBoxCollision))
        return queryModel(primitive, start, end, extent, maxTime);
    if (primitive.kind !== "bsp") return queryTriangles(primitive, start, end, extent, maxTime);

    return queryBsp(primitive, start, end, extent, maxTime);
}

export function sweptBounds(start: Vector3, end: Vector3, extent: Vector3, target: Box3): Box3 {
    target.min.set(Math.min(start.x, end.x) - extent.x, Math.min(start.y, end.y) - extent.y, Math.min(start.z, end.z) - extent.z);
    target.max.set(Math.max(start.x, end.x) + extent.x, Math.max(start.y, end.y) + extent.y, Math.max(start.z, end.z) + extent.z);

    return target;
}