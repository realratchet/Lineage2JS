import FConstructable from "../un-constructable";
import UPackage from "../un-package";
import { PropertyTag } from "../un-property";
import FArray from "../un-array";
import BufferValue from "../../buffer-value";

class FStaticMeshUVStream extends FConstructable {
    public static readonly typeSize = 24;
    public readonly data: FArray<FMeshUVFloat> = new FArray(FMeshUVFloat);
    public f10: number;
    public f1C: number;

    public async load(pkg: UPackage, tag: PropertyTag): Promise<this> {
        const i = new BufferValue(BufferValue.int32);

        await this.data.load(pkg, tag);
        
        this.f10 = pkg.read(i).value as number;
        this.f1C = pkg.read(i).value as number;

        return this;
    }
}

class FMeshUVFloat extends FConstructable {
    public static readonly typeSize = 8;

    public u: number;
    public v: number;

    public async load(pkg: UPackage, tag: PropertyTag): Promise<this> {
        const f = new BufferValue(BufferValue.float);

        this.u = pkg.read(f).value as number;
        this.v = pkg.read(f).value as number;

        return this;
    }

}

export default FStaticMeshUVStream;
export { FStaticMeshUVStream };