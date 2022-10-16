import UObject from "./un-object";
import FString from "./un-string";
import BufferValue from "../buffer-value";

class UTextBuffer extends UObject {
    public pos: number;
    public top: number;
    public string = new FString();

    public doLoad(pkg: UPackage, exp: UExport): this {
        const uint32 = new BufferValue(BufferValue.uint32);

        super.doLoad(pkg, exp);

        this.pos = pkg.read(uint32).value as number;
        this.top = pkg.read(uint32).value as number;

        this.string.load(pkg);

        this.readHead = pkg.tell();

        return this;
    }

    public get text() { return this.string.value; }
}

export default UTextBuffer;
export { UTextBuffer };