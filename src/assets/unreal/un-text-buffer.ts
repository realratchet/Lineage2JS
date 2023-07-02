import UObject from "@l2js/core";
import FString from "./un-string";
import { BufferValue } from "@l2js/core";

abstract class UTextBuffer extends UObject {
    public pos: number;
    public top: number;
    public string = new FString();

    public doLoad(pkg: GA.UPackage, exp: C.UExport): this {
        const uint32 = new BufferValue(BufferValue.uint32);

        super.doLoad(pkg, exp);

        this.pos = pkg.read(uint32).value;
        this.top = pkg.read(uint32).value;

        this.string.load(pkg);

        this.readHead = pkg.tell();

        return this;
    }

    public get text() { return this.string.value; }
}

export default UTextBuffer;
export { UTextBuffer };