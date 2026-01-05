import { BufferValue } from "@l2js/core";

const int32 = new BufferValue(BufferValue.int32);
const compat = new BufferValue(BufferValue.compat32);

class FRawColorStream implements C.IConstructable {
    declare private elementCount: number;
    declare private data: DataView;
    declare private revision: number;

    public getColor(index: number): [number, number, number, number] {
        const off = index << 2;

        return [
            this.data.getUint8(off),
            this.data.getUint8(off + 1),
            this.data.getUint8(off + 2),
            this.data.getUint8(off + 3)
        ];
    }

    public getElemCount() { return this.elementCount };

    public load(pkg: C.APackage): this {
        this.elementCount = pkg.read(compat).value as number;
        this.data = pkg.read(this.elementCount * 4).value;

        this.revision = pkg.read(int32).value;

        return this;
    }

}

export default FRawColorStream;
export { FRawColorStream };