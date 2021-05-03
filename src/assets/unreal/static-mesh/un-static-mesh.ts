import FArray from "../un-array";
import UBox from "../un-box";
import USphere from "../un-sphere";
import UPrimitive from "../un-primitive";
import FStaticMeshSection from "./un-static-mesh-section";
import FStaticMeshVertexStream from "./un-static-vertex-stream";
import FRawColorStream from "../un-raw-color-stream";
import FStaticMeshUVStream from "./un-static-mesh-uv-stream";
import FRawIndexBuffer from "../un-raw-index-buffer";
import { Float32BufferAttribute, Uint16BufferAttribute, BufferGeometry, Sphere, Box3, MeshBasicMaterial, Mesh } from "three";

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

    public async load(pkg: UPackage, exp: UExport) {
        await super.load(pkg, exp);

        await this.sections.load(pkg, null);
        await this.boundingBox.load(pkg, null);
        await this.vertexStream.load(pkg, null);
        await this.colorStream.load(pkg, null);
        await this.alphaStream.load(pkg, null);
        await this.uvStream.load(pkg, null);
        await this.indexStream1.load(pkg, null);
        await this.indexStream2.load(pkg, null);

        return this;
    }

    public async decodeMesh() {
        const section = this.sections.getElem(0);
        const materials = this.materials.getElem(0);

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

            position.toArray(positions, i * 3);
            normal.toArray(normals, i * 3);

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

        const texture = materials.material.decodeMipmap ? await materials.material.decodeMipmap(0) : null;
        const material = new MeshBasicMaterial({ map: texture });
        const mesh = new Mesh(geometry, material);

        return mesh;
    }
}

export default UStaticMesh;
export { UStaticMesh };