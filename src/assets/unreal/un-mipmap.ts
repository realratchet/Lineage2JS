import FConstructable from "./un-constructable";
import BufferValue from "../buffer-value";
import FNumber from "./un-number";
import { FArrayLazy } from "./un-array";

type UPackage = import("./un-package").UPackage;
type PropertyTag = import("./un-property").PropertyTag;

class FMipmap extends FConstructable {
    public static readonly typeSize: number = FArrayLazy.typeSize + 16;

    protected dataArray: FArrayLazy<FNumber> = new FArrayLazy(FNumber.forType(BufferValue.uint8) as any);
    public sizeW: number;
    public sizeH: number;
    public bitsW: number;
    public bitsH: number;

    public async load(pkg: UPackage, tag: PropertyTag): Promise<this> {
        await this.dataArray.load(pkg, tag);

        const int32 = new BufferValue(BufferValue.int32);
        const int8 = new BufferValue(BufferValue.int8);

        this.sizeW = pkg.read(int32).value as number;
        this.sizeH = pkg.read(int32).value as number;
        this.bitsW = pkg.read(int8).value as number;
        this.bitsH = pkg.read(int8).value as number;

        return this;
    }

    public getByteLength() { return this.dataArray.length; }

    public getImageBuffer(elements: Uint8Array, offset: number): Uint8Array {
        const elCount = this.dataArray.getElemCount();

        for (let i = 0; i < elCount; i++)
            elements[offset + i] = this.dataArray.getElem(i).value;

        return elements;
    }
}

export default FMipmap;
export { FMipmap, FNumber };