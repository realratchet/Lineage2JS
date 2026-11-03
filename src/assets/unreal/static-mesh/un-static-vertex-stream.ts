import type { APackage, Constructable_T } from "@l2js/core";

export class FStaticMeshVertexStream implements Constructable_T {
    declare private data: DataView;
    declare private elementCount: number;
    declare private revision: number;

    public getElemCount() { return this.elementCount };

    public copyTo(positions: Float32Array, normals: Float32Array): void {
        for (let i = 0; i < this.elementCount; i++) {
            const off = i * 24, index = i * 3;

            positions[index] = this.data.getFloat32(off, true);
            positions[index + 1] = this.data.getFloat32(off + 4, true);
            positions[index + 2] = this.data.getFloat32(off + 8, true);
            normals[index] = this.data.getFloat32(off + 12, true);
            normals[index + 1] = this.data.getFloat32(off + 16, true);
            normals[index + 2] = this.data.getFloat32(off + 20, true);
        }
    }

    public getElem(index: number): [number, number, number, number, number, number] {
        const off = index * 24;

        return [
            this.data.getFloat32(off + 0, true),
            this.data.getFloat32(off + 4, true),
            this.data.getFloat32(off + 8, true),
            this.data.getFloat32(off + 12, true),
            this.data.getFloat32(off + 16, true),
            this.data.getFloat32(off + 20, true)
        ];
    }

    public load(pkg: APackage): this {
        const size = pkg.read("compat32");

        this.data = pkg.read(size * 24);
        /**
         * position[0].x, position[0].y, position[0].z, (float: 4 bytes x 3)
         * normal[0].x, position[0].y, position[0].z, (float: 4 bytes x 3)
         * ...
         * position[n].x, position[n].y, position[n].z,
         * normal[n].x, position[n].y, position[n].z
         */

        this.elementCount = size;

        this.revision = pkg.read("int32");

        return this;
    }
}

export default FStaticMeshVertexStream;
