import FArray from "../un-array";
import UBox from "../un-box";
import USphere from "../un-sphere";
import UPrimitive from "../un-primitive";
import FStaticMeshSection from "./un-static-mesh-section";
import FStaticMeshVertexStream from "./un-static-vertex-stream";
import FRawColorStream from "../un-raw-color-stream";
import FStaticMeshUVStream from "./un-static-mesh-uv-stream";
import FRawIndexBuffer from "../un-raw-index-buffer";
import { Float32BufferAttribute, Uint16BufferAttribute, BufferGeometry, Sphere, Box3, MeshBasicMaterial, Mesh, FrontSide, BackSide, DoubleSide } from "three";
import UTexture from "../un-texture";
import UMaterial from "../un-material";

type UPackage = import("../un-package").UPackage;
type UExport = import("../un-export").UExport;

class UStaticMesh extends UPrimitive {
    protected boundingBox: UBox = new UBox();
    protected boundingSphere: USphere = new USphere();
    protected sections: FArray<FStaticMeshSection> = new FArray(FStaticMeshSection);
    protected vertexStream: FStaticMeshVertexStream = new FStaticMeshVertexStream();
    protected colorStream: FRawColorStream = new FRawColorStream();
    protected alphaStream: FRawColorStream = new FRawColorStream();
    protected uvStream: FArray<FStaticMeshUVStream> = new FArray(FStaticMeshUVStream);
    protected indexStream1 = new FRawIndexBuffer();
    protected indexStream2 = new FRawIndexBuffer();
    protected staticMeshLod2: UStaticMesh;
    protected staticMeshLod1: UStaticMesh;
    protected lodRange1: number;
    protected lodRange2: number;
    protected hasStaticMeshLod: boolean;
    protected isMadeTwoSideMesh: boolean;
    protected isStaticMeshLodBlend: boolean;
    protected isUsingBillboard: boolean;
    protected frequency: number;

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

    public async load(pkg: UPackage, exp: UExport) {
        await super.load(pkg, exp);

        await this.sections.load(pkg, null);
        await this.boundingBox.load(pkg);
        await this.vertexStream.load(pkg, null);
        await this.colorStream.load(pkg, null);
        await this.alphaStream.load(pkg, null);
        await this.uvStream.load(pkg, null);
        await this.indexStream1.load(pkg, null);
        await this.indexStream2.load(pkg, null);

        console.assert(this.sections.getElemCount() === this.materials.getElemCount());

        return this;
    }

    public async decodeMesh() {
        // debugger;

        // const section = this.sections.getElem(0);
        // const materials = this.materials.getElem(0);

        // if (this.sections.getElemCount() > 1)
        //     debugger;

        const countVerts = this.vertexStream.vert.getElemCount();
        const countFaces = this.indexStream1.indices.getElemCount();
        const countUvs = this.uvStream.getElemCount();

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

        for (let i = 0; i < countFaces; i++) {
            indices[i] = this.indexStream1.indices.getElem(i).value;
        }

        const attrPosition = new Float32BufferAttribute(positions, 3);
        const attrNormal = new Float32BufferAttribute(normals, 3);
        const attrUv = new Float32BufferAttribute(uvs, 2);
        const attrIndices = new Uint16BufferAttribute(indices, 1);

        const geometry = new BufferGeometry();
        const { center, radius } = this.boundingSphere;
        const { min, max } = this.boundingBox;

        geometry.setAttribute("position", attrPosition);
        geometry.setAttribute("normal", attrNormal);
        geometry.setAttribute("uv", attrUv);
        geometry.setIndex(attrIndices);

        geometry.boundingSphere = new Sphere(center, radius);
        geometry.boundingBox = new Box3(min, max);

        const materials = [];

        // debugger;

        for(let i = 0, len = this.sections.getElemCount(); i < len; i++) {
            const section = this.sections.getElem(i);
            geometry.addGroup(section.firstIndex, section.numFaces * 3, i);
            materials.push(await this.materials.getElem(i).decodeMaterial());
        }

        // const materials = await this.materials.getElem(0)?.decodeMaterial();
        const mesh = new Mesh(geometry, materials);

        return mesh;
    }
}

export default UStaticMesh;
export { UStaticMesh };

// import FArray from "../un-array";
// import UBox from "../un-box";
// import USphere from "../un-sphere";
// import UPrimitive from "../un-primitive";
// import FStaticMeshSection from "./un-static-mesh-section";
// import FStaticMeshVertexStream from "./un-static-vertex-stream";
// import FRawColorStream from "../un-raw-color-stream";
// import FStaticMeshUVStream from "./un-static-mesh-uv-stream";
// import FRawIndexBuffer from "../un-raw-index-buffer";
// import { Float32BufferAttribute, Uint16BufferAttribute, BufferGeometry, Sphere, Box3, MeshBasicMaterial, Mesh, FrontSide, BackSide, DoubleSide } from "three";
// import UTexture from "../un-texture";
// import UMaterial from "../un-material";

