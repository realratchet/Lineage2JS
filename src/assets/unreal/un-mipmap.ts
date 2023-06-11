import { BufferValue } from "@l2js/core";
import { FPrimitiveArrayLazy } from "@l2js/core/src/unreal/un-array";

class FMipmap implements C.IConstructable {
    protected dataArray = new FPrimitiveArrayLazy(BufferValue.uint8);

    public sizeW: number;
    public sizeH: number;
    public bitsW: number;
    public bitsH: number;

    public load(pkg: C.APackage, tag: C.PropertyTag): this {
        this.dataArray.load(pkg, tag);

        const int32 = new BufferValue(BufferValue.int32);
        const int8 = new BufferValue(BufferValue.int8);

        this.sizeW = pkg.read(int32).value as number;
        this.sizeH = pkg.read(int32).value as number;
        this.bitsW = pkg.read(int8).value as number;
        this.bitsH = pkg.read(int8).value as number;

        return this;
    }

    public getByteLength() { return this.dataArray.getByteLength(); }

    public getImageBuffer(elements: Uint8Array, offset: number): Uint8Array {
        elements.set(this.dataArray.getTypedArray() as Uint8Array, offset);

        return elements;
    }
}

export default FMipmap;
export { FMipmap };