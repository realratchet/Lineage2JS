import { BufferGeometry, BufferAttribute, Mesh, Matrix4, Group, Object3D, Material, MeshBasicMaterial, NormalBlending } from "three";
import { canonicalizeStaticMeshMaterials, decodeStaticMeshMaterial } from "./material-decoder";
import Terrain from "../../objects/terrain";
import CollidingMesh from "../../objects/colliding-mesh";
import ZoneObject, { SectorObject } from "../../objects/zone-object";
import { MeshLight_T } from "../../objects/lit-actor";
import { buildStaticMeshBatchData } from "./batch-data";
import type { StaticMeshBatchManifest_T, BatchElement_T } from "./batch-data";
import type { CollisionTriangleIndex_T } from "../../objects/objects";

type StaticMeshIndexArray_T = Uint8Array | Uint16Array | Uint32Array;
type StaticMeshIndexCopy_T = { source: StaticMeshIndexArray_T, target: StaticMeshIndexArray_T, offset: number };
type StaticMeshBatchJob_T = {
    library: GD.DecodeLibrary,
    sector: SectorObject,
    staticMeshGroup: Group,
    fetchGeometry: (info: GD.IGeometryDecodeInfo) => BufferGeometry,
    decodeObject3D: (library: GD.DecodeLibrary, info: GD.IBaseObjectOrInstanceDecodeInfo) => Object3D,
    manifest: StaticMeshBatchManifest_T,
    batchIndex: number,
    actorIndex: number,
    indexCopy: StaticMeshIndexCopy_T
};

const INDEX_COPY_CHUNK_BYTES = 256 * 1024;

export function makeSwayAttribute(vertexCount: number, info: GD.IStaticMeshSwayDecodeInfo, phase: number = 0): Float32Array {
    const sway = new Float32Array(vertexCount * 4);

    for (let i = 0; i < vertexCount; i++) {
        sway[i * 4] = info.pivotZ;
        sway[i * 4 + 1] = info.frequency;
        sway[i * 4 + 2] = info.maxAngle;
        sway[i * 4 + 3] = phase;
    }

    return sway;
}

function createBatchObject(
    name: string,
    mergedGeometry: BufferGeometry,
    materials: Material | Material[],
    mergedLightInfo: MeshLight_T | null,
    mergedColliderIndices: Uint32Array | null,
    collisionIndex: CollisionTriangleIndex_T | null,
    actors: GD.IStaticMeshActorDecodeInfo[],
    perActorAmbient: any[],
    batchElements: BatchElement_T[]
): CollidingMesh {
    const mergedObject = new CollidingMesh({
        geometry: mergedGeometry,
        materials,
        lightInfo: mergedLightInfo,
        colliderIndices: mergedColliderIndices,
        collisionIndex,
        scaledGlow: actors[0].scaledGlow,
        isSunAffected: actors.some(a => a.isSunAffected ?? true),
        ambient: actors[0].ambient
    });

    mergedObject.material = canonicalizeStaticMeshMaterials(mergedObject.material);

    mergedObject.name = name;
    mergedObject.isBatch = true;
    mergedObject.batchActorUuids = actors.map(a => a.uuid);
    mergedObject.setPerActorAmbient(perActorAmbient);
    mergedObject.batchElements = batchElements;
    mergedObject.allGroups = mergedGeometry.groups.map(g => ({ ...g }));
    mergedObject.batchIndices = null;

    // Transparent actor indices are depth-sorted during visibility updates.
    const matList = materials instanceof Array ? materials : [materials];
    const transparentMats = new Set<number>();
    const sortedTransparentMats = new Set<number>();

    matList.forEach((m, i) => {
        if (!m?.transparent) return;
        transparentMats.add(i);
        if (m.blending === NormalBlending) sortedTransparentMats.add(i);
    });

    mergedObject.transparentMaterialIndexes = transparentMats;
    mergedObject.sortedTransparentMaterialIndexes = sortedTransparentMats;

    if (transparentMats.size > 0) {
        const opaque = mergedGeometry.groups.filter(g => !transparentMats.has(g.materialIndex));

        mergedGeometry.clearGroups();
        for (const g of opaque) mergedGeometry.addGroup(g.start, g.count, g.materialIndex);
    }

    return mergedObject;
}

