import UPrimitive from "../un-primitive";
import FArray from "../un-array";
import FVert from "./un-vert";
import FVector from "../un-vector";
import FBSPNode, { BspNodeFlags_T } from "../bsp/un-bsp-node";
import FBSPSurf from "../bsp/un-bsp-surf";
import UPolys, { PolyFlags_T } from "../un-polys";
import BufferValue from "../../buffer-value";
import FZoneProperties from "../un-zone-properties";
import { Float32BufferAttribute, BufferGeometry, TriangleFanDrawMode, BackSide, Mesh, MeshBasicMaterial, Uint16BufferAttribute, Matrix4, Material, Group, Object3D, Sphere, Box3 } from "three";
import { BufferGeometryUtils } from "three/examples/jsm/utils/BufferGeometryUtils";
import UMaterial from "../un-material";
import FBox from "../un-box";
import FNumber from "../un-number";
import ULight from "../un-light";
import FLeaf from "../un-leaf";

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
    protected numSharedSides: number;
    protected polys: UPolys;
    protected zones: FZoneProperties[];
    protected bounds = new FArray(FBox);
    protected leafHulls = new FArray(FNumber.forType(BufferValue.int32) as any);
    protected leaves = new FArray(FLeaf)
    protected lights = new FArray(ULight);
    protected rootOutside: boolean;
    protected linked: boolean;

    public async load(pkg: UPackage, exp: UExport) {
        try {
            const int32 = new BufferValue(BufferValue.int32);
            const uint8 = new BufferValue(BufferValue.uint8);
            const compat32 = new BufferValue(BufferValue.compat32);

            this.setReadPointers(exp);

            pkg.seek(this.readHead, "set");

            const startOffset = pkg.tell();
            // console.log(`offset: ${(this.readTail - pkg.tell())}`);

            // debugger;

            await super.load(pkg, exp);

            await this.vectors.load(pkg);
            await this.points.load(pkg);
            await this.bspNodes.load(pkg);
            await this.bspSurfs.load(pkg);
            await this.vertices.load(pkg);

            // console.assert(this.bspNodes.getElemCount() === this.bspSurfs.getElemCount());

            this.numSharedSides = await pkg.read(int32).value as number;

            const numZones = await pkg.read(int32).value as number;

            console.assert(numZones <= MAX_ZONES);

            this.zones = new Array(numZones);

            for (let i = 0; i < numZones; i++)
                this.zones[i] = await new FZoneProperties().load(pkg);

            this.readHead = pkg.tell();
            const polysId = await pkg.read(new BufferValue(BufferValue.compat32)).value as number;

            const polyExp = pkg.exports[polysId - 1];
            const className = pkg.getPackageName(polyExp.idClass.value as number)

            console.assert(className === "Polys");

            this.readHead = pkg.tell();

            // console.log(`offset: ${(this.readTail - pkg.tell())}`);

            await this.bounds.load(pkg, null);

            // console.log(`offset: ${(this.readTail - pkg.tell())}`);

            await this.leafHulls.load(pkg, null);

            // console.log(`offset: ${(this.readTail - pkg.tell())}`);

            await this.leaves.load(pkg, null);

            // console.log(`offset: ${(this.readTail - pkg.tell())}`);

            await this.lights.load(pkg, null);

            const unk = await pkg.read(compat32).value as number;
            
            this.readHead = pkg.tell();

            // debugger;

            // console.log(exp.objectName, "->", polyExp.objectName);
            this.rootOutside = (await pkg.read(uint8).value as number) !== 0;
            this.linked = (await pkg.read(uint8).value as number) !== 0;

            this.readHead = pkg.tell();

            // debugger;

            this.polys = await pkg.fetchObject(polysId) as UPolys;


            pkg.seek(this.readHead, "set");
        } catch (e) { }
        return this;
    }

    public async decodeModel(): Promise<Object3D> {
        const groups = new Group();
        const globalBSPTexelScale = 128;
        const objectMap = new Map<UMaterial, { numVertices: number, nodes: { node: FBSPNode, surf: FBSPSurf }[] }>();
        const geometry = new BufferGeometry();
        const materials: Material[] = [];

        // Calculate the size of the vertex buffer and the base vertex index of each node.
        let totalVertices = 0;
        let dstVertices = 0;

        for (let nodeIndex = 0, ncount = this.bspNodes.getElemCount(); nodeIndex < ncount; nodeIndex++) {
            const node: FBSPNode = this.bspNodes.getElem(nodeIndex);
            const surf: FBSPSurf = this.bspSurfs.getElem(node.iSurf);

            const isInvisible = surf.flags & PolyFlags_T.PF_Invisible;

            if (isInvisible) continue;

            if (!objectMap.has(surf.material)) {
                objectMap.set(surf.material, {
                    numVertices: 0,
                    nodes: []
                });
            }

            const gData = objectMap.get(surf.material);
            const vcount = node.numVertices;
            // const vcount = (surf.flags & PolyFlags_T.PF_TwoSided) ? (node.numVertices * 2) : node.numVertices;

            node.iVertexIndex = gData.numVertices;
            gData.numVertices += vcount;
            totalVertices += vcount;

            gData.nodes.push({ node, surf });
            // break;
        }

        // debugger;

        const arrPositions = new Float32Array(totalVertices * 3);
        const arrNormals = new Float32Array(totalVertices * 3);
        const arrUvs = new Float32Array(totalVertices * 2);
        const arrTangentX = new Float32Array(totalVertices * 3);
        const arrTangentZ = new Float32Array(totalVertices * 4);
        const indices = [];

        let groupOffset = 0, vertexOffset = 0, materialIndex = 0;

        if (totalVertices > 0) {
            for (let material of [...objectMap.keys()]) {
                const { numVertices, nodes } = objectMap.get(material);
                const startGroupOffset = groupOffset;
                materials.push(await material.decodeMaterial());

                for (let { node, surf } of nodes) {
                    const textureBase: FVector = this.points.getElem(surf.pBase);
                    const textureX: FVector = this.vectors.getElem(surf.vTextureU);
                    const textureY: FVector = this.vectors.getElem(surf.vTextureV);

                    // Use the texture coordinates and normal to create an orthonormal tangent basis.
                    const tangentX: FVector = textureX;
                    const tangentY: FVector = textureY;
                    const tangentZ: FVector = this.vectors.getElem(surf.vNormal); // tangentZ is normal?
                    const fcount = node.numVertices - 2;
                    const findex = vertexOffset + node.iVertexIndex;

                    createOrthonormalBasis(tangentX, tangentY, tangentZ);

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

                        arrPositions[dstVertices * 3 + 0] = position.vector.x;
                        arrPositions[dstVertices * 3 + 1] = position.vector.z;
                        arrPositions[dstVertices * 3 + 2] = position.vector.y;

                        arrUvs[dstVertices * 2 + 0] = texU;
                        arrUvs[dstVertices * 2 + 1] = texV;

                        // DestVertex->ShadowTexCoord = Vert.ShadowTexCoord;
                        tangentX.vector.toArray(arrTangentX, dstVertices * 3);
                        tangentZ.vector.toArray(arrTangentZ, dstVertices * 4);

                        // store the sign of the determinant in TangentZ.W
                        arrTangentZ[dstVertices * 4 + 3] = getBasisDeterminantSign(tangentX, tangentY, tangentZ);

                        dstVertices++;
                    }
                }

                vertexOffset = vertexOffset + numVertices;

                geometry.addGroup(startGroupOffset * 3, (groupOffset - startGroupOffset) * 3, materialIndex++);
            }
        }

        const attrPositions = new Float32BufferAttribute(arrPositions, 3);
        const attrUvs = new Float32BufferAttribute(arrUvs, 2);

        geometry.setAttribute("position", attrPositions);
        geometry.setAttribute("uv", attrUvs);
        geometry.setIndex(new Uint16BufferAttribute(indices, 1));

        const mesh = new Mesh(geometry, materials);

        groups.add(mesh);

        return groups;
    }
}

