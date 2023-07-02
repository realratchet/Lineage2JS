import { BufferValue } from "@l2js/core";
import FArray from "@l2js/core/src/unreal/un-array";

class FStaticMeshUVStream implements C.IConstructable {
    declare public data: FArray<FMeshUVFloat>;

    declare public f10: number;
    declare public f1C: number;

    public load(pkg: GA.UPackage): this {
        const i = new BufferValue(BufferValue.int32);

        this.data = new FArray(FMeshUVFloat);
        this.data.load(pkg);

        this.f10 = pkg.read(i).value as number;
        this.f1C = pkg.read(i).value as number;

        return this;
    }
}

class FMeshUVFloat implements C.IConstructable {
    declare public u: number;
    declare public v: number;

    public load(pkg: GA.UPackage): this {
        const f = new BufferValue(BufferValue.float);

        this.u = pkg.read(f).value as number;
        this.v = pkg.read(f).value as number;

        return this;
    }
}

export default FStaticMeshUVStream;
export { FStaticMeshUVStream };