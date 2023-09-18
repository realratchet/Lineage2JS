import { v5 as seededUuid } from "uuid";
import UPrimitive from "../un-primitive";
import FStaticMeshSection from "./un-static-mesh-section";
import FStaticMeshVertexStream from "./un-static-vertex-stream";
import FRawColorStream from "../un-raw-color-stream";
import FStaticMeshUVStream from "./un-static-mesh-uv-stream";
import FRawIndexBuffer from "../un-raw-index-buffer";
import { BufferValue, UObject } from "@l2js/core";
import { FStaticMeshCollisionTriangle, FStaticMeshCollisionNode } from "./un-static-mesh-collision";
import { generateUUID } from "three/src/math/MathUtils";
import FStaticMeshTriangle from "./un-static-mesh-triangle";
import getTypedArrayConstructor from "@client/utils/typed-arrray-constructor";
import StringSet from "@client/utils/string-set";
import FArray, { FArrayLazy } from "@l2js/core/src/unreal/un-array";

const triggerDebuggerOnUnsupported = true;


abstract class UStaticMesh extends UPrimitive {
    declare protected sections: FArray<FStaticMeshSection>;
    declare protected vertexStream: FStaticMeshVertexStream;
    declare protected colorStream: FRawColorStream;
    declare protected alphaStream: FRawColorStream;
    declare protected uvStream: FArray<FStaticMeshUVStream>;
    declare protected indexStream: FRawIndexBuffer; // triangle indices
    declare protected edgesStream: FRawIndexBuffer; // triangle edge indices
    declare protected staticMeshLod2: UStaticMesh;
    declare protected staticMeshLod1: UStaticMesh;
    declare protected lodRange1: number;
    declare protected lodRange2: number;
    declare protected hasStaticMeshLod: boolean;
    declare protected isMadeTwoSideMesh: boolean;
    declare protected isStaticMeshLodBlend: boolean;
    declare protected isUsingBillboard: boolean;
    declare protected frequency: number;

    declare protected collisionFaces: FArray<FStaticMeshCollisionTriangle>;
    declare protected collisionNodes: FArray<FStaticMeshCollisionNode>;
    declare protected staticMeshTris: FArrayLazy<FStaticMeshTriangle>;

    declare protected unkIndex0: number;

    declare protected unkInt_5x0: number;
    declare protected unkInd_5x0: number;
    declare protected unkInd_5x1: number;
    declare protected unkInt_5x1: number;
    declare protected unkInt_5x2: number;

    declare protected unkInt_6x0: number;
    declare protected unkInt_6x1: number;
    declare protected unkInt_Ax0: number;
    declare protected unkInt_Cx0: number;
    declare protected unkInt_Dx0: number;
    declare protected unkInt_Dx1: number;
    declare protected unkInt_Ex0: number;

    declare protected unkInt0: number;
    declare protected unkIndex1: number;
    declare protected unkInt1: number;

