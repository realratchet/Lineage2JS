import FConstructable from "./un-constructable";
import UPackage from "./un-package";
import { PropertyTag } from "./un-property-tag";
import { BufferValue } from "@l2js/core";

class FString extends FConstructable {
    public value: string;

    public load(pkg: UPackage, tag?: PropertyTag): this {

        const bufLen = pkg.read(new BufferValue(BufferValue.compat32)).value as number;
        const buf = pkg.read(BufferValue.allocBytes(bufLen)).value as DataView;

        this.value = new TextDecoder("ascii").decode(buf.buffer.slice(0, -1));

        return this;
    }
}

export default FString;
export { FString };