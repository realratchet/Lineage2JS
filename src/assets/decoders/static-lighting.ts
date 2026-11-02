import type { BatchLightEntry_T } from "../unreal/static-mesh-batch";

function visitVertices(light: BatchLightEntry_T, count: number, visit: (vertex: number) => void): void {
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

export function buildStaticLightIndices(lights: BatchLightEntry_T[], count: number) {
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
