import FConstructable from "./un-constructable";
import UPackage from "./un-package";
import BufferValue from "../buffer-value";

type PropertyTag = import("./un-property").PropertyTag;

class FUnknownStruct extends FConstructable {
    public readonly buffer: BufferValue<"buffer">;

    public constructor(elementSize: number) {
        super();

        this.buffer = BufferValue.allocBytes(elementSize);
    }

    public async load(pkg: UPackage, tag: PropertyTag): Promise<this> {
        pkg.read(this.buffer);

        return this;
    }

}

export default FUnknownStruct;
export { FUnknownStruct };