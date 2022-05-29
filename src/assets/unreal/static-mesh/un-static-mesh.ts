import FArray, { FArrayLazy, FPrimitiveArray } from "../un-array";
import UPrimitive from "../un-primitive";
import FStaticMeshSection from "./un-static-mesh-section";
import FStaticMeshVertexStream from "./un-static-vertex-stream";
import FRawColorStream from "../un-raw-color-stream";
import FStaticMeshUVStream from "./un-static-mesh-uv-stream";
import FRawIndexBuffer from "../un-raw-index-buffer";

import BufferValue from "../../buffer-value";
import { FStaticMeshCollisionTriangle, FStaticMeshCollisionNode } from "./un-static-mesh-collision";
import FVector from "../un-vector";

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
        const uint32 = new BufferValue(BufferValue.uint32);
        const int32 = new BufferValue(BufferValue.int32);
        const float = new BufferValue(BufferValue.float);
        const int8 = new BufferValue(BufferValue.int8);

        // if (exp.objectName === "oren_curumadungeon17") debugger;
        // if (exp.objectName === "oren_curumadungeon33") debugger;

        super.doLoad(pkg, exp);

        this.sections.load(pkg, null);        // 0400 0000 0000 00BE 00ED 0022 0022 0000
        this.boundingBox.load(pkg);           // 6666 A2C3 FAED EBC0 889D 06C4 6666 A243
        this.vertexStream.load(pkg, null);    // 6E03 6666 A243 0000 0C42 8A2E F343 0000
        this.colorStream.load(pkg, null);     // 6E03 FFFF FFFF FFFF FFFF FFFF FFFF FFFF
        this.alphaStream.load(pkg, null);     // 6E03 FFFF FFFF FFFF FFFF FFFF FFFF FFFF
        this.uvStream.load(pkg, null);        // 6E03 FFFF FFFF FFFF FFFF FFFF FFFF FFFF
        this.indexStream.load(pkg, null);     // 4606 E500 E400 E000 DE00 DF00 E000 E100
        this.edgesStream.load(pkg, null);     // 7409 E500 E400 E400 E000 E000 E500 DE00

        const unkIndex0 = pkg.read(compat32).value as number;

        if (verLicense < 0x11) {
            debugger;
            console.warn("Not supported yet");
        } else {
            if (verArchive < 0x3E) {
                debugger;
                console.warn("Not supported yet");
            } else {
                // lazy loader for something
                this.collisionFaces.load(pkg, null);
                this.readHead = pkg.tell();

                this.collisionNodes.load(pkg, null);
                this.readHead = pkg.tell();
            }

            debugger;

            // // lazy loader for something
            // {
            //     const unkInt1 = pkg.read(uint32).value as number;

            //     this.collisionNodes.load(pkg);
            //     this.readHead = pkg.tell();

            //     debugger;
            // }

            // // const unkIndex3 = pkg.read(compat32).value as number;
            // // const unkIndex4 = pkg.read(compat32).value as number;

            // debugger;
        }


        debugger;

        const unkInt2 = pkg.read(uint32).value as number;
        const unkIndex5 = pkg.read(compat32).value as number;
        const unkIndex6 = pkg.read(compat32).value as number;

        // const a = new FVector().load()

        const v = new FVector().load(pkg);

        this.readHead = pkg.tell();

        debugger;

        // const unkInt3 = pkg.read(uint32).value as number;
        // const unkInt4 = pkg.read(uint32).value as number;

        // const unkInt5 = pkg.read(uint32).value as number;
        // const unkInt6 = pkg.read(uint32).value as number;

        // const unkInt7 = pkg.read(uint32).value as number;
        // const unkInt8 = pkg.read(uint32).value as number;

        // const unkInt9 = pkg.read(uint32).value as number;
        // const unkInt10 = pkg.read(uint32).value as number;

        // const unkInt11 = pkg.read(uint32).value as number;

        // // lazy loader for something
        // const unkInt12 = pkg.read(uint32).value as number;
        // const unkIndex7 = pkg.read(compat32).value as number;
        // const unkIndex8 = pkg.read(compat32).value as number;

        // const unkInt13 = pkg.read(uint32).value as number;

        // const unkIndex9 = pkg.read(compat32).value as number;

        // const unkInt14 = pkg.read(uint32).value as number;

        this.readHead = pkg.tell();

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

        // debugger;

        // const section = this.sections.getElem(0);
        // const materials = this.materials.getElem(0);

        // if (this.sections.getElemCount() > 1)
        //     debugger;

        const countVerts = this.vertexStream.vert.getElemCount();
        const countFaces = this.indexStream.indices.getElemCount();
        const countUvs = this.uvStream.getElemCount();

        if (countUvs > 1) debugger;

        const positions = new Float32Array(countVerts * 3);
        const normals = new Float32Array(countVerts * 3);
        const uvs = new Float32Array(countVerts * 2);
        const indices = new Uint16Array(countFaces);

        for (let i = 0; i < countVerts; i++) {
            const { position, normal } = this.vertexStream.vert.getElem(i);
            const { u, v } = this.uvStream.getElem(0).data.getElem(i);


            // position.toArray(positions, i * 3);
            // normal.toArray(normals, i * 3);

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

        const materials = await Promise.all(this.materials.map((mat: UMaterialContainer) => mat.getDecodeInfo(library)));

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

        // debugger;

        return {
            type: "StaticMesh",
            name: this.objectName,
            geometry: this.uuid,
            materials: this.uuid
        };
    }
}

export default UStaticMesh;
export { UStaticMesh };