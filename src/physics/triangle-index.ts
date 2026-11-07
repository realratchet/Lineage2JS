import type { CollisionTriangleIndex_T } from "../objects/objects";

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

    return { minX, minY, cellSizeX, cellSizeY, sizeX: size, sizeY: size, offsets, triangleIndices, triangleBounds, marks: new Uint32Array(indices.length / 3), queryTag: 0 };
}

export default buildTriangleIndex;