export default UModel;
export { UModel };

function createOrthonormalBasis(inXAxis: FVector, inYAxis: FVector, inZAxis: FVector) {
    // Magic numbers for numerical precision.
    const DELTA = 0.00001;

    let [XAxis, YAxis, ZAxis] = [inXAxis, inYAxis, inZAxis].map(v => new FVector(v.vector.x, v.vector.y, v.vector.z));

    // Project the X and Y axes onto the plane perpendicular to the Z axis.
    XAxis = XAxis.sub(ZAxis.multiplyScalar((XAxis.dot(ZAxis)) / (ZAxis.dot(ZAxis))));
    YAxis = YAxis.sub(ZAxis.multiplyScalar((YAxis.dot(ZAxis)) / (ZAxis.dot(ZAxis))));

    // If the X axis was parallel to the Z axis, choose a vector which is orthogonal to the Y and Z axes.
    if (XAxis.vector.lengthSq() < DELTA * DELTA) {
        XAxis = YAxis.cross(ZAxis);
    }

    // If the Y axis was parallel to the Z axis, choose a vector which is orthogonal to the X and Z axes.
    if (YAxis.vector.lengthSq() < DELTA * DELTA) {
        YAxis = XAxis.cross(ZAxis);
    }

    // Normalize the basis vectors.
    XAxis.vector.normalize();
    YAxis.vector.normalize();
    ZAxis.vector.normalize();

    inXAxis.vector.copy(XAxis.vector);
    inYAxis.vector.copy(YAxis.vector);
    inZAxis.vector.copy(ZAxis.vector);

    return [inXAxis, inYAxis, inZAxis];
}

function getBasisDeterminantSign(XAxis: FVector, YAxis: FVector, ZAxis: FVector): number {
    const basis = new Matrix4();

    basis.elements = [
        XAxis.vector.x, XAxis.vector.y, XAxis.vector.z, 0,
        YAxis.vector.x, YAxis.vector.y, YAxis.vector.z, 0,
        ZAxis.vector.x, ZAxis.vector.y, ZAxis.vector.z, 0,
        0, 0, 0, 1
    ];

    return (basis.determinant() < 0) ? -1.0 : +1.0;
}