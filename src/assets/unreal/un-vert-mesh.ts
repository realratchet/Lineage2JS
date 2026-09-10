import { BufferValue, FArray, FPrimitiveArray, type APackage, type UExport } from "@l2js/core";
import ULodMesh from "./un-lod-mesh";
import FBox from "./un-box";
import FPlane from "./un-plane";
import { FAnimSequence } from "./skeletal-mesh/un-mesh-animation";
import { FAnimMeshVertex } from "./skeletal-mesh/un-skeletal-mesh";
import type { DecodeLibraryBuilder } from "./decode-library-builder";
import type { IGeometryDecodeInfo } from "./decode-library";

export abstract class UVertMesh extends ULodMesh {
    protected vertexStream = new FArray(FAnimMeshVertex);
    protected revision: number;
    protected animVerts = new FPrimitiveArray(BufferValue.uint32);
    protected frameKeys = new FPrimitiveArray(BufferValue.float);
    protected animSeqs = new FArray(FAnimSequence);
    protected animNormals = new FPrimitiveArray(BufferValue.uint32);
    protected frameVerts: number;
    protected animFrames: number;
    protected boundingBoxes: FBox[] = [];
    protected boundingSpheres: FPlane[] = [];

    public doLoad(pkg: APackage, exp: UExport): void {
        super.doLoad(pkg, exp);

        // Engine.dll UVertMesh::Serialize 0x9d9206–0x9d92a6.
        this.vertexStream.load(pkg);
        this.revision = pkg.read("int32");
        this.animVerts.load(pkg);
        this.frameKeys.load(pkg);
        this.animSeqs.load(pkg);
        this.animNormals.load(pkg);
        this.frameVerts = pkg.read("int32");
        this.animFrames = pkg.read("int32");

        for (let i = 0, count = pkg.read("compat32"); i < count; i++)
            this.boundingBoxes.push(FBox.make().load(pkg));
        for (let i = 0, count = pkg.read("compat32"); i < count; i++)
            this.boundingSpheres.push(FPlane.make().load(pkg));

        this.readHead = pkg.tell();
        if (this.readHead !== this.readTail) throw new Error(`VertMesh '${this.objectName}' has ${this.readTail - this.readHead} unread bytes.`);
    }

    public getDecodeInfo(builder: DecodeLibraryBuilder) {
        const sequence = this.animSeqs.find(sequence => sequence.name.toLowerCase() === this.objectName.toLowerCase());
        const wedges = this.lodWedges;
        const frames: Float32Array[] = [];
        const normals: Float32Array[] = [];
        const uvs = new Float32Array(wedges.length * 2);
        const indices: number[] = [];
        const groups: [number, number, number][] = [];

        if (!sequence || sequence.frameCount <= 0) throw new Error(`VertMesh '${this.objectName}' has no matching animation sequence.`);
        if (this.animVerts.getElemCount() !== this.frameVerts * this.animFrames || this.animNormals.getElemCount() !== this.animVerts.getElemCount()) throw new Error(`VertMesh '${this.objectName}' has inconsistent animation frame data.`);
        if (sequence.frameStart + sequence.frameCount > this.animFrames) throw new Error(`VertMesh '${this.objectName}' animation exceeds its frame data.`);

        for (let f = 0; f < sequence.frameCount; f++) {
            const positions = new Float32Array(wedges.length * 3);
            const frameNormals = new Float32Array(wedges.length * 3);

            for (let i = 0; i < wedges.length; i++) {
                const wedge = wedges[i];

                if (wedge.vertexIndex >= this.frameVerts) throw new Error(`VertMesh '${this.objectName}' wedge ${i} exceeds its vertex count.`);

                const index = (sequence.frameStart + f) * this.frameVerts + wedge.vertexIndex;
                const vertex = this.animVerts.getElem(index);
                const normal = this.animNormals.getElem(index);

                // Engine.dll GetFrame 0x9d6a5d–0x9d6ad7; normal bias 0xaae3ac is 512.
                positions[i * 3] = vertex << 21 >> 21;
                positions[i * 3 + 1] = vertex << 10 >> 21;
                positions[i * 3 + 2] = vertex >> 22;
                frameNormals[i * 3] = (normal & 1023) - 512;
                frameNormals[i * 3 + 1] = (normal >>> 10 & 1023) - 512;
                frameNormals[i * 3 + 2] = (normal >>> 20 & 1023) - 512;
                uvs[i * 2] = wedge.texU;
                uvs[i * 2 + 1] = wedge.texV;
            }

            frames.push(positions);
            normals.push(frameNormals);
        }

        for (let i = 0; i < this.meshMaterials.length; i++) {
            const start = indices.length;

            for (const face of this.lodFaces) {
                if (face.meshMaterialIndex >= this.meshMaterials.length) throw new Error(`VertMesh '${this.objectName}' has an invalid face material.`);
                if (face.meshMaterialIndex !== i) continue;
                if (face.wedgeIndices.some(index => index >= wedges.length)) throw new Error(`VertMesh '${this.objectName}' has an invalid face wedge.`);

                indices.push(face.wedgeIndices[2], face.wedgeIndices[1], face.wedgeIndices[0]);
            }

            groups.push([start, indices.length - start, i]);
        }

        const materials = this.meshMaterials.map(material => {
            const source = this.lodMeshMaterials[material.materialIndex];

            if (!source) throw new Error(`VertMesh '${this.objectName}' material ${material.materialIndex} is missing.`);

            return builder.pullMaterial(source);
        });
        const geometry: IGeometryDecodeInfo = { attributes: { positions: frames[0], normals: normals[0], uvs }, indices: new Uint32Array(indices), groups };

        return { geometry, materials, frames, normals, framerate: sequence.framerate };
    }
}

export default UVertMesh;
