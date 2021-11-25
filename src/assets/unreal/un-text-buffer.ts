import UObject from "./un-object";
import BufferValue from "../buffer-value";
import FString from "./un-string";

class UTextBuffer extends UObject {
    public pos: number;
    public top: number;
    public text: string;

    public async load(pkg: UPackage, exp: UExport): Promise<this> {
        const uint32 = new BufferValue(BufferValue.uint32);

        super.load(pkg, exp);

        this.pos = await pkg.read(uint32).value as number;
        this.top = await pkg.read(uint32).value as number;

        this.text = (await new FString().load(pkg)).value;

        return this;
    }
}

export default UTextBuffer;
export { UTextBuffer };