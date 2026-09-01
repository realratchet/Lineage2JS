import { type APackage, type UExport, FString } from "@l2js/core";
import UObject from "./un-object";

export abstract class UTextBuffer extends UObject {
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