    public static getUnserializedProperties(): C.UnserializedProperty_T[] {
        return [
            ["LodRange01", "FloatProperty"],
            ["StaticMeshLod01", "ObjectProperty"],
            ["LodRange02", "FloatProperty"],
            ["StaticMeshLod02", "ObjectProperty"],
            ["bStaticMeshLod", "BoolProperty"],
            ["bMakeTwoSideMesh", "BoolProperty"],
            ["bStaticMeshLodBlend", "BoolProperty"],
            ["Frequency", "FloatProperty"],
            ["bUseBillBoard", "FloatProperty"],
        ];
    }

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
            "Frequency": "frequency",
        });
    }

    public doLoad(pkg: GA.UPackage, exp: C.UExport) {

        // debugger;

        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();


        if (verArchive < 0x55) (UObject as any).prototype.doLoad.call(this, pkg, exp);
        else (UPrimitive as any).prototype.doLoad.call(this, pkg, exp);

        const compat32 = new BufferValue(BufferValue.compat32);
        const int32 = new BufferValue(BufferValue.int32);

        this.sections = new FArray(FStaticMeshSection);
        this.vertexStream = new FStaticMeshVertexStream();
        this.colorStream = new FRawColorStream();
        this.alphaStream = new FRawColorStream();
        this.uvStream = new FArray(FStaticMeshUVStream);
        this.indexStream = new FRawIndexBuffer(); // triangle indices
        this.edgesStream = new FRawIndexBuffer(); // triangle edge indices
        this.staticMeshTris = new FArrayLazy(FStaticMeshTriangle);

        // debugger;


        // debugger;

        this.sections.load(pkg);
        this.boundingBox.load(pkg);
        this.vertexStream.load(pkg);
        this.colorStream.load(pkg);
        this.alphaStream.load(pkg);
        this.uvStream.load(pkg);
        this.indexStream.load(pkg);
        this.edgesStream.load(pkg);

        this.unkIndex0 = pkg.read(compat32).value;

        if (this.unkIndex0 !== 0)
            debugger;

        // if (this.vertexStream.vert.length === 0xB3)
        //     debugger;

        // if (this.vertexStream.vert.length === 0x42)
        //     debugger;

        // if (this.vertexStream.vert.length === 0x69)
        //     debugger;

        // if (this.vertexStream.vert.length === 0xC)
        //     debugger;

        // debugger;

        if (verLicense < 0x11) {
            if (this.unkIndex0 > 0) {
                debugger;
            }

            this.collisionFaces = new FArray(FStaticMeshCollisionTriangle).load(pkg);
            this.collisionNodes = new FArray(FStaticMeshCollisionNode).load(pkg);
        } else {
            if (verArchive < 0x3E) {
                console.warn("Not supported yet");
                this.skipRemaining = true;
                if (triggerDebuggerOnUnsupported) debugger;
                return;
            } else {
                // debugger;

                this.collisionFaces = new FArrayLazy(FStaticMeshCollisionTriangle).load(pkg);
                this.collisionNodes = new FArrayLazy(FStaticMeshCollisionNode).load(pkg);

                // debugger;
            }
        }

        // debugger;

        if (this.unkIndex0 > 0)
            debugger;

        this.readHead = pkg.tell();

        if (verArchive < 0x72) {
            console.warn("Not supported yet");
            this.skipRemaining = true;
            if (triggerDebuggerOnUnsupported) debugger;
            return;
        }

        if (0x5 < verLicense) {
            this.unkInt_5x0 = pkg.read(int32).value;
            this.unkInd_5x0 = pkg.read(compat32).value;
            this.unkInd_5x1 = pkg.read(compat32).value;
            this.unkInt_5x1 = pkg.read(int32).value;
            this.unkInt_5x2 = pkg.read(int32).value;
        }

        if (0x6 < verLicense) {
            this.unkInt_6x0 = pkg.read(int32).value;
            this.unkInt_6x1 = pkg.read(int32).value;
        }

        if (0xA < verLicense) this.unkInt_Ax0 = pkg.read(int32).value;
        if (0xC < verLicense) this.unkInt_Cx0 = pkg.read(int32).value;
        if (0xD < verLicense) {
            this.unkInt_Dx0 = pkg.read(int32).value;
            this.unkInt_Dx1 = pkg.read(int32).value;
        }

        if (0xE < verLicense) this.unkInt_Ex0 = pkg.read(int32).value;

        if (verArchive < 0x5C) {
            console.warn("Not supported yet");
            this.skipRemaining = true;
            if (triggerDebuggerOnUnsupported) debugger;
            return;
        }

        if (0x4E < verArchive) {
            if (verArchive < 0x61) {
                console.warn("Not supported yet");
                this.skipRemaining = true;
                if (triggerDebuggerOnUnsupported) debugger;
                return;
            } else this.staticMeshTris.load(pkg);
        }

        if (verArchive < 0x51) {
            console.warn("Not supported yet");
            this.skipRemaining = true;
            if (triggerDebuggerOnUnsupported) debugger;
            return;
        } else this.unkInt0 = pkg.read(int32).value;

        if (99 < verArchive) this.unkIndex1 = pkg.read(compat32).value;
        if (0x77 < verArchive) this.unkInt1 = pkg.read(int32).value;

        this.readHead = pkg.tell();

        console.assert(this.readHead === this.readTail, "Should be zero");
    }

    public getDecodeInfo(library: GD.DecodeLibrary, matModifiers?: string[]): GD.IStaticMeshObjectDecodeInfo {
        // await this.onDecodeReady();

        // debugger;

        let materialUuid = this.uuid;

        if (matModifiers?.length > 0) {
            const hash = new StringSet(matModifiers).hash();
            const hashArr = new Uint8Array(new BigUint64Array([hash]).buffer);

            materialUuid = seededUuid(hashArr, materialUuid);

            if (!(materialUuid in library.materials)) {
                library.materials[materialUuid] = {
                    materialType: "instance",
                    baseMaterial: this.uuid,
                    modifiers: matModifiers
                } as GD.IMaterialInstancedDecodeInfo;

                // debugger;
            }
        }

        // debugger;


        // if (!(materialUuid in library.materials)) {
        //     debugger;
        //     const materials = await Promise.all(this.materials.map((mat: UStaticMeshMaterial) => mat.getDecodeInfo(library)));

        //     materials.forEach(uuid => {
        //         if (!library.materials[uuid]) return;

        //         library.materials[uuid].color = true;
        //     });

        //     library.materials[materialUuid] = { materialType: "group", materials } as IMaterialGroupDecodeInfo;

        //     debugger;
        // }

        if (this.uuid in library.geometries) return {
            uuid: this.uuid,
            type: "StaticMesh",
            name: this.objectName,
            geometry: this.uuid,
            materials: materialUuid,
        } as GD.IStaticMeshObjectDecodeInfo;

        library.geometryInstances[this.uuid] = 0;
        library.geometries[this.uuid] = null;
        library.materials[this.uuid] = null;

        // 43 arrays of 30 uint8 values that are likely colors
        // 43x30 -> 1290
        // 43x10 -> 430

        // 24 x 117 = 2808 | (24 x 39 = 936)

        const countVerts = this.vertexStream.vert.getElemCount();
        const countIndices = this.indexStream.indices.getElemCount();
        const countUvs = this.uvStream.getElemCount();

        if (countUvs > 1) debugger;

        // debugger;

        const TypedIndicesArray = getTypedArrayConstructor(countVerts);
        const positions = new Float32Array(countVerts * 3);
        const colors = new Float32Array(countVerts * 3);
        const normals = new Float32Array(countVerts * 3);
        const uvs = new Float32Array(countVerts * 2);
        const indices = new TypedIndicesArray(countIndices);

        // if (countVerts === 0x42)
        //     debugger;

        const _colors = [
            /*0000000*/ 0x3c, 0x59, 0xff, 0x31, 0x4a, 0x6f, 0xff, 0x3d, 0x4e, 0x6f, 0xff, 0x3e, 0x36, 0x51, 0xff, 0x2c,
            /*0000010*/ 0x00, 0x00, 0xff, 0x00, 0x45, 0x67, 0xff, 0x39, 0x4e, 0x72, 0xff, 0x3e, 0x00, 0x00, 0xff, 0x00,
            /*0000020*/ 0x0c, 0x12, 0xff, 0x0a, 0x0a, 0x10, 0xff, 0x08, 0x0c, 0x12, 0xff, 0x0a, 0x0f, 0x16, 0xff, 0x0c,
            /*0000030*/ 0x00, 0x00, 0xff, 0x00, 0x08, 0x0c, 0xff, 0x06, 0x0a, 0x10, 0xff, 0x08, 0x00, 0x00, 0xff, 0x00,
            /*0000040*/ 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff, 0x00, 0x2c, 0x43, 0xff, 0x24, 0x00, 0x00, 0xff, 0x00,
            /*0000050*/ 0x00, 0x00, 0xff, 0x00, 0x2c, 0x42, 0xff, 0x23, 0x27, 0x3a, 0xff, 0x20, 0x2c, 0x43, 0xff, 0x24,
            /*0000060*/ 0x12, 0x1b, 0xff, 0x0f, 0x1e, 0x2b, 0xff, 0x18, 0x3a, 0x47, 0xff, 0x29, 0x08, 0x0c, 0xff, 0x06,
            /*0000070*/ 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff, 0x00,
            /*0000080*/ 0x44, 0x64, 0xff, 0x37, 0x41, 0x5c, 0xff, 0x33, 0x52, 0x71, 0xff, 0x40, 0x48, 0x6b, 0xff, 0x3b,
            /*0000090*/ 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff, 0x00, 0x0e, 0x15, 0xff, 0x0b, 0x09, 0x0e, 0xff, 0x08,
            /*00000a0*/ 0x00, 0x00, 0xff, 0x00, 0x2b, 0x40, 0xff, 0x23, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff, 0x00,
            /*00000b0*/ 0x00, 0x00, 0xff, 0x00, 0x4e, 0x6f, 0xff, 0x3e, 0x4a, 0x6f, 0xff, 0x3d, 0x00, 0x00, 0xff, 0x00,
            /*00000c0*/ 0x00, 0x00, 0xff, 0x00, 0x0f, 0x16, 0xff, 0x0c, 0x0c, 0x12, 0xff, 0x0a, 0x00, 0x00, 0xff, 0x00,
            /*00000d0*/ 0x00, 0x00, 0xff, 0x00, 0x2c, 0x43, 0xff, 0x24, 0x2c, 0x43, 0xff, 0x24
        ];

        const _colors2 = [
            89, 60, 49, 255, 111, 74, 61, 255, 111, 78, 62, 255, 81, 54, 44, 255,
            0, 0, 0, 255, 103, 69, 57, 255, 114, 78, 62, 255, 0, 0, 0, 255,
            18, 12, 10, 255, 16, 10, 8, 255, 18, 12, 10, 255, 22, 15, 12, 255,
            0, 0, 0, 255, 12, 8, 6, 255, 16, 10, 8, 255, 0, 0, 0, 255,
            0, 0, 0, 255, 0, 0, 0, 255, 67, 44, 36, 255, 0, 0, 0, 255,
            0, 0, 0, 255, 66, 44, 35, 255, 58, 39, 32, 255, 67, 44, 36, 255,
            27, 18, 15, 255, 43, 30, 24, 255, 71, 58, 41, 255, 12, 8, 6, 255,
            0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255,
            100, 68, 55, 255, 92, 65, 51, 255, 113, 82, 64, 255, 107, 72, 59, 255,
            0, 0, 0, 255, 0, 0, 0, 255, 21, 14, 11, 255, 14, 9, 8, 255,
            0, 0, 0, 255, 64, 43, 35, 255, 0, 0, 0, 255, 0, 0, 0, 255,
            0, 0, 0, 255, 111, 78, 62, 255, 111, 74, 61, 255, 0, 0, 0, 255,
            0, 0, 0, 255, 22, 15, 12, 255, 18, 12, 10, 255, 0, 0, 0, 255,
            0, 0, 0, 255, 67, 44, 36, 255, 67, 44, 36, 255
        ];


        for (let i = 0; i < countVerts; i++) {
            const { position, normal } = this.vertexStream.vert.getElem(i);
            const { u, v } = this.uvStream.getElem(0).data.getElem(i);
            const color = this.colorStream.color.getElem(i);

            positions[i * 3 + 0] = position.x;
            positions[i * 3 + 1] = position.z;
            positions[i * 3 + 2] = position.y;

            normals[i * 3 + 0] = normal.x;
            normals[i * 3 + 1] = normal.z;
            normals[i * 3 + 2] = normal.y;

            // colors[i * 3 + 0] = _colors[i * 4 + 1] / 255;
            // colors[i * 3 + 1] = _colors[i * 4 + 0] / 255;
            // colors[i * 3 + 2] = _colors[i * 4 + 3] / 255;

            colors[i * 3 + 0] = color.r / 255;
            colors[i * 3 + 1] = color.g / 255;
            colors[i * 3 + 2] = color.b / 255;

            uvs[i * 2 + 0] = u;
            uvs[i * 2 + 1] = v;
        }

        for (let i = 0; i < countIndices; i++)
            indices[i] = this.indexStream.indices.getElem(i);

        const collisionFaces = this.collisionFaces.length;
        const collision = new Uint32Array(this.collisionFaces.length * 3);

        for (let i = 0; i < collisionFaces; i++) {
            const face = this.collisionFaces[i];
            const verts = face.vertices;//.map(vi => positions.slice(vi * 3, vi * 3 + 3));
            const offset = i * 3;

            collision[offset + 0] = verts[0];
            collision[offset + 1] = verts[1];
            collision[offset + 2] = verts[2];

            // collision[offset + 0] = verts[0][0];
            // collision[offset + 1] = verts[0][1];
            // collision[offset + 2] = verts[0][2];

            // collision[offset + 3] = verts[1][0];
            // collision[offset + 4] = verts[1][1];
            // collision[offset + 5] = verts[1][2];

            // collision[offset + 6] = verts[2][0];
            // collision[offset + 7] = verts[2][1];
            // collision[offset + 8] = verts[2][2];
        }

        library.geometries[this.uuid] = {
            attributes: {
                positions,
                colors,
                normals,
                uvs
            },
            indices,
            colliderIndices: collision,
            groups: this.sections.map((section, index) => [section.firstIndex, section.numFaces * 3, index]),
            bounds: this.decodeBoundsInfo()
        };

        // const materials = await Promise.all(this.materials.map((mat: UStaticMeshMaterial) => mat.getDecodeInfo(library)));
        const materials = this.materials.map((mat: GA.UStaticMeshMaterial) => mat.loadSelf().getDecodeInfo(library));

        materials.forEach(uuid => {
            if (!library.materials[uuid]) return;

            library.materials[uuid].color = true;
        });

        library.materials[this.uuid] = { materialType: "group", materials } as GD.IMaterialGroupDecodeInfo;

        return {
            uuid: this.uuid,
            type: "StaticMesh",
            name: this.objectName,
            geometry: this.uuid,
            materials: materialUuid,
            children: [
                // this.getDecodeTrisInfo(library),
            ]
        };
    }

    protected getDecodeTrisInfo(library: GA.DecodeLibrary): GD.IBaseObjectDecodeInfo {
        const trisCount = this.staticMeshTris.length;
        const trisGeometryUuid = generateUUID();
        const TypedIndicesArray = getTypedArrayConstructor(trisCount);
        const trisPositions = new Float32Array(trisCount * 3 * 3);
        const trisIndices = new TypedIndicesArray(trisCount * 4);

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
        } as GD.IEdgesObjectDecodeInfo;
    }
}

export default UStaticMesh;
export { UStaticMesh, FStaticMeshTriangle };