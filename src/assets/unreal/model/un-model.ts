import UPrimitive from "../un-primitive";
import FVert from "./un-vert";
import FVector from "../un-vector";
import FBSPNode from "../bsp/un-bsp-node";
import FBSPSurf from "../bsp/un-bsp-surf";
import UPolys, { PolyFlags_T } from "../un-polys";
import { BufferValue } from "@l2js/core";
import FZoneProperties from "../un-zone-properties";
import FBox from "../un-box";
import FLeaf from "../un-leaf";
import FBSPSection from "../bsp/un-bsp-section";
import FLightmapIndex from "./un-lightmap-index";
import FMultiLightmapTexture from "./un-multilightmap-texture";
import { generateUUID } from "three/src/math/MathUtils";
import getTypedArrayConstructor from "@client/utils/typed-arrray-constructor";
import FArray, { FIndexArray, FPrimitiveArray } from "@l2js/core/src/unreal/un-array";


const MAX_NODE_VERTICES = 16;       // Max vertices in a Bsp node, pre clipping.
const MAX_FINAL_VERTICES = 24;      // Max vertices in a Bsp node, post clipping.
const MAX_ZONES = 64;               // Max zones per level.
const TEXEL_SCALE = 512;

class UModel extends UPrimitive {
    protected vectors = new FArray(FVector);
    protected points = new FArray(FVector);
    protected vertices = new FArray(FVert);
    protected bspNodes = new FArray(FBSPNode);
    protected bspSurfs = new FArray(FBSPSurf);
    protected bspSection = new FArray(FBSPSection);
    protected lightmaps = new FArray(FLightmapIndex);
    protected multiLightmaps = new FArray(FMultiLightmapTexture);
    protected numSharedSides: number;
    protected polys: UPolys = null;
    protected zones: FZoneProperties[] = [];
    protected bounds = new FArray(FBox);
    protected leafHulls = new FPrimitiveArray(BufferValue.int32);
    protected leaves = new FArray(FLeaf)
    protected rootOutside: boolean;
    protected linked: boolean;

    protected unkArr0 = new FIndexArray();
    protected unkInt0: number;
    protected unkInt1: number;

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

        this.numSharedSides = pkg.read(int32).value as number;  // 0x124

        const numZones = pkg.read(int32).value as number;       // 0x128

        console.assert(numZones <= MAX_ZONES);

        this.zones = new Array(numZones);

        for (let i = 0; i < numZones; i++)
            this.zones[i] = new FZoneProperties().load(pkg);

        this.readHead = pkg.tell();
        const polysId = pkg.read(compat32).value as number;

        const polyExp = pkg.exports[polysId - 1];
        const className = pkg.getPackageName(polyExp.idClass as number)

        console.assert(className === "Polys");

        // if (polysId !== 0) this.promisesLoading.push(new Promise<void>(async resolve => {
        //     this.polys = await pkg.fetchObject<UPolys>(polysId);
        //     resolve();
        // }));

        this.readHead = pkg.tell();

        this.bounds.load(pkg);
        this.leafHulls.load(pkg);
        this.leaves.load(pkg);

        this.unkArr0.load(pkg);

        this.readHead = pkg.tell();

        this.unkInt0 = pkg.read(int32).value as number;
        this.unkInt1 = pkg.read(int32).value as number;

        this.readHead = pkg.tell();

        this.bspSection.load(pkg);

        this.readHead = pkg.tell();

        this.lightmaps.load(pkg);
        this.multiLightmaps.load(pkg);

        this.readHead = pkg.tell();

        pkg.seek(this.readHead, "set");

        // if (this.lightmaps.length > 0)
        //     debugger;

