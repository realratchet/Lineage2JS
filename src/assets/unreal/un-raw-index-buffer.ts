import { BufferValue } from "@l2js/core";
import { FPrimitiveArray } from "@l2js/core/src/unreal/un-array";

class FRawIndexBuffer implements C.IConstructable {
    public readonly indices = new FPrimitiveArray(BufferValue.uint16);
    public revision: number;

    public load(pkg: GA.UPackage, tag?: C.PropertyTag): this {
        this.indices.load(pkg, tag);

        this.revision = pkg.read(new BufferValue(BufferValue.int32)).value;

        return this;
    }
}

export default FRawIndexBuffer;
export { FRawIndexBuffer };