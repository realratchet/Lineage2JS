import { clipAxis } from "./collision-bounds";

export type CollisionTriangleIndex_T = {
    minX: number;
    minY: number;
    cellSizeX: number;
    cellSizeY: number;
    sizeX: number;
    sizeY: number;
    offsets: Uint32Array;
    triangleIndices: Uint32Array;
    triangleBounds?: Float32Array;
    marks: Uint16Array | Uint32Array;
    queryTag: number;
};

type IndexPosition_T = { x: number, y: number };
const arrCellTriangles: number[] = [];
const gridClip: [number, number] = [0, 1];

export const MIN_STATIC_MESH_INDEX_COUNT = 384;

export function buildTriangleIndex(vertices: Float32Array, indices: Uint32Array, buildBounds: boolean = false): CollisionTriangleIndex_T {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (let i = 0, len = indices.length; i < len; i++) {
        const offset = indices[i] * 3;

        minX = Math.min(minX, vertices[offset]);
        minY = Math.min(minY, vertices[offset + 1]);
        maxX = Math.max(maxX, vertices[offset]);
        maxY = Math.max(maxY, vertices[offset + 1]);
    }

    const size = Math.max(1, Math.round(Math.sqrt(indices.length / 6)));
    const cellSizeX = (maxX - minX) / size || 1;
    const cellSizeY = (maxY - minY) / size || 1;
    const counts = new Uint32Array(size * size);
    const triangleBounds = buildBounds ? new Float32Array(indices.length * 2) : undefined;

    for (let i = 0, len = indices.length; i < len; i += 3) {
        const ax = vertices[indices[i] * 3], ay = vertices[indices[i] * 3 + 1];
        const bx = vertices[indices[i + 1] * 3], by = vertices[indices[i + 1] * 3 + 1];
        const cx = vertices[indices[i + 2] * 3], cy = vertices[indices[i + 2] * 3 + 1];

        if (triangleBounds) {
            const az = vertices[indices[i] * 3 + 2], bz = vertices[indices[i + 1] * 3 + 2], cz = vertices[indices[i + 2] * 3 + 2];
            triangleBounds[i * 2] = Math.min(ax, bx, cx);
            triangleBounds[i * 2 + 1] = Math.min(ay, by, cy);
            triangleBounds[i * 2 + 2] = Math.min(az, bz, cz);
            triangleBounds[i * 2 + 3] = Math.max(ax, bx, cx);
            triangleBounds[i * 2 + 4] = Math.max(ay, by, cy);
            triangleBounds[i * 2 + 5] = Math.max(az, bz, cz);
        }
        const x0 = Math.max(0, Math.min(size - 1, Math.floor((Math.min(ax, bx, cx) - minX) / cellSizeX)));
        const y0 = Math.max(0, Math.min(size - 1, Math.floor((Math.min(ay, by, cy) - minY) / cellSizeY)));
        const x1 = Math.max(0, Math.min(size - 1, Math.floor((Math.max(ax, bx, cx) - minX) / cellSizeX)));
        const y1 = Math.max(0, Math.min(size - 1, Math.floor((Math.max(ay, by, cy) - minY) / cellSizeY)));

        for (let y = y0; y <= y1; y++)
            for (let x = x0; x <= x1; x++) counts[y * size + x]++;
    }

    const offsets = new Uint32Array(counts.length + 1);

    for (let i = 0, len = counts.length; i < len; i++) offsets[i + 1] = offsets[i] + counts[i];

    const triangleIndices = new Uint32Array(offsets[offsets.length - 1]);
    const cursors = new Uint32Array(offsets);

    for (let i = 0, len = indices.length; i < len; i += 3) {
        const ax = vertices[indices[i] * 3], ay = vertices[indices[i] * 3 + 1];
        const bx = vertices[indices[i + 1] * 3], by = vertices[indices[i + 1] * 3 + 1];
        const cx = vertices[indices[i + 2] * 3], cy = vertices[indices[i + 2] * 3 + 1];
        const x0 = Math.max(0, Math.min(size - 1, Math.floor((Math.min(ax, bx, cx) - minX) / cellSizeX)));
        const y0 = Math.max(0, Math.min(size - 1, Math.floor((Math.min(ay, by, cy) - minY) / cellSizeY)));
        const x1 = Math.max(0, Math.min(size - 1, Math.floor((Math.max(ax, bx, cx) - minX) / cellSizeX)));
        const y1 = Math.max(0, Math.min(size - 1, Math.floor((Math.max(ay, by, cy) - minY) / cellSizeY)));

        for (let y = y0; y <= y1; y++)
            for (let x = x0; x <= x1; x++) {
                const cell = y * size + x;

                triangleIndices[cursors[cell]++] = i / 3;
            }
    }

    return { minX, minY, cellSizeX, cellSizeY, sizeX: size, sizeY: size, offsets, triangleIndices, triangleBounds, marks: new Uint16Array(indices.length / 3), queryTag: 0 };
}

export function prepareTriangleIndex(index: CollisionTriangleIndex_T): CollisionTriangleIndex_T {
    if (index && index.marks.BYTES_PER_ELEMENT !== 2 && index.marks.byteLength === index.marks.buffer.byteLength) {
        index.marks = new Uint16Array(index.marks.length);
        index.queryTag = 0;
    }

    return index;
}

