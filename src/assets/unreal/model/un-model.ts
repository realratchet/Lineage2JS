import UPrimitive from "../un-primitive";
import FVert from "./un-vert";
import FBSPNode, { BspNodeFlags_T } from "../bsp/un-bsp-node";
import FBSPSurf from "../bsp/un-bsp-surf";
import { PolyFlags_T } from "../un-polys";
import { BufferValue } from "@l2js/core";
import FZoneProperties from "../un-zone-properties";
import FLeaf from "../un-leaf";
import FBSPSection from "../bsp/un-bsp-section";
import FLightmapIndex from "./un-lightmap-index";
import FMultiLightmapTexture from "./un-multilightmap-texture";
import { generateUUID } from "three/src/math/MathUtils";
import getTypedArrayConstructor from "../../../utils/typed-arrray-constructor";
import FArray, { FObjectArray, FPrimitiveArray } from "@l2js/core/src/unreal/un-array";
import FVector from "../un-vector";
import FBox from "../un-box";
import { DoubleSide } from "three";

const MAX_NODE_VERTICES = 16;       // Max vertices in a Bsp node, pre clipping.
const MAX_FINAL_VERTICES = 24;      // Max vertices in a Bsp node, post clipping.
const MAX_ZONES = 64;               // Max zones per level.
const TEXEL_SCALE = 512;
const PF_Unlit = 0x00400000; // from UnObj.h line 254

const PF_WaterSheet = 0x00080000; // L2.water.trace 17626640: uniquely marks shipped D3DCULL_NONE water sheets.

const nodeCache = new Array<number>();

class FVectorArray implements C.IConstructable {
    declare protected elementCount: number;
    declare protected data: DataView;

    public readonly elementSize = 3 * 4;

    public getElem(index: number, out: FVector): FVector {
        const off = index * this.elementSize;

        out.set(
            this.data.getFloat32(off, true),
            this.data.getFloat32(off + 4, true),
            this.data.getFloat32(off + 8, true),
        );

        return out;
    }

    public getElemCount() { return this.elementCount };

    public load(pkg: C.APackage): this {
        this.elementCount = pkg.read("compat32");
        this.data = pkg.read(this.elementCount * this.elementSize);

        return this;
    }
}

class FBoxArray implements C.IConstructable {
    declare protected elementCount: number;
    declare protected data: DataView;

    public readonly elementSize = 3 * 4 * 2 + 1;

    public getElem(index: number, out: FBox): FBox {
        const off = index * this.elementSize;

        out.min.set(
            this.data.getFloat32(off, true),
            this.data.getFloat32(off + 4, true),
            this.data.getFloat32(off + 8, true),
        );

        out.max.set(
            this.data.getFloat32(off + 12, true),
            this.data.getFloat32(off + 16, true),
            this.data.getFloat32(off + 20, true),
        );

        out.isValid = this.data.getUint8(off + 24) as 0 | 1;

        return out;
    }

    public getElemCount() { return this.elementCount };

    public load(pkg: C.APackage): this {
        this.elementCount = pkg.read("compat32");
        this.data = pkg.read(this.elementCount * this.elementSize);

        return this;
    }
}



abstract class UModel extends UPrimitive {
    protected levelInfo: GA.ULevelInfo

    declare protected vectors: FVectorArray;
    declare protected points: FVectorArray;
    declare protected vertices: C.FArray<FVert>;
    declare protected bspNodes: C.FArray<FBSPNode>;
    declare protected bspSurfs: C.FArray<FBSPSurf>;
    declare protected bspSection: C.FArray<FBSPSection>;
    declare protected lightmaps: C.FArray<FLightmapIndex>;
    declare protected multiLightmaps: C.FArray<FMultiLightmapTexture>;
    declare protected numSharedSides: number;
    declare protected polys: GA.UPolys;
    declare protected zones: FZoneProperties[];
    declare protected bounds: FBoxArray;
    declare protected leafHulls: FPrimitiveArray<"int32">;
    declare protected leaves: FArray<FLeaf>
    declare protected isRootOutside: boolean;
    declare protected isLinked: boolean;

