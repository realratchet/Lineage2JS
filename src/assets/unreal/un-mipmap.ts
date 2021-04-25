import { FConstructable } from "./un-constructable";
import { FArrayLazy } from "./un-array";
import UPackage from "./un-package";

type BufferValue<T extends ValueTypeNames_T = ValueTypeNames_T> = import("../buffer-value").BufferValue<T>;

class FNumber extends FConstructable {
    public static readonly typeSize: number = 1;

    public async load(pkg: UPackage): Promise<this> {
        debugger;

        return this;
    }
}

class FMipmap extends FConstructable {
    public static readonly typeSize: number = FArrayLazy.typeSize + 16;

    public dataArray: FArrayLazy<FNumber> = new FArrayLazy(FNumber);
    public sizeW: number;
    public sizeH: number;
    public bitsW: number;
    public bitsH: number;

    public async load(pkg: UPackage): Promise<this> {
        await this.dataArray.load(pkg);
        
        debugger;

        return this;
    }
}

export default FMipmap;
export { FMipmap, FNumber };