import { Box3, Matrix3, Matrix4, Vector3 } from "three";
import type { CollisionModel_T, CollisionPrimitive_T, CollisionTriangleIndex_T } from "../objects/objects";

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
const tmpMatrix = new Matrix4();
const tmpNormalMatrix = new Matrix3();
const tmpModelNormalMatrix = new Matrix3();
const tmpPlanePoint = new Vector3();
const tmpPlaneNormal = new Vector3();
const tmpTriangleHit: PrimitiveHit_T = { time: 1, normal: new Vector3(), item: -1 };
const tmpHullHit: PrimitiveHit_T = { time: 1, normal: new Vector3(), item: -1 };
const tmpBestHit: PrimitiveHit_T = { time: 1, normal: new Vector3(), item: -1 };
const tmpPointHit: PrimitiveHit_T = { time: 0, normal: new Vector3(), item: -1 };
const clipState: ClipState_T = { t0: -1, t1: 1, normal: new Vector3(), item: -1, hit: false };
const arrHullPlanes: HullPlane_T[] = [];
const arrHullBoxPlanes: HullPlane_T[] = [];
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
let bspModel: CollisionModel_T = null;
let bspMatrix: Matrix4 = null;
let bspPlaneX = 0;
let bspPlaneY = 0;
let bspPlaneZ = 0;
let bspPlaneW = 0;
let bspStart: Vector3 = null;
let bspEnd: Vector3 = null;
let bspExtent: Vector3 = null;
let bspBestTime = 2;
let bspHit = false;
let bspHitX = 0;
let bspHitY = 0;
let bspHitZ = 0;
let bspHitItem = -1;
let terrainPrimitive: Extract<CollisionPrimitive_T, { kind: "terrain" }> = null;
let terrainBestTime = 1;
let terrainBestItem = -1;
let gridClipT0 = 0;
let gridClipT1 = 1;