    declare protected lights: FObjectArray;
    declare protected isSky: boolean;

    public setLevelInfo(levelInfo: GA.ULevelInfo) { this.levelInfo = levelInfo; return this; }
    public getLevelInfo() { return this.levelInfo; }
    public getBspNodes() { return this.bspNodes; }
    public getIsRootOutside() { return this.isRootOutside; }

    protected preLoad(pkg: C.APackage, exp: C.UExport): void {
        super.preLoad(pkg, exp);

        this.vectors = new FVectorArray();
        this.points = new FVectorArray();
        this.vertices = new FArray(FVert);
        this.bspNodes = new FArray(FBSPNode);
        this.bspSurfs = new FArray(FBSPSurf);
        this.bspSection = new FArray(FBSPSection);
        this.lightmaps = new FArray(FLightmapIndex);
        this.multiLightmaps = new FArray(FMultiLightmapTexture);
        this.polys = null;
        this.zones = [];
        this.bounds = new FBoxArray();
        this.leafHulls = new FPrimitiveArray(BufferValue.int32);
        this.leaves = new FArray(FLeaf);
        this.lights = new FObjectArray();
    }

    protected doLoad(pkg: C.APackage, exp: C.UExport): this {

        // const verArchive = pkg.header.getArchiveFileVersion();
        // const verLicense = pkg.header.getLicenseeVersion();

        // console.assert(verArchive === 123, "Archive version differs, will likely not work.");
        // console.assert(verLicense === 23, "Licensee version differs, will likely not work.");

        pkg.seek(this.readHead, "set");

        super.doLoad(pkg, exp);

        this.vectors.load(pkg);     // 0x78
        this.points.load(pkg);      // 0x88
        this.bspNodes.load(pkg);    // 0x58
        this.bspSurfs.load(pkg);    // 0x98
        this.vertices.load(pkg);    // 0x68

        this.numSharedSides = pkg.read("int32");  // 0x124

        const numZones = pkg.read("int32");       // 0x128

        console.assert(numZones <= MAX_ZONES);

        this.zones = new Array(numZones);

        for (let i = 0; i < numZones; i++)
            this.zones[i] = new FZoneProperties().load(pkg);

        // debugger;

        this.readHead = pkg.tell();
        const polysId = pkg.read("compat32");
        const polyExp = pkg.exports[polysId - 1];
        const className = pkg.getPackageName(polyExp.idClass)

        console.assert(className === "Polys");

        // if (polysId !== 0) this.promisesLoading.push(new Promise<void>(async resolve => {
        //     this.polys = await pkg.fetchObject<UPolys>(polysId);
        //     resolve();
        // }));

        this.readHead = pkg.tell();

        this.bounds.load(pkg);
        this.leafHulls.load(pkg);
        this.leaves.load(pkg);

        this.lights.load(pkg);

        // if (this.lights.length !== 0)
        //     debugger;

        this.readHead = pkg.tell();

        this.isRootOutside = pkg.read("int32") != 0;
        this.isLinked = pkg.read("int32") != 0;

        this.readHead = pkg.tell();

        this.bspSection.load(pkg);

        this.readHead = pkg.tell();

        this.lightmaps.load(pkg);
        this.multiLightmaps.load(pkg);

        this.readHead = pkg.tell();

        pkg.seek(this.readHead, "set");

        // if (this.lightmaps.length > 0)
        //     debugger;

        // debugger;

        this.isSky = pkg.path.toLowerCase().replace(/\\/g, '/').endsWith('assets/maps/skylevel.unr');

        return this;
    }

    public getZoneActor(iZone: number) { return this.zones[iZone].zoneActor ?? this.levelInfo; }

