import { BufferValue } from "@l2js/core";
import { FPrimitiveArray } from "@l2js/core/src/unreal/un-array";

class FRawIndexBuffer implements C.IConstructable {
    public readonly indices = new FPrimitiveArray(BufferValue.uint16);
    public revision: number;

    public load(pkg: C.APackage, tag?: C.PropertyTag): this {
        this.indices.load(pkg, tag);

        this.revision = pkg.read("int32");

        return this;
    }
}

export default FRawIndexBuffer;
export { FRawIndexBuffer };