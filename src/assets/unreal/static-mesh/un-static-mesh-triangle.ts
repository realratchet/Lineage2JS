import type { APackage, Constructable_T } from "@l2js/core";
class FStaticMeshTriangleSub implements Constructable_T {
    declare public uv0: number[];
    declare public uv1: number[];
    declare public uv2: number[];

    public load(pkg: APackage): this {
        this.uv0 = new Array(2).fill(1).map(_ => pkg.read("float"));
        this.uv1 = new Array(2).fill(1).map(_ => pkg.read("float"));
        this.uv2 = new Array(2).fill(1).map(_ => pkg.read("float"));

        return this;
    }
}

class FStaticMeshTriangle implements Constructable_T {
    declare private data: DataView;

    declare public uvs: FStaticMeshTriangleSub[];
    declare public colors: number[];

    declare public materialIndex: number;
    declare public smoothingMask: number;

    public getVertices(): [[number, number, number], [number, number, number], [number, number, number]] {
        return [
            [
                this.data.getFloat32(0, true),
                this.data.getFloat32(4, true),
                this.data.getFloat32(8, true),
            ],
            [
                this.data.getFloat32(12, true),
                this.data.getFloat32(16, true),
                this.data.getFloat32(20, true),
            ],
            [
                this.data.getFloat32(24, true),
                this.data.getFloat32(28, true),
                this.data.getFloat32(32, true),
            ]
        ]
    }

    public load(pkg: APackage): this {
        const verArchive = pkg.header.getArchiveFileVersion();

        if (verArchive < 0x6f) {
            console.warn("Not supported yet");
            debugger;
        } else {

            this.data = pkg.read(3 * 3 * 4);

            const count = pkg.read("uint32");

            this.uvs = new Array(count).fill(1).map(_ => new FStaticMeshTriangleSub().load(pkg));
            this.colors = new Array(12).fill(1).map(_ => pkg.read("uint8"));

            if (verArchive < 0x70) {
                console.warn("Not supported yet");
                debugger;
            }

            this.materialIndex = pkg.read("uint32");
            this.smoothingMask = pkg.read("uint32");
        }

        return this;
    }
}

export default FStaticMeshTriangle;
export { FStaticMeshTriangle };
