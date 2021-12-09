import FArray from "../un-array";
import UPrimitive from "../un-primitive";
import FStaticMeshSection from "./un-static-mesh-section";
import FStaticMeshVertexStream from "./un-static-vertex-stream";
import FRawColorStream from "../un-raw-color-stream";
import FStaticMeshUVStream from "./un-static-mesh-uv-stream";
import FRawIndexBuffer from "../un-raw-index-buffer";

import BufferValue from "../../buffer-value";
import { FStaticMeshCollisionTriangle, FStaticMeshCollisionNode } from "./un-static-mesh-collision";

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

    protected collisionFaces: FArray<FStaticMeshCollisionTriangle> = new FArray(FStaticMeshCollisionTriangle);
    protected collisionNodes: FArray<FStaticMeshCollisionNode> = new FArray(FStaticMeshCollisionNode);

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
        const compat32 = new BufferValue(BufferValue.compat32);
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

        // pkg.seek(1);

        const unk = pkg.read(compat32).value as number;

        if (unk !== 0) debugger;

        // const unk2 = await pkg.read(compat32).value as number;

        // const lodsMaybe = await new FArray(FStaticMeshSection).load(pkg);


        // debugger;




        // debugger;

        // // const arr = await new FArray(UModel).load(pkg);

        // debugger;

        // // 15 4 60 0

        // // const unk = [
        // //     await pkg.read(new BufferValue(BufferValue.uint8)).value as number,
        // //     await pkg.read(new BufferValue(BufferValue.uint8)).value as number,
        // //     await pkg.read(new BufferValue(BufferValue.uint8)).value as number,
        // //     await pkg.read(new BufferValue(BufferValue.uint8)).value as number,
        // //     // await pkg.read(new BufferValue(BufferValue.compat32)).value as number,
        // //     // await pkg.read(new BufferValue(BufferValue.compat32)).value as number,
        // //     // await pkg.read(new BufferValue(BufferValue.compat32)).value as number,
        // //     // await pkg.read(new BufferValue(BufferValue.compat32)).value as number
        // // ];

        // // debugger;

        // // const startOffset = pkg.tell();

        // // const unk = pkg.read(new BufferValue(BufferValue.int32)); // skip unknown;
        // // const unkVal = unk.value;

        // // const compatVal = await pkg.read(compat32).value as number;

        // // const steps = pkg.tell() - startOffset;

        // // debugger;

        // // console.log(this.vertexStream.vert[this.indexStream1.indices[0].value].position);
        // // console.log(this.vertexStream.vert[this.indexStream1.indices[1].value].position);
        // // console.log(this.vertexStream.vert[this.indexStream1.indices[2].value].position);

        // const count = await pkg.read(new BufferValue(BufferValue.compat32)).value as number;

        // // debugger;

        // const dview = await pkg.read(BufferValue.allocBytes(this.readTail - pkg.tell() - 3)).value as DataView;
        // const fview = new Float32Array(dview.buffer);

        // // debugger;

        // await this.collisionFaces.load(pkg);

        // // debugger;

        // this.readHead = pkg.tell();

        // const bytesLeft = this.readTail - this.readHead;
        // const nextItems = [];
        // const byteOffset = 1 + 1, byteCount = 5000;
        // const byteEnd = Math.min(bytesLeft, byteOffset + byteCount);

        // const sphere = new Sphere(this.boundingSphere.center, this.boundingSphere.radius);

        // console.log(this.boundingBox.min, this.boundingBox.max);

        // this.vtest = [];
        // this.ptest = [];

        // for (let i = 0, len = this.collisionFaces.length; i < len; i++) {
        //     const tri = this.collisionFaces[i] as FStaticMeshCollisionTriangle;

        //     for (let j = 0; j < 4; j++) {
        //         const plane = new Plane(new Vector3(tri.f1[j * 4 + 0], tri.f1[j * 4 + 2], tri.f1[j * 4 + 1]), tri.f1[j * 4 + 3]);

        //         this.ptest.push(plane);
        //     }

        //     // debugger;

        //     // const x = tri.f1[3 + 4 * 0], y = tri.f1[3 + 4 * 1], z = tri.f1[3 + 4 * 2], w = tri.f1[3 + 4 * 3];

        //     // this.vtest.push(new Vector3(x, y, z));

        //     // console.log(tri.f1, tri.f2);
        //     // console.log(x, y, z, w, tri.f2);
        // }


        // // debugger;

        // // pkg.seek(3924065, "set");
        // pkg.seek(6);

        // pkg.dump(1);

        // debugger;

        // for (let steps = 0; pkg.tell() < this.readTail; steps++) {
        //     // pkg.seek(this.readHead + i, "set");

        //     const nx = await pkg.read(BufferValue.allocBytes(3 * 4)).value as DataView;
        //     const fx = new Float32Array(nx.buffer);
        //     const px = await pkg.read(float).value as number;
        //     const ny = await pkg.read(BufferValue.allocBytes(3 * 4)).value as DataView;
        //     const fy = new Float32Array(ny.buffer);
        //     const py = await pkg.read(float).value as number;
        //     const nz = await pkg.read(BufferValue.allocBytes(3 * 4)).value as DataView;
        //     const fz = new Float32Array(nz.buffer);
        //     const pz = await pkg.read(float).value as number;

        //     // debugger;

        //     // const a = await pkg.read(float).value;
        //     // const b = await pkg.read(compat32).value;
        //     // const c = await pkg.read(compat32).value;
        //     // const d = await pkg.read(compat32).value;
        //     // const e = await pkg.read(compat32).value;

        //     const unk = await pkg.read(BufferValue.allocBytes(5 * 4)).value as DataView;

        //     this.vtest.push(new Vector3(px, py, pz));

        //     // debugger;

        //     if (steps === 10)
        //         break;
        // }

        // for (let i = byteOffset; i < byteEnd - FVector.typeSize * 4; i += 1) {
        //     try {
        //         pkg.seek(this.readHead + i, "set");

        //         if (await pkg.read(float).value as number === 35) {
        //             pkg.seek(3924065, "set");

        //             debugger;

        //             const nx = await pkg.read(BufferValue.allocBytes(3 * 4)).value as DataView;
        //             const fx = new Float32Array(nx.buffer);
        //             const px = await pkg.read(float).value as number;
        //             const ny = await pkg.read(BufferValue.allocBytes(3 * 4)).value as DataView;
        //             const fy = new Float32Array(ny.buffer);
        //             const py = await pkg.read(float).value as number;
        //             const nz = await pkg.read(BufferValue.allocBytes(3 * 4)).value as DataView;
        //             const fz = new Float32Array(nz.buffer);
        //             const pz = await pkg.read(float).value as number;

        //             const t = pkg.tell();

        //             const a = await pkg.read(compat32).value;
        //             const b = await pkg.read(compat32).value;
        //             const c = await pkg.read(compat32).value;
        //             const d = await pkg.read(compat32).value;
        //             const e = await pkg.read(compat32).value;

        //             console.log(pkg.tell() - t);

        //             debugger;

        //             // const unk = await pkg.read(BufferValue.allocBytes(5 * 4)).value as DataView;

        //             const nx1 = await pkg.read(BufferValue.allocBytes(3 * 4)).value as DataView;
        //             const px1 = await pkg.read(float).value as number;
        //             const ny1 = await pkg.read(BufferValue.allocBytes(3 * 4)).value as DataView;
        //             const py1 = await pkg.read(float).value as number;
        //             const nz1 = await pkg.read(BufferValue.allocBytes(3 * 4)).value as numbeDataViewr;
        //             const pz1 = await pkg.read(float).value as number;

        //             // const px1 = await pkg.read(float).value as number, nx1 = await pkg.read(BufferValue.allocBytes(3 * 4)).value as number;
        //             // const py1 = await pkg.read(float).value as number, ny1 = await pkg.read(BufferValue.allocBytes(3 * 4)).value as number;
        //             // const pz1 = await pkg.read(float).value as number, nz1 = await pkg.read(BufferValue.allocBytes(3 * 4)).value as number;

        //             const buff = new Float32Array(await pkg.read(BufferValue.allocBytes(4 * 64 * 2 - 4)).value.buffer);

        //             debugger;
        //         }

        //         // pkg.seek(3928502, "set");

        //         // // const v = await new FVector().load(pkg);
        //         // // const n = await new FVector().load(pkg);

        //         // pkg.seek(-4 * 12 - 3);
        //         // const buff = new Float32Array(await pkg.read(BufferValue.allocBytes(4 * 64 * 2 - 4)).value.buffer)

        //         // debugger;

        //         // const px = await pkg.read(float).value as number, nx = await pkg.read(BufferValue.allocBytes(3 * 4)).value as number;
        //         // const py = await pkg.read(float).value as number, ny = await pkg.read(BufferValue.allocBytes(3 * 4)).value as number;
        //         // const pz = await pkg.read(float).value as number, nz = await pkg.read(BufferValue.allocBytes(3 * 4)).value as number;

        //         // debugger;

        //         // 
        //         // const py = await pkg.read(float).value as number, ny = await pkg.read(int8).value as number;
        //         // const pz = await pkg.read(float).value as number, nz = await pkg.read(int8).value as number;

        //         const p = new Vector3(px, py, pz);
        //         const n = new Vector3(nx, ny, nz);

        //         if (sphere.containsPoint(p) /*&& v.vector.z > 500*/) {
        //             nextItems.push([pkg.tell(), ...p.toArray()]);

        //             this.vtest.push(p);
        //         }

        //         debugger;

        //         // const tag = await PropertyTag.from(pkg, pkg.tell());

        //         // if (
        //         //     true
        //         //     && tag.name !== "None"
        //         //     && tag.dataSize > 0
        //         //     && tag.type >= 0x1 && tag.type < 0xf
        //         //     && tag.arrayIndex >= 0
        //         //     && tag.structName !== "EnableCollision" && tag.structName !== "EnableCollisionforShadow" && tag.structName !== "Material" && tag.structName !== "Cm_dg_inner_deco5" && tag.structName !== "Cm_dg_statue3"
        //         //     && (tag.type !== UNP_PropertyTypes.UNP_StructProperty || tag.type === UNP_PropertyTypes.UNP_StructProperty && tag.structName)
        //         //     && (tag.type !== UNP_PropertyTypes.UNP_ArrayProperty || tag.type === UNP_PropertyTypes.UNP_ArrayProperty && tag.arrayIndex === 0 && tag.dataSize > 1)
        //         //     && (tag.type === UNP_PropertyTypes.UNP_ObjectProperty || tag.type === UNP_PropertyTypes.UNP_ArrayProperty /*|| tag.type === UNP_PropertyTypes.UNP_ClassProperty*/)
        //         //     && !tag.name.startsWith("Cm_") && !tag.name.startsWith("oren_") && !tag.name.startsWith("cm_") && !tag.name.startsWith("dion_")
        //         //     && (tag.dataSize < bytesLeft)
        //         //     && (tag.type !== UNP_PropertyTypes.UNP_ObjectProperty || tag.type === UNP_PropertyTypes.UNP_ObjectProperty && tag.dataSize <= 4)
        //         //     && tag.name !== "EnableCollisionforShadow" && tag.name !== "EnableCollision" && tag.name !== "bNoDynamicShadowCast"
        //         // ) {
        //         //     console.log(i, tag);

        //         //     nextItems.push(tag);
        //         // }

        //         // const index = await pkg.read(compat32).value as number;

        //         // const data = index < 0
        //         //     ? (pkg.imports[-index - 1] ? pkg.getPackageName(index) : "Bad Import")
        //         //     : index > 0
        //         //         ? (pkg.exports[index] ? pkg.getPackageName(pkg.exports[index].idClass.value as number) : "Bad Export")
        //         //         : null;

        //         // if (data !== null && index < 0 && !data.startsWith("Bad "))
        //         //     nextItems.push([data, index]);
        //     } catch (e) { }
        // }

        // pkg.seek(3928703 - 4 * 64, "set");

        // const buffer = new Float32Array(await pkg.read(BufferValue.allocBytes(4 * 64 * 2)).value.buffer);

        // console.log(buffer);

        // debugger;

        // console.log(nextItems);

        // debugger;

        // const bytesLeft = this.readTail - this.readHead;
        // const lines = Math.max(Math.ceil(bytesLeft / 16), 255);

        // // debugger;

        // pkg.dump(100);

        // const buffer = await pkg.read(BufferValue.allocBytes(bytesLeft));

        // debugger;

        // const unk = await pkg.read(compat32).value as number;

        // if (unk !== 0) debugger;

        // debugger;

        // await this.collisionFaces.load(pkg);
        // await this.collisionNodes.load(pkg);

        // debugger;

        // await this.readNamedProps(pkg);

        /*                                          // 000F 043C 0042 0200 0080 3F00 0000 0000 */
        /*                                          // 0000 0066 66A2 4300 0000 8000 0080 3F00 */
        /*                                          // 0000 0000 000C 4200 0000 0000 0000 0000 */
        /*                                          // 0080 BF75 6257 C300 0000 002E ED7C BF23 */
        /*                                          // 331E 3EE5 3C22 4200 0102 0300 0080 3F00 */
        /*                                          // 0000 8000 0000 0066 66A2 4300 0000 002E */
        /*                                          // ED7C 3F23 331E BEE4 3C22 C200 0000 8000 */
        /*                                          // 0080 BF00 0000 00FA EDEB 4000 0000 8000 */
        /*                                          // 0000 0000 0080 3F8A 2EF3 4300 0203 0300 */
        /*                                          // 0000 0000 0000 0000 0080 BF75 6257 C300 */
        /*                                          // 0000 0000 0080 3F00 0000 0000 000C 4200 */
        /*                                          // 0080 BF00 0000 8000 0000 8066 6622 C3FD */
        /*                                          // 4281 3E0B B577 BF00 0000 005F 8940 4204 */
        /*                                          // 0506 0200 0000 0000 0000 0000 0080 BF75 */
        /*                                          // 6257 C3FD 4281 BE0B B577 3F00 0000 005F */
        /*                                          // 8940 C200 0000 0000 0080 BF00 0000 00FA */
        /*                                          // EDEB 4000 0080 3F00 0000 8000 0000 0066 */
        /*                                          // 66A2 4304 0607 0229 684C BF00 0000 006E */
        /*                                          // 1F1A BFAC AB81 C300 0000 0000 0080 3F00 */
        /*                                          // 0000 0000 000C 426F 1F1A BF00 0000 0029 */
        this.readHead = pkg.tell();

        // debugger;

        // console.assert((this.readTail - pkg.tell()) === 0);
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

        await Promise.all(this.promisesLoading);

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

        // 229 228 224 222 223 224 225 222 224 228 225 224 228 226 225 226 227 225 201 202 203 204 201 203 204 203 205 204 205 206 207 208 209 207 209 210 211 207 210 212 211 210 213 212 210 190 191 192 190 192 193 194 190 193 230 231 232 233 230 232 234 233 232 235 234 232 235 232 236 235 236 237 214 215 216 217 214 216 218 217 216 218 216 219 218 219 220 221 218 220 195 196 197 195 197 198 199 195 198 199 198 200 16 17 18 16 18 19 36 37 38 36 38 39 60 61 62 60 62 63 72 73 74 72 74 75 92 93 94 92 94 95 112 113 114 112 114 115 120 121 122 120 122 123 128 129 130 128 130 131 144 145 146 144 146 147 152 153 154 152 154 155 174 175 176 174 176 177 186 187 188 186 188 189 4 5 6 4 6 7 28 29 30 28 30 31 44 45 46 44 46 47 52 53 54 52 54 55 80 81 82 80 82 83 96 97 98 96 98 99 104 105 106 104 106 107 136 137 138 136 138 139 166 167 168 166 168 169 8 9 10 8 10 11 161 164 165 161 165 162 160 161 162 160 162 163 12 13 14 12 14 15 20 21 22 20 22 23 24 25 26 24 26 27 32 33 34 32 34 35 40 41 42 40 42 43 48 49 50 48 50 51 56 57 58 56 58 59 64 65 66 64 66 67 68 69 70 68 70 71 76 77 78 76 78 79 84 85 86 84 86 87 88 89 90 88 90 91 100 101 102 100 102 103 108 109 110 108 110 111 116 117 118 116 118 119 124 125 126 124 126 127 132 133 134 132 134 135 140 141 142 140 142 143 148 149 150 148 150 151 156 157 158 156 158 159 170 171 172 170 172 173 178 179 180 178 180 181 182 183 184 182 184 185 0 1 2 0 2 3

        for (let i = 0; i < countFaces; i++) {
            if (this.indexStream.indices.array instanceof DataView)
                indices[i] = this.indexStream.indices.getElem(i);
            else
                indices[i] = this.indexStream.indices.getElem(i).value;
        }

        console.log(indices.join(" "));

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