// type UPackage = import("../un-package").UPackage;
// type UExport = import("../un-export").UExport;

// class UStaticMesh extends UPrimitive {
//     protected boundingBox: UBox = new UBox();
//     protected boundingSphere: USphere = new USphere();
//     protected sections: FArray<FStaticMeshSection> = new FArray(FStaticMeshSection);
//     protected vertexStream: FStaticMeshVertexStream = new FStaticMeshVertexStream();
//     protected colorStream: FRawColorStream = new FRawColorStream();
//     protected alphaStream: FRawColorStream = new FRawColorStream();
//     protected uvStream: FArray<FStaticMeshUVStream> = new FArray(FStaticMeshUVStream);
//     protected indexStream1 = new FRawIndexBuffer();
//     protected indexStream2 = new FRawIndexBuffer();
//     protected staticMeshLod2: UStaticMesh;
//     protected staticMeshLod1: UStaticMesh;
//     protected lodRange1: number;
//     protected lodRange2: number;
//     protected hasStaticMeshLod: boolean;
//     protected isMadeTwoSideMesh: boolean;
//     protected isStaticMeshLodBlend: boolean;
//     protected isUsingBillboard: boolean;
//     protected frequency: number;

//     protected getPropertyMap() {
//         return Object.assign({}, super.getPropertyMap(), {
//             "StaticMeshLod02": "staticMeshLod2",
//             "LodRange02": "lodRange2",
//             "StaticMeshLod01": "staticMeshLod1",
//             "LodRange01": "lodRange1",
//             "bStaticMeshLod": "hasStaticMeshLod",
//             "bMakeTwoSideMesh": "isMadeTwoSideMesh",
//             "bStaticMeshLodBlend": "isStaticMeshLodBlend",
//             "bUseBillBoard": "isUsingBillboard",
//             "Frequency": "frequency"
//         });
//     }

//     public async load(pkg: UPackage, exp: UExport) {
//         await super.load(pkg, exp);

//         await this.sections.load(pkg, null);
//         await this.boundingBox.load(pkg);
//         await this.vertexStream.load(pkg, null);
//         await this.colorStream.load(pkg, null);
//         await this.alphaStream.load(pkg, null);
//         await this.uvStream.load(pkg, null);
//         await this.indexStream1.load(pkg, null);
//         await this.indexStream2.load(pkg, null);

//         console.assert(this.sections.getElemCount() === this.materials.getElemCount());

//         return this;
//     }

//     public async decodeMesh() {
//         // const countVerts = this.vertexStream.vert.getElemCount();
//         // const countFaces = this.indexStream1.indices.getElemCount();
//         // const countUvs = this.uvStream.getElemCount();

//         // const positions = new Float32Array(countVerts * 3);
//         // const normals = new Float32Array(countVerts * 3);
//         // const uvs = new Float32Array(countVerts * 2);
//         // const indices = new Uint16Array(countFaces);

//         // for (let i = 0; i < countVerts; i++) {
//         //     const { position, normal } = this.vertexStream.vert.getElem(i);
//         //     const { u, v } = this.uvStream.getElem(0).data.getElem(i);

//         //     positions[i * 3 + 0] = position.x;
//         //     positions[i * 3 + 1] = position.z;
//         //     positions[i * 3 + 2] = position.y;

//         //     normals[i * 3 + 0] = normal.x;
//         //     normals[i * 3 + 1] = normal.z;
//         //     normals[i * 3 + 2] = normal.y;

//         //     uvs[i * 2 + 0] = u;
//         //     uvs[i * 2 + 1] = v;
//         // }

//         // for (let i = 0; i < countFaces; i++) {
//         //     indices[i] = this.indexStream1.indices.getElem(i).value;
//         // }

//         // const attrPosition = new Float32BufferAttribute(positions, 3);
//         // const attrNormal = new Float32BufferAttribute(normals, 3);
//         // const attrUv = new Float32BufferAttribute(uvs, 2);
//         // const attrIndices = new Uint16BufferAttribute(indices, 1);

//         // const geometry = new BufferGeometry();
//         // const { center, radius } = this.boundingSphere;
//         // const { min, max } = this.boundingBox;

//         // geometry.setAttribute("position", attrPosition);
//         // geometry.setAttribute("normal", attrNormal);
//         // geometry.setAttribute("uv", attrUv);
//         // geometry.setIndex(attrIndices);

//         // geometry.boundingSphere = new Sphere(center, radius);
//         // geometry.boundingBox = new Box3(min, max);

//         // const materials = [];
//         // let offset = 0;

//         // for(let i = 0, len = this.sections.getElemCount(); i < len; i++) {
//         //     const section = this.sections.getElem(i);
//         //     geometry.addGroup(offset, offset + section.numFaces, i);
//         //     materials.push(await this.materials.getElem(i).decodeMaterial());

