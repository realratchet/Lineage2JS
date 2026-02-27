import {
    BufferGeometry, BufferAttribute, Mesh, Matrix4, Matrix3, Vector3, Quaternion, Group, Object3D,
    Material, MeshBasicMaterial
} from "three";
import { generateUUID } from "three/src/math/MathUtils";
import decodeMaterial from "./material-decoder";
import Terrain from "@client/objects/terrain";
import CollidingMesh from "@client/objects/colliding-mesh";
import ZoneObject, { SectorObject } from "../../objects/zone-object";
import { MeshLight } from "@client/objects/lit-actor";

interface PreparedActorGeometry {
    geometry: BufferGeometry;
    worldMatrix: Matrix4;
    normalMatrix: Matrix3;
    reverseWinding: boolean;
    lights: MeshLight | null;
    ambient: {
        glow: number,
        vector: GD.Vector3Arr,
        isUnlit: boolean
    };
    scaledGlow: number;
    isSunAffected: boolean;
    collider: Uint32Array | null;
}

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
}

function mergeMeshLightFlags(
    totalVertices: number,
    actorGeometries: PreparedActorGeometry[],
    flagArrays: Uint8Array[]
): Uint8Array {
    const bytesNeeded = Math.ceil(totalVertices / 8);
    const result = new Uint8Array(bytesNeeded);
    let globalVertex = 0;

    for (let ai = 0; ai < actorGeometries.length; ai++) {
        const actorVertexCount = actorGeometries[ai].geometry.getAttribute("position").count;
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

function groupActorsForBatching(
    library: GD.DecodeLibrary,
    uniqueActors: Map<string, GD.IBaseObjectOrInstanceDecodeInfo>,
    unbatchable: GD.IStaticMeshActorDecodeInfo[]
): Map<string, GD.IStaticMeshActorDecodeInfo[]> {
    const batchGroups = new Map<string, GD.IStaticMeshActorDecodeInfo[]>();

    uniqueActors.forEach(actorBase => {
        const actor = actorBase as GD.IStaticMeshActorDecodeInfo;
        const meshMaterials = actor.instance?.mesh?.materials;
        const isBatchable = !(actor as any).dontBatch && meshMaterials;

        if (!isBatchable) {
            unbatchable.push(actor);
            return;
        }

        const materialInfo = library.materials[meshMaterials];
        if (isMaterialTransparent(library, materialInfo)) {
            unbatchable.push(actor);
            return;
        }

        const batchKey = meshMaterials;
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

function prepareActorGeometries(
    library: GD.DecodeLibrary,
    actors: GD.IStaticMeshActorDecodeInfo[],
    fetchGeometry: (info: GD.IGeometryDecodeInfo) => BufferGeometry
): PreparedActorGeometry[] {
    return actors.map(actor => {
        const { geometry, lights, collider } = decodeStaticMeshInstance(library, actor.instance, fetchGeometry);
        const worldMatrix = new Matrix4();
        const pos = actor.position || [0, 0, 0];
        const scl = actor.scale || [1, 1, 1];
        const quat = actor.quaternion || [0, 0, 0, 1];

        worldMatrix.compose(
            new Vector3(pos[0], pos[1], pos[2]),
            new Quaternion(quat[0], quat[1], quat[2], quat[3]),
            new Vector3(scl[0], scl[1], scl[2])
        );

        return {
            geometry,
            worldMatrix,
            normalMatrix: new Matrix3().getNormalMatrix(worldMatrix),
            reverseWinding: worldMatrix.determinant() < 0,
            lights,
            ambient: actor.ambient,
            scaledGlow: actor.scaledGlow,
            isSunAffected: actor.isSunAffected ?? true,
            collider
        };
    });
}

function mergeBatchGeometries(
    actorGeometries: PreparedActorGeometry[]
) {
    let totalVertices = 0;
    let totalIndices = 0;
    let totalColliderIndices = 0;
    let hasColors = false;
    let hasColorsInstance = false;
    let hasUVs = false;
    let ColorArrayConstructor: any = Float32Array;
    let ColorInstanceConstructor: any = Float32Array;
    let colorNormalized = false;
    let colorInstanceNormalized = false;

    for (const { geometry, collider } of actorGeometries) {
        totalVertices += geometry.getAttribute("position").count;
        totalIndices += geometry.index ? geometry.index.count : 0;
        if (collider) totalColliderIndices += collider.length;
        if (geometry.hasAttribute("color")) {
            hasColors = true;
            const attr = geometry.getAttribute("color");
            ColorArrayConstructor = attr.array.constructor;
            colorNormalized = attr.normalized;
        }
        if (geometry.hasAttribute("colorInstance")) {
            hasColorsInstance = true;
            const attr = geometry.getAttribute("colorInstance");
            ColorInstanceConstructor = attr.array.constructor;
            colorInstanceNormalized = attr.normalized;
        }
        if (geometry.hasAttribute("uv")) hasUVs = true;
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
    let mergedLightMatrix: Matrix4 | null = null;
    const perActorAmbient: { startVertex: number, count: number, ambient: any, scaledGlow: number, isSunAffected: boolean }[] = [];

    let vertexOffset = 0;
    let indexOffset = 0;
    let colliderIndexOffset = 0;
    const mergedGroups: { start: number, count: number, materialIndex: number, actorIndex: number }[] = [];

    for (let ai = 0; ai < actorGeometries.length; ai++) {
        const { geometry, worldMatrix, normalMatrix, reverseWinding, lights, ambient, scaledGlow, isSunAffected, collider } = actorGeometries[ai];
        const positions = geometry.getAttribute("position");
        const normals = geometry.getAttribute("normal");
        const uvs = geometry.hasAttribute("uv") ? geometry.getAttribute("uv") : null;
        const colors = geometry.hasAttribute("color") ? geometry.getAttribute("color") : null;
        const colorsInstance = geometry.hasAttribute("colorInstance") ? geometry.getAttribute("colorInstance") : null;
        const vertexCount = positions.count;

        const tmpV = new Vector3();
        const tmpN = new Vector3();
        for (let vi = 0; vi < vertexCount; vi++) {
            tmpV.fromBufferAttribute(positions, vi);
            tmpV.applyMatrix4(worldMatrix);
            mergedPositions[(vertexOffset + vi) * 3] = tmpV.x;
            mergedPositions[(vertexOffset + vi) * 3 + 1] = tmpV.y;
            mergedPositions[(vertexOffset + vi) * 3 + 2] = tmpV.z;

            tmpN.fromBufferAttribute(normals, vi);
            tmpN.applyMatrix3(normalMatrix).normalize();
            mergedNormals[(vertexOffset + vi) * 3] = tmpN.x;
            mergedNormals[(vertexOffset + vi) * 3 + 1] = tmpN.y;
            mergedNormals[(vertexOffset + vi) * 3 + 2] = tmpN.z;
        }

        if (mergedUVs && uvs) {
            for (let vi = 0; vi < vertexCount; vi++) {
                mergedUVs[(vertexOffset + vi) * 2] = uvs.getX(vi);
                mergedUVs[(vertexOffset + vi) * 2 + 1] = uvs.getY(vi);
            }
        }
        if (mergedColors && colors) {
            for (let vi = 0; vi < vertexCount; vi++) {
                mergedColors[(vertexOffset + vi) * 3] = colors.getX(vi);
                mergedColors[(vertexOffset + vi) * 3 + 1] = colors.getY(vi);
                mergedColors[(vertexOffset + vi) * 3 + 2] = colors.getZ(vi);
            }
        }
        if (mergedColorsInstance && colorsInstance) {
            for (let vi = 0; vi < vertexCount; vi++) {
                mergedColorsInstance[(vertexOffset + vi) * 3] = colorsInstance.getX(vi);
                mergedColorsInstance[(vertexOffset + vi) * 3 + 1] = colorsInstance.getY(vi);
                mergedColorsInstance[(vertexOffset + vi) * 3 + 2] = colorsInstance.getZ(vi);
            }
        }

        const srcIndex = geometry.index;
        if (srcIndex) {
            const groups = geometry.groups.length > 0 ? geometry.groups : [{ start: 0, count: srcIndex.count, materialIndex: 0 }];
            for (const group of groups) {
                mergedGroups.push({
                    start: indexOffset + group.start,
                    count: group.count,
                    materialIndex: group.materialIndex ?? 0,
                    actorIndex: ai
                });
            }
            if (reverseWinding) {
                for (let ii = 0; ii < srcIndex.count; ii += 3) {
                    mergedIndices[indexOffset + ii] = srcIndex.getX(ii) + vertexOffset;
                    mergedIndices[indexOffset + ii + 1] = srcIndex.getX(ii + 2) + vertexOffset;
                    mergedIndices[indexOffset + ii + 2] = srcIndex.getX(ii + 1) + vertexOffset;
                }
            } else {
                for (let ii = 0; ii < srcIndex.count; ii++) {
                    mergedIndices[indexOffset + ii] = srcIndex.getX(ii) + vertexOffset;
                }
            }
            indexOffset += srcIndex.count;
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
            if (!mergedLightMatrix) mergedLightMatrix = new Matrix4();
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

    const mergedGeometry = new BufferGeometry();
    mergedGeometry.setAttribute("position", new BufferAttribute(mergedPositions, 3));
    mergedGeometry.setAttribute("normal", new BufferAttribute(mergedNormals, 3));
    if (mergedUVs) mergedGeometry.setAttribute("uv", new BufferAttribute(mergedUVs, 2));
    if (mergedColors) mergedGeometry.setAttribute("color", new BufferAttribute(mergedColors, 3, colorNormalized));
    if (mergedColorsInstance) mergedGeometry.setAttribute("colorInstance", new BufferAttribute(mergedColorsInstance, 3, colorInstanceNormalized));
    mergedGeometry.setIndex(new BufferAttribute(mergedIndices, 1));

    let mergedLightInfo: MeshLight | null = null;
    if (hasAnyLights) {
        mergedLightInfo = {
            matrix: mergedLightMatrix || new Matrix4(),
            scene: Array.from(mergedSceneLights.entries()).map(([light, flagArrays]) => ({
                light,
                flags: mergeMeshLightFlags(totalVertices, actorGeometries, flagArrays)
            })),
            environment: Array.from(mergedEnvLights.entries()).map(([light, flagArrays]) => ({
                light,
                flags: mergeMeshLightFlags(totalVertices, actorGeometries, flagArrays)
            }))
        };
    }

    return {
        mergedGeometry,
        mergedLightInfo,
        mergedColliderIndices,
        perActorAmbient,
        mergedGroups,
        mergedIndices,
        totalVertices,
        totalIndices
    };
}

function createBatchObject(
    name: string,
    mergedGeometry: BufferGeometry,
    materials: Material | Material[],
    mergedLightInfo: MeshLight | null,
    mergedColliderIndices: Uint32Array | null,
    actors: GD.IStaticMeshActorDecodeInfo[],
    perActorAmbient: any[],
    batchElements: BatchElement[]
): CollidingMesh {
    const mergedObject = new CollidingMesh({
        geometry: mergedGeometry,
        materials,
        lightInfo: mergedLightInfo,
        colliderIndices: mergedColliderIndices,
        scaledGlow: actors[0].scaledGlow,
        isSunAffected: actors.some(a => a.isSunAffected ?? true),
        ambient: actors[0].ambient
    });

    mergedObject.name = name;
    mergedObject.userData.isBatch = true;
    mergedObject.userData.batchActorUuids = actors.map(a => a.uuid);
    mergedObject.userData.perActorAmbient = perActorAmbient;
    mergedObject.userData.batchElements = batchElements;
    mergedObject.userData.allGroups = mergedGeometry.groups.map(g => ({ ...g }));

    return mergedObject;
}

export function decodeStaticMeshActorLight(_library: GD.DecodeLibrary, info?: GD.ILightInstanceDecodeInfo): MeshLight | null {
    if (!info) return null;

    const matrix = new Matrix4().fromArray(info.matrix);
    const buffer = info.flags;

    const [scene, environment] = [info.scene, info.environment].map(elems =>
        elems.map(([uuid, byteOffset, length]) => ({
            light: uuid,
            flags: new Uint8Array(buffer, byteOffset, length)
        }))
    )

    return { matrix, scene, environment };
}

export function decodeStaticMeshInstance(
    library: GD.DecodeLibrary,
    info: GD.IStaticMeshInstanceDecodeInfo,
    fetchGeometry: (info: GD.IGeometryDecodeInfo) => BufferGeometry
) {
    const geometryUuid = info.mesh.geometry;
    const infoGeo = {
        ...library.geometries[geometryUuid],
        attributes: {
            ...library.geometries[geometryUuid].attributes,
            ...Object.fromEntries(Object.keys(info.attributes).map((k: "colors") => [`${k}Instance`, (info.attributes as any)[k]]))
        }
    };

    const geometry = fetchGeometry(infoGeo);
    const meshInfo = info.mesh;

    const infoMats = library.materials[meshInfo.materials];

    const materials = decodeMaterial(library, infoMats) || (new MeshBasicMaterial({ color: 0xff00ff }) as Material);

    (materials instanceof Array ? materials : [materials]).forEach(mat => {
        if (info.attributes.colors) (mat as any)?.setInstanced?.();
    });

    if (infoGeo.attributes.colors) {
        (materials instanceof Array ? materials : [materials]).forEach(mat => {
            if (!mat) return;
            mat.vertexColors = true;
        });
    }

    const collider = infoGeo.colliderIndices || null;
    const lights = decodeStaticMeshActorLight(library, info.lights);

    return { geometry, materials, collider, lights };
}

function isMaterialTransparent(library: GD.DecodeLibrary, materialInfo: GD.IBaseMaterialDecodeInfo): boolean {
    if (!materialInfo) return false;
    switch (materialInfo.materialType) {
        case "shader": return !!(materialInfo as GD.IShaderDecodeInfo).transparent;
        case "modifier": {
            const mod = materialInfo as GD.IBaseMaterialModifierDecodeInfo;
            if (mod.modifierType === "finalBlend") return !!(mod as GD.IFinalBlendDecodeInfo).transparent;
            return false;
        }
        case "group": {
            const group = materialInfo as GD.IMaterialGroupDecodeInfo;
            return group.materials.some(uuid => isMaterialTransparent(library, library.materials[uuid]));
        }
        default: return false;
    }
}

function updateSceneGraphForBatch(
    library: GD.DecodeLibrary,
    sector: SectorObject,
    staticMeshGroup: Group,
    batchObject: CollidingMesh,
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

    staticMeshGroup.add(batchObject);
    for (const actor of actors) (sector as any).staticMeshMap.set(actor.uuid, batchObject);
    (sector as any).staticMeshMap.set(batchUuid, batchObject);
}

export function batchStaticMeshActors(
    library: GD.DecodeLibrary,
    sector: SectorObject,
    staticMeshGroup: Group,
    uniqueActors: Map<string, GD.IBaseObjectOrInstanceDecodeInfo>,
    fetchGeometry: (info: GD.IGeometryDecodeInfo) => BufferGeometry,
    decodeObject3D: (library: GD.DecodeLibrary, info: GD.IBaseObjectOrInstanceDecodeInfo) => Object3D
) {
    const unbatchable: GD.IStaticMeshActorDecodeInfo[] = [];

    if (!library.batching.staticMeshes) {
        uniqueActors.forEach(actor => unbatchable.push(actor as GD.IStaticMeshActorDecodeInfo));
    } else {
        const batchGroups = groupActorsForBatching(library, uniqueActors, unbatchable);

        batchGroups.forEach((actors, batchKey) => {
            try {
                const actorGeometries = prepareActorGeometries(library, actors, fetchGeometry);
                const {
                    mergedGeometry,
                    mergedLightInfo,
                    mergedColliderIndices,
                    perActorAmbient,
                    mergedGroups,
                    mergedIndices,
                    totalVertices,
                    totalIndices
                } = mergeBatchGeometries(actorGeometries);

                const batchUuid = generateUUID();
                const batchElements: BatchElement[] = actors.map((a, ai) => ({
                    uuid: a.uuid,
                    boundsMin: a.bounds?.min || [0, 0, 0],
                    boundsMax: a.bounds?.max || [0, 0, 0],
                    groups: mergedGroups
                        .filter(g => g.actorIndex === ai)
                        .map(g => ({ start: g.start, count: g.count, materialIndex: g.materialIndex })),
                    zoneMask: (a as any).zoneMask || 0n,
                    isRangeIgnored: !!(a as any).isRangeIgnored
                }));

                // Handle indices if multi-material
                if (mergedGroups.some(g => g.materialIndex !== 0)) {
                    const materialGroupsMap = new Map<number, { indices: number[], actorIndex: number }[]>();
                    for (const group of mergedGroups) {
                        const matIndex = group.materialIndex;
                        if (!materialGroupsMap.has(matIndex)) materialGroupsMap.set(matIndex, []);
                        const indices: number[] = [];
                        for (let ii = 0; ii < group.count; ii++) indices.push(mergedIndices[group.start + ii]);
                        materialGroupsMap.get(matIndex)!.push({ indices, actorIndex: group.actorIndex });
                    }
                    mergedGeometry.clearGroups();
                    let globalIndexOffset = 0;
                    Array.from(materialGroupsMap.keys()).sort().forEach(matIndex => {
                        const entries = materialGroupsMap.get(matIndex)!;
                        const matGroupStart = globalIndexOffset;
                        let matGroupCount = 0;
                        for (const { indices, actorIndex } of entries) {
                            const elem = batchElements[actorIndex];
                            const groupInElem = elem.groups.find(g => g.materialIndex === matIndex);
                            if (groupInElem) groupInElem.start = globalIndexOffset;

                            mergedIndices.set(indices, globalIndexOffset);
                            globalIndexOffset += indices.length;
                            matGroupCount += indices.length;
                        }
                        mergedGeometry.addGroup(matGroupStart, matGroupCount, matIndex);
                    });
                } else {
                    mergedGeometry.clearGroups();
                    mergedGeometry.addGroup(0, totalIndices, 0);
                }

                const firstActor = actors[0];
                const { materials } = decodeStaticMeshInstance(library, firstActor.instance, fetchGeometry);

                const batchObject = createBatchObject(
                    `Batch_${actors.length}_${actors[0].name}`,
                    mergedGeometry,
                    materials,
                    mergedLightInfo,
                    mergedColliderIndices,
                    actors,
                    perActorAmbient,
                    batchElements
                );

                updateSceneGraphForBatch(library, sector, staticMeshGroup, batchObject, actors, batchUuid);

                // console.log(`[Batch] Merged ${actors.length} actors → ${batchObject.name} (${totalVertices} verts, ${totalIndices / 3} tris)`);
            } catch (e) {
                console.warn(`[Batch] Failed to merge batch group ${batchKey}, falling back to individual:`, e);
                unbatchable.push(...actors);
            }
        });
    }

    for (const actor of unbatchable) {
        try {
            const object = decodeObject3D(library, actor);
            staticMeshGroup.add(object);
            (sector as any).staticMeshMap.set(actor.uuid, object);
        } catch (e) {
            console.warn(`Failed to decode static mesh actor ${actor.uuid}:`, e);
        }
    }

    sector.add(staticMeshGroup);
    (sector as any).staticMeshGroup = staticMeshGroup;
    staticMeshGroup.updateMatrixWorld(true);
    const frozenUpdateMatrixWorld = function () { };
    for (const child of staticMeshGroup.children) {
        child.matrixAutoUpdate = false;
        child.updateMatrixWorld = frozenUpdateMatrixWorld;
        child.traverse(node => {
            node.frustumCulled = false;
            node.matrixAutoUpdate = false;
        });
    }
}

function mergeTerrainGeometries(sectors: Terrain[]) {
    let totalVertices = 0;
    let totalIndices = 0;

    for (const sector of sectors) {
        const pos = sector.geometry.getAttribute("position");
        if (pos) {
            totalVertices += pos.count;
        }
        if (sector.geometry.index) {
            totalIndices += sector.geometry.index.count;
        }
    }

    const mergedPositions = new Float32Array(totalVertices * 3);
    const mergedNormals = new Float32Array(totalVertices * 3);
    const mergedColors = new Uint8ClampedArray(totalVertices * 3);
    const mergedTerrainIndices = new Float32Array(totalVertices);
    const mergedIndices = new Uint32Array(totalIndices);

    const batchSectorInfo: {
        startVertex: number;
        vertexCount: number;
        startIndex: number;
        indexCount: number;
        sector: THREE.Mesh;
    }[] = [];

    let vertexOffset = 0;
    let indexOffset = 0;

    for (let sectorIndex = 0; sectorIndex < sectors.length; sectorIndex++) {
        const sector = sectors[sectorIndex];
        const g = sector.geometry;
        const idx = g.index;
        const pos = g.getAttribute("position");
        const norm = g.getAttribute("normal");
        const color = g.getAttribute("color");
        const terrainIndex = g.getAttribute("terrainIndex");

        const vCount = pos.count;
        const iCount = idx ? idx.count : 0;
        const sectorPos = sector.position;

        // Copy and shift data
        for (let i = 0; i < vCount; i++) {
            const vi = vertexOffset + i;

            mergedPositions[vi * 3 + 0] = pos.getX(i) + sectorPos.x;
            mergedPositions[vi * 3 + 1] = pos.getY(i) + sectorPos.y;
            mergedPositions[vi * 3 + 2] = pos.getZ(i) + sectorPos.z;

            if (norm) {
                mergedNormals[vi * 3 + 0] = norm.getX(i);
                mergedNormals[vi * 3 + 1] = norm.getY(i);
                mergedNormals[vi * 3 + 2] = norm.getZ(i);
            }

            if (color) {
                mergedColors[vi * 3 + 0] = color.getX(i);
                mergedColors[vi * 3 + 1] = color.getY(i);
                mergedColors[vi * 3 + 2] = color.getZ(i);
            }

            if (terrainIndex) {
                mergedTerrainIndices[vi] = terrainIndex.getX(i);
            }
        }

        if (idx) {
            const idxArray = idx.array as any;
            for (let j = 0; j < iCount; j++) {
                mergedIndices[indexOffset + j] = idxArray[j] + vertexOffset;
            }
        }

        batchSectorInfo.push({
            startVertex: vertexOffset,
            vertexCount: vCount,
            startIndex: indexOffset,
            indexCount: iCount,
            sector
        });

        vertexOffset += vCount;
        indexOffset += iCount;
    }

    const mergedGeometry = new BufferGeometry();
    mergedGeometry.setAttribute("position", new BufferAttribute(mergedPositions, 3));
    mergedGeometry.setAttribute("normal", new BufferAttribute(mergedNormals, 3));
    mergedGeometry.setAttribute("color", new BufferAttribute(mergedColors, 3, true));
    mergedGeometry.setAttribute("terrainIndex", new BufferAttribute(mergedTerrainIndices, 1));
    mergedGeometry.setIndex(new BufferAttribute(mergedIndices, 1));

    mergedGeometry.computeBoundingBox();
    mergedGeometry.computeBoundingSphere();

    return { mergedGeometry, batchSectorInfo, totalIndices };
}

export function batchTerrainSectors(
    library: GD.DecodeLibrary,
    group: Object3D,
    sectors: Terrain[]
) {
    if (!library.batching.terrain || sectors.length < 2) return;

    try {
        const { mergedGeometry, batchSectorInfo, totalIndices } = mergeTerrainGeometries(sectors);

        const materials: Material[] = [];
        mergedGeometry.clearGroups();
        for (let i = 0; i < batchSectorInfo.length; i++) {
            const info = batchSectorInfo[i];
            const sector = info.sector;
            const matIndex = materials.length;

            if (Array.isArray(sector.material)) {
                sector.material.forEach((m: Material) => materials.push(m));
            } else {
                materials.push(sector.material);
            }

            mergedGeometry.addGroup(info.startIndex, info.indexCount, matIndex);
        }

        // Use a standard Mesh instead of Terrain for the batch to avoid recursive updates
        const batchedTerrain = new Mesh(mergedGeometry, materials as any);
        batchedTerrain.name = `${group.name}_Batch`;

        // Match expected structure in zone-object.ts for lighting and culling
        batchedTerrain.userData.isTerrainBatch = true;
        batchedTerrain.userData.sectors = sectors;

        const originalGroups: any[] = [];
        mergedGeometry.groups.forEach(g => originalGroups.push({ ...g }));
        batchedTerrain.userData.originalGroups = originalGroups;

        group.add(batchedTerrain);
        for (let i = 0; i < batchSectorInfo.length; i++) {
            const info = batchSectorInfo[i];
            const sector = info.sector;

            (sector as any).batchGeometry = mergedGeometry;
            (sector as any).batchVertexOffset = info.startVertex;
            (sector as any).batchIndexOffset = info.startIndex;
            (sector as any).batchSectorIndex = i;

            // Properties used by zone-object.ts for culling and updates:
            (sector as any).batchGroupOffset = i;
            (sector as any).batchGroupCount = 1;

            // Shift bounds to world space for frustum culling in zone-object.ts
            (sector as any).bounds.min.add(sector.position);
            (sector as any).bounds.max.add(sector.position);

            // Remove from scene graph to avoid interference
            group.remove(sector);
        }

        // console.log(`[Terrain Batch] Merged ${sectors.length} sectors into ${batchedTerrain.name} (${totalIndices / 3} tris)`);
    } catch (e) {
        console.warn(`[Terrain Batch] Failed to merge terrain sectors:`, e);
    }
}
