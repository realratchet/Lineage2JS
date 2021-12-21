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
import UPackage from "../un-package";
import { PropertyTag } from "../un-property";

type UPackage = import("../un-package").UPackage;
type UExport = import("../un-export").UExport;

const MAX_NODE_VERTICES = 16;       // Max vertices in a Bsp node, pre clipping.
const MAX_FINAL_VERTICES = 24;      // Max vertices in a Bsp node, post clipping.
const MAX_ZONES = 64;               // Max zones per level.

class FLightmap extends FConstructable {
    public load(pkg: UPackage, tag?: PropertyTag): this {
        const int32 = new BufferValue(BufferValue.int32);
        const uint8 = new BufferValue(BufferValue.uint8);
        const compat32 = new BufferValue(BufferValue.compat32);
        const float = new BufferValue(BufferValue.float);

        this.iLightmapTexture = pkg.read(compat32).value as number;
        this.iSurface = pkg.read(compat32).value as number;
        this.iUnk1 = pkg.read(compat32).value as number;
        this.offsetX = pkg.read(compat32).value as number;
        this.offsetY = pkg.read(compat32).value as number;


        // this.dataOffset = pkg.read(int32).value as number;
        // this.pan = new FVector().load(pkg);
        // this.clampU = pkg.read(compat32).value as number;
        // this.clampV = pkg.read(compat32).value as number;
        // this.scaleU = pkg.read(int32).value as number;
        // this.scaleV = pkg.read(int32).value as number;
        // this.clampU = pkg.read(compat32).value as number;
        // this.iLightIndex = pkg.read(compat32).value as number;

        return this;
    }

}

class UModel extends UPrimitive {
    protected vectors = new FArray(FVector);
    protected points = new FArray(FVector);
    protected vertices = new FArray(FVert);
    protected bspNodes = new FArray(FBSPNode);
    protected bspSurfs = new FArray(FBSPSurf);
    protected numSharedSides: number;
    protected polys: UPolys = null;
    protected zones: FZoneProperties[] = [];
    protected bounds = new FArray(FBox);
    protected leafHulls = new FArray(FNumber.forType(BufferValue.int32) as any);
    protected leaves = new FArray(FLeaf)
    protected lights = new FArray(FLight);
    protected rootOutside: boolean;
    protected linked: boolean;

