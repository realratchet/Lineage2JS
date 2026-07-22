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

type StaticMeshDecodeResult_T = { object: GD.IStaticMeshObjectDecodeInfo, geometry: GD.IGeometryDecodeInfo, materials: [string, GD.IBaseMaterialDecodeInfo][], colorMaterials: string[] };

const triggerDebuggerOnUnsupported = true;


abstract class UStaticMesh extends UPrimitive {
    declare protected materials: C.FArray<GA.UStaticMeshMaterial>;

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

    declare protected swayObject: boolean;
    declare protected maxSwayAngle: number;

    declare protected collisionFaces: FArray<FStaticMeshCollisionTriangle>;
    declare protected collisionNodes: FArray<FStaticMeshCollisionNode>;
    declare protected staticMeshTris: FArrayLazy<FStaticMeshTriangle>;

    declare protected collisionModelId: number;
    declare protected collisionModel: GA.UModel;

    declare protected unkInt_Dx1: number; // maybe boolean

    declare protected internalVersion: number;
    declare protected kPhysicsProps: number;
    declare protected authenticationKey: number;

    protected useSimpleLineCollision: boolean = false;
    protected UseSimpleBoxCollision: boolean = false;
    public useVertexColor: boolean = false;

    public static getUnserializedProperties(): C.UnserializedProperty_T[] {
        return [
            ["Materials", "ArrayProperty", ["Class", "StaticMeshMaterial"]],
            ["bSwayObject", "BoolProperty"],
            ["Frequency", "FloatProperty"],
            ["MaxSwayAngle", "FloatProperty"],
            ["LodRange01", "FloatProperty"],
            ["StaticMeshLod01", "ObjectProperty"],
            ["LodRange02", "FloatProperty"],
            ["StaticMeshLod02", "ObjectProperty"],
            ["bStaticMeshLod", "BoolProperty"],
            ["bStaticMeshLodBlend", "BoolProperty"],
            ["bMakeTwoSideMesh", "BoolProperty"],
            ["bUseBillBoard", "FloatProperty"],
        ];
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Materials": "materials",
            "StaticMeshLod02": "staticMeshLod2",
            "LodRange02": "lodRange2",
            "StaticMeshLod01": "staticMeshLod1",
            "LodRange01": "lodRange1",
            "bStaticMeshLod": "hasStaticMeshLod",
            "bMakeTwoSideMesh": "isMadeTwoSideMesh",
            "bStaticMeshLodBlend": "isStaticMeshLodBlend",
            "bUseBillBoard": "isUsingBillboard",
            "bSwayObject": "swayObject",
            "Frequency": "frequency",
            "MaxSwayAngle": "maxSwayAngle",
            "bUseVertexColor": "useVertexColor",
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
            // not sure why are these overwritten here again because these are part of unserialized props!
            this.hasStaticMeshLod = pkg.read("int32") !== 0;
            this.staticMeshLod1 = pkg.fetchObject(pkg.read("compat32"));
            this.staticMeshLod2 = pkg.fetchObject(pkg.read("compat32"));
            this.lodRange1 = pkg.read("float");
            this.lodRange2 = pkg.read("float");
        }

        if (6 < verLicense) {
            // ditto
            this.swayObject = pkg.read("int32") !== 0;
            this.frequency = pkg.read("float");
        }

        // ditto
        if (11 < verLicense) this.maxSwayAngle = pkg.read("float");
        if (12 < verLicense) this.isStaticMeshLodBlend = pkg.read("int32") !== 0;
        if (13 < verLicense) {
            this.isMadeTwoSideMesh = pkg.read("int32") !== 0;
            this.unkInt_Dx1 = pkg.read("int32"); // likely boolean?
        }

        if (14 < verLicense) this.isUsingBillboard = pkg.read("int32") !== 0;

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

