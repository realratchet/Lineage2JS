import UObject from "@l2js/core";
import { BufferValue } from "@l2js/core";
import FString from "@l2js/core/unreal/un-string";

const uint32 = new BufferValue(BufferValue.uint32);

abstract class UTextBuffer extends UObject {
    declare public pos: number;
    declare public top: number;
    declare public string: FString;

    public doLoad(pkg: C.APackage, exp: C.UExport): this {
        super.doLoad(pkg, exp);

        this.pos = pkg.read(uint32).value;
        this.top = pkg.read(uint32).value;

        this.string = new FString().load(pkg);

        this.readHead = pkg.tell();

        return this;
    }

    public get text() { return this.string.value; }
}

export default UTextBuffer;
export { UTextBuffer };