import { BufferValue } from "@l2js/core";
import FConstructable from "./un-constructable";


class FUnknownStruct extends FConstructable {
    public readonly buffer: BufferValue<"buffer">;

    public constructor(elementSize: number = null) {
        super();

        this.buffer = elementSize ? BufferValue.allocBytes(elementSize) : null;
    }

    public load(pkg: UPackage): this {

        if (this.buffer)
            throw new Error("Buffer not defined");

        pkg.read(this.buffer);

        return this;
    }

}

export default FUnknownStruct;
export { FUnknownStruct };