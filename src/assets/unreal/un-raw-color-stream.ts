import FConstructable from "./un-constructable";
import FArray from "./un-array";
import FColor from "./un-color";
import { BufferValue } from "@l2js/core";

class FRawColorStream extends FConstructable {
    public color: FArray<FColor> = new FArray(FColor);
    public revision: number;

    public load(pkg: UPackage, tag?: PropertyTag): this {
        this.color.load(pkg, tag);
        this.revision = pkg.read(new BufferValue(BufferValue.int32)).value as number;
        
        return this;
    }

}

export default FRawColorStream;
export { FRawColorStream };