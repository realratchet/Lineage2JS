import { Matrix4, Matrix3, Vector3, Quaternion } from "three";
import { generateUUID } from "three/src/math/MathUtils";

/**
 * Data-only half of static mesh batching: groups actors by vertex attribute layout,
 * merges shared material sections into big attribute arrays stored back into the
 * DecodeLibrary (merged geometry under library.geometries plus a manifest under library.staticMeshBatches)
 * and rewrites library.leafActors to reference the batch. Uses only three.js math
 * classes, so the decode worker can run it before transferring the library;
 * object-batching.ts instantiates CollidingMesh objects from the manifest on the
 * main thread.
 */

interface BatchElementGroup {
    start: number;
    count: number;
    materialIndex: number;
}

interface BatchElement {
    uuid: string;
    boundsMin: number[];
    boundsMax: number[];
    groups: BatchElementGroup[];
    zoneMask: bigint;
    isRangeIgnored: boolean;
    leaves: number[] | null; // bsp leaves holding the actor, for per-element pvs culling
}

interface BatchLightEntry {
    light: string;
    flags: Uint8Array;
}

interface StaticMeshBatchInfo {
    uuid: string;
    name: string;
    geometry: string; // key into library.geometries
    materials: string;
    actors: GD.IStaticMeshActorDecodeInfo[];
    colliderIndices: Uint32Array | null;
    lights: { scene: BatchLightEntry[]; environment: BatchLightEntry[] } | null;
    perActorAmbient: { startVertex: number, count: number, ambient: any, scaledGlow: number, isSunAffected: boolean }[];
    batchElements: BatchElement[];
}

interface StaticMeshBatchManifest {
    batches: StaticMeshBatchInfo[];
    unbatchable: GD.IStaticMeshActorDecodeInfo[];
}

type ColorTypedArray = Float32Array | Uint8Array | Uint8ClampedArray;

interface PreparedActorGeometryData {
    positions: Float32Array;
    normals: Float32Array;
    uvs: Float32Array | null;
    colors: ColorTypedArray | null;
    colorsInstance: ColorTypedArray | null;
    indices: ArrayLike<number> | null;
    groups: [number, number, number?][];
    materialIndices: number[];
    vertexCount: number;
    worldMatrix: Matrix4;
    normalMatrix: Matrix3;
    reverseWinding: boolean;
    lights: { scene: BatchLightEntry[]; environment: BatchLightEntry[] } | null;
    ambient: { glow: number, vector: GD.Vector3Arr, isUnlit: boolean };
    scaledGlow: number;
    isSunAffected: boolean;
    collider: Uint32Array | null;
}

function groupActorsForBatching(
    library: GD.DecodeLibrary,
    uniqueActors: Map<string, GD.IBaseObjectOrInstanceDecodeInfo>,
    unbatchable: GD.IStaticMeshActorDecodeInfo[]
): Map<string, GD.IStaticMeshActorDecodeInfo[]> {
    const batchGroups = new Map<string, GD.IStaticMeshActorDecodeInfo[]>();

    uniqueActors.forEach(actorBase => {
        const actor = actorBase as GD.IStaticMeshActorDecodeInfo;
        const meshMaterials = actor.instance?.mesh?.materials;
        const meshGeometry = library.geometries[actor.instance?.mesh?.geometry];
        const isBatchable = !(actor as any).dontBatch && meshMaterials && meshGeometry;

        if (!isBatchable) {
            unbatchable.push(actor);
            return;
        }

        const batchKey = `${meshGeometry.attributes.colors ? 1 : 0}:${actor.instance.attributes?.colors ? 1 : 0}`;
        if (!batchGroups.has(batchKey)) batchGroups.set(batchKey, []);
        batchGroups.get(batchKey)!.push(actor);
    });

    // Filter out groups with only one actor
    batchGroups.forEach((actors, key) => {
        if (actors.length < 2) {
            unbatchable.push(...actors);
            batchGroups.delete(key);
        }
    });

    return batchGroups;
}

