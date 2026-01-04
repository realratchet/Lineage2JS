import UPrimitive from "../un-primitive";
import FVert from "./un-vert";
import FBSPNode from "../bsp/un-bsp-node";
import FBSPSurf from "../bsp/un-bsp-surf";
import { PolyFlags_T } from "../un-polys";
import { BufferValue } from "@l2js/core";
import FZoneProperties from "../un-zone-properties";
import FLeaf from "../un-leaf";
import FBSPSection from "../bsp/un-bsp-section";
import FLightmapIndex from "./un-lightmap-index";
import FMultiLightmapTexture from "./un-multilightmap-texture";
import { generateUUID } from "three/src/math/MathUtils";
import getTypedArrayConstructor from "@client/utils/typed-arrray-constructor";
import FArray, { FIndexArray, FObjectArray, FPrimitiveArray } from "@l2js/core/src/unreal/un-array";
import FVector from "../un-vector";
import FBox from "@client/assets/unreal/un-box";
import { dumpBspTreeArtifacts } from "@client/utils/bsp-dump";


const MAX_NODE_VERTICES = 16;       // Max vertices in a Bsp node, pre clipping.
const MAX_FINAL_VERTICES = 24;      // Max vertices in a Bsp node, post clipping.
const MAX_ZONES = 64;               // Max zones per level.
const TEXEL_SCALE = 512;

const nodeCache = new Array<number>();

abstract class UModel extends UPrimitive {
    protected levelInfo: GA.ULevelInfo

    declare protected vectors: C.FArray<GA.FVector>;
    declare protected points: C.FArray<GA.FVector>;
    declare protected vertices: C.FArray<FVert>;
    declare protected bspNodes: C.FArray<FBSPNode>;
    declare protected bspSurfs: C.FArray<FBSPSurf>;
    declare protected bspSection: C.FArray<FBSPSection>;
    declare protected lightmaps: C.FArray<FLightmapIndex>;
    declare protected multiLightmaps: C.FArray<FMultiLightmapTexture>;
    declare protected numSharedSides: number;
    declare protected polys: GA.UPolys;
    declare protected zones: FZoneProperties[];
    declare protected bounds: FArray<GA.FBox>;
    declare protected leafHulls: FPrimitiveArray<"int32">;
    declare protected leaves: FArray<FLeaf>
    declare protected isRootOutside: boolean;
    declare protected isLinked: boolean;

    declare protected lights: FObjectArray;

    public setLevelInfo(levelInfo: GA.ULevelInfo) { this.levelInfo = levelInfo; }
    public getLevelInfo() { return this.levelInfo; }

    protected preLoad(pkg: C.APackage, exp: C.UExport): void {
        super.preLoad(pkg, exp);

        this.vectors = new FArray(FVector.class());
        this.points = new FArray(FVector.class());
        this.vertices = new FArray(FVert);
        this.bspNodes = new FArray(FBSPNode);
        this.bspSurfs = new FArray(FBSPSurf);
        this.bspSection = new FArray(FBSPSection);
        this.lightmaps = new FArray(FLightmapIndex);
        this.multiLightmaps = new FArray(FMultiLightmapTexture);
        this.polys = null;
        this.zones = [];
        this.bounds = new FArray(FBox.class());
        this.leafHulls = new FPrimitiveArray(BufferValue.int32);
        this.leaves = new FArray(FLeaf);
        this.lights = new FObjectArray();
    }

