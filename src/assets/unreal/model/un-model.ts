import UPrimitive from "../un-primitive";
import FArray, { FPrimitiveArray } from "../un-array";
import FVert from "./un-vert";
import FVector from "../un-vector";
import FBSPNode from "../bsp/un-bsp-node";
import FBSPSurf from "../bsp/un-bsp-surf";
import UPolys, { PolyFlags_T } from "../un-polys";
import BufferValue from "../../buffer-value";
import FZoneProperties from "../un-zone-properties";
import UMaterial from "../un-material";
import FBox from "../un-box";
import FNumber from "../un-number";
import { FLight } from "../un-light";
import FLeaf from "../un-leaf";
import FConstructable from "../un-constructable";
// import UPackage from "../un-package";
import { PropertyTag, UNP_PropertyTypes } from "../un-property";
import FBspSection from "../bsp/un-bsp-section";
import FLightmapIndex from "./un-lightmap-index";
import saveFile from "@client/utils/save-file";
import FMultiLightmapTexture from "./un-multilightmap-texture";
import { generateUUID } from "three/src/math/MathUtils";

type UPackage = import("../un-package").UPackage;
type UExport = import("../un-export").UExport;

const MAX_NODE_VERTICES = 16;       // Max vertices in a Bsp node, pre clipping.
const MAX_FINAL_VERTICES = 24;      // Max vertices in a Bsp node, post clipping.
const MAX_ZONES = 64;               // Max zones per level.


class UModel extends UPrimitive {
    protected vectors = new FArray(FVector);
    protected points = new FArray(FVector);
    protected vertices = new FArray(FVert);
    protected bspNodes = new FArray(FBSPNode);
    protected bspSurfs = new FArray(FBSPSurf);
    protected bspSection = new FArray(FBspSection);
    protected lightmaps = new FArray(FLightmapIndex);
    protected multiLightmaps = new FArray(FMultiLightmapTexture);
    protected numSharedSides: number;
    protected polys: UPolys = null;
    protected zones: FZoneProperties[] = [];
    protected bounds = new FArray(FBox);
    protected leafHulls: FPrimitiveArray<"int32"> = new FPrimitiveArray(BufferValue.int32);
    protected leaves = new FArray(FLeaf)
    protected lights = new FArray(FLight);
    protected rootOutside: boolean;
    protected linked: boolean;

    protected unkArr0: number[];
    protected unkInt0: number;
    protected unkInt1: number;

    protected doLoad(pkg: UPackage, exp: UExport): this {
        try {
            const int8 = new BufferValue(BufferValue.int8);
            const int32 = new BufferValue(BufferValue.int32);
            const uint8 = new BufferValue(BufferValue.uint8);
            const compat32 = new BufferValue(BufferValue.compat32);
            const float = new BufferValue(BufferValue.float);

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
            const className = pkg.getPackageName(polyExp.idClass.value as number)

            console.assert(className === "Polys");

            this.readHead = pkg.tell();

            this.bounds.load(pkg, null);
            this.leafHulls.load(pkg, null);
            this.leaves.load(pkg, null);

            this.unkArr0 = new FArray(FNumber.forType(BufferValue.compat32)).load(pkg).map(x => x.value);

            this.readHead = pkg.tell();

            this.unkInt0 = pkg.read(int32).value as number;
            this.unkInt1 = pkg.read(int32).value as number;

            this.readHead = pkg.tell();

            this.bspSection.load(pkg, null);

            this.readHead = pkg.tell();

            this.lightmaps.load(pkg, null);
            this.multiLightmaps.load(pkg, null);

            // if (this.lightmaps.length > 0 || this.multiLightmaps.length > 0)
            //     debugger;

            this.readHead = pkg.tell();

            pkg.seek(this.readHead, "set");
        } catch (e) { }
        return this;
    }