    protected doLoad(pkg: UPackage, exp: UExport): this {
        try {
            const int32 = new BufferValue(BufferValue.int32);
            const uint8 = new BufferValue(BufferValue.uint8);
            const compat32 = new BufferValue(BufferValue.compat32);

            pkg.seek(this.readHead, "set");

            const startOffset = pkg.tell();
            // console.log(`offset: ${(this.readTail - pkg.tell())}`);

            super.doLoad(pkg, exp);

            this.vectors.load(pkg);
            this.points.load(pkg);
            this.bspNodes.load(pkg);
            this.bspSurfs.load(pkg);
            this.vertices.load(pkg);

            // debugger;

            // console.assert(this.bspNodes.getElemCount() === this.bspSurfs.getElemCount());

            this.numSharedSides = pkg.read(int32).value as number;

            const numZones = pkg.read(int32).value as number;

            console.assert(numZones <= MAX_ZONES);

            this.zones = new Array(numZones);

            for (let i = 0; i < numZones; i++)
                this.zones[i] = new FZoneProperties().load(pkg);

            this.readHead = pkg.tell();
            const polysId = pkg.read(new BufferValue(BufferValue.compat32)).value as number;

            const polyExp = pkg.exports[polysId - 1];
            const className = pkg.getPackageName(polyExp.idClass.value as number)

            console.assert(className === "Polys");

            this.readHead = pkg.tell();

            // console.log(`offset: ${(this.readTail - pkg.tell())}`);

            this.bounds.load(pkg, null);

            // console.log(`offset: ${(this.readTail - pkg.tell())}`);

            this.leafHulls.load(pkg, null);

            // console.log(`offset: ${(this.readTail - pkg.tell())}`);

            this.leaves.load(pkg, null);

            this.readHead = pkg.tell();

            // debugger;

            if (this.objectName === "Exp_Model327") {
                debugger;

                // pkg.seek(this.readTail - 16, "set");

                // function isPow2(x) {
                //     return (Math.log(x) / Math.log(2)) % 1 === 0;
                // }

                // for (let i = this.readHead; i < this.readTail; i++) {
                //     pkg.seek(i, "set");
                //     const lmap = new FLightmapIndex().load(pkg);

                //     if (lmap.dataOffset > this.readHead && isFinite(lmap.pan.x) && isFinite(lmap.pan.y) && isFinite(lmap.pan.z) && lmap.clampU === lmap.clampV && lmap.iLightIndex >= 0 && lmap.iLightIndex < 1000 && lmap.dataOffset < this.readTail && isPow2(lmap.clampU)) {
                //         console.log(i, lmap);
                //         // debugger;
                //     }
                // }


                // const startByte = this.readHead + (this.bytesUnread % 32);
                // const lengthBytes = this.readTail - startByte;

                // // pkg.seek(this.readHead + (this.bytesUnread % 32), "set");

                // const buff = pkg.buffer.slice(this.readTail - (256 * 256 * 4) * 2, this.readTail - (256 * 256 * 2));
                // const buff = pkg.buffer.slice(this.readHead, this.readTail); // (@8306076 128x128)
                // const blob = new Blob([buff], { type: "application/octet-stream" });
                // const url = URL.createObjectURL(blob);

                // window.open(url, "_blank");

                // debugger;


                // const lights = new FArray(FNumber.forType(BufferValue.compat32) as any);

                // lights.load(pkg, null);

                // debugger;
            }
            // else debugger;



            // this.lights.load(pkg, null);

            // debugger;

            // const unk = pkg.read(compat32).value as number;

            // this.readHead = pkg.tell();


            // if(this.zones.length > 0) {
            //     console.log(this);
            //     debugger;
            // }

            // // debugger;

            // // console.log(exp.objectName, "->", polyExp.objectName);
            // this.rootOutside = (pkg.read(uint8).value as number) !== 0;
            // this.linked = (pkg.read(uint8).value as number) !== 0;

            // this.readHead = pkg.tell();

            // // debugger;

            // this.promisesLoading.push(new Promise(async resolve => {
            //     this.polys = await pkg.fetchObject<UPolys>(polysId);
            //     resolve();
            // }));


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
        const objectMap = new Map<UMaterial, { numVertices: number, nodes: { node: FBSPNode, surf: FBSPSurf }[] }>();

        // Calculate the size of the vertex buffer and the base vertex index of each node.
        let totalVertices = 0;
        let dstVertices = 0;

        for (let nodeIndex = 0, ncount = this.bspNodes.length; nodeIndex < ncount; nodeIndex++) {
            const node: FBSPNode = this.bspNodes[nodeIndex];
            const surf: FBSPSurf = this.bspSurfs[node.iSurf];

            await Promise.all(surf.promisesLoading);

            const isInvisible = surf.flags & PolyFlags_T.PF_Invisible;

            if (isInvisible) continue;

            if (!objectMap.has(surf.material)) {
                objectMap.set(surf.material, {
                    numVertices: 0,
                    nodes: []
                });
            }

            // debugger;

            const gData = objectMap.get(surf.material);
            const vcount = node.numVertices;
            // const vcount = (surf.flags & PolyFlags_T.PF_TwoSided) ? (node.numVertices * 2) : node.numVertices;

            node.iVertexIndex = gData.numVertices;
            gData.numVertices += vcount;
            totalVertices += vcount;

            gData.nodes.push({ node, surf });
        }

        // debugger;

        const positions = new Float32Array(totalVertices * 3);
        const normals = new Float32Array(totalVertices * 3);
        const uvs = new Float32Array(totalVertices * 2);
        // const tangentsX = new Float32Array(totalVertices * 3);
        // const tangentsZ = new Float32Array(totalVertices * 4);
        const indices: number[] = [], groups: ArrGeometryGroup[] = [];

        let groupOffset = 0, vertexOffset = 0, materialIndex = 0;

        if (totalVertices > 0) {
            for (let material of [...objectMap.keys()]) {
                const { numVertices, nodes } = objectMap.get(material);
                const startGroupOffset = groupOffset;
                materials.push(await material.getDecodeInfo(library));

                for (let { node, surf } of nodes) {
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
                        const position: FVector = this.points.getElem(vert.pVertex);//.sub(new FVector(17728, 114176, -2852));

                        const texB = position.sub(textureBase);
                        const texU = texB.dot(textureX) / globalBSPTexelScale;
                        const texV = texB.dot(textureY) / globalBSPTexelScale;

                        positions[dstVertices * 3 + 0] = position.x;
                        positions[dstVertices * 3 + 1] = position.z;
                        positions[dstVertices * 3 + 2] = position.y;

                        normals[dstVertices * 3 + 0] = tangentZ.x;
                        normals[dstVertices * 3 + 1] = tangentZ.z;
                        normals[dstVertices * 3 + 2] = tangentZ.y;

                        uvs[dstVertices * 2 + 0] = texU;
                        uvs[dstVertices * 2 + 1] = texV;

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

        // debugger;

        library.geometries[this.uuid] = {
            groups,
            indices,
            // bounds: this.decodeBoundsInfo(),
            attributes: {
                normals,
                positions,
                uvs
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