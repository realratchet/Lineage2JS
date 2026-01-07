

import { BufferValue } from "@l2js/core";

const compat32 = new BufferValue(BufferValue.compat32);

class FString implements C.IConstructable {
    public value: string;

    public load(pkg: C.APackage, tag?: C.PropertyTag): this {

        const bufLen = pkg.read(compat32).value as number;
        const buf = pkg.read(bufLen).getBytes();

        this.value = new TextDecoder("ascii").decode(buf.slice(0, -1));

        return this;
    }
}

export default FString;
export { FString };