    protected doLoad(pkg: C.APackage, exp: C.UExport): this {

        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        // console.assert(verArchive === 123, "Archive version differs, will likely not work.");
        // console.assert(verLicense === 23, "Licensee version differs, will likely not work.");

        const int32 = new BufferValue(BufferValue.int32);
        const compat32 = new BufferValue(BufferValue.compat32);

        pkg.seek(this.readHead, "set");

        super.doLoad(pkg, exp);

        this.vectors.load(pkg);     // 0x78
        this.points.load(pkg);      // 0x88
        this.bspNodes.load(pkg);    // 0x58
        this.bspSurfs.load(pkg);    // 0x98
        this.vertices.load(pkg);    // 0x68

        this.numSharedSides = pkg.read(int32).value;  // 0x124

        const numZones = pkg.read(int32).value;       // 0x128

        console.assert(numZones <= MAX_ZONES);

        this.zones = new Array(numZones);

        for (let i = 0; i < numZones; i++)
            this.zones[i] = new FZoneProperties().load(pkg);

        this.readHead = pkg.tell();
        const polysId = pkg.read(compat32).value;
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

        this.isRootOutside = pkg.read(int32).value != 0;
        this.isLinked = pkg.read(int32).value != 0;

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

    public getZoneDecodeInfo(library: GD.DecodeLibrary, uLevelInfo: GA.ULevelInfo): void {
        this.leaves.forEach((leaf: FLeaf) => library.bspLeaves.push(leaf.getDecodeInfo()));
        this.zones.forEach((zone: FZoneProperties, index: number) => {
            const bspZone = zone.getDecodeInfo(library, uLevelInfo);

            library.bspZones.push(bspZone);

            library.bspZoneIndexMap[bspZone.zoneInfo.uuid] = index;
        });
    }

    public getDecodeInfo(library: GD.DecodeLibrary, uLevelInfo: GA.ULevelInfo): string[][] {

        this.multiLightmaps.map((lm: FMultiLightmapTexture) => lm.textures[0].staticLightmap.getDecodeInfo(library));

        this.getZoneDecodeInfo(library, uLevelInfo);

        library.leafActors.length = library.bspLeaves.length;
        library.nodeToSection.length = this.bspNodes.length;
        library.nodeZoneMasks.length = this.bspNodes.length;
        library.bspRenderBounds.length = this.bounds.length;

        for (let i = 0; i < library.bspLeaves.length; i++)
            library.leafActors[i] = [];

        for (let i = 0; i < this.bspNodes.length; i++)
            library.nodeToSection[i] = -1;

        for (let i = 0; i < this.bounds.length; i++)
            library.bspRenderBounds[i] = this.bounds[i]?.getDecodeInfo() ?? { isValid: false, min: [0, 0, 0], max: [0, 0, 0] };


        const sectionMap = new Map<PriorityGroups_T, Map<string, ObjectsForSection_T>>();

        for (let nodeIndex = 0, ncount = this.bspNodes.length; nodeIndex < ncount; nodeIndex++) {
            const node: FBSPNode = this.bspNodes[nodeIndex];
            const surf: FBSPSurf = this.bspSurfs[node.iSurf];
            const nodeInfo = node.getBSPDecodeInfo(surf.flags) as GD.IBSPNodeDecodeInfo_T;

            nodeInfo.zoneMask = library.nodeZoneMasks[nodeIndex] = node.zoneMask;

            library.bspNodes.push(nodeInfo);

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
                        min: [initialVector[0], initialVector[2], initialVector[1]],
                        max: [initialVector[3], initialVector[5], initialVector[4]]
                    }
                };
            }

            if (surf.flags & PolyFlags_T.PF_Invisible) continue;

            const vert: FVert = this.vertices.getElem(node.iVertPool);
            const { x: testX, y: testZ, z: testY } = this.points.getElem(vert.pVertex) as FVector;

            if (testY <= -16000 || testY >= 16000) continue;
            if (testX <= -327680.00 || testX >= 327680.00) continue;
            if (testZ <= -262144.00 || testZ >= 262144.00) continue;

            if (node.iCollisionBound >= 0) {
                library.bspColliders.push(nodeInfo.collision.bounds);
            }