    public async getDecodeInfo(library: IDecodeLibrary): Promise<IStaticMeshObjectDecodeInfo> {
        if (this.uuid in library.geometries) return {
            name: this.objectName,
            type: "Model",
            geometry: this.uuid,
            materials: this.uuid,
        } as IStaticMeshObjectDecodeInfo

        library.geometries[this.uuid] = null;
        library.materials[this.uuid] = null;

        await this.onLoaded();

        const globalBSPTexelScale = 128;
        const materials: string[] = [];
        const objectMap = new Map<UMaterial, Map<any, { numVertices: number, nodes: { node: FBSPNode, surf: FBSPSurf, light?: LightmapInfo }[] }>>();

        // Calculate the size of the vertex buffer and the base vertex index of each node.
        let totalVertices = 0;
        let dstVertices = 0;

        await Promise.all(this.multiLightmaps.map((lm: FMultiLightmapTexture, i) => lm.textures[0].staticLightmap.getDecodeInfo(library)));

        for (let nodeIndex = 0, ncount = this.bspNodes.length; nodeIndex < ncount; nodeIndex++) {
            const node: FBSPNode = this.bspNodes[nodeIndex];
            const surf: FBSPSurf = this.bspSurfs[node.iSurf];

            // if(node.iSurf !== 699) continue;
            // if(node.iSurf !== 234) continue;
            if (node.iSurf !== 1771) continue; // offset: [56, 360] | size: [72, 136] | lightmap: 8 | small piece of water
            // if (node.iSurf !== 1774) continue; // grass near water

            await Promise.all(surf.promisesLoading);

            const isInvisible = surf.flags & PolyFlags_T.PF_Invisible;

            if (isInvisible) continue;

            const lightmapIndex: FLightmapIndex = node.iLightmapIndex === undefined ? null : this.lightmaps[node.iLightmapIndex];
            const lightmap = lightmapIndex ? this.multiLightmaps[lightmapIndex.iLightmapTexture].textures[0].staticLightmap : null;

            // if (!lightmapIndex) continue;
            // if (lightmapIndex.iLightmapTexture !== 8) continue;
            // if (lightmapIndex.offsetX !== 56 && lightmapIndex.offsetX !== 128) continue;
            // if (lightmapIndex.offsetY !== 360) continue;

            // console.log(lightmapIndex.offsetX, node.iSurf);

            // debugger;

            if (!objectMap.has(surf.material)) {
                objectMap.set(surf.material, new Map());
            }

            const gSurf = objectMap.get(surf.material);

            if (!gSurf.has(lightmap)) {
                gSurf.set(lightmap, {
                    numVertices: 0,
                    nodes: []
                });
            };

            const gData = gSurf.get(lightmap);
            const vcount = node.numVertices;
            // const vcount = (surf.flags & PolyFlags_T.PF_TwoSided) ? (node.numVertices * 2) : node.numVertices;

            // if (vcount == 7)
            //     debugger;

            const light: LightmapInfo = !lightmap ? null : {
                uuid: lightmap.uuid,
                offset: { x: lightmapIndex.offsetX, y: lightmapIndex.offsetY },
                size: { width: lightmapIndex.sizeX, height: lightmapIndex.sizeY }
            };

            node.iVertexIndex = gData.numVertices;
            gData.numVertices += vcount;
            totalVertices += vcount;

            gData.nodes.push({ node, surf, light, lightmapIndex, lightmap: this.multiLightmaps?.[lightmapIndex?.iLightmapTexture] });

            // debugger;
            // console.log(light);
            // break;
        }

        // debugger;

        const positions = new Float32Array(totalVertices * 3);
        const normals = new Float32Array(totalVertices * 3);
        const uvs = new Float32Array(totalVertices * 2);
        const uvs2 = new Float32Array(totalVertices * 2);
        // const tangentsX = new Float32Array(totalVertices * 3);
        // const tangentsZ = new Float32Array(totalVertices * 4);
        const indices: number[] = [], groups: ArrGeometryGroup[] = [];

        let groupOffset = 0, vertexOffset = 0, materialIndex = 0;

        if (totalVertices > 0) {
            for (let material of [...objectMap.keys()]) {
                const gSurf = objectMap.get(material);

                for (let staticLightmap of [...gSurf.keys()]) {
                    const materialUuid = await material.getDecodeInfo(library);

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

                    for (let { node, surf, light, lightmap, lightmapIndex } of nodes) {
                        const textureBase: FVector = this.points.getElem(surf.pBase);
                        const textureX: FVector = this.vectors.getElem(surf.vTextureU);
                        const textureY: FVector = this.vectors.getElem(surf.vTextureV);

                        // // Use the texture coordinates and normal to create an orthonormal tangent basis.
                        // const tangentX: FVector = textureX;
                        // const tangentY: FVector = textureY;
                        const tangentZ: FVector = this.vectors.getElem(surf.vNormal); // tangentZ is normal?
                        const fcount = node.numVertices - 2;
                        const findex = vertexOffset + node.iVertexIndex;

                        // debugger;

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

                        // debugger;

                        for (let vertexIndex = 0, vcount = node.numVertices; vertexIndex < vcount; vertexIndex++) {
                            const vert: FVert = this.vertices.getElem(node.iVertPool + vertexIndex);
                            const position: FVector = this.points.getElem(vert.pVertex);//.sub(new FVector(17728, 114176, -2852));

                            const texB = position.sub(textureBase);
                            const texU = texB.dot(textureX) / globalBSPTexelScale;
                            const texV = texB.dot(textureY) / globalBSPTexelScale;

                            // const [lmNormU, lmNormV] = _uvs[vertexIndex];

                            // const a = position.sub(node.unkVec).dot(textureX);
                            // const b = position.sub(node.unkVec).dot(textureY);

                            debugger;

                            const lmNormU = (Math.abs(texB.dot(textureX)) % 64) / 64;
                            const lmNormV = (Math.abs(texB.dot(textureY)) % 64) / 64;

                            // debugger;

                            // const lmNormU = this.vectors.getElem(25 + vertexIndex).dot(textureX);
                            // const lmNormV = this.vectors.getElem(25 + vertexIndex).dot(textureY);

                            const lmU = light ? light.offset.x / 512 + lmNormU * (light.size.width / 512) : 0;
                            const lmV = light ? light.offset.y / 512 + lmNormV * (light.size.height / 512) : 0;

                            // console.log(lmNormU, lmNormV)

                            // [0.109375, 0.703125, 0.140625, 0.265625]
                            // debugger;

                            positions[dstVertices * 3 + 0] = position.x;
                            positions[dstVertices * 3 + 1] = position.z;
                            positions[dstVertices * 3 + 2] = position.y;

                            normals[dstVertices * 3 + 0] = tangentZ.x;
                            normals[dstVertices * 3 + 1] = tangentZ.z;
                            normals[dstVertices * 3 + 2] = tangentZ.y;

                            uvs[dstVertices * 2 + 0] = texU;
                            uvs[dstVertices * 2 + 1] = texV;

                            // const uvNormalizedX = (1 + (texU) % 1) % 1;
                            // const uvNormalizedY = (1 + (texV) % 1) % 1;

                            uvs2[dstVertices * 2 + 0] = lmNormU;
                            uvs2[dstVertices * 2 + 1] = lmNormV;

                            // debugger;

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

                    // debugger;
                }
            }
        }

        // debugger;

        library.geometries[this.uuid] = {
            groups,
            indices,
            // bounds: this.decodeBoundsInfo(),
            attributes: {
                normals,
                positions,
                uvs: [uvs, uvs2]
            },
        };

        library.materials[this.uuid] = { materialType: "group", materials } as IMaterialGroupDecodeInfo;

        return {
            name: this.objectName,
            type: "Model",
            geometry: this.uuid,
            materials: this.uuid,
        } as IStaticMeshObjectDecodeInfo;
    }

    // public async decodeModel(): Promise<Object3D> {
    //     const groups = new Group();
    //     const globalBSPTexelScale = 128;
    //     const objectMap = new Map<UMaterial, { numVertices: number, nodes: { node: FBSPNode, surf: FBSPSurf }[] }>();
    //     const geometry = new BufferGeometry();
    //     const materials: Material[] = [];

    //     // Calculate the size of the vertex buffer and the base vertex index of each node.
    //     let totalVertices = 0;
    //     let dstVertices = 0;

    //     for (let nodeIndex = 0, ncount = this.bspNodes.getElemCount(); nodeIndex < ncount; nodeIndex++) {
    //         const node: FBSPNode = this.bspNodes.getElem(nodeIndex);
    //         const surf: FBSPSurf = this.bspSurfs.getElem(node.iSurf);

    //         const isInvisible = surf.flags & PolyFlags_T.PF_Invisible;

    //         if (isInvisible) continue;

    //         if (!objectMap.has(surf.material)) {
    //             objectMap.set(surf.material, {
    //                 numVertices: 0,
    //                 nodes: []
    //             });
    //         }

    //         const gData = objectMap.get(surf.material);
    //         const vcount = node.numVertices;
    //         // const vcount = (surf.flags & PolyFlags_T.PF_TwoSided) ? (node.numVertices * 2) : node.numVertices;

    //         node.iVertexIndex = gData.numVertices;
    //         gData.numVertices += vcount;
    //         totalVertices += vcount;

    //         gData.nodes.push({ node, surf });
    //         // break;
    //     }

    //     // debugger;

    //     const arrPositions = new Float32Array(totalVertices * 3);
    //     const arrNormals = new Float32Array(totalVertices * 3);
    //     const arrUvs = new Float32Array(totalVertices * 2);
    //     const arrTangentX = new Float32Array(totalVertices * 3);
    //     const arrTangentZ = new Float32Array(totalVertices * 4);
    //     const indices = [];

    //     let groupOffset = 0, vertexOffset = 0, materialIndex = 0;

    //     if (totalVertices > 0) {
    //         for (let material of [...objectMap.keys()]) {
    //             const { numVertices, nodes } = objectMap.get(material);
    //             const startGroupOffset = groupOffset;
    //             materials.push(await material.decodeMaterial());

    //             for (let { node, surf } of nodes) {
    //                 const textureBase: FVector = this.points.getElem(surf.pBase);
    //                 const textureX: FVector = this.vectors.getElem(surf.vTextureU);
    //                 const textureY: FVector = this.vectors.getElem(surf.vTextureV);

    //                 // Use the texture coordinates and normal to create an orthonormal tangent basis.
    //                 const tangentX: FVector = textureX;
    //                 const tangentY: FVector = textureY;
    //                 const tangentZ: FVector = this.vectors.getElem(surf.vNormal); // tangentZ is normal?
    //                 const fcount = node.numVertices - 2;
    //                 const findex = vertexOffset + node.iVertexIndex;

    //                 createOrthonormalBasis(tangentX, tangentY, tangentZ);

    //                 for (let i = 0; i < fcount; i++) {
    //                     indices.push(findex, findex + i + 2, findex + i + 1)
    //                 }

    //                 groupOffset = groupOffset + fcount;

    //                 if (surf.flags & PolyFlags_T.PF_TwoSided) {
    //                     for (let i = 0; i < fcount; i++) {
    //                         indices.push(findex, findex + i + 1, findex + i + 2)
    //                     }

    //                     groupOffset = groupOffset + fcount;
    //                 }

    //                 for (let vertexIndex = 0, vcount = node.numVertices; vertexIndex < vcount; vertexIndex++) {
    //                     const vert: FVert = this.vertices.getElem(node.iVertPool + vertexIndex);
    //                     const position: FVector = this.points.getElem(vert.pVertex);//.sub(new FVector(17728, 114176, -2852));

    //                     const texB = position.sub(textureBase);
    //                     const texU = texB.dot(textureX) / globalBSPTexelScale;
    //                     const texV = texB.dot(textureY) / globalBSPTexelScale;

    //                     arrPositions[dstVertices * 3 + 0] = position.x;
    //                     arrPositions[dstVertices * 3 + 1] = position.z;
    //                     arrPositions[dstVertices * 3 + 2] = position.y;

    //                     arrUvs[dstVertices * 2 + 0] = texU;
    //                     arrUvs[dstVertices * 2 + 1] = texV;

    //                     // DestVertex->ShadowTexCoord = Vert.ShadowTexCoord;
    //                     tangentX.toArray(arrTangentX, dstVertices * 3);
    //                     tangentZ.toArray(arrTangentZ, dstVertices * 4);

    //                     // store the sign of the determinant in TangentZ.W
    //                     arrTangentZ[dstVertices * 4 + 3] = getBasisDeterminantSign(tangentX, tangentY, tangentZ);

    //                     dstVertices++;
    //                 }
    //             }

    //             vertexOffset = vertexOffset + numVertices;

    //             geometry.addGroup(startGroupOffset * 3, (groupOffset - startGroupOffset) * 3, materialIndex++);
    //         }
    //     }

    //     const attrPositions = new Float32BufferAttribute(arrPositions, 3);
    //     const attrUvs = new Float32BufferAttribute(arrUvs, 2);

    //     geometry.setAttribute("position", attrPositions);
    //     geometry.setAttribute("uv", attrUvs);
    //     geometry.setIndex(new Uint16BufferAttribute(indices, 1));

    //     const mesh = new Mesh(geometry, materials);

    //     groups.add(mesh);

    //     return groups;
    // }
}

export default UModel;
export { UModel };

type LightmapInfo = {
    uuid: string,
    offset: {
        x: number;
        y: number;
    },
    size: {
        width: number;
        height: number;
    }
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