import type { DecodeLibrary, IGeometryDecodeInfo } from "../decode-library";
import type { IMaterialGroupDecodeInfo } from "../un-material";
import type { IStaticMeshObjectDecodeInfo } from "./un-static-mesh";
import type { IStaticMeshInstanceDecodeInfo } from "./un-static-mesh-instance";
import getTypedArrayConstructor from "../utils/typed-arrray-constructor";

export type StaticMeshLodLevel_T = { range: number, vertex: number, index: number, billboard: boolean };

export function buildLodMesh(library: DecodeLibrary, levels: { mesh: IStaticMeshObjectDecodeInfo, range: number, billboard: boolean }[]) {
    const base = levels[0].mesh, geometries = levels.map(level => library.geometries[level.mesh.geometry]);
    const vertexCount = geometries.reduce((sum, geo) => sum + geo.attributes.positions.length / 3, 0);
    const indexCount = geometries.reduce((sum, geo) => sum + geo.indices.length, 0);
    const uvSets = geometries.map(geo => Array.isArray(geo.attributes.uvs) ? geo.attributes.uvs : geo.attributes.uvs ? [geo.attributes.uvs] : []);
    const uvs = Array.from({ length: Math.max(...uvSets.map(sets => sets.length)) }, () => new Float32Array(vertexCount * 2));
    const positions = new Float32Array(vertexCount * 3), normals = new Float32Array(vertexCount * 3);
    const colors = new Uint8ClampedArray(vertexCount * 3);
    const vertexAlpha = geometries.some(geo => geo.attributes.vertexAlpha) ? new Uint8Array(vertexCount).fill(255) : null;
    const indices = new (getTypedArrayConstructor(vertexCount))(indexCount);
    const groups: IGeometryDecodeInfo["groups"] = [], slots: string[] = [], lods: StaticMeshLodLevel_T[] = [];
    const baseVertices = geometries[0].attributes.positions;
    const nearest = new Uint32Array(vertexCount - baseVertices.length / 3);
    let vertex = 0, index = 0;

    for (let i = 0; i < levels.length; i++) {
        const { mesh, range, billboard } = levels[i], geo = geometries[i], attr = geo.attributes;
        lods.push({ range, vertex, index, billboard });
        positions.set(attr.positions, vertex * 3);
        normals.set(attr.normals, vertex * 3);
        colors.set(attr.colors, vertex * 3);
        if (attr.vertexAlpha) vertexAlpha.set(attr.vertexAlpha, vertex);
        uvSets[i].forEach((uv, set) => uvs[set].set(uv, vertex * 2));

        const materials = (library.materials[mesh.materials] as IMaterialGroupDecodeInfo).materials;
        for (const [start, count, slot] of geo.groups) groups.push([index + start, count, slots.length + slot]);
        slots.push(...materials);
        for (let j = 0; j < geo.indices.length; j++) indices[index + j] = geo.indices[j] + vertex;

        // Baked instance colors and light masks are indexed against the original mesh.
        if (i) for (let j = 0; j < attr.positions.length; j += 3) {
            let closest = 0, distance = Infinity;
            for (let k = 0; k < baseVertices.length; k += 3) {
                const x = baseVertices[k] - attr.positions[j], y = baseVertices[k + 1] - attr.positions[j + 1], z = baseVertices[k + 2] - attr.positions[j + 2];
                const d = x * x + y * y + z * z;
                if (d < distance) { closest = k / 3; distance = d; }
                if (!d) break;
            }
            nearest[vertex + j / 3 - baseVertices.length / 3] = closest;
        }
        vertex += attr.positions.length / 3;
        index += geo.indices.length;
    }

    const id = base.uuid + ":lod";
    library.geometries[id] = { ...geometries[0], attributes: { positions, normals, colors, uvs, vertexAlpha }, indices, groups };
    library.geometryInstances[id] = 0;
    library.materials[id] = { name: id, materialType: "group", materials: slots } as IMaterialGroupDecodeInfo;
    return { mesh: { ...base, geometry: id, materials: id, lods }, nearest };
}

export function extendLodLighting(instance: IStaticMeshInstanceDecodeInfo, nearest: Uint32Array) {
    const baseCount = instance.mesh.lods[1].vertex;
    const colors = instance.attributes.colors;
    if (colors) {
        const result = colors instanceof Float32Array ? new Float32Array((baseCount + nearest.length) * 3) : new Uint8Array((baseCount + nearest.length) * 3);
        result.set(colors);
        nearest.forEach((source, index) => {
            for (let c = 0; c < 3; c++) result[(baseCount + index) * 3 + c] = colors[source * 3 + c];
        });
        instance.attributes.colors = result;
    }
    if (!instance.lights) return;
    const { flags, scene, environment } = instance.lights;
    const stride = Math.ceil((baseCount + nearest.length) / 8);
    const result = new Uint8Array(stride * (scene.length + environment.length));
    let offset = 0;
    for (const entry of [...scene, ...environment]) {
        const mask = new Uint8Array(flags, entry[1], entry[2]);
        result.set(mask.subarray(0, Math.ceil(baseCount / 8)), offset);
        if (baseCount % 8) result[offset + (baseCount >> 3)] &= (1 << (baseCount % 8)) - 1;
        nearest.forEach((source, index) => {
            const v = baseCount + index;
            if (mask[source >> 3] & (1 << (source & 7))) result[offset + (v >> 3)] |= 1 << (v & 7);
        });
        entry[1] = offset;
        entry[2] = stride;
        offset += stride;
    }
    instance.lights.flags = result.buffer;
}
