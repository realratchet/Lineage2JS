import { type APackage, type UExport, BufferValue, FString } from "@l2js/core";
import UObject from "./un-object";

abstract class UTextBuffer extends UObject {
    declare public pos: number;
    declare public top: number;
    declare public string: FString;

    public doLoad(pkg: APackage, exp: UExport): this {
        super.doLoad(pkg, exp);

        this.pos = pkg.read("uint32");
        this.top = pkg.read("uint32");

        this.string = new FString().load(pkg);

        this.readHead = pkg.tell();

        return this;
    }

    public get text() { return this.string.value; }
}

export default UTextBuffer;
export { UTextBuffer };