function resolveMaterialSlots(
    library: GD.DecodeLibrary,
    materialUuid: string,
    variants: Map<string, string>,
    modifiers: string[] = []
): string[] {
    const info = library.materials[materialUuid];

    if (!info) return [materialUuid];

    if (info.materialType === "group") {
        return (info as GD.IMaterialGroupDecodeInfo).materials.flatMap(uuid =>
            resolveMaterialSlots(library, uuid, variants, modifiers)
        );
    }

    if (info.materialType === "instance") {
        const instance = info as GD.IMaterialInstancedDecodeInfo;
        return resolveMaterialSlots(library, instance.baseMaterial, variants, [...modifiers, ...instance.modifiers]);
    }

    if (modifiers.length === 0) return [materialUuid];

    const variantKey = `${materialUuid}:${modifiers.join(":")}`;
    let variantUuid = variants.get(variantKey);

    if (!variantUuid) {
        variantUuid = generateUUID();
        variants.set(variantKey, variantUuid);
        library.materials[variantUuid] = {
            name: variantUuid,
            materialType: "instance",
            baseMaterial: materialUuid,
            modifiers
        } as GD.IMaterialInstancedDecodeInfo;
    }

    return [variantUuid];
}

/**
 * Same view-building as decodeStaticMeshActorLight, minus the THREE.Matrix4 (the
 * merged batch light matrix is always identity).
 */
function prepareActorLights(info?: GD.ILightInstanceDecodeInfo): { scene: BatchLightEntry[]; environment: BatchLightEntry[] } | null {
    if (!info) return null;

    const buffer = info.flags;
    const [scene, environment] = [info.scene, info.environment].map(elems =>
        elems.map(([uuid, byteOffset, length]) => ({
            light: uuid,
            flags: new Uint8Array(buffer, byteOffset, length)
        }))
    );

    return { scene, environment };
}

function prepareActorGeometriesData(
    library: GD.DecodeLibrary,
    actors: GD.IStaticMeshActorDecodeInfo[],
    variants: Map<string, string>
): { actorGeometries: PreparedActorGeometryData[], materialUuids: string[] } {
    const materialUuids: string[] = [];
    const materialIndexes = new Map<string, number>();

    const actorGeometries = actors.map(actor => {
        const info = actor.instance;
        const meshGeo = library.geometries[info.mesh.geometry];
        const positions = meshGeo.attributes.positions as Float32Array;
        const vertexCount = positions.length / 3;
        /* uvs may hold multiple uv sets; batching only carries the first (the "uv" attribute) */
        const uvs = Array.isArray(meshGeo.attributes.uvs) ? meshGeo.attributes.uvs[0] : meshGeo.attributes.uvs;

        const worldMatrix = new Matrix4();
        const pos = actor.position || [0, 0, 0];
        const scl = actor.scale || [1, 1, 1];
        const quat = actor.quaternion || [0, 0, 0, 1];
        const slots = resolveMaterialSlots(library, info.mesh.materials, variants);
        const actorMaterialIndices = slots.map(uuid => {
            let index = materialIndexes.get(uuid);

            if (index === undefined) {
                index = materialUuids.length;
                materialIndexes.set(uuid, index);
                materialUuids.push(uuid);
            }

            return index;
        });

        worldMatrix.compose(
            new Vector3(pos[0], pos[1], pos[2]),
            new Quaternion(quat[0], quat[1], quat[2], quat[3]),
            new Vector3(scl[0], scl[1], scl[2])
        );

        return {
            positions,
            normals: meshGeo.attributes.normals as Float32Array,
            uvs: (uvs as Float32Array) ?? null,
            colors: (meshGeo.attributes.colors as ColorTypedArray) ?? null,
            colorsInstance: ((info.attributes as any)?.colors as ColorTypedArray) ?? null,
            indices: meshGeo.indices ?? null,
            groups: (meshGeo.groups?.length > 0 ? meshGeo.groups : (meshGeo.indices ? [[0, meshGeo.indices.length, 0]] : [])) as [number, number, number?][],
            materialIndices: actorMaterialIndices,
            vertexCount,
            worldMatrix,
            normalMatrix: new Matrix3().getNormalMatrix(worldMatrix),
            reverseWinding: worldMatrix.determinant() < 0,
            lights: prepareActorLights(info.lights),
            ambient: actor.ambient,
            scaledGlow: actor.scaledGlow,
            isSunAffected: actor.isSunAffected ?? true,
            collider: meshGeo.colliderIndices || null
        } as PreparedActorGeometryData;
    });

    return { actorGeometries, materialUuids };
}

