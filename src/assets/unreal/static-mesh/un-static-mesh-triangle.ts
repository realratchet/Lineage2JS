import FVector from "../un-vector";
import { BufferValue } from "@l2js/core";

class FStaticMeshTriangleSub implements C.IConstructable {
    declare public f0: number[];
    declare public f1: number[];
    declare public f2: number[];

    public load(pkg: GA.UPackage): this {

        const float = new BufferValue(BufferValue.float);

        this.f0 = new Array(2).fill(1).map(_ => pkg.read(float).value as number);
        this.f1 = new Array(2).fill(1).map(_ => pkg.read(float).value as number);
        this.f2 = new Array(2).fill(1).map(_ => pkg.read(float).value as number);

        return this;
    }
}

class FStaticMeshTriangle implements C.IConstructable {
    declare public v0: FVector;
    declare public v1: FVector;
    declare public v2: FVector;

    declare public unkSubs: FStaticMeshTriangleSub[]; // uvs?
    declare public unkBytes: number[];                // color [[r, g, b, a] x 3]

    declare public unkInt0: number;                  // material section I think
    declare public unkInt1: number;                  // always pow2, flags?

    public load(pkg: GA.UPackage): this {
        const verArchive = pkg.header.getArchiveFileVersion();
        const uint32 = new BufferValue(BufferValue.uint32);
        const uint8 = new BufferValue(BufferValue.uint8);

        this.v0 = FVector.make();
        this.v1 = FVector.make();
        this.v2 = FVector.make();

        if (verArchive < 0x6f) {
            console.warn("Not supported yet");
            debugger;
        } else {

            this.v0.load(pkg);
            this.v1.load(pkg);
            this.v2.load(pkg);

            const count = pkg.read(uint32).value as number;

            this.unkSubs = new Array(count).fill(1).map(_ => new FStaticMeshTriangleSub().load(pkg));
            this.unkBytes = new Array(12).fill(1).map(_ => pkg.read(uint8).value as number);

            if (verArchive < 0x70) {
                console.warn("Not supported yet");
                debugger;
            }

            this.unkInt0 = pkg.read(uint32).value as number;
            this.unkInt1 = pkg.read(uint32).value as number;
        }

        return this;
    }
}

export default FStaticMeshTriangle;
export { FStaticMeshTriangle };