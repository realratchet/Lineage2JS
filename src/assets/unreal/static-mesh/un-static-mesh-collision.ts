import FConstructable from "../un-constructable";
import BufferValue from "../../buffer-value";

class FStaticMeshCollisionNode extends FConstructable {
    public static readonly typeSize: number = 4 * 4 + 4 * 6 + 1;

    public f1: number[];
    public f2: number[];
    public f3: number;

    public load(pkg: UPackage): this {
        const compat32 = new BufferValue(BufferValue.compat32);
        const float = new BufferValue(BufferValue.float);
        const int8 = new BufferValue(BufferValue.int8);

        this.f1 = new Array(4).fill(1).map(_ => pkg.read(compat32).value as number);
        this.f2 = new Array(6).fill(1).map(_ => pkg.read(float).value as number);
        this.f3 = pkg.read(int8).value as number;

        return this;
    }
}

class FStaticMeshCollisionTriangle extends FConstructable {
    public static readonly typeSize: number = 4 * 16 + 2 * 4;

    public f1: number[];
    public f2: number[];

    public load(pkg: UPackage): this {
        const compat32 = new BufferValue(BufferValue.compat32);
        const float = new BufferValue(BufferValue.float);

        this.f1 = new Array(16).fill(1).map(_ => pkg.read(float).value as number);
        this.f2 = new Array(4).fill(1).map(_ => pkg.read(compat32).value as number);

        return this;
    }
}

export { FStaticMeshCollisionNode, FStaticMeshCollisionTriangle };