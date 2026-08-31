import { BufferValue, type APackage, type Constructable_T, type PropertyTag, FPrimitiveArrayLazy } from "@l2js/core";

class FMipmap implements Constructable_T {
    public readonly dataArray = new FPrimitiveArrayLazy(BufferValue.uint8);

    public sizeW: number;
    public sizeH: number;
    public bitsW: number;
    public bitsH: number;

    public load(pkg: APackage, tag: PropertyTag): this {
        this.dataArray.load(pkg, tag);

        this.sizeW = pkg.read("int32");
        this.sizeH = pkg.read("int32");
        this.bitsW = pkg.read("int8");
        this.bitsH = pkg.read("int8");

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