//         //     offset = offset + section.numFaces;
//         // }

//         const geometry = new BufferGeometry();
//         const countVerts = this.vertexStream.vert.getElemCount();
//         const { center, radius } = this.boundingSphere;
//         const { min, max } = this.boundingBox;
//         const sectionCount = this.sections.getElemCount();
//         const materials = new Array(sectionCount);
//         const istream = this.indexStream1.indices;
//         const indexCount = istream.getElemCount();
//         const indices = [];
//         const positions = [], normals = [], uvs = [];
//         // const positions = new Float32Array(countVerts * 3);
//         // const normals = new Float32Array(countVerts * 3);
//         // const uvs = new Float32Array(countVerts * 2);

//         let offset = 0;

//         for (let i = 0; i < sectionCount; i++) {
//             const section = this.sections.getElem(i);
//             const faceCount = section.numFaces;
//             const material = await this.materials.getElem(i).decodeMaterial();

//             if (offset * 3 + faceCount * 3 > indexCount) {
//                 section.numFaces = (indexCount - offset * 3) / 3;
//                 if (section.numFaces < 0)
//                     section.numFaces = 0;
//             }

//             for (let j = 0; j < faceCount; j++) {
//                 const vidx = offset * 3 + j * 3;
//                 const [i1, i2, i3] = [0, 1, 2].map(i => istream.getElem(vidx + i).value);

//                 // uvs.push(this.uvStream.getElem(0).data.getElem(i1).u, this.uvStream.getElem(0).data.getElem(i1).v);
//                 // normals.push(this.vertexStream.vert.getElem(i1).normal.x, this.vertexStream.vert.getElem(i1).normal.z, this.vertexStream.vert.getElem(i1).normal.y);
//                 // positions.push(this.vertexStream.vert.getElem(i1).position.x, this.vertexStream.vert.getElem(i1).position.z, this.vertexStream.vert.getElem(i1).position.y);
//                 // uvs.push(this.uvStream.getElem(0).data.getElem(i2).u, this.uvStream.getElem(0).data.getElem(i2).v);
//                 // normals.push(this.vertexStream.vert.getElem(i2).normal.x, this.vertexStream.vert.getElem(i2).normal.z, this.vertexStream.vert.getElem(i2).normal.y);
//                 // positions.push(this.vertexStream.vert.getElem(i2).position.x, this.vertexStream.vert.getElem(i2).position.z, this.vertexStream.vert.getElem(i2).position.y);
//                 // uvs.push(this.uvStream.getElem(0).data.getElem(i3).u, this.uvStream.getElem(0).data.getElem(i3).v);
//                 // normals.push(this.vertexStream.vert.getElem(i3).normal.x, this.vertexStream.vert.getElem(i3).normal.z, this.vertexStream.vert.getElem(i3).normal.y);
//                 // positions.push(this.vertexStream.vert.getElem(i3).position.x, this.vertexStream.vert.getElem(i3).position.z, this.vertexStream.vert.getElem(i3).position.y);

//                 indices.push(i1, i2, i3);
//             }

//             geometry.addGroup(offset, offset + faceCount, i);
//             offset = offset + faceCount;

//             materials[i] = material;

//             // break;
//         }

//         // debugger;

//         // if (this.uvStream.getElemCount() > 1) debugger;
//         // if (this.alphaStream.color.getElemCount() > 0) debugger;
//         // if (this.indexStream2.indices.getElemCount() > 0) debugger;

//         for (let i = 0; i < countVerts; i++) {
//             const { position, normal } = this.vertexStream.vert.getElem(i);
//             const { u, v } = this.uvStream.getElem(0).data.getElem(i);

//             positions[i * 3 + 0] = position.x;
//             positions[i * 3 + 1] = position.z;
//             positions[i * 3 + 2] = position.y;

//             normals[i * 3 + 0] = normal.x;
//             normals[i * 3 + 1] = normal.z;
//             normals[i * 3 + 2] = normal.y;

//             uvs[i * 2 + 0] = u;
//             uvs[i * 2 + 1] = v;
//         }

//         const attrPosition = new Float32BufferAttribute(positions, 3);
//         const attrNormal = new Float32BufferAttribute(normals, 3);
//         const attrUv = new Float32BufferAttribute(uvs, 2);
//         const attrIndices = new Uint16BufferAttribute(indices, 1);

//         geometry.boundingSphere = new Sphere(center, radius);
//         geometry.boundingBox = new Box3(min, max);

//         geometry.setAttribute("position", attrPosition);
//         geometry.setAttribute("normal", attrNormal);
//         geometry.setAttribute("uv", attrUv);
//         geometry.setIndex(attrIndices);

//         debugger;

//         // const materials = await this.materials.getElem(0)?.decodeMaterial();
//         const mesh = new Mesh(geometry, materials);

//         return mesh;
//     }
// }

// export default UStaticMesh;
// export { UStaticMesh };