    public boxLeavesRecursive(iNode: number, origin: GA.FVector, extent: GA.FVector, outLeaves?: number[]): number[] {
        outLeaves = outLeaves ?? [];
        nodeCache.length = this.bspNodes.length;

        const iNodes = nodeCache;

        let index = 0;

        iNodes[0] = iNode;

        const min = Math.min(Math.min(extent.x, extent.y), extent.z);
        const max = Math.max(Math.max(extent.x, extent.y), extent.z);

        if (min * 2 > max) {
            const pushOut = extent.length();
            while (index >= 0) {
                iNode = iNodes[index--];

                const node = this.bspNodes[iNode];
                const distance = node.plane.dot(origin);

                if (distance < pushOut) {
                    if (node.iBack !== -1)
                        iNodes[++index] = node.iBack;
                    else if (node.iLeaf[0] !== -1)
                        outLeaves.push(node.iLeaf[0]);
                }

                if (-distance < pushOut) {
                    if (node.iFront !== -1)
                        iNodes[++index] = node.iFront;
                    else if (node.iLeaf[1] !== -1)
                        outLeaves.push(node.iLeaf[1]);
                }
            }
        } else {
            while (index >= 0) {
                iNode = iNodes[index--];

                const node = this.bspNodes[iNode];
                const pushOut = boxPushOut(node.plane, extent);
                const distance = node.plane.dot(origin);

                if (distance < pushOut) {
                    if (node.iBack !== -1)
                        iNodes[++index] = node.iBack;
                    else if (node.iLeaf[0] !== -1)
                        outLeaves.push(node.iLeaf[0]);
                }

                if (-distance < pushOut) {
                    if (node.iFront !== -1)
                        iNodes[++index] = node.iFront;
                    else if (node.iLeaf[1] !== -1)
                        outLeaves.push(node.iLeaf[1]);
                }
            }
        }

        return outLeaves;
    }

    public boxLeaves(box: GA.FBox): GA.FLeaf[] {
        if (this.bspNodes.length === 0) return [];

        const origin = box.getCenter();
        const extent = box.getExtents();

        return this.boxLeavesRecursive(0, origin, extent).map(i => this.leaves[i]);
    }

    public boxLeafIndices(box: GA.FBox): number[] {
        if (this.bspNodes.length === 0) return [];

        const origin = box.getCenter();
        const extent = box.getExtents();

        return this.boxLeavesRecursive(0, origin, extent);
    }

    public isCsg(node: FBSPNode): boolean {
        return (node.numVertices > 0) && !(node.flags & (BspNodeFlags_T.NF_IsNew | BspNodeFlags_T.NF_NotCsg));
    }

    public getZoneDecodeInfo(library: GD.DecodeLibrary, uLevelInfo: GA.ULevelInfo): ModelZoneDecodeResult_T {
        const result: ModelZoneDecodeResult_T = { bspLeaves: [], bspZones: [], bspZoneIndexMap: {} };

        this.leaves.forEach((leaf: FLeaf) => result.bspLeaves.push(leaf.getDecodeInfo()));
        this.zones.forEach((zone: FZoneProperties, index: number) => {
            const bspZone = zone.getDecodeInfo(library, uLevelInfo);

            result.bspZones.push(bspZone);

            result.bspZoneIndexMap[bspZone.zoneInfo.uuid] = index;
        });

        return result;
    }

    public getCollisionModelDecodeInfo(): GD.IBSPCollisionModelDecodeInfo {
        const planes = this.bspNodes.map((node: FBSPNode) => node.plane.getElements());
        const hulls: GD.IBSPNodeCollisionInfo_T[] = [];
        const leafHulls = this.leafHulls.getTypedArray() as Int32Array;

        for (const node of this.bspNodes) {
            if (node.iCollisionBound < 0) continue;

            const hullIndexList = leafHulls.slice(node.iCollisionBound);
            let hullPlanesCount = 0;

            while (hullIndexList[hullPlanesCount] >= 0) hullPlanesCount++;

            const bounds = new Float32Array(new Int32Array(hullIndexList.slice(hullPlanesCount + 1, hullPlanesCount + 7)).buffer);

            hulls.push({
                flags: [...hullIndexList.slice(0, hullPlanesCount)],
                bounds: {
                    isValid: true,
                    min: [bounds[0], bounds[1], bounds[2]],
                    max: [bounds[3], bounds[4], bounds[5]]
                }
            });
        }

        return { planes, hulls };
    }

