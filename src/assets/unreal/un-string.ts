import FConstructable from "./un-constructable";

import { BufferValue } from "@l2js/core";

class FString extends FConstructable {
    public value: string;

    public load(pkg: C.APackage, tag?: C.PropertyTag): this {

        const bufLen = pkg.read(new BufferValue(BufferValue.compat32)).value as number;
        const buf = pkg.read(BufferValue.allocBytes(bufLen)).value as DataView;

        this.value = new TextDecoder("ascii").decode(buf.buffer.slice(0, -1));

        return this;
    }
}

export default FString;
export { FString };