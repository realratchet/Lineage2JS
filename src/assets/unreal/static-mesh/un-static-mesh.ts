import FArray from "../un-array";
import FBox from "../un-box";
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
    protected boundingBox: FBox = new FBox();
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

        geometry.setAttribute("position", attrPosition);
        geometry.setAttribute("normal", attrNormal);
        geometry.setAttribute("uv", attrUv);
        geometry.setIndex(attrIndices);

        geometry.boundingSphere = new Sphere(this.boundingSphere.center, this.boundingSphere.radius);
        if (this.boundingBox.isValid) {
            geometry.boundingBox = geometry.boundingBox || new Box3();
            geometry.boundingBox.set(this.boundingBox.min, this.boundingBox.max);
        }

        const materials = [];

        // debugger;

        for (let i = 0, len = this.sections.getElemCount(); i < len; i++) {
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