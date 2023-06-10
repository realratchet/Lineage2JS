import FArray from "../un-array";
import { BufferValue } from "@l2js/core";
import FConstructable from "../un-constructable";

class FStaticMeshUVStream extends FConstructable {
    public readonly data: FArray<FMeshUVFloat> = new FArray(FMeshUVFloat as any);

    public f10: number;
    public f1C: number;

    public load(pkg: UPackage): this {
        const i = new BufferValue(BufferValue.int32);

        this.data.load(pkg);

        this.f10 = pkg.read(i).value as number;
        this.f1C = pkg.read(i).value as number;

        return this;
    }
}

class FMeshUVFloat extends FConstructable {
    public u: number;
    public v: number;

    public load(pkg: UPackage): this {
        const f = new BufferValue(BufferValue.float);

        this.u = pkg.read(f).value as number;
        this.v = pkg.read(f).value as number;

        return this;
    }
}

export default FStaticMeshUVStream;
export { FStaticMeshUVStream };