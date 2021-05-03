import FConstructable from "./un-constructable";
import UPackage from "./un-package";
import { PropertyTag } from "./un-property";
import FArray from "./un-array";
import FNumber from "./un-number";
import BufferValue from "../buffer-value";

class FRawIndexBuffer extends FConstructable {
    public static readonly typeSize = 24;
    public readonly indices: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.uint16));
    public revision: number;

    public async load(pkg: UPackage, tag: PropertyTag): Promise<this> {
        await this.indices.load(pkg, tag);

        this.revision = pkg.read(new BufferValue(BufferValue.int32)).value as number;

        return this;
    }
}

export default FRawIndexBuffer;
export { FRawIndexBuffer };