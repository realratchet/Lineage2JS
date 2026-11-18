export type VertexLightMask_T = { flags: Uint8Array, vertexRangeStart?: number, vertexRangeEnd?: number, flagsOffset?: number };

const cacheAffectedVertices = new WeakMap<Uint8Array, { start: number, end: number, offset: number, indices: Uint32Array }>();

function visitVertices(light: VertexLightMask_T, count: number, visit: (vertex: number) => void): void {
    const start = light.vertexRangeStart ?? 0, end = light.vertexRangeEnd ?? count, offset = light.flagsOffset || 0;

    for (let i = 0; i < light.flags.length; i++) {
        let bits = light.flags[i];

        while (bits) {
            const vertex = (i + offset) * 8 + 31 - Math.clz32(bits & -bits);

            if (vertex >= start && vertex < end) visit(vertex);
            bits &= bits - 1;
        }
    }
}

export function buildStaticLightIndices(lights: VertexLightMask_T[], count: number) {
    const offsets = new Uint32Array(count + 1);

    for (const light of lights) visitVertices(light, count, vertex => offsets[vertex + 1]++);
    for (let i = 1; i <= count; i++) {
        const next = offsets[i] + offsets[i - 1];

        if (next > 0xffffffff) throw new Error(`Static lighting index overflow.`);
        offsets[i] = next;
    }

    const indices = lights.length <= 65536 ? new Uint16Array(offsets[count]) : new Uint32Array(offsets[count]);
    const cursor = offsets.slice(0, count);

    for (let i = 0; i < lights.length; i++) visitVertices(lights[i], count, vertex => indices[cursor[vertex]++] = i);

    return { offsets, indices };
}

export function mergeMeshLightFlags(totalVertices: number, vertexCounts: number[], flagArrays: Uint8Array[]): VertexLightMask_T {
    let globalVertex = 0;
    let rangeStart = totalVertices;
    let rangeEnd = 0;

    for (let ai = 0; ai < vertexCounts.length; ai++) {
        if (flagArrays[ai]) {
            rangeStart = Math.min(rangeStart, globalVertex);
            rangeEnd = globalVertex + vertexCounts[ai];
        }
        globalVertex += vertexCounts[ai];
    }

    if (rangeStart > rangeEnd) {
        rangeStart = 0;
        rangeEnd = 0;
    }

    const flagsOffset = rangeStart >> 3;
    const result = new Uint8Array(Math.ceil(rangeEnd / 8) - flagsOffset);
    globalVertex = 0;

    for (let ai = 0; ai < vertexCounts.length; ai++) {
        const actorVertexCount = vertexCounts[ai];
        const actorFlags = flagArrays[ai];

        if (actorFlags) {
            const count = Math.min(actorFlags.length, Math.ceil(actorVertexCount / 8));
            const shift = globalVertex & 7;
            const offset = Math.floor(globalVertex / 8) - flagsOffset;
            const tail = actorVertexCount & 7;

            for (let bi = 0; bi < count; bi++) {
                const bits = tail && bi === Math.floor(actorVertexCount / 8) ? actorFlags[bi] & ((1 << tail) - 1) : actorFlags[bi];

                result[offset + bi] |= bits << shift;
                if (shift) result[offset + bi + 1] |= bits >>> (8 - shift);
            }
        }
        globalVertex += actorVertexCount;
    }

    return { flags: result, vertexRangeStart: rangeStart, vertexRangeEnd: rangeEnd, flagsOffset };
}

export function getAffectedVertices(light: VertexLightMask_T, vertexCount: number): Uint32Array {
    const { flags, vertexRangeStart: rangeStart = 0, vertexRangeEnd: rangeEnd = vertexCount, flagsOffset = 0 } = light;
    const cached = cacheAffectedVertices.get(flags);
    if (cached && cached.start === rangeStart && cached.end === rangeEnd && cached.offset === flagsOffset) return cached.indices;

    let count = 0;
    for (let vi = rangeStart; vi < rangeEnd; vi++) {
        const byte = flags[(vi >> 3) - flagsOffset];

        if (byte === 0) vi |= 7;
        else if (byte & (1 << (vi & 7))) count++;
    }

    const indices = new Uint32Array(count);
    for (let vi = rangeStart, k = 0; vi < rangeEnd; vi++) {
        const byte = flags[(vi >> 3) - flagsOffset];

        if (byte === 0) vi |= 7;
        else if (byte & (1 << (vi & 7))) indices[k++] = vi;
    }

    cacheAffectedVertices.set(flags, { start: rangeStart, end: rangeEnd, offset: flagsOffset, indices });
    return indices;
}

export function* buildVertexLightIndices(lights: VertexLightMask_T[], count: number) {
    const counts = new Uint32Array(count), offsets = new Uint32Array(count + 1);

    for (const entry of lights) {
        const affected = getAffectedVertices(entry, count);

        for (let k = 0; k < affected.length; k++) counts[affected[k]]++;
        yield;
    }

    for (let i = 0; i < count; i++) offsets[i + 1] = offsets[i] + counts[i];
    const indices = new Uint32Array(offsets[count]);
    counts.set(offsets.subarray(0, count));
    yield;
    for (let i = 0; i < lights.length; i++) {
        const entry = lights[i], affected = getAffectedVertices(entry, count);

        for (let k = 0; k < affected.length; k++) indices[counts[affected[k]]++] = i;
        yield;
    }

    return { offsets, indices };
}