function mergeMeshLightFlags(
    totalVertices: number,
    vertexCounts: number[],
    flagArrays: Uint8Array[]
): Uint8Array {
    const bytesNeeded = Math.ceil(totalVertices / 8);
    const result = new Uint8Array(bytesNeeded);
    let globalVertex = 0;

    for (let ai = 0; ai < vertexCounts.length; ai++) {
        const actorVertexCount = vertexCounts[ai];
        const actorFlags = flagArrays[ai];

        if (actorFlags) {
            for (let vi = 0; vi < actorVertexCount; vi++) {
                const srcByte = Math.floor(vi / 8);
                const srcBit = vi % 8;

                if (srcByte < actorFlags.length && (actorFlags[srcByte] & (1 << srcBit))) {
                    const dstVertex = globalVertex + vi;
                    const dstByte = Math.floor(dstVertex / 8);
                    const dstBit = dstVertex % 8;
                    result[dstByte] |= (1 << dstBit);
                }
            }
        }
        globalVertex += actorVertexCount;
    }

    return result;
}

function mergeBatchGeometriesData(actorGeometries: PreparedActorGeometryData[]) {
    let totalVertices = 0;
    let totalIndices = 0;
    let totalColliderIndices = 0;
    let hasColors = false;
    let hasColorsInstance = false;
    let hasUVs = false;
    let ColorArrayConstructor: any = Float32Array;
    let ColorInstanceConstructor: any = Float32Array;

    for (const geo of actorGeometries) {
        totalVertices += geo.vertexCount;
        totalIndices += geo.indices ? geo.indices.length : 0;
        if (geo.collider) totalColliderIndices += geo.collider.length;
        if (geo.colors) {
            hasColors = true;
            ColorArrayConstructor = geo.colors.constructor;
        }
        if (geo.colorsInstance) {
            hasColorsInstance = true;
            ColorInstanceConstructor = geo.colorsInstance.constructor;
        }
        if (geo.uvs) hasUVs = true;
    }

    const mergedPositions = new Float32Array(totalVertices * 3);
    const mergedNormals = new Float32Array(totalVertices * 3);
    const mergedUVs = hasUVs ? new Float32Array(totalVertices * 2) : null;
    const mergedColors = hasColors ? new ColorArrayConstructor(totalVertices * 3) : null;
    const mergedColorsInstance = hasColorsInstance ? new ColorInstanceConstructor(totalVertices * 3) : null;
    const mergedIndices = new Uint32Array(totalIndices);
    const mergedColliderIndices = totalColliderIndices > 0 ? new Uint32Array(totalColliderIndices) : null;

    const mergedSceneLights = new Map<string, Uint8Array[]>();
    const mergedEnvLights = new Map<string, Uint8Array[]>();
    let hasAnyLights = false;
    const perActorAmbient: { startVertex: number, count: number, ambient: any, scaledGlow: number, isSunAffected: boolean }[] = [];

    let vertexOffset = 0;
    let indexOffset = 0;
    let colliderIndexOffset = 0;
    const mergedGroups: { start: number, count: number, materialIndex: number, actorIndex: number }[] = [];

    const tmpV = new Vector3();
    const tmpN = new Vector3();

    for (let ai = 0; ai < actorGeometries.length; ai++) {
        const { positions, normals, uvs, colors, colorsInstance, indices, groups, materialIndices, vertexCount, worldMatrix, normalMatrix, reverseWinding, lights, ambient, scaledGlow, isSunAffected, collider } = actorGeometries[ai];

        for (let vi = 0; vi < vertexCount; vi++) {
            tmpV.fromArray(positions, vi * 3);
            tmpV.applyMatrix4(worldMatrix);
            mergedPositions[(vertexOffset + vi) * 3] = tmpV.x;
            mergedPositions[(vertexOffset + vi) * 3 + 1] = tmpV.y;
            mergedPositions[(vertexOffset + vi) * 3 + 2] = tmpV.z;

            tmpN.fromArray(normals, vi * 3);
            tmpN.applyMatrix3(normalMatrix).normalize();
            mergedNormals[(vertexOffset + vi) * 3] = tmpN.x;
            mergedNormals[(vertexOffset + vi) * 3 + 1] = tmpN.y;
            mergedNormals[(vertexOffset + vi) * 3 + 2] = tmpN.z;
        }

        if (mergedUVs && uvs) mergedUVs.set(uvs.subarray(0, vertexCount * 2), vertexOffset * 2);
        if (mergedColors && colors) mergedColors.set(colors.subarray(0, vertexCount * 3), vertexOffset * 3);
        if (mergedColorsInstance && colorsInstance) mergedColorsInstance.set(colorsInstance.subarray(0, vertexCount * 3), vertexOffset * 3);

        if (indices) {
            for (const [start, count, materialIndex] of groups) {
                mergedGroups.push({
                    start: indexOffset + start,
                    count,
                    materialIndex: materialIndices[materialIndex ?? 0] ?? 0,
                    actorIndex: ai
                });
            }
            if (reverseWinding) {
                for (let ii = 0; ii < indices.length; ii += 3) {
                    mergedIndices[indexOffset + ii] = indices[ii] + vertexOffset;
                    mergedIndices[indexOffset + ii + 1] = indices[ii + 2] + vertexOffset;
                    mergedIndices[indexOffset + ii + 2] = indices[ii + 1] + vertexOffset;
                }
            } else {
                for (let ii = 0; ii < indices.length; ii++) {
                    mergedIndices[indexOffset + ii] = indices[ii] + vertexOffset;
                }
            }
            indexOffset += indices.length;
        }

        if (mergedColliderIndices && collider) {
            if (reverseWinding) {
                for (let ci = 0; ci < collider.length; ci += 3) {
                    mergedColliderIndices[colliderIndexOffset + ci] = collider[ci] + vertexOffset;
                    mergedColliderIndices[colliderIndexOffset + ci + 1] = collider[ci + 2] + vertexOffset;
                    mergedColliderIndices[colliderIndexOffset + ci + 2] = collider[ci + 1] + vertexOffset;
                }
            } else {
                for (let ci = 0; ci < collider.length; ci++) {
                    mergedColliderIndices[colliderIndexOffset + ci] = collider[ci] + vertexOffset;
                }
            }
            colliderIndexOffset += collider.length;
        }

        if (lights) {
            hasAnyLights = true;
            for (const entry of lights.scene) {
                if (!mergedSceneLights.has(entry.light)) mergedSceneLights.set(entry.light, new Array(actorGeometries.length).fill(null));
                mergedSceneLights.get(entry.light)![ai] = entry.flags;
            }
            for (const entry of lights.environment) {
                if (!mergedEnvLights.has(entry.light)) mergedEnvLights.set(entry.light, new Array(actorGeometries.length).fill(null));
                mergedEnvLights.get(entry.light)![ai] = entry.flags;
            }
        }
        perActorAmbient.push({ startVertex: vertexOffset, count: vertexCount, ambient, scaledGlow, isSunAffected });
        vertexOffset += vertexCount;
    }

    const vertexCounts = actorGeometries.map(g => g.vertexCount);

    let mergedLights: { scene: BatchLightEntry[]; environment: BatchLightEntry[] } | null = null;
    if (hasAnyLights) {
        mergedLights = {
            scene: Array.from(mergedSceneLights.entries()).map(([light, flagArrays]) => ({
                light,
                flags: mergeMeshLightFlags(totalVertices, vertexCounts, flagArrays)
            })),
            environment: Array.from(mergedEnvLights.entries()).map(([light, flagArrays]) => ({
                light,
                flags: mergeMeshLightFlags(totalVertices, vertexCounts, flagArrays)
            }))
        };
    }

    return {
        attributes: {
            positions: mergedPositions,
            normals: mergedNormals,
            uvs: mergedUVs,
            colors: mergedColors,
            colorsInstance: mergedColorsInstance
        },
        mergedLights,
        mergedColliderIndices,
        perActorAmbient,
        mergedGroups,
        mergedIndices,
        totalVertices,
        totalIndices
    };
}

