import { BufferValue } from "@l2js/core";

class FStaticMeshTriangleSub implements C.IConstructable {
    declare public f0: number[];
    declare public f1: number[];
    declare public f2: number[];

    public load(pkg: C.APackage): this {
        this.f0 = new Array(2).fill(1).map(_ => pkg.read("float"));
        this.f1 = new Array(2).fill(1).map(_ => pkg.read("float"));
        this.f2 = new Array(2).fill(1).map(_ => pkg.read("float"));

        return this;
    }
}

class FStaticMeshTriangle implements C.IConstructable {
    declare private data: DataView;

    declare public unkSubs: FStaticMeshTriangleSub[]; // uvs?
    declare public unkBytes: number[];                // color [[r, g, b, a] x 3]

    declare public unkInt0: number;                  // material section I think
    declare public unkInt1: number;                  // always pow2, flags?

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

    public load(pkg: C.APackage): this {
        const verArchive = pkg.header.getArchiveFileVersion();

        if (verArchive < 0x6f) {
            console.warn("Not supported yet");
            debugger;
        } else {

            this.data = pkg.read(3 * 3 * 4).value;

            const count = pkg.read("uint32");

            this.unkSubs = new Array(count).fill(1).map(_ => new FStaticMeshTriangleSub().load(pkg));
            this.unkBytes = new Array(12).fill(1).map(_ => pkg.read("uint8"));

            if (verArchive < 0x70) {
                console.warn("Not supported yet");
                debugger;
            }

            this.unkInt0 = pkg.read("uint32");
            this.unkInt1 = pkg.read("uint32");
        }

        return this;
    }
}

export default FStaticMeshTriangle;
export { FStaticMeshTriangle };