import FColor from "./un-color";
import FConstructable from "./un-constructable";
import UPackage from "./un-package";
import { PropertyTag } from "./un-property";
import BufferValue from "../buffer-value";

class FString extends FConstructable {
    public static readonly typeSize: number = 1;
    public value: string;

    public async load(pkg: UPackage, tag?: PropertyTag): Promise<this> {

        const bufLen = await pkg.read(new BufferValue(BufferValue.compat32)).value as number;
        const buf = await pkg.read(BufferValue.allocBytes(bufLen)).value as DataView;

        this.value = new TextDecoder("ascii").decode(buf.buffer.slice(0, -1));

        return this;
    }
}

export default FString;
export { FString };