export function decodeStaticMeshActorLight(_library: GD.DecodeLibrary, info?: GD.ILightInstanceDecodeInfo): MeshLight_T | null {
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
    const geometryInfo = library.geometries[geometryUuid];
    const sway = info.mesh.sway ? makeSwayAttribute((geometryInfo.attributes.positions as Float32Array).length / 3, info.mesh.sway, info.swayPhase ?? 0) : null;
    const infoGeo = {
        ...geometryInfo,
        attributes: {
            ...geometryInfo.attributes,
            ...(sway ? { sway } : {}),
            ...Object.fromEntries(Object.keys(info.attributes).map((k: "colors") => [`${k}Instance`, (info.attributes as any)[k]]))
        }
    };

    const geometry = fetchGeometry(infoGeo);
    const meshInfo = info.mesh;

    const infoMats = library.materials[meshInfo.materials];

    const materials = decodeStaticMeshMaterial(library, infoMats, !!infoGeo.attributes.colors, !!info.attributes.colors, !!sway) || (new MeshBasicMaterial({ color: 0xff00ff }) as Material);

    const collider = infoGeo.colliderIndices || null;
    const lights = decodeStaticMeshActorLight(library, info.lights);

    return { geometry, materials, collider, lights, staticMeshCollision: infoGeo.staticMeshCollision, collisionIndex: (infoGeo as any).collisionIndex as CollisionTriangleIndex_T };
}

function createStaticMeshBatchJob(
    library: GD.DecodeLibrary,
    sector: SectorObject,
    staticMeshGroup: Group,
    fetchGeometry: (info: GD.IGeometryDecodeInfo) => BufferGeometry,
    decodeObject3D: (library: GD.DecodeLibrary, info: GD.IBaseObjectOrInstanceDecodeInfo) => Object3D
): StaticMeshBatchJob_T {
    const manifest: StaticMeshBatchManifest_T = (library as any).staticMeshBatches ?? buildStaticMeshBatchData(library);

    return { library, sector, staticMeshGroup, fetchGeometry, decodeObject3D, manifest, batchIndex: 0, actorIndex: 0, indexCopy: null };
}

function stepStaticMeshBatchJob(job: StaticMeshBatchJob_T): boolean {
    const { library, sector, staticMeshGroup, fetchGeometry, decodeObject3D, manifest } = job;

    if (job.indexCopy) {
        const { source, target, offset } = job.indexCopy;
        const count = Math.min(source.length - offset, Math.max(1, Math.floor(INDEX_COPY_CHUNK_BYTES / source.BYTES_PER_ELEMENT)));

        target.set(source.subarray(offset, offset + count), offset);
        job.indexCopy.offset += count;
        if (job.indexCopy.offset >= source.length) job.indexCopy = null;

        return false;
    }

    if (job.batchIndex < manifest.batches.length) {
        const batch = manifest.batches[job.batchIndex++];

        try {
            const geometry = fetchGeometry(library.geometries[batch.geometry]);
            const geometryInfo = library.geometries[batch.geometry];
            const materialInfo = library.materials[batch.materials];
            const materials = decodeStaticMeshMaterial(library, materialInfo, !!geometryInfo.attributes.colors, !!geometryInfo.attributes.colorsInstance, !!geometryInfo.attributes.sway)
                || (new MeshBasicMaterial({ color: 0xff00ff }) as Material);
            // The merged light matrix has always been identity (see mergeBatchGeometriesData)
            const lightInfo: MeshLight_T | null = batch.lights
                ? { matrix: new Matrix4(), scene: batch.lights.scene, environment: batch.lights.environment }
                : null;

            const batchObject = createBatchObject(
                batch.name,
                geometry,
                materials,
                lightInfo,
                batch.colliderIndices,
                (geometryInfo as any).collisionIndex,
                batch.actors,
                batch.perActorAmbient,
                batch.batchElements
            );

            const source = geometry.index?.array as StaticMeshIndexArray_T;
            if (source) {
                const target = new (source.constructor as any)(source.length) as StaticMeshIndexArray_T;
                batchObject.batchIndices = target;
                job.indexCopy = { source, target, offset: 0 };
            }

            staticMeshGroup.add(batchObject);
            for (const actor of batch.actors) (sector as any).staticMeshMap.set(actor.uuid, batchObject);
            (sector as any).staticMeshMap.set(batch.uuid, batchObject);

        } catch (e) {
            console.warn(`[Batch] Failed to instantiate batch '${batch.name}':`, e);
        }

        return false;
    }

    if (job.actorIndex < manifest.unbatchable.length) {
        const actor = manifest.unbatchable[job.actorIndex++];

        try {
            const object = decodeObject3D(library, actor);

            // visibility fallback data, same role as batchElements bounds/zoneMask
            const bounds = (actor as any).bounds;

            if (bounds?.min && bounds?.max) {
                (object as any).actorBoundsMin = bounds.min;
                (object as any).actorBoundsMax = bounds.max;
            }

            (object as any).actorZoneMask = (actor as any).zoneMask || 0n;
            (object as any).actorRangeIgnored = !!(actor as any).isRangeIgnored;

            staticMeshGroup.add(object);
            (sector as any).staticMeshMap.set(actor.uuid, object);
        } catch (e) {
            console.warn(`Failed to decode static mesh actor ${actor.uuid}:`, e);
        }

        return false;
    }

    sector.add(staticMeshGroup);
    (sector as any).staticMeshGroup = staticMeshGroup;
    staticMeshGroup.updateMatrixWorld(true);
    const frozenUpdateMatrixWorld = function () { };
    for (const child of staticMeshGroup.children) {
        if ((child as any).isMovableObject || (child as any).isRotatingObject) continue;

        child.matrixAutoUpdate = false;
        child.updateMatrixWorld = frozenUpdateMatrixWorld;
        child.traverse(node => {
            node.frustumCulled = false;
            node.matrixAutoUpdate = false;
        });
    }

    return true;
}

