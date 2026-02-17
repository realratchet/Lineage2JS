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
    declare protected wireframeIndexBuffer: FRawIndexBuffer; // triangle edge indices
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

    declare protected collisionModelId: number;
    declare protected collisionModel: GA.UModel;

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

    declare protected internalVersion: number;
    declare protected kPhysicsProps: number;
    declare protected authenticationKey: number;

    protected useSimpleLineCollision: boolean = false;
    protected UseSimpleBoxCollision: boolean = false;
    protected useVertexColor: boolean = false;

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
            ["bUseBillBoard", "BoolProperty"],
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

    public doLoad(pkg: C.APackage, exp: C.UExport) {

        // debugger;

        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();


        if (verArchive < 85) (UObject as any).prototype.doLoad.call(this, pkg, exp);
        else (UPrimitive as any).prototype.doLoad.call(this, pkg, exp);

        this.sections = new FArray(FStaticMeshSection);
        this.vertexStream = new FStaticMeshVertexStream();
        this.colorStream = new FRawColorStream();
        this.alphaStream = new FRawColorStream();
        this.uvStream = new FArray(FStaticMeshUVStream);
        this.indexStream = new FRawIndexBuffer(); // triangle indices
        this.wireframeIndexBuffer = new FRawIndexBuffer(); // triangle edge indices
        this.staticMeshTris = new FArrayLazy(FStaticMeshTriangle);

        // debugger;

        this.sections.load(pkg);
        this.boundingBox.load(pkg);
        this.vertexStream.load(pkg);
        this.colorStream.load(pkg);
        this.alphaStream.load(pkg);
        this.uvStream.load(pkg);
        this.indexStream.load(pkg);
        this.wireframeIndexBuffer.load(pkg);

        this.collisionModelId = pkg.read("compat32");
        this.collisionModel = pkg.fetchObject<GA.UModel>(this.collisionModelId);

        if (this.collisionModelId !== 0)
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

        if (verLicense < 17) {
            if (this.collisionModelId > 0) {
                debugger;
            }

            this.collisionFaces = new FArray(FStaticMeshCollisionTriangle).load(pkg);
            this.collisionNodes = new FArray(FStaticMeshCollisionNode).load(pkg);
        } else {
            if (verArchive < 62) {
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

        if (this.collisionModelId > 0)
            debugger;

        this.readHead = pkg.tell();

        if (verArchive < 114) {
            console.warn("Not supported yet");
            this.skipRemaining = true;
            if (triggerDebuggerOnUnsupported) debugger;
            return;
        }

        if (5 < verLicense) {
            this.unkInt_5x0 = pkg.read("int32");
            this.unkInd_5x0 = pkg.read("compat32");
            this.unkInd_5x1 = pkg.read("compat32");
            this.unkInt_5x1 = pkg.read("int32");
            this.unkInt_5x2 = pkg.read("int32");
        }

        if (6 < verLicense) {
            this.unkInt_6x0 = pkg.read("int32");
            this.unkInt_6x1 = pkg.read("int32");
        }

        if (11 < verLicense) this.unkInt_Ax0 = pkg.read("int32");
        if (12 < verLicense) this.unkInt_Cx0 = pkg.read("int32");
        if (13 < verLicense) {
            this.unkInt_Dx0 = pkg.read("int32");
            this.unkInt_Dx1 = pkg.read("int32");
        }

        if (14 < verLicense) this.unkInt_Ex0 = pkg.read("int32");

        if (verArchive < 92) {
            console.warn("Not supported yet");
            this.skipRemaining = true;
            if (triggerDebuggerOnUnsupported) debugger;
            return;
        }

        if (78 < verArchive) {
            if (verArchive < 97) {
                console.warn("Not supported yet");
                this.skipRemaining = true;
                if (triggerDebuggerOnUnsupported) debugger;
                return;
            } else this.staticMeshTris.load(pkg);
        }

        if (verArchive < 81) {
            console.warn("Not supported yet");
            this.skipRemaining = true;
            if (triggerDebuggerOnUnsupported) debugger;
            return;
        } else this.internalVersion = pkg.read("int32");

        if (99 < verArchive) this.kPhysicsProps = pkg.read("compat32");
        if (119 < verArchive) this.authenticationKey = pkg.read("int32");

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

        const countVerts = this.vertexStream.getElemCount();
        const countIndices = this.indexStream.indices.getElemCount();
        const countUvs = this.uvStream.getElemCount();

        if (countUvs > 1) debugger;

        // debugger;

        const TypedIndicesArray = getTypedArrayConstructor(countVerts);
        const positions = new Float32Array(countVerts * 3);
        const colors = new Uint8ClampedArray(countVerts * 3);
        const normals = new Float32Array(countVerts * 3);
        const uvs = new Float32Array(countVerts * 2);
        const indices = new TypedIndicesArray(countIndices);

        // if (countVerts === 0x42)
        //     debugger;

        for (let i = 0; i < countVerts; i++) {
            const [px, py, pz, nx, ny, nz] = this.vertexStream.getElem(i);
            const [u, v] = this.uvStream.getElem(0).getUV(i);

            // if (Math.abs(px - 241.79730224609375) < 1 && Math.abs(py + 235.71449279785156) < 1 && Math.abs(pz + 622.3489990234375) < 1) {
            //     debugger;
            // }

            positions[i * 3 + 0] = px;
            positions[i * 3 + 1] = pz;
            positions[i * 3 + 2] = py;

            normals[i * 3 + 0] = nx;
            normals[i * 3 + 1] = nz;
            normals[i * 3 + 2] = ny;

            colors[i * 3 + 0] = 255;
            colors[i * 3 + 1] = 255;
            colors[i * 3 + 2] = 255;

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

        library.materials[this.uuid] = { name: this.uuid, materialType: "group", materials } as GD.IMaterialGroupDecodeInfo;

        const lods = new Array<[GD.IStaticMeshObjectDecodeInfo, number]>();

        if (this.hasStaticMeshLod) {
            if (this.staticMeshLod1?.loadSelf()) {
                lods.push([this.staticMeshLod1.getDecodeInfo(library, matModifiers), this.lodRange1]);
            }

            if (this.staticMeshLod2?.loadSelf()) {
                lods.push([this.staticMeshLod2.getDecodeInfo(library, matModifiers), this.lodRange2]);
            }
        }

        return {
            uuid: this.uuid,
            type: "StaticMesh",
            name: this.objectName,
            geometry: this.uuid,
            materials: materialUuid,
            children: [
                // this.getDecodeTrisInfo(library),
            ],
            lods: lods.length > 0 ? lods : null
        };
    }

    protected getDecodeTrisInfo(library: GD.DecodeLibrary): GD.IBaseObjectDecodeInfo {
        const trisCount = this.staticMeshTris.length;
        const trisGeometryUuid = generateUUID();
        const TypedIndicesArray = getTypedArrayConstructor(trisCount);
        const trisPositions = new Float32Array(trisCount * 3 * 3);
        const trisIndices = new TypedIndicesArray(trisCount * 4);

        for (let i = 0, len = trisCount; i < len; i++) {
            const indOffset = i * 4;
            const vIndOffset = i * 3, vertOffset = vIndOffset * 3;
            const [v0, v1, v2] = this.staticMeshTris.getElem(i).getVertices();

            [v0, v1, v2].forEach((v, j) => {
                const [x, y, z] = v;
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

    public getRenderBoundingBox(owner?: GA.AActor): GA.FBox {
        return this.boundingBox;
    }
}

export default UStaticMesh;
export { UStaticMesh, FStaticMeshTriangle };