        return this;
    }

    public getDecodeInfo(library: DecodeLibrary, uLevelInfo: ULevelInfo): string[][] {

        this.multiLightmaps.map((lm: FMultiLightmapTexture) => lm.textures[0].staticLightmap.getDecodeInfo(library));

        this.leaves.forEach((leaf: FLeaf) => library.bspLeaves.push(leaf.getDecodeInfo()));
        this.zones.forEach((zone: FZoneProperties, index: number) => {
            const bspZone = zone.getDecodeInfo(library, uLevelInfo);

            library.bspZones.push(bspZone);

            library.bspZoneIndexMap[bspZone.zoneInfo.uuid] = index;
        });

        const objectMap = new Map<PriorityGroups_T, ObjectsForPriority_T>();

        for (let nodeIndex = 0, ncount = this.bspNodes.length; nodeIndex < ncount; nodeIndex++) {
            const node: FBSPNode = this.bspNodes[nodeIndex];
            const surf: FBSPSurf = this.bspSurfs[node.iSurf];
            const nodeInfo = node.getBSPDecodeInfo();

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

            // if (node.iCollisionBound >= 0 && node.iLeaf[0] === -1 && node.iLeaf[1] === -1 && nodeIndex === 1211) {
            //     const hulls = this.leafHulls.getTypedArray() as Int32Array;
            //     const hullIndexList = hulls.slice(node.iCollisionBound);

            //     let hullPlanesCount = 0;
            //     while (hullIndexList[hullPlanesCount] >= 0)
            //         hullIndexList[hullPlanesCount++];

            //     // reinterpret as floats
            //     const initialVector = new Float32Array(new Int32Array(hullIndexList.slice(hullPlanesCount + 1, hullPlanesCount + 1 + 6)).buffer);
            //     const hullFlags = hullIndexList.slice(0, hullPlanesCount);

            //     nodeInfo.collision = {
            //         flags: [...hullFlags],
            //         bounds: {
            //             isValid: true,
            //             min: [initialVector[0], initialVector[2], initialVector[1]],
            //             max: [initialVector[3], initialVector[5], initialVector[4]]
            //         }
            //     };
            // }

            // continue;

            // debugger;

            const zone = surf.actor.loadSelf().getZone();
            const lightmapIndex: FLightmapIndex = node.iLightmapIndex === undefined ? null : this.lightmaps[node.iLightmapIndex];
            const lightmap = lightmapIndex ? this.multiLightmaps[lightmapIndex.iLightmapTexture].textures[0].staticLightmap as FStaticLightmapTexture : null;
            const priority: PriorityGroups_T = surf.flags & PolyFlags_T.PF_AddLast ? "transparent" : "opaque";

            if (!objectMap.has(priority)) objectMap.set(priority, new Map());

            const gPriority = objectMap.get(priority);

            if (!gPriority.has(zone)) gPriority.set(zone, { totalVertices: 0, objects: new Map() });

            const gZone = gPriority.get(zone);

            if (!gZone.objects.has(surf.material)) gZone.objects.set(surf.material, new Map());

            const gSurf = gZone.objects.get(surf.material);

            if (!gSurf.has(lightmap)) gSurf.set(lightmap, { numVertices: 0, nodes: [] });

            const gData = gSurf.get(lightmap);
            const vcount = node.numVertices;

            const light: LightmapInfo = !lightmap ? null : {
                uuid: lightmap.uuid,
                resolution: { width: lightmap.width, height: lightmap.height },
                offset: { x: lightmapIndex.offsetX, y: lightmapIndex.offsetY },
                size: { width: lightmapIndex.sizeX, height: lightmapIndex.sizeY },
                matrix: lightmapIndex.uvMatrix
            };

            node.iVertexIndex = gData.numVertices;
            gData.numVertices += vcount;
            gZone.totalVertices += vcount;

            gData.nodes.push({ node, surf, light });
        }

        const createZoneInfo = (priority: PriorityGroups_T, zone: UZoneInfo, { totalVertices, objects: objectMap }: ObjectsForZone_T): string => {
            const zoneInfo = library.bspZones[library.bspZoneIndexMap[zone.uuid]].zoneInfo;
            const positions = new Float32Array(totalVertices * 3);
            const normals = new Float32Array(totalVertices * 3);
            const uvs = new Float32Array(totalVertices * 2), uvs2 = new Float32Array(totalVertices * 2);

            const materials: string[] = [];
            const TypedIndicesArray = getTypedArrayConstructor(totalVertices);
            const indices: number[] = [], groups: ArrGeometryGroup[] = [];

            let dstVertices = 0;
            let groupOffset = 0, vertexOffset = 0, materialIndex = 0;

            if (totalVertices > 0) {
                for (let material of objectMap.keys()) {
                    const gSurf = objectMap.get(material);

                    for (let staticLightmap of gSurf.keys()) {
                        const materialUuid = material.loadSelf().getDecodeInfo(library);

                        if (staticLightmap) {
                            const lightmappedMaterialUuid = generateUUID();

                            library.materials[lightmappedMaterialUuid] = {
                                materialType: "lightmapped",
                                material: materialUuid,
                                lightmap: staticLightmap?.uuid || null,
                            } as IBaseMaterialDecodeInfo;

                            materials.push(lightmappedMaterialUuid);
                        } else {
                            materials.push(materialUuid);
                        }

                        const { numVertices, nodes } = gSurf.get(staticLightmap);
                        const startGroupOffset = groupOffset;

                        for (let { node, surf, light } of nodes) {
                            const textureBase: FVector = this.points.getElem(surf.pBase);
                            const textureX: FVector = this.vectors.getElem(surf.vTextureU);
                            const textureY: FVector = this.vectors.getElem(surf.vTextureV);

                            // // Use the texture coordinates and normal to create an orthonormal tangent basis.
                            // const tangentX: FVector = textureX;
                            // const tangentY: FVector = textureY;
                            const tangentZ: FVector = this.vectors.getElem(surf.vNormal); // tangentZ is normal?
                            const fcount = node.numVertices - 2;
                            const findex = vertexOffset + node.iVertexIndex;

                            // createOrthonormalBasis(tangentX, tangentY, tangentZ);

                            for (let i = 0; i < fcount; i++) {
                                indices.push(findex, findex + i + 2, findex + i + 1)
                            }

                            groupOffset = groupOffset + fcount;

                            if (surf.flags & PolyFlags_T.PF_TwoSided) {
                                for (let i = 0; i < fcount; i++) {
                                    indices.push(findex, findex + i + 1, findex + i + 2)
                                }

                                groupOffset = groupOffset + fcount;
                            }

 
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

                                zoneInfo.bounds.isValid = true;
                                [[Math.min, zoneInfo.bounds.min], [Math.max, zoneInfo.bounds.max]].forEach(
                                    ([fn, arr]: [(...values: number[]) => number, Vector3Arr]) => {
                                        for (let i = 0; i < 3; i++)
                                            arr[i] = fn(arr[i], positions[vOffset + i]);
                                    }
                                );

                                normals[vOffset + 0] = tangentZ.x;
                                normals[vOffset + 1] = tangentZ.z;
                                normals[vOffset + 2] = tangentZ.y;

                                uvs[uOffset + 0] = texU;
                                uvs[uOffset + 1] = texV;

                                if (light) {
                                    const posLightmapped = position.applyMatrix4(light.matrix);
                                    const u = posLightmapped.x / light.size.width, v = posLightmapped.y / light.size.height;

                                    const { width, height } = light.resolution;

                                    const lmU = light ? light.offset.x / width + u * (light.size.width / width) : 0;
                                    const lmV = light ? light.offset.y / height + v * (light.size.height / height) : 0;

                                    uvs2[uOffset + 0] = lmU;
                                    uvs2[uOffset + 1] = lmV;
                                }

                                // // DestVertex->ShadowTexCoord = Vert.ShadowTexCoord;
                                // tangentX.toArray(tangentsX, dstVertices * 3);
                                // tangentZ.toArray(tangentsZ, dstVertices * 4);

                                // // store the sign of the determinant in TangentZ.W
                                // tangentsZ[dstVertices * 4 + 3] = getBasisDeterminantSign(tangentX, tangentY, tangentZ);

                                dstVertices++;
                            }
                        }


                        vertexOffset = vertexOffset + numVertices;

                        groups.push([startGroupOffset * 3, (groupOffset - startGroupOffset) * 3, materialIndex++]);
                    }
                }
            }

            const uuid = generateUUID();
            const materialUuid = `${priority}/${zone.uuid}/${this.uuid}`;
            const geometryUuid = `${priority}/${zone.uuid}/${this.uuid}`;

            library.materials[materialUuid] = { materialType: "group", materials } as IMaterialGroupDecodeInfo;
            library.geometries[geometryUuid] = {
                groups,
                indices: new TypedIndicesArray(indices),
                attributes: {
                    normals,
                    positions,
                    uvs: [uvs, uvs2]
                }
            };

            // debugger;

            zoneInfo.children.push({
                uuid,
                type: "Model",
                name: `Sub_${priority}_${this.objectName}_${zone.objectName}`,
                geometry: geometryUuid,
                materials: materialUuid,
            } as IStaticMeshObjectDecodeInfo);

            return uuid;
        };

        const createPriorityGroup = ([priority, priorityMap]: [PriorityGroups_T, ObjectsForPriority_T]): string[] => {
            return [...priorityMap.entries()].map(([zone, objects]) => createZoneInfo(priority, zone, objects));
        };

        return [...objectMap.entries()].map(createPriorityGroup);
    }
}

export default UModel;
export { UModel };

type PriorityGroups_T = "opaque" | "transparent";
type ObjectsForPriority_T = Map<UZoneInfo, ObjectsForZone_T>;
type ObjectsForZone_T = { totalVertices: number, objects: Map<UMaterial, ObjectsForMaterial_T> };
type ObjectsForMaterial_T = Map<FStaticLightmapTexture, ObjectsForLightmap_T>;
type ObjectsForLightmap_T = { numVertices: number, nodes: NodeInfo_T[] };
type NodeInfo_T = { node: FBSPNode, surf: FBSPSurf, light?: LightmapInfo };

type LightmapInfo = {
    uuid: string,
    offset: { x: number; y: number; },
    resolution: { width: number; height: number; },
    size: { width: number; height: number; },
    matrix: FMatrix
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