export function batchStaticMeshActors(
    library: GD.DecodeLibrary,
    sector: SectorObject,
    staticMeshGroup: Group,
    fetchGeometry: (info: GD.IGeometryDecodeInfo) => BufferGeometry,
    decodeObject3D: (library: GD.DecodeLibrary, info: GD.IBaseObjectOrInstanceDecodeInfo) => Object3D
) {
    const job = createStaticMeshBatchJob(library, sector, staticMeshGroup, fetchGeometry, decodeObject3D);

    while (!stepStaticMeshBatchJob(job)) { }
}

export { createStaticMeshBatchJob, stepStaticMeshBatchJob, StaticMeshBatchJob_T };

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

        const posArray = pos.array as any;
        const normArray = norm ? norm.array as any : null;
        const colorArray = color ? color.array as any : null;
        const terrainIndexArray = terrainIndex ? terrainIndex.array as any : null;

        // Copy and shift data
        for (let i = 0; i < vCount; i++) {
            const vi = vertexOffset + i;

            mergedPositions[vi * 3 + 0] = posArray[i * 3 + 0] + sectorPos.x;
            mergedPositions[vi * 3 + 1] = posArray[i * 3 + 1] + sectorPos.y;
            mergedPositions[vi * 3 + 2] = posArray[i * 3 + 2] + sectorPos.z;

            if (normArray) {
                mergedNormals[vi * 3 + 0] = normArray[i * 3 + 0];
                mergedNormals[vi * 3 + 1] = normArray[i * 3 + 1];
                mergedNormals[vi * 3 + 2] = normArray[i * 3 + 2];
            }

            if (colorArray) {
                mergedColors[vi * 3 + 0] = colorArray[i * 3 + 0];
                mergedColors[vi * 3 + 1] = colorArray[i * 3 + 1];
                mergedColors[vi * 3 + 2] = colorArray[i * 3 + 2];
            }

            if (terrainIndexArray) {
                mergedTerrainIndices[vi] = terrainIndexArray[i];
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

        const batchedTerrain = new Mesh(mergedGeometry, materials as any);
        batchedTerrain.name = `${group.name}_Batch`;

        (batchedTerrain as any).isTerrainBatch = true;
        (batchedTerrain as any).sectors = sectors;

        const originalGroups: any[] = [];
        mergedGeometry.groups.forEach(g => originalGroups.push({ ...g }));
        (batchedTerrain as any).originalGroups = originalGroups;

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
