import FArray, { FArrayLazy } from "../un-array";
import UPrimitive from "../un-primitive";
import FStaticMeshSection from "./un-static-mesh-section";
import FStaticMeshVertexStream from "./un-static-vertex-stream";
import FRawColorStream from "../un-raw-color-stream";
import FStaticMeshUVStream from "./un-static-mesh-uv-stream";
import FRawIndexBuffer from "../un-raw-index-buffer";

import BufferValue from "../../buffer-value";
import { FStaticMeshCollisionTriangle, FStaticMeshCollisionNode } from "./un-static-mesh-collision";
import FVector from "../un-vector";
import FConstructable from "../un-constructable";
import { generateUUID } from "three/src/math/MathUtils";

const triggerDebuggerOnUnsupported = false;

class FStaticMeshTriangleSub extends FConstructable {
    public f0: number[];
    public f1: number[];
    public f2: number[];

    public load(pkg: UPackage): this {

        const float = new BufferValue(BufferValue.float);

        this.f0 = new Array(2).fill(1).map(_ => pkg.read(float).value as number);
        this.f1 = new Array(2).fill(1).map(_ => pkg.read(float).value as number);
        this.f2 = new Array(2).fill(1).map(_ => pkg.read(float).value as number);

        return this;
    }
}

class FStaticMeshTriangle extends FConstructable {
    public v0 = new FVector();
    public v1 = new FVector();
    public v2 = new FVector();

    public unkSubs: FStaticMeshTriangleSub[];
    public unkBytes = BufferValue.allocBytes(12);

    public unkInt0: number;
    public unkInt1: number;

    public load(pkg: UPackage): this {
        const verArchive = pkg.header.getArchiveFileVersion();
        const uint32 = new BufferValue(BufferValue.uint32);

        if (verArchive < 0x6f) {
            console.warn("Not supported yet");
            debugger;
        } else {

            this.v0.load(pkg);
            this.v1.load(pkg);
            this.v2.load(pkg);

            const count = pkg.read(uint32).value as number;

            this.unkSubs = new Array(count).fill(1).map(_ => new FStaticMeshTriangleSub().load(pkg));

            pkg.read(this.unkBytes);

            if (verArchive < 0x70) {
                console.warn("Not supported yet");
                debugger;
            }

            this.unkInt0 = pkg.read(uint32).value as number;
            this.unkInt1 = pkg.read(uint32).value as number;
        }

        return this;
    }
}

class UStaticMesh extends UPrimitive {
    protected sections: FArray<FStaticMeshSection> = new FArray(FStaticMeshSection);
    protected vertexStream: FStaticMeshVertexStream = new FStaticMeshVertexStream();
    protected colorStream: FRawColorStream = new FRawColorStream();
    protected alphaStream: FRawColorStream = new FRawColorStream();
    protected uvStream: FArray<FStaticMeshUVStream> = new FArray(FStaticMeshUVStream);
    protected indexStream = new FRawIndexBuffer(); // triangle indices
    protected edgesStream = new FRawIndexBuffer(); // triangle edge indices
    protected staticMeshLod2: UStaticMesh;
    protected staticMeshLod1: UStaticMesh;
    protected lodRange1: number;
    protected lodRange2: number;
    protected hasStaticMeshLod: boolean;
    protected isMadeTwoSideMesh: boolean;
    protected isStaticMeshLodBlend: boolean;
    protected isUsingBillboard: boolean;
    protected frequency: number;

    protected collisionFaces: FArrayLazy<FStaticMeshCollisionTriangle> = new FArrayLazy(FStaticMeshCollisionTriangle);
    protected collisionNodes: FArrayLazy<FStaticMeshCollisionNode> = new FArrayLazy(FStaticMeshCollisionNode);
    protected staticMeshTris: FArrayLazy<FStaticMeshTriangle> = new FArrayLazy(FStaticMeshTriangle);

    protected unkIndex0: number;

    protected unkInt_5x0: number;
    protected unkInd_5x0: number;
    protected unkInd_5x1: number;
    protected unkInt_5x1: number;
    protected unkInt_5x2: number;