export function buildTriangleBounds(vertices: Float32Array, indices: Uint32Array): Float32Array {
    const bounds = new Float32Array(indices.length * 2);

    for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;

        for (let axis = 0; axis < 3; axis++) {
            bounds[i * 2 + axis] = Math.min(vertices[a + axis], vertices[b + axis], vertices[c + axis]);
            bounds[i * 2 + axis + 3] = Math.max(vertices[a + axis], vertices[b + axis], vertices[c + axis]);
        }
    }

    return bounds;
}

function beginIndexQuery(index: CollisionTriangleIndex_T) {
    index.queryTag++;

    if (index.queryTag === 0xffff) {
        index.queryTag = 1;
        index.marks.fill(0);
    }
}

function collectCellTriangles(index: CollisionTriangleIndex_T, cell: number, triangles: number[], count: number): number {
    for (let i = index.offsets[cell], end = index.offsets[cell + 1]; i < end; i++) {
        const triangle = index.triangleIndices[i];
        if (index.marks[triangle] === index.queryTag) continue;

        index.marks[triangle] = index.queryTag;
        triangles[count++] = triangle;
    }

    return count;
}

export function collectPointTriangles(index: CollisionTriangleIndex_T, localX: number, localY: number, extentX: number, extentY: number, triangles: number[]): void {
    const x0 = Math.max(0, Math.floor((localX - extentX - index.minX) / index.cellSizeX) - 1);
    const y0 = Math.max(0, Math.floor((localY - extentY - index.minY) / index.cellSizeY) - 1);
    const x1 = Math.min(index.sizeX - 1, Math.floor((localX + extentX - index.minX) / index.cellSizeX) + 1);
    const y1 = Math.min(index.sizeY - 1, Math.floor((localY + extentY - index.minY) / index.cellSizeY) + 1);

    beginIndexQuery(index);
    let count = 0;
    for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) count = collectCellTriangles(index, y * index.sizeX + x, triangles, count);

    triangles.length = count;
    triangles.sort((a, b) => a - b);
}

// segment walk; the swept-AABB cell box it replaces grows with the square of the segment length
export function traceTriangleIndex(index: CollisionTriangleIndex_T, start: IndexPosition_T, end: IndexPosition_T, extent: IndexPosition_T, visit: (triangles: number[], count: number) => number): void {
    const startX = (start.x - index.minX) / index.cellSizeX, startY = (start.y - index.minY) / index.cellSizeY;
    const endX = (end.x - index.minX) / index.cellSizeX, endY = (end.y - index.minY) / index.cellSizeY;
    const extentX = extent.x / index.cellSizeX, extentY = extent.y / index.cellSizeY;
    const minCellX = Math.max(0, Math.floor(Math.min(startX, endX) - extentX)), maxCellX = Math.min(index.sizeX - 1, Math.floor(Math.max(startX, endX) + extentX));
    const minCellY = Math.max(0, Math.floor(Math.min(startY, endY) - extentY)), maxCellY = Math.min(index.sizeY - 1, Math.floor(Math.max(startY, endY) + extentY));

    beginIndexQuery(index);
    if (minCellX > maxCellX || minCellY > maxCellY) return;

    let bestTime = Infinity;
    const padX = Math.ceil(extentX), padY = Math.ceil(extentY); // cells outside the swept box only hold triangles the box cells hold too
    gridClip[0] = 0;
    gridClip[1] = 1;

    if (!clipAxis(gridClip, startX, endX - startX, minCellX - padX, maxCellX + 1 + padX)) return;
    if (!clipAxis(gridClip, startY, endY - startY, minCellY - padY, maxCellY + 1 + padY)) return;

    const gridClipT0 = gridClip[0], gridClipT1 = gridClip[1];
    const fromX = startX + (endX - startX) * gridClipT0, fromY = startY + (endY - startY) * gridClipT0;
    const toX = startX + (endX - startX) * gridClipT1, toY = startY + (endY - startY) * gridClipT1;
    const stepX = Math.sign(toX - fromX), stepY = Math.sign(toY - fromY);
    const rateX = stepX !== 0 ? 1 / Math.abs(toX - fromX) : Infinity;
    const rateY = stepY !== 0 ? 1 / Math.abs(toY - fromY) : Infinity;
    const lastX = Math.min(maxCellX + padX, Math.floor(toX)), lastY = Math.min(maxCellY + padY, Math.floor(toY));
    const maxSteps = (maxCellX - minCellX + 2 * padX) + (maxCellY - minCellY + 2 * padY) + 8;

    let cellX = Math.min(maxCellX + padX, Math.floor(fromX)), cellY = Math.min(maxCellY + padY, Math.floor(fromY));
    let nextX = stepX > 0 ? (cellX + 1 - fromX) * rateX : stepX < 0 ? (fromX - cellX) * rateX : Infinity;
    let nextY = stepY > 0 ? (cellY + 1 - fromY) * rateY : stepY < 0 ? (fromY - cellY) * rateY : Infinity;

    for (let steps = 0; steps <= maxSteps; steps++) {
        const x0 = Math.max(minCellX, cellX - padX), x1 = Math.min(maxCellX, cellX + padX);
        const y0 = Math.max(minCellY, cellY - padY), y1 = Math.min(maxCellY, cellY + padY);

        for (let y = y0; y <= y1; y++)
            for (let x = x0; x <= x1; x++) {
                const count = collectCellTriangles(index, y * index.sizeX + x, arrCellTriangles, 0);
                bestTime = visit(arrCellTriangles, count);
            }

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

export default buildTriangleIndex;
