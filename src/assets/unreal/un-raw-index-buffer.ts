import FConstructable from "./un-constructable";
import UPackage from "./un-package";
import { PropertyTag } from "./un-property";
import { FPrimitiveArray } from "./un-array";
import BufferValue from "../buffer-value";

class FRawIndexBuffer extends FConstructable {
    public static readonly typeSize = 24;
    public readonly indices: FPrimitiveArray<"uint16"> = new FPrimitiveArray(BufferValue.uint16);
    public revision: number;

    public load(pkg: UPackage, tag: PropertyTag): this {
        this.indices.load(pkg, tag);

        this.revision = pkg.read(new BufferValue(BufferValue.int32)).value as number;

        return this;
    }
}

export default FRawIndexBuffer;
export { FRawIndexBuffer };