export type PrimitiveHit_T = { time: number, normal: Vector3, item: number };
type ClipState_T = { t0: number, t1: number, normal: Vector3, item: number, hit: boolean };
type GridCellVisitor_T = (x: number, y: number) => number; // returns the best hit time so far
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

    let bestTime = Infinity;

    for (let steps = 0; steps <= maxSteps; steps++) {
        const x0 = Math.max(minCellX, cellX - padX), x1 = Math.min(maxCellX, cellX + padX);
        const y0 = Math.max(minCellY, cellY - padY), y1 = Math.min(maxCellY, cellY + padY);

        for (let y = y0; y <= y1; y++)
            for (let x = x0; x <= x1; x++) bestTime = visit(x, y);

        if (cellX === lastX && cellY === lastY) return;
        if (gridClipT0 + Math.min(nextX, nextY) * (gridClipT1 - gridClipT0) >= bestTime) return; // cells come in ray order, nothing further along can be nearer

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

    return staticBestTime;
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

    return terrainBestTime;
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

function pointHull(planes: HullPlane_T[], boxPlanes: HullPlane_T[], location: Vector3, extent: Vector3): PrimitiveHit_T | null {
    pointBestDistance = Infinity;

    for (const plane of planes)
        if (!pointClip(plane[0], plane[1], plane[2], plane[3], location, extent)) return null;

    for (const plane of boxPlanes)
        if (!pointClip(plane[0], plane[1], plane[2], plane[3], location, extent)) return null;

    for (let i = 0, len = planes.length; i < len; i++) {
        const a = planes[i];

        for (let j = 0; j < i; j++) {
            const b = planes[j];
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

function loadBspPlane(x: number, y: number, z: number, w: number) {
    if (!bspMatrix) {
        bspPlaneX = x;
        bspPlaneY = y;
        bspPlaneZ = z;
        bspPlaneW = w;
        return;
    }

    tmpPlaneNormal.set(x, y, z).applyMatrix3(tmpModelNormalMatrix).normalize();
    tmpPlanePoint.set(x * w, y * w, z * w).applyMatrix4(bspMatrix);

    bspPlaneX = tmpPlaneNormal.x;
    bspPlaneY = tmpPlaneNormal.y;
    bspPlaneZ = tmpPlaneNormal.z;
    bspPlaneW = tmpPlaneNormal.dot(tmpPlanePoint);
}

function loadBspNodePlane(iNode: number) {
    const planes = bspModel.planes, p = iNode * 4;

    loadBspPlane(planes[p], planes[p + 1], planes[p + 2], planes[p + 3]);
}

function loadBspHullPlanes(source: HullPlane_T[], target: HullPlane_T[]): HullPlane_T[] {
    if (!bspMatrix) return source;

    target.length = source.length;

    for (let i = 0, len = source.length; i < len; i++) {
        const plane = target[i] || (target[i] = [0, 0, 0, 0, 0]);

        loadBspPlane(source[i][0], source[i][1], source[i][2], source[i][3]);
        plane[0] = bspPlaneX;
        plane[1] = bspPlaneY;
        plane[2] = bspPlaneZ;
        plane[3] = bspPlaneW;
        plane[4] = source[i][4];
    }

    return target;
}

function beginBspQuery(model: CollisionModel_T, matrix: Matrix4) {
    bspModel = model;
    bspMatrix = matrix;

    if (matrix) tmpModelNormalMatrix.getNormalMatrix(matrix);
}

function bspChildOutside(iNode: number, isFront: number, outside: boolean): boolean {
    return isFront ? outside || bspModel.isCsg[iNode] === 1 : outside && bspModel.isCsg[iNode] === 0;
}

function bspLineCheck(iHit: number, iNode: number, endX: number, endY: number, endZ: number, startX: number, startY: number, startZ: number, outside: boolean): boolean { // retail 0x9cb370, ExtraNodeFlags is always 0 so NF_BrightCorners never applies
    const children = bspModel.children;

    while (iNode !== -1) {
        loadBspNodePlane(iNode);

        const dist1 = bspPlaneX * startX + bspPlaneY * startY + bspPlaneZ * startZ - bspPlaneW;
        const dist2 = bspPlaneX * endX + bspPlaneY * endY + bspPlaneZ * endZ - bspPlaneW;

        if (dist1 > -0.001 && dist2 > -0.001) {
            outside = bspChildOutside(iNode, 1, outside);
            iNode = children[iNode * 2 + 1];
        } else if (dist1 < 0.001 && dist2 < 0.001) {
            outside = bspChildOutside(iNode, 0, outside);
            iNode = children[iNode * 2];
        } else {
            const alpha = dist1 / (dist2 - dist1);
            const middleX = startX + (startX - endX) * alpha, middleY = startY + (startY - endY) * alpha, middleZ = startZ + (startZ - endZ) * alpha;
            const frontFirst = dist1 > 0 ? 1 : 0;

            if (!bspLineCheck(iHit, children[iNode * 2 + frontFirst], middleX, middleY, middleZ, startX, startY, startZ, bspChildOutside(iNode, frontFirst, outside))) return false;

            outside = bspChildOutside(iNode, 1 - frontFirst, outside);
            iHit = iNode;
            iNode = children[iNode * 2 + 1 - frontFirst];
            startX = middleX;
            startY = middleY;
            startZ = middleZ;
        }
    }

    if (!outside) {
        bspHitX = startX;
        bspHitY = startY;
        bspHitZ = startZ;
        bspHitItem = iHit;
    }

    return outside;
}

function bspBoxLineCheck(iParent: number, iNode: number, outside: boolean) { // retail 0x9cd7b0
    const children = bspModel.children;

    while (iNode !== -1) {
        loadBspNodePlane(iNode);

        const d0 = bspPlaneX * bspStart.x + bspPlaneY * bspStart.y + bspPlaneZ * bspStart.z - bspPlaneW;
        const d1 = bspPlaneX * bspEnd.x + bspPlaneY * bspEnd.y + bspPlaneZ * bspEnd.z - bspPlaneW;
        const pushOut = Math.abs(bspPlaneX * bspExtent.x * 1.1) + Math.abs(bspPlaneY * bspExtent.y * 1.1) + Math.abs(bspPlaneZ * bspExtent.z * 1.1);
        const useBack = d0 <= pushOut || d1 <= pushOut, useFront = d0 >= -pushOut || d1 >= -pushOut;
        const frontFirst = d0 >= d1 ? 1 : 0;

        if (frontFirst ? useFront : useBack) bspBoxLineCheck(iNode, children[iNode * 2 + frontFirst], bspChildOutside(iNode, frontFirst, outside));
        if (!(frontFirst ? useBack : useFront)) return;

        iParent = iNode;
        outside = bspChildOutside(iNode, 1 - frontFirst, outside);
        iNode = children[iNode * 2 + 1 - frontFirst];
    }

    const hullIndex = bspModel.hullIndices[iParent];

    if (outside || hullIndex === -1) return;

    const hull = bspModel.hulls[hullIndex];

    resetClip(bspBestTime, -1);

    if (!clipBspHull(loadBspHullPlanes(hull.planes, arrHullPlanes), loadBspHullPlanes(hull.boxPlanes, arrHullBoxPlanes), bspStart, bspEnd, bspExtent)) return;
    if (!(clipState.t0 > -1 && clipState.t0 < clipState.t1 && clipState.t1 > 0)) return;

    bspBestTime = clipState.t0;
    bspHit = true;
    tmpBestHit.normal.copy(clipState.normal);
    tmpBestHit.item = clipState.item;
}

function queryBsp(model: CollisionModel_T, matrix: Matrix4, start: Vector3, end: Vector3, extent: Vector3): PrimitiveHit_T | null { // retail UModel::LineCheck 0x9ce810
    beginBspQuery(model, matrix);

    if (extent.x === 0 && extent.y === 0 && extent.z === 0) {
        if (bspLineCheck(0, 0, end.x, end.y, end.z, start.x, start.y, start.z, model.rootOutside)) return null;

        const dx = end.x - start.x, dy = end.y - start.y, dz = end.z - start.z;

        loadBspNodePlane(bspHitItem);

        tmpBestHit.time = ((bspHitX - start.x) * dx + (bspHitY - start.y) * dy + (bspHitZ - start.z) * dz) / (dx * dx + dy * dy + dz * dz);
        tmpBestHit.normal.set(bspPlaneX, bspPlaneY, bspPlaneZ);
        tmpBestHit.item = bspHitItem;

        if (-dx * bspPlaneX - dy * bspPlaneY - dz * bspPlaneZ < 0) tmpBestHit.normal.negate();

        return tmpBestHit;
    }

    bspStart = start;
    bspEnd = end;
    bspExtent = extent;
    bspBestTime = 2;
    bspHit = false;

    bspBoxLineCheck(0, 0, model.rootOutside);

    if (!bspHit) return null;

    tmpBestHit.time = bspBestTime;

    return tmpBestHit;
}

function bspBoxPointCheck(iParent: number, iNode: number, outside: boolean, location: Vector3, extent: Vector3): boolean { // retail 0x9cc580
    const children = bspModel.children;
    let result = true;

    while (iNode !== -1) {
        loadBspNodePlane(iNode);

        const dist = bspPlaneX * location.x + bspPlaneY * location.y + bspPlaneZ * location.z - bspPlaneW;
        const pushOut = Math.abs(bspPlaneX * extent.x * 1.1) + Math.abs(bspPlaneY * extent.y * 1.1) + Math.abs(bspPlaneZ * extent.z * 1.1);

        if (dist > -pushOut && !bspBoxPointCheck(iNode, children[iNode * 2 + 1], bspChildOutside(iNode, 1, outside), location, extent)) result = false;

        iParent = iNode;
        outside = bspChildOutside(iNode, 0, outside);
        iNode = children[iNode * 2];

        if (dist > pushOut) return result;
    }

    const hullIndex = bspModel.hullIndices[iParent];

    if (outside || hullIndex === -1) return result;

    const hull = bspModel.hulls[hullIndex];

    if (!pointHull(loadBspHullPlanes(hull.planes, arrHullPlanes), loadBspHullPlanes(hull.boxPlanes, arrHullBoxPlanes), location, extent)) return result;

    return false;
}

function pointBsp(model: CollisionModel_T, matrix: Matrix4, location: Vector3, extent: Vector3): PrimitiveHit_T | null { // retail UModel::PointCheck 0x9cd410
    beginBspQuery(model, matrix);

    if (extent.x !== 0 || extent.y !== 0 || extent.z !== 0) {
        if (bspBoxPointCheck(0, 0, model.rootOutside, location, extent)) return null;

        tmpPointHit.item = -1;

        return tmpPointHit;
    }

    const children = model.children;
    let iNode = 0, iPrevNode = 0, isFront = 0, outside = model.rootOutside;

    do {
        loadBspNodePlane(iNode);

        iPrevNode = iNode;
        isFront = bspPlaneX * location.x + bspPlaneY * location.y + bspPlaneZ * location.z - bspPlaneW > 0 ? 1 : 0;
        outside = bspChildOutside(iNode, isFront, outside);
        iNode = children[iNode * 2 + isFront];
    } while (iNode !== -1);

    if (outside) return null;

    tmpPointHit.normal.set(0, 0, 0);
    tmpPointHit.item = iPrevNode * 2 + isFront;

    return tmpPointHit;
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

    if (primitive.kind === "staticMesh" && primitive.collisionModel && primitive.useSimpleBoxCollision)
        return pointBsp(primitive.collisionModel, primitive.matrixWorld, location, extent);

    if (primitive.kind === "bsp") return pointBsp(primitive.model, null, location, extent);

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

    if (denominator < 0.000001) return false; // FIntersectPlanes2 0x9cc310 zeroes I and D below this, which makes the convolved plane a NaN no-op

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

function clipBspHull(planes: HullPlane_T[], boxPlanes: HullPlane_T[], start: Vector3, end: Vector3, extent: Vector3): boolean {
    for (const plane of planes)
        if (!clipBspPlane(plane[0], plane[1], plane[2], plane[3], plane[4], start, end, extent)) return false;

    for (const plane of boxPlanes)
        if (!clipBspPlane(plane[0], plane[1], plane[2], plane[3], -1, start, end, extent)) return false;

    for (let i = 0, len = planes.length; i < len; i++) {
        const a = planes[i];

        for (let j = 0; j < i; j++) {
            const b = planes[j];
            const flags = planeFlags(a[0], a[1], a[2]) | planeFlags(b[0], b[1], b[2]);

            if ((flags & 3) === 3 && !clipHullEdge(a, b, 0, start, end, extent)) return false;
            if ((flags & 12) === 12 && !clipHullEdge(a, b, 1, start, end, extent)) return false;
            if ((flags & 48) === 48 && !clipHullEdge(a, b, 2, start, end, extent)) return false;
        }
    }

    return true;
}

export function queryPrimitive(primitive: CollisionPrimitive_T, start: Vector3, end: Vector3, extent: Vector3, maxTime: number = 1): PrimitiveHit_T | null {
    if (primitive.kind === "cylinder") return queryCylinder(primitive, start, end, extent, maxTime);
    if (primitive.kind === "staticMesh" && primitive.collisionModel && (extent.lengthSq() === 0 ? primitive.useSimpleLineCollision : primitive.useSimpleBoxCollision))
        return queryBsp(primitive.collisionModel, primitive.matrixWorld, start, end, extent);
    if (primitive.kind !== "bsp") return queryTriangles(primitive, start, end, extent, maxTime);

    return queryBsp(primitive.model, null, start, end, extent);
}

export function sweptBounds(start: Vector3, end: Vector3, extent: Vector3, target: Box3): Box3 {
    target.min.set(Math.min(start.x, end.x) - extent.x, Math.min(start.y, end.y) - extent.y, Math.min(start.z, end.z) - extent.z);
    target.max.set(Math.max(start.x, end.x) + extent.x, Math.max(start.y, end.y) + extent.y, Math.max(start.z, end.z) + extent.z);

    return target;
}