    public getDecodeInfo(builder: GD.DecodeLibraryBuilder, uLevelInfo: GA.ULevelInfo): ModelDecodeResult_T {
        const library = builder.library;
        const result: ModelDecodeResult_T = Object.assign(this.getZoneDecodeInfo(library, uLevelInfo), {
            bspNodes: [], bspColliders: [], leafActors: [], nodeToSection: [], nodeZoneMasks: [], bspRenderBounds: [], bspSections: [], bspSectionIndexMap: new Map(), geometries: [], materials: []
        });

        this.multiLightmaps.map((lm: FMultiLightmapTexture) => builder.pullStaticLightmap(lm.textures[0].staticLightmap));

        result.leafActors.length = result.bspLeaves.length;
        result.nodeToSection.length = this.bspNodes.length;
        result.nodeZoneMasks.length = this.bspNodes.length;
        result.bspRenderBounds.length = this.bounds.getElemCount();

        for (let i = 0; i < result.bspLeaves.length; i++)
            result.leafActors[i] = [];

        for (let i = 0; i < this.bspNodes.length; i++)
            result.nodeToSection[i] = -1;

        const _box = FBox.make();

        for (let i = 0, len = this.bounds.getElemCount(); i < len; i++)
            result.bspRenderBounds[i] = this.bounds.getElem(i, _box).getDecodeInfo() ?? { isValid: false, min: [0, 0, 0], max: [0, 0, 0] };

        const sectionMap = new Map<PriorityGroups_T, Map<string, ObjectsForSection_T>>();

        for (let nodeIndex = 0, ncount = this.bspNodes.length; nodeIndex < ncount; nodeIndex++) {
            const node: FBSPNode = this.bspNodes[nodeIndex];
            const surf: FBSPSurf = this.bspSurfs[node.iSurf];
            const nodeInfo = node.getBSPDecodeInfo(surf.flags) as GD.IBSPNodeDecodeInfo_T;

            nodeInfo.zoneMask = result.nodeZoneMasks[nodeIndex] = node.zoneMask;

            result.bspNodes.push(nodeInfo);

            if (node.iCollisionBound >= 0) {
                const hulls = this.leafHulls.getTypedArray() as Int32Array;
                const hullIndexList = hulls.slice(node.iCollisionBound);

                let hullPlanesCount = 0;
                while (hullIndexList[hullPlanesCount] >= 0)
                    hullIndexList[hullPlanesCount++];

                // reinterpret as floats
                const initialVector = new Float32Array(new Int32Array(hullIndexList.slice(hullPlanesCount + 1, hullPlanesCount + 1 + 6)).buffer);
                const hullFlags = hullIndexList.slice(0, hullPlanesCount);

                nodeInfo.collision = {
                    flags: [...hullFlags],
                    bounds: {
                        isValid: true,
                        min: [initialVector[0], initialVector[1], initialVector[2]],
                        max: [initialVector[3], initialVector[4], initialVector[5]]
                    }
                };
            }


            // if (nodeIndex === 14)
            //     debugger;

            // if (!(surf.flags | PolyFlags_T.PF_Unused2)) {
            //     continue
            // }

            if (surf.flags & (
                PolyFlags_T.PF_Invisible |
                PolyFlags_T.PF_Portal |
                // PF_AntiPortal (0x8000000) renders in retail - ToI 23_18 Baium floor slab carries it with live texture+lightmap
                PolyFlags_T.PF_FakeBackdrop | // no skybox
                PolyFlags_T.PF_Unused2        // don't know what this flag is but seems invisible
            )) continue;

            // if (surf.flags === 4194304)
            //     continue

            const zoneIndex = node.iZone[1];
            const zoneProp = this.zones[zoneIndex];
            const zoneActor = zoneProp?.zoneActor;

            const isSkyZone = zoneActor?.tag === "SkyZoneInfo";

            if (library.isSkyLevel && !isSkyZone) continue;

            if (!library.isSkyLevel && isSkyZone) continue;

            if (node.iCollisionBound >= 0) {
                result.bspColliders.push(nodeInfo.collision.bounds);
            }

            const lightmapIndex: FLightmapIndex = node.iLightmapIndex === undefined ? null : this.lightmaps[node.iLightmapIndex];
            const lightmap = lightmapIndex ? this.multiLightmaps[lightmapIndex.iLightmapTexture].textures[0].staticLightmap as GA.FStaticLightmapTexture : null;
            const priority: PriorityGroups_T = /*false &&*/ surf.flags & PolyFlags_T.PF_AddLast ? "transparent" : "opaque";


            const materialUuid = builder.pullMaterial(surf.material);
            const lightmapTextureIndex = lightmapIndex ? lightmapIndex.iLightmapTexture : -1;

            // const matInfo = library.materials[library.materials[materialUuid].material];

            // const _decodeMat = decodeTextureAsB64;

            // debugger;

            // PolyFlags used: PF_Unlit | PF_Selected | PF_TwoSided (from UnModel.cpp line 1000)
            const sectionPolyFlags = surf.flags & (PF_Unlit | PolyFlags_T.PF_Selected | PolyFlags_T.PF_TwoSided);

            const sectionKey = `${materialUuid}/${sectionPolyFlags}/${lightmapTextureIndex}`;

            const isOutdoor = zoneIndex === 0 || (zoneActor && (zoneActor as any).isSunAffected); // zone 0 is LevelInfo (Outdoor)

            const composedKey = `${sectionKey}/${isOutdoor}`;

            if (!sectionMap.has(priority)) sectionMap.set(priority, new Map());
            const prioritySections = sectionMap.get(priority);

            if (!prioritySections.has(composedKey)) {
                prioritySections.set(composedKey, {
                    material: materialUuid,
                    lightmap: lightmap ? lightmap.uuid : null,
                    polyFlags: sectionPolyFlags,
                    lightmapTextureIndex: lightmapTextureIndex,
                    totalVertices: 0,
                    nodes: [],
                    isOutdoor,
                    isWaterSheet: !!(surf.flags & PF_WaterSheet)
                });
            }

            const vcount = node.numVertices;
            if (vcount <= 0) continue;

            const section = prioritySections.get(composedKey);

            const light: LightmapInfo_T = !lightmap ? null : {
                uuid: lightmap.uuid,
                resolution: { width: lightmap.width, height: lightmap.height },
                offset: { x: lightmapIndex.offsetX, y: lightmapIndex.offsetY },
                size: { width: lightmapIndex.sizeX, height: lightmapIndex.sizeY },
                matrix: lightmapIndex.uvMatrix
            };

            node.iVertexIndex = section.totalVertices;
            section.totalVertices += vcount;
            section.nodes.push({ node, surf, light, nodeIndex });
        }

        const _textureBase = FVector.make(), _position = FVector.make();
        const _textureX: FVector = FVector.make(), _textureY: FVector = FVector.make();
        const _tangentZ: FVector = FVector.make();

        const createSection = (priority: PriorityGroups_T, sectionKey: string, sectionData: ObjectsForSection_T): number => {
            const { material, lightmap, totalVertices, nodes } = sectionData;

            const positions = new Float32Array(totalVertices * 3);
            const normals = new Float32Array(totalVertices * 3);
            const uvs = new Float32Array(totalVertices * 2), uvs2 = new Float32Array(totalVertices * 2);
            const attrNodeIndices = new Uint32Array(totalVertices);

            const TypedIndicesArray = getTypedArrayConstructor(totalVertices);
            const indices: number[] = [];
            const nodeIndices: number[] = [];

            let dstVertices = 0;

            for (const { node, surf, light, nodeIndex } of nodes) {
                const textureBase: FVector = this.points.getElem(surf.pBase, _textureBase);
                const textureX: FVector = this.vectors.getElem(surf.vTextureU, _textureX);
                const textureY: FVector = this.vectors.getElem(surf.vTextureV, _textureY);
                const tangentZ: FVector = this.vectors.getElem(surf.vNormal, _tangentZ);

                const texSize = surf.material?.loadSelf?.().getTextureSize();
                const texWidth = texSize?.width ?? TEXEL_SCALE;
                const texHeight = texSize?.height ?? TEXEL_SCALE;

                const fcount = node.numVertices - 2;
                const findex = dstVertices; // Starting vertex index for this node

                for (let vertexIndex = 0, vcount = node.numVertices; vertexIndex < vcount; vertexIndex++) {
                    const vert: FVert = this.vertices.getElem(node.iVertPool + vertexIndex);
                    const position: FVector = this.points.getElem(vert.pVertex, _position);

                    const texB = position.sub(textureBase);
                    const texU = texB.dot(textureX) / texWidth;
                    const texV = texB.dot(textureY) / texHeight;

                    const vOffset = dstVertices * 3, uOffset = dstVertices * 2;

                    position.toArray(positions, vOffset);
                    tangentZ.toArray(normals, vOffset);

                    uvs[uOffset + 0] = texU;
                    uvs[uOffset + 1] = texV;

                    if (light) {
                        const posLightmapped = position.applyMatrix4(light.matrix);
                        const u = posLightmapped.x / light.size.width, v = posLightmapped.y / light.size.height;
                        const { width, height } = light.resolution;
                        const lmU = light.offset.x / width + u * (light.size.width / width);
                        const lmV = light.offset.y / height + v * (light.size.height / height);
                        uvs2[uOffset + 0] = lmU;
                        uvs2[uOffset + 1] = lmV;
                    }

                    attrNodeIndices[vertexIndex + findex] = nodeIndex;

                    dstVertices++;
                }

                for (let i = 0; i < fcount; i++) {
                    indices.push(findex, findex + i + 2, findex + i + 1);
                }

                // UE2 line 1024: Node.iSection = Section - &Sections(0);
                // const nodeIndex = this.bspNodes.indexOf(node); // Optimized: passed via NodeInfo_T
                if (nodeIndex >= 0 && node.numVertices > 0) {
                    nodeIndices.push(nodeIndex);
                    const sectionIndex = result.bspSections.length;
                    result.nodeToSection[nodeIndex] = sectionIndex;
                    result.bspNodes[nodeIndex].sectionIndex = sectionIndex;
                }
            }

            let finalMaterialUuid: string;
            if (lightmap) {
                finalMaterialUuid = `${material}+LM_${generateUUID()}`;
                result.materials.push([finalMaterialUuid, {
                    materialType: "lightmapped",
                    material: material,
                    lightmap: lightmap,
                } as GD.IBaseMaterialDecodeInfo]);
            } else {
                finalMaterialUuid = material;
            }

            const geometryUuid = generateUUID();
            result.geometries.push([geometryUuid, {
                groups: [[0, indices.length, 0]],
                indices: new TypedIndicesArray(indices),
                attributes: {
                    normals,
                    positions,
                    uvs: lightmap ? [uvs, uvs2] : [uvs],
                    nodeIndex: attrNodeIndices
                }
            }]);

            const sectionInfo: GD.IBSPSectionDecodeInfo_T & { isOutdoor: boolean } = {
                uuid: generateUUID(),
                priority,
                material: finalMaterialUuid,
                lightmap: lightmap,
                geometry: geometryUuid,
                nodeIndices,
                isOutdoor: sectionData.isOutdoor,
                isUnlit: !!(sectionData.polyFlags & PF_Unlit),
                sectionName: sectionKey,
                depthWrite: this.isSky ? false : undefined,
                depthTest: this.isSky ? false : undefined,
                fog: this.isSky ? true : undefined,
                side: (this.isSky || (sectionData.polyFlags & PolyFlags_T.PF_TwoSided) || sectionData.isWaterSheet) ? DoubleSide : undefined,
                blendingMode: this.isSky ? (!(sectionData.polyFlags & PolyFlags_T.PF_TwoSided) ? "brighten" : "normal") :
                    ((sectionData.polyFlags & PolyFlags_T.PF_Additive) ? "brighten" : undefined),
            };

            const sectionIndex = result.bspSections.length;
            result.bspSections.push(sectionInfo);
            result.bspSectionIndexMap.set(sectionKey, sectionIndex);

            return sectionIndex;
        };

        // Process all sections
        for (const [priority, prioritySections] of sectionMap.entries()) {
            for (const [sectionKey, sectionData] of prioritySections.entries()) {
                createSection(priority, sectionKey, sectionData);
            }
        }


        return result;
    }
}