    protected unkInt_6x0: number;
    protected unkInt_6x1: number;
    protected unkInt_Ax0: number;
    protected unkInt_Cx0: number;
    protected unkInt_Dx0: number;
    protected unkInt_Dx1: number;
    protected unkInt_Ex0: number;

    protected unkInt0: number;
    protected unkIndex1: number;
    protected unkInt1: number;


    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "StaticMeshLod02": "staticMeshLod2",
            "LodRange02": "lodRange2",
            "StaticMeshLod01": "staticMeshLod1",
            "LodRange01": "lodRange1",
            "bStaticMeshLod": "hasStaticMeshLod",
            "bMakeTwoSideMesh": "isMadeTwoSideMesh",
            "bStaticMeshLodBlend": "isStaticMeshLodBlend",
            "bUseBillBoard": "isUsingBillboard",
            "Frequency": "frequency"
        });
    }

    public doLoad(pkg: UPackage, exp: UExport) {
        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        const compat32 = new BufferValue(BufferValue.compat32);
        const int32 = new BufferValue(BufferValue.int32);

        super.doLoad(pkg, exp);

        this.sections.load(pkg);
        this.boundingBox.load(pkg);
        this.vertexStream.load(pkg);
        this.colorStream.load(pkg);
        this.alphaStream.load(pkg);
        this.uvStream.load(pkg);
        this.indexStream.load(pkg);
        this.edgesStream.load(pkg);

        this.unkIndex0 = pkg.read(compat32).value as number;

        if (verLicense < 0x11) {
            console.warn("Not supported yet");
            if (triggerDebuggerOnUnsupported) debugger;
            return;
        } else {
            if (verArchive < 0x3E) {
                console.warn("Not supported yet");
                if (triggerDebuggerOnUnsupported) debugger;
                return;
            } else {
                this.collisionFaces.load(pkg);
                this.collisionNodes.load(pkg);
            }
        }

        this.readHead = pkg.tell();

        if (verArchive < 0x72) {
            console.warn("Not supported yet");
            if (triggerDebuggerOnUnsupported) debugger;
            return;
        }

        if (0x5 < verLicense) {
            this.unkInt_5x0 = pkg.read(int32).value as number;
            this.unkInd_5x0 = pkg.read(compat32).value as number;
            this.unkInd_5x1 = pkg.read(compat32).value as number;
            this.unkInt_5x1 = pkg.read(int32).value as number;
            this.unkInt_5x2 = pkg.read(int32).value as number;
        }

        if (0x6 < verLicense) {
            this.unkInt_6x0 = pkg.read(int32).value as number;
            this.unkInt_6x1 = pkg.read(int32).value as number;
        }

        if (0xA < verLicense) this.unkInt_Ax0 = pkg.read(int32).value as number;
        if (0xC < verLicense) this.unkInt_Cx0 = pkg.read(int32).value as number;
        if (0xD < verLicense) {
            this.unkInt_Dx0 = pkg.read(int32).value as number;
            this.unkInt_Dx1 = pkg.read(int32).value as number;
        }

        if (0xE < verLicense) this.unkInt_Ex0 = pkg.read(int32).value as number;

        if (verArchive < 0X5C) {
            console.warn("Not supported yet");
            if (triggerDebuggerOnUnsupported) debugger;
            return;
        }

        if (0x4E < verArchive) {
            if (verArchive < 0x61) {
                console.warn("Not supported yet");
                if (triggerDebuggerOnUnsupported) debugger;
                return;
            } else this.staticMeshTris.load(pkg);
        }

        if (verArchive < 0x51) {
            console.warn("Not supported yet");
            if (triggerDebuggerOnUnsupported) debugger;
            return;
        } else this.unkInt0 = pkg.read(int32).value as number;

        if (99 < verArchive) this.unkIndex1 = pkg.read(compat32).value as number;
        if (0x77 < verArchive) this.unkInt1 = pkg.read(int32).value as number;

        this.readHead = pkg.tell();

        // debugger;

        console.assert(this.readHead === this.readTail, "Should be zero");
    }

    public async getDecodeInfo(library: IDecodeLibrary): Promise<IStaticMeshObjectDecodeInfo> {

        if (this.uuid in library.geometries) return {
            type: "StaticMesh",
            name: this.objectName,
            geometry: this.uuid,
            materials: this.uuid,
        } as IStaticMeshObjectDecodeInfo;

        library.geometries[this.uuid] = null;
        library.materials[this.uuid] = null;

        await this.onLoaded();

        // 43 arrays of 30 uint8 values that are likely colors
        // 43x30 -> 1290
        // 43x10 -> 430

        const countVerts = this.vertexStream.vert.getElemCount();
        const countFaces = this.indexStream.indices.getElemCount();
        const countUvs = this.uvStream.getElemCount();

        if (countUvs > 1) debugger;

        // debugger;

        const positions = new Float32Array(countVerts * 3);
        const normals = new Float32Array(countVerts * 3);
        const uvs = new Float32Array(countVerts * 2);
        const indices = new Uint16Array(countFaces);

        for (let i = 0; i < countVerts; i++) {
            const { position, normal } = this.vertexStream.vert.getElem(i);
            const { u, v } = this.uvStream.getElem(0).data.getElem(i);

            positions[i * 3 + 0] = position.x;
            positions[i * 3 + 1] = position.z;
            positions[i * 3 + 2] = position.y;

            normals[i * 3 + 0] = normal.x;
            normals[i * 3 + 1] = normal.z;
            normals[i * 3 + 2] = normal.y;

            uvs[i * 2 + 0] = u;
            uvs[i * 2 + 1] = v;
        }

        for (let i = 0; i < countFaces; i++)
            indices[i] = this.indexStream.indices.getElem(i);

        const materials = await Promise.all(this.materials.map((mat: FStaticMeshMaterial) => mat.getDecodeInfo(library)));

        library.geometries[this.uuid] = {
            attributes: {
                positions,
                normals,
                uvs,
            },
            indices,
            groups: this.sections.map((section, index) => [section.firstIndex, section.numFaces * 3, index]),
            bounds: this.decodeBoundsInfo()
        };

        library.materials[this.uuid] = { materialType: "group", materials } as IMaterialGroupDecodeInfo;

        return {
            type: "StaticMesh",
            name: this.objectName,
            geometry: this.uuid,
            materials: this.uuid,
            children: [
                // this.getDecodeTrisInfo(library),
            ]
        };
    }

    protected getDecodeTrisInfo(library: IDecodeLibrary): IBaseObjectDecodeInfo {
        const trisCount = this.staticMeshTris.length;
        const trisGeometryUuid = generateUUID();
        const trisPositions = new Float32Array(trisCount * 3 * 3);
        const trisIndices = new Uint16Array(trisCount * 4);

        for (let i = 0, len = trisCount; i < len; i++) {
            const indOffset = i * 4;
            const vIndOffset = i * 3, vertOffset = vIndOffset * 3;
            const { v0, v1, v2 } = this.staticMeshTris.getElem(i);

            [v0, v1, v2].forEach((v, j) => {
                const { x, y, z } = v;
                const offset = vertOffset + j * 3;

                trisPositions[offset + 0] = x;
                trisPositions[offset + 1] = z;
                trisPositions[offset + 2] = y;
            });

            trisIndices[indOffset + 0] = vIndOffset + 0;
            trisIndices[indOffset + 1] = vIndOffset + 1;
            trisIndices[indOffset + 2] = vIndOffset + 2;
            trisIndices[indOffset + 3] = vIndOffset + 0;
        }

        library.geometries[trisGeometryUuid] = {
            indices: trisIndices,
            attributes: {
                positions: trisPositions
            }
        };

        return {
            type: "Edges",
            geometry: trisGeometryUuid,
            color: [1, 0, 1]
        } as IEdgesObjectDecodeInfo;
    }
}

export default UStaticMesh;
export { UStaticMesh };