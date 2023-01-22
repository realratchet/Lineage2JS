import FConstructable from "./un-constructable";
import BufferValue from "../buffer-value";
import FNumber from "./un-number";
import { FPrimitiveArrayLazy } from "./un-array";

type UPackage = import("./un-package").UPackage;
type PropertyTag = import("./un-property-tag").PropertyTag;

class FMipmap extends FConstructable {
    protected dataArray: FPrimitiveArrayLazy<"uint8"> = new FPrimitiveArrayLazy(BufferValue.uint8);

    public sizeW: number;
    public sizeH: number;
    public bitsW: number;
    public bitsH: number;

    public load(pkg: UPackage, tag: PropertyTag): this {
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
export { FMipmap, FNumber };