            const lightmapIndex: FLightmapIndex = node.iLightmapIndex === undefined ? null : this.lightmaps[node.iLightmapIndex];
            const lightmap = lightmapIndex ? this.multiLightmaps[lightmapIndex.iLightmapTexture].textures[0].staticLightmap as GA.FStaticLightmapTexture : null;
            const priority: PriorityGroups_T = /*false &&*/ surf.flags & PolyFlags_T.PF_AddLast ? "transparent" : "opaque";

            // Get material UUID
            const materialUuid = surf.material.loadSelf().getDecodeInfo(library);
            const lightmapTextureIndex = lightmapIndex ? lightmapIndex.iLightmapTexture : -1;

            // UE2 groups sections by: Material + PolyFlags + iLightMapTexture
            // PolyFlags used: PF_Unlit | PF_Selected | PF_TwoSided (from UnModel.cpp line 1000)
            // PF_Unlit = 0x00400000 (from UnObj.h line 254)
            const PF_Unlit = 0x00400000;
            const sectionPolyFlags = surf.flags & (PF_Unlit | PolyFlags_T.PF_Selected | PolyFlags_T.PF_TwoSided);

            // Create section key matching UE2's exact criteria
            const sectionKey = `${materialUuid}/${sectionPolyFlags}/${lightmapTextureIndex}`;

            if (!sectionMap.has(priority)) sectionMap.set(priority, new Map());
            const prioritySections = sectionMap.get(priority);

            if (!prioritySections.has(sectionKey)) {
                prioritySections.set(sectionKey, {
                    material: materialUuid,
                    lightmap: lightmap ? lightmap.uuid : null,
                    polyFlags: sectionPolyFlags,
                    lightmapTextureIndex: lightmapTextureIndex,
                    totalVertices: 0,
                    nodes: []
                });
            }

            // UE2 line 1003: Only nodes with NumVertices > 0 get added to sections
            const vcount = node.numVertices;
            if (vcount <= 0) continue; // Skip nodes without vertices (splitter nodes)

            const section = prioritySections.get(sectionKey);

            const light: LightmapInfo = !lightmap ? null : {
                uuid: lightmap.uuid,
                resolution: { width: lightmap.width, height: lightmap.height },
                offset: { x: lightmapIndex.offsetX, y: lightmapIndex.offsetY },
                size: { width: lightmapIndex.sizeX, height: lightmapIndex.sizeY },
                matrix: lightmapIndex.uvMatrix
            };

