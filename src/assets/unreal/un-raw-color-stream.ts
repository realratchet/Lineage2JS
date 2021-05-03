import FConstructable from "./un-constructable";
import UPackage from "./un-package";
import { PropertyTag } from "./un-property";
import FArray from "./un-array";
import FColor from "./un-color";
import BufferValue from "../buffer-value";

class FRawColorStream extends FConstructable {
    public color: FArray<FColor> = new FArray(FColor);
    public revision: number;

    public async load(pkg: UPackage, tag: PropertyTag): Promise<this> {
        await this.color.load(pkg, tag);
        
        this.revision = pkg.read(new BufferValue(BufferValue.int32)).value as number;
        
        return this;
    }

}

export default FRawColorStream;
export { FRawColorStream };