export default UModel;
export { UModel };

function boxPushOut(normal: GA.FVector | GA.FPlane, size: GA.FVector) {
    return Math.abs(normal.x * size.x) + Math.abs(normal.y * size.y) + Math.abs(normal.z * size.z);
}

type PriorityGroups_T = "opaque" | "transparent";
type ModelZoneDecodeResult_T = { bspLeaves: GD.IBSPLeafDecodeInfo_T[], bspZones: GD.IBSPZoneDecodeInfo_T[], bspZoneIndexMap: Record<string, number> };
type ModelDecodeResult_T = ModelZoneDecodeResult_T & { bspNodes: GD.IBSPNodeDecodeInfo_T[], bspColliders: GD.IBoxDecodeInfo[], leafActors: GD.IBaseObjectOrInstanceDecodeInfo[][], nodeToSection: number[], nodeZoneMasks: bigint[], bspRenderBounds: GD.IBoxDecodeInfo[], bspSections: GD.IBSPSectionDecodeInfo_T[], bspSectionIndexMap: Map<string, number>, geometries: [string, GD.IGeometryDecodeInfo][], materials: [string, GD.IBaseMaterialDecodeInfo][] };
type ObjectsForSection_T = {
    material: string,  // material UUID
    lightmap: string | null,  // lightmap UUID
    polyFlags: number,  // PolyFlags (PF_Unlit | PF_Selected | PF_TwoSided)
    lightmapTextureIndex: number,  // iLightMapTexture index
    totalVertices: number,
    nodes: NodeInfo_T[],
    isOutdoor: boolean,
    isWaterSheet: boolean
};
type NodeInfo_T = { node: FBSPNode, surf: FBSPSurf, light?: LightmapInfo_T | null, nodeIndex: number };