            node.iVertexIndex = section.totalVertices;
            section.totalVertices += vcount;
            section.nodes.push({ node, surf, light });
        }

        // Create sections from sectionMap (UE2-style: material + lightmap only, NOT split by zone)
        const createSection = (priority: PriorityGroups_T, sectionKey: string, sectionData: ObjectsForSection_T): number => {
            const { material, lightmap, totalVertices, nodes } = sectionData;

            const positions = new Float32Array(totalVertices * 3);
            const normals = new Float32Array(totalVertices * 3);
            const uvs = new Float32Array(totalVertices * 2), uvs2 = new Float32Array(totalVertices * 2);

            const TypedIndicesArray = getTypedArrayConstructor(totalVertices);
            const indices: number[] = [];
            const nodeIndices: number[] = [];

            let dstVertices = 0;

            // Process all nodes in this section (UE2: sections can span multiple zones)
            for (const { node, surf, light } of nodes) {
                const textureBase: FVector = this.points.getElem(surf.pBase);
                const textureX: FVector = this.vectors.getElem(surf.vTextureU);
                const textureY: FVector = this.vectors.getElem(surf.vTextureV);
                const tangentZ: FVector = this.vectors.getElem(surf.vNormal);

                const fcount = node.numVertices - 2;
                const findex = dstVertices; // Starting vertex index for this node

                // Process vertices first (so we know the correct vertex count)
                for (let vertexIndex = 0, vcount = node.numVertices; vertexIndex < vcount; vertexIndex++) {
                    const vert: FVert = this.vertices.getElem(node.iVertPool + vertexIndex);
                    const position: FVector = this.points.getElem(vert.pVertex);

                    const texB = position.sub(textureBase);
                    const texU = texB.dot(textureX) / TEXEL_SCALE;
                    const texV = texB.dot(textureY) / TEXEL_SCALE;

                    const vOffset = dstVertices * 3, uOffset = dstVertices * 2;

                    positions[vOffset + 0] = position.x;
                    positions[vOffset + 1] = position.z;
                    positions[vOffset + 2] = position.y;

                    normals[vOffset + 0] = tangentZ.x;
                    normals[vOffset + 1] = tangentZ.z;
                    normals[vOffset + 2] = tangentZ.y;

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

                    dstVertices++;
                }

                // Create triangles after vertices are processed
                for (let i = 0; i < fcount; i++) {
                    indices.push(findex, findex + i + 2, findex + i + 1);
                }

                if (surf.flags & PolyFlags_T.PF_TwoSided) {
                    for (let i = 0; i < fcount; i++) {
                        indices.push(findex, findex + i + 1, findex + i + 2);
                    }
                }

                // Store node index for this section
                // UE2 line 1024: Node.iSection = Section - &Sections(0);
                // Only nodes with NumVertices > 0 get section indices
                const nodeIndex = this.bspNodes.indexOf(node);
                if (nodeIndex >= 0 && node.numVertices > 0) {
                    nodeIndices.push(nodeIndex);
                    const sectionIndex = library.bspSections.length;
                    library.nodeToSection[nodeIndex] = sectionIndex;
                    library.bspNodes[nodeIndex].sectionIndex = sectionIndex;
                }
            }

            // Create material (lightmapped or regular)
            let finalMaterialUuid: string;
            if (lightmap) {
                finalMaterialUuid = generateUUID();
                library.materials[finalMaterialUuid] = {
                    materialType: "lightmapped",
                    material: material,
                    lightmap: lightmap,
                } as GD.IBaseMaterialDecodeInfo;
            } else {
                finalMaterialUuid = material;
            }

            // Create geometry for this section
            const geometryUuid = generateUUID();
            library.geometries[geometryUuid] = {
                groups: [[0, indices.length, 0]],
                indices: new TypedIndicesArray(indices),
                attributes: {
                    normals,
                    positions,
                    uvs: lightmap ? [uvs, uvs2] : [uvs]
                }
            };

            // Create section info (UE2-style: material + lightmap only, no zone splitting)
            const sectionInfo: GD.IBSPSectionDecodeInfo_T = {
                uuid: generateUUID(),
                priority,
                material: finalMaterialUuid,
                lightmap: lightmap,
                geometry: geometryUuid,
                nodeIndices
            };

            const sectionIndex = library.bspSections.length;
            library.bspSections.push(sectionInfo);
            library.bspSectionIndexMap.set(sectionKey, sectionIndex);

            return sectionIndex;
        };

        // Process all sections
        for (const [priority, prioritySections] of sectionMap.entries()) {
            for (const [sectionKey, sectionData] of prioritySections.entries()) {
                createSection(priority, sectionKey, sectionData);
            }
        }


        return [];
    }
}

export default UModel;
export { UModel };

function boxPushOut(normal: GA.FVector | GA.FPlane, size: GA.FVector) {
    return Math.abs(normal.x * size.x) + Math.abs(normal.y * size.y) + Math.abs(normal.z * size.z);
}

type PriorityGroups_T = "opaque" | "transparent";
// NEW: Section-based organization (replaces zone-based)
type ObjectsForSection_T = {
    material: string,  // material UUID
    lightmap: string | null,  // lightmap UUID
    polyFlags: number,  // PolyFlags (PF_Unlit | PF_Selected | PF_TwoSided)
    lightmapTextureIndex: number,  // iLightMapTexture index
    totalVertices: number,
    nodes: NodeInfo_T[]
};
type NodeInfo_T = { node: FBSPNode, surf: FBSPSurf, light?: LightmapInfo | null };

type LightmapInfo = {
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