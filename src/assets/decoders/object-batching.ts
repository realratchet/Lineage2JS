import {
    BufferGeometry, BufferAttribute, Mesh, Matrix4, Group, Object3D,
    Material, MeshBasicMaterial, NormalBlending
} from "three";
import { canonicalizeStaticMeshMaterials, decodeStaticMeshMaterial } from "./material-decoder";
import Terrain from "@client/objects/terrain";
import CollidingMesh from "@client/objects/colliding-mesh";
import ZoneObject, { SectorObject } from "../../objects/zone-object";
import { MeshLight } from "@client/objects/lit-actor";
import { buildStaticMeshBatchData } from "./batch-data";
import type { StaticMeshBatchManifest, BatchElement } from "./batch-data";

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

    mergedObject.material = canonicalizeStaticMeshMaterials(mergedObject.material);

    mergedObject.name = name;
    mergedObject.userData.isBatch = true;
    mergedObject.userData.batchActorUuids = actors.map(a => a.uuid);
    mergedObject.userData.perActorAmbient = perActorAmbient;
    mergedObject.userData.batchElements = batchElements;
    mergedObject.userData.allGroups = mergedGeometry.groups.map(g => ({ ...g }));
    mergedObject.userData.batchIndices = mergedGeometry.index ? mergedGeometry.index.array.slice() : null;

    // Transparent actor indices are depth-sorted during visibility updates.
    const matList = materials instanceof Array ? materials : [materials];
    const transparentMats = new Set<number>();
    const sortedTransparentMats = new Set<number>();

    matList.forEach((m, i) => {
        if (!m?.transparent) return;
        transparentMats.add(i);
        if (m.blending === NormalBlending) sortedTransparentMats.add(i);
    });

    mergedObject.userData.transparentMaterialIndexes = transparentMats;
    mergedObject.userData.sortedTransparentMaterialIndexes = sortedTransparentMats;

    if (transparentMats.size > 0) {
        const opaque = mergedGeometry.groups.filter(g => !transparentMats.has(g.materialIndex));

        mergedGeometry.clearGroups();
        for (const g of opaque) mergedGeometry.addGroup(g.start, g.count, g.materialIndex);
    }

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

    const materials = decodeStaticMeshMaterial(library, infoMats, !!infoGeo.attributes.colors, !!info.attributes.colors) || (new MeshBasicMaterial({ color: 0xff00ff }) as Material);

    const collider = infoGeo.colliderIndices || null;
    const lights = decodeStaticMeshActorLight(library, info.lights);

    return { geometry, materials, collider, lights };
}

export function batchStaticMeshActors(
    library: GD.DecodeLibrary,
    sector: SectorObject,
    staticMeshGroup: Group,
    fetchGeometry: (info: GD.IGeometryDecodeInfo) => BufferGeometry,
    decodeObject3D: (library: GD.DecodeLibrary, info: GD.IBaseObjectOrInstanceDecodeInfo) => Object3D
) {
    /*
     * The heavy merge (buildStaticMeshBatchData) normally runs in the decode worker and
     * arrives precomputed with the library; synchronous paths (skylevel, worker fallback)
     * build it here on demand. Either way only scene objects are instantiated here.
     */
    const manifest: StaticMeshBatchManifest = (library as any).staticMeshBatches ?? buildStaticMeshBatchData(library);

    for (const batch of manifest.batches) {
        try {
            const geometry = fetchGeometry(library.geometries[batch.geometry]);
            const geometryInfo = library.geometries[batch.geometry];
            const materialInfo = library.materials[batch.materials];
            const materials = decodeStaticMeshMaterial(library, materialInfo, !!geometryInfo.attributes.colors, !!geometryInfo.attributes.colorsInstance)
                || (new MeshBasicMaterial({ color: 0xff00ff }) as Material);
            // The merged light matrix has always been identity (see mergeBatchGeometriesData)
            const lightInfo: MeshLight | null = batch.lights
                ? { matrix: new Matrix4(), scene: batch.lights.scene, environment: batch.lights.environment }
                : null;

            const batchObject = createBatchObject(
                batch.name,
                geometry,
                materials,
                lightInfo,
                batch.colliderIndices,
                batch.actors,
                batch.perActorAmbient,
                batch.batchElements
            );

            staticMeshGroup.add(batchObject);
            for (const actor of batch.actors) (sector as any).staticMeshMap.set(actor.uuid, batchObject);
            (sector as any).staticMeshMap.set(batch.uuid, batchObject);

        } catch (e) {
            /* leafActors already reference the batch entry - the actors cannot be recovered individually */
            console.warn(`[Batch] Failed to instantiate batch '${batch.name}':`, e);
        }
    }

    for (const actor of manifest.unbatchable) {
        try {
            const object = decodeObject3D(library, actor);

            // visibility fallback data, same role as batchElements bounds/zoneMask
            const bounds = (actor as any).bounds;

            if (bounds?.min && bounds?.max) {
                object.userData.actorBoundsMin = bounds.min;
                object.userData.actorBoundsMax = bounds.max;
            }

            object.userData.actorZoneMask = (actor as any).zoneMask || 0n;
            object.userData.actorRangeIgnored = !!(actor as any).isRangeIgnored;

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