    public getDecodeInfo(builder: GD.DecodeLibraryBuilder, matModifiers?: string[]): StaticMeshDecodeResult_T {
        // await this.onDecodeReady();

        // debugger;

        const library = builder.library;
        let materialUuid = this.uuid;
        const materialsInfo: [string, GD.IBaseMaterialDecodeInfo][] = [];
        const sway = this.swayObject ? {
            pivotZ: this.boundingBox.min.z,
            frequency: this.frequency,
            maxAngle: this.maxSwayAngle
        } : undefined;

        if (matModifiers?.length > 0) {
            const hash = new StringSet(matModifiers).hash();
            const hashArr = new Uint8Array(new BigUint64Array([hash]).buffer);

            materialUuid = seededUuid(hashArr, materialUuid);

            if (!(materialUuid in library.materials)) {
                materialsInfo.push([materialUuid, {
                    materialType: "instance",
                    baseMaterial: this.uuid,
                    modifiers: matModifiers
                } as GD.IMaterialInstancedDecodeInfo]);

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

        const objectInfo = {
            uuid: this.uuid,
            type: "StaticMesh",
            name: this.objectName,
            geometry: this.uuid,
            materials: materialUuid,
            sway
        } as GD.IStaticMeshObjectDecodeInfo;

        if (this.uuid in library.geometries)
            return { object: objectInfo, geometry: null, materials: materialsInfo, colorMaterials: [] };

        // 43 arrays of 30 uint8 values that are likely colors
        // 43x30 -> 1290
        // 43x10 -> 430

        // 24 x 117 = 2808 | (24 x 39 = 936)

        const countVerts = this.vertexStream.getElemCount();
        const countIndices = this.indexStream.indices.getElemCount();
        const countUvs = this.uvStream.getElemCount();

        const TypedIndicesArray = getTypedArrayConstructor(countVerts);
        const positions = new Float32Array(countVerts * 3);
        const colors = new Uint8ClampedArray(countVerts * 3);
        const normals = new Float32Array(countVerts * 3);
        const uvs = Array.from({ length: countUvs }, () => new Float32Array(countVerts * 2));
        const indices = new TypedIndicesArray(countIndices);

        // if (countVerts === 0x42)
        //     debugger;

        for (let i = 0; i < countVerts; i++) {
            const [px, py, pz, nx, ny, nz] = this.vertexStream.getElem(i);

            // if (Math.abs(px - 241.79730224609375) < 1 && Math.abs(py + 235.71449279785156) < 1 && Math.abs(pz + 622.3489990234375) < 1) {
            //     debugger;
            // }

            positions[i * 3 + 0] = px;
            positions[i * 3 + 1] = py;
            positions[i * 3 + 2] = pz;

            normals[i * 3 + 0] = nx;
            normals[i * 3 + 1] = ny;
            normals[i * 3 + 2] = nz;

            colors[i * 3 + 0] = 255;
            colors[i * 3 + 1] = 255;
            colors[i * 3 + 2] = 255;

            for (let s = 0; s < countUvs; s++) {
                const [u, v] = this.uvStream.getElem(s).getUV(i);

                uvs[s][i * 2 + 0] = u;
                uvs[s][i * 2 + 1] = v;
            }
        }

        for (let i = 0; i < countIndices; i++)
            indices[i] = this.indexStream.indices.getElem(i);

        const collisionFaces = this.collisionFaces.length;
        const collision = new Uint32Array(this.collisionFaces.length * 3);

        for (let i = 0; i < collisionFaces; i++) {
            const face = this.collisionFaces.getElem(i);
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

        const geometryInfo = {
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
        const materials = this.materials.map((mat: GA.UStaticMeshMaterial) => builder.pullMaterial(mat));

        materialsInfo.push([this.uuid, { name: this.uuid, materialType: "group", materials } as GD.IMaterialGroupDecodeInfo]);

        return { object: objectInfo, geometry: geometryInfo, materials: materialsInfo, colorMaterials: materials };
    }

    protected getDecodeTrisInfo(): { object: GD.IBaseObjectDecodeInfo, uuid: string, geometry: GD.IGeometryDecodeInfo } {
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
                trisPositions[offset + 1] = y;
                trisPositions[offset + 2] = z;
            });

            trisIndices[indOffset + 0] = vIndOffset + 0;
            trisIndices[indOffset + 1] = vIndOffset + 1;
            trisIndices[indOffset + 2] = vIndOffset + 2;
            trisIndices[indOffset + 3] = vIndOffset + 0;
        }


        const geometryInfo = {
            indices: trisIndices,
            attributes: {
                positions: trisPositions
            }
        };

        return {
            object: {
                type: "Edges",
                geometry: trisGeometryUuid,
                color: [1, 0, 1]
            } as GD.IEdgesObjectDecodeInfo,
            uuid: trisGeometryUuid,
            geometry: geometryInfo
        };
    }

    public getRenderBoundingBox(owner?: GA.AActor): GA.FBox {
        return this.boundingBox;
    }
}

export default UStaticMesh;
export { UStaticMesh, FStaticMeshTriangle };