/**
 * Replaces the batched actors in the BSP leaves with a single entry representing the
 * whole batch (data half of what updateSceneGraphForBatch used to do).
 */
function rewriteLeafActors(
    library: GD.DecodeLibrary,
    actors: GD.IStaticMeshActorDecodeInfo[],
    batchUuid: string
) {
    const actorUuidSet = new Set(actors.map(a => a.uuid));
    const batchActorEntry = {
        uuid: batchUuid,
        type: "StaticMeshActor" as const,
        zoneMask: actors.reduce((mask, a) => mask | ((a as any).zoneMask || 0n), 0n),
        bounds: { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
    };

    for (const actor of actors) {
        if (actor.bounds) {
            for (let i = 0; i < 3; i++) {
                batchActorEntry.bounds.min[i] = Math.min(batchActorEntry.bounds.min[i], actor.bounds.min[i]);
                batchActorEntry.bounds.max[i] = Math.max(batchActorEntry.bounds.max[i], actor.bounds.max[i]);
            }
        }
    }

    for (let li = 0; li < library.leafActors.length; li++) {
        const leaf = library.leafActors[li];
        let hasBatchActor = false;
        for (let ai = leaf.length - 1; ai >= 0; ai--) {
            if (actorUuidSet.has(leaf[ai].uuid)) {
                if (!hasBatchActor) {
                    leaf[ai] = batchActorEntry as any;
                    hasBatchActor = true;
                } else {
                    leaf.splice(ai, 1);
                }
            }
        }
    }
}

// spatial sort keeps frustum-visible elements contiguous in the merged index buffer,
// so their per-material runs collapse into few draws at rebuild time
function mortonKey(position: number[] | undefined): number {
    if (!position) return 0;

    let x = Math.max(0, Math.min(0xffff, ((position[0] + 165000) / 6) | 0));
    let y = Math.max(0, Math.min(0xffff, ((position[1] + 165000) / 6) | 0));
    let key = 0;

    for (let i = 0; i < 16; i++)
        key += ((x >> i) & 1) * Math.pow(2, 2 * i) + ((y >> i) & 1) * Math.pow(2, 2 * i + 1);

    return key;
}

function buildStaticMeshBatchData(library: GD.DecodeLibrary): StaticMeshBatchManifest {
    const manifest: StaticMeshBatchManifest = { batches: [], unbatchable: [] };

    (library as any).staticMeshBatches = manifest;

    // per-actor leaf lists, collected before rewriteLeafActors replaces the
    // entries with batch-level ones
    const actorLeaves = new Map<string, number[]>();

    library.leafActors.forEach((actors, leafIndex) => {
        for (const a of actors) {
            if (a.type !== "StaticMeshActor") continue;

            let list = actorLeaves.get(a.uuid);

            if (!list) actorLeaves.set(a.uuid, list = []);
            list.push(leafIndex);
        }
    });

    const uniqueActors = new Map<string, GD.IBaseObjectOrInstanceDecodeInfo>();

    library.leafActors.forEach(leaf => {
        leaf.forEach(actor => {
            if (actor.type === "StaticMeshActor" && library.exportedActors.has(actor.uuid)) {
                uniqueActors.set(actor.uuid, actor);
            }
        });
    });

    if (!library.batching.staticMeshes) {
        uniqueActors.forEach(actor => manifest.unbatchable.push(actor as GD.IStaticMeshActorDecodeInfo));
        return manifest;
    }

    const batchGroups = groupActorsForBatching(library, uniqueActors, manifest.unbatchable);
    const materialVariants = new Map<string, string>();

    batchGroups.forEach((actors, batchKey) => {
        try {
            actors.sort((a, b) => mortonKey(a.position) - mortonKey(b.position));

            const { actorGeometries, materialUuids } = prepareActorGeometriesData(library, actors, materialVariants);
            const {
                attributes,
                mergedLights,
                mergedColliderIndices,
                perActorAmbient,
                mergedGroups,
                mergedIndices,
                totalIndices
            } = mergeBatchGeometriesData(actorGeometries);

            const batchUuid = generateUUID();
            const batchElements: BatchElement[] = actors.map((a, ai) => ({
                uuid: a.uuid,
                boundsMin: a.bounds?.min || [0, 0, 0],
                boundsMax: a.bounds?.max || [0, 0, 0],
                groups: mergedGroups
                    .filter(g => g.actorIndex === ai)
                    .map(g => ({ start: g.start, count: g.count, materialIndex: g.materialIndex })),
                zoneMask: (a as any).zoneMask || 0n,
                isRangeIgnored: !!(a as any).isRangeIgnored,
                leaves: actorLeaves.get(a.uuid) ?? null
            }));

            // Regroup indices per material if multi-material
            let finalGroups: [number, number, number][];

            if (mergedGroups.some(g => g.materialIndex !== 0)) {
                const materialGroupsMap = new Map<number, { indices: number[], elementGroup: BatchElementGroup }[]>();
                for (const group of mergedGroups) {
                    const matIndex = group.materialIndex;
                    if (!materialGroupsMap.has(matIndex)) materialGroupsMap.set(matIndex, []);
                    const indices: number[] = [];
                    for (let ii = 0; ii < group.count; ii++) indices.push(mergedIndices[group.start + ii]);
                    const elementGroup = batchElements[group.actorIndex].groups.find(g =>
                        g.start === group.start && g.count === group.count && g.materialIndex === group.materialIndex
                    )!;
                    materialGroupsMap.get(matIndex)!.push({ indices, elementGroup });
                }
                finalGroups = [];
                let globalIndexOffset = 0;
                Array.from(materialGroupsMap.keys()).sort().forEach(matIndex => {
                    const entries = materialGroupsMap.get(matIndex)!;
                    const matGroupStart = globalIndexOffset;
                    let matGroupCount = 0;
                    for (const { indices, elementGroup } of entries) {
                        elementGroup.start = globalIndexOffset;

                        mergedIndices.set(indices, globalIndexOffset);
                        globalIndexOffset += indices.length;
                        matGroupCount += indices.length;
                    }
                    finalGroups.push([matGroupStart, matGroupCount, matIndex]);
                });
            } else {
                finalGroups = [[0, totalIndices, 0]];
            }

            library.geometries[batchUuid] = {
                attributes: {
                    positions: attributes.positions,
                    normals: attributes.normals,
                    ...(attributes.uvs ? { uvs: attributes.uvs } : {}),
                    ...(attributes.colors ? { colors: attributes.colors } : {}),
                    ...(attributes.colorsInstance ? { colorsInstance: attributes.colorsInstance } : {})
                },
                indices: mergedIndices,
                groups: finalGroups
            } as GD.IGeometryDecodeInfo;
            library.materials[batchUuid] = {
                name: batchUuid,
                materialType: "group",
                materials: materialUuids
            } as GD.IMaterialGroupDecodeInfo;

            manifest.batches.push({
                uuid: batchUuid,
                name: `Batch_${actors.length}_${actors[0].name}`,
                geometry: batchUuid,
                materials: batchUuid,
                actors,
                colliderIndices: mergedColliderIndices,
                lights: mergedLights,
                perActorAmbient,
                batchElements
            });

            rewriteLeafActors(library, actors, batchUuid);
        } catch (e) {
            console.warn(`[Batch] Failed to merge batch group ${batchKey}, falling back to individual:`, e);
            manifest.unbatchable.push(...actors);
        }
    });

    return manifest;
}

export default buildStaticMeshBatchData;
export { buildStaticMeshBatchData };
export type { StaticMeshBatchManifest, StaticMeshBatchInfo, BatchElement, BatchElementGroup, BatchLightEntry };