type LightmapInfo_T = {
    uuid: string,
    offset: { x: number; y: number; },
    resolution: { width: number; height: number; },
    size: { width: number; height: number; },
    matrix: GA.FMatrix
};

// function createOrthonormalBasis(inXAxis: FVector, inYAxis: FVector, inZAxis: FVector) {
//     // Magic numbers for numerical precision.
//     const DELTA = 0.00001;

//     let [XAxis, YAxis, ZAxis] = [inXAxis, inYAxis, inZAxis].map(v => new FVector(v.x, v.y, v.z));

//     // Project the X and Y axes onto the plane perpendicular to the Z axis.
//     XAxis = XAxis.sub(ZAxis.multiplyScalar((XAxis.dot(ZAxis)) / (ZAxis.dot(ZAxis))));
//     YAxis = YAxis.sub(ZAxis.multiplyScalar((YAxis.dot(ZAxis)) / (ZAxis.dot(ZAxis))));

//     // If the X axis was parallel to the Z axis, choose a vector which is orthogonal to the Y and Z axes.
//     if (XAxis.lengthSq() < DELTA * DELTA) {
//         XAxis = YAxis.cross(ZAxis);
//     }

//     // If the Y axis was parallel to the Z axis, choose a vector which is orthogonal to the X and Z axes.
//     if (YAxis.lengthSq() < DELTA * DELTA) {
//         YAxis = XAxis.cross(ZAxis);
//     }

//     // Normalize the basis vectors.
//     XAxis.normalize();
//     YAxis.normalize();
//     ZAxis.normalize();

//     inXAxis.copy(XAxis);
//     inYAxis.copy(YAxis);
//     inZAxis.copy(ZAxis);

//     return [inXAxis, inYAxis, inZAxis];
// }

// function getBasisDeterminantSign(XAxis: FVector, YAxis: FVector, ZAxis: FVector): number {
//     const basis = new Matrix4();

//     basis.elements = [
//         XAxis.x, XAxis.y, XAxis.z, 0,
//         YAxis.x, YAxis.y, YAxis.z, 0,
//         ZAxis.x, ZAxis.y, ZAxis.z, 0,
//         0, 0, 0, 1
//     ];

//     return (basis.determinant() < 0) ? -1.0 : +1.0;
// }
