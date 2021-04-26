import { FConstructable } from "./un-constructable";
import { FArrayLazy } from "./un-array";
import UPackage from "./un-package";
import BufferValue from "../buffer-value";

class FNumber<T extends ValueTypeNames_T = ValueTypeNames_T> extends FConstructable {
    public static readonly typeSize: number = 1;

    protected readonly type: ValidTypes_T<T>;
    public value: number;

    constructor(dtype: ValidTypes_T<T>) {
        super();
        this.type = dtype;
    }

    public async load(pkg: UPackage): Promise<this> {
        this.value = pkg.read(new BufferValue(this.type)).value as number;

        return this;
    }

    public static forType<T extends ValueTypeNames_T = ValueTypeNames_T>(dtype: ValidTypes_T<T>): FNumber<T> {
        return class FNumberExt extends FNumber<T> {
            constructor() { super(dtype); }
        } as unknown as FNumber<T>;
    }
}

class FMipmap extends FConstructable {
    public static readonly typeSize: number = FArrayLazy.typeSize + 16;

    public dataArray: FArrayLazy<FNumber> = new FArrayLazy(FNumber.forType(BufferValue.int8) as any);
    public sizeW: number;
    public sizeH: number;
    public bitsW: number;
    public bitsH: number;

    public async load(pkg: UPackage): Promise<this> {
        await this.dataArray.load(pkg);

        const int32 = new BufferValue(BufferValue.int32);
        const int8 = new BufferValue(BufferValue.int8);

        this.sizeW = pkg.read(int32).value as number;
        this.sizeH = pkg.read(int32).value as number;
        this.bitsW = pkg.read(int8).value as number;
        this.bitsH = pkg.read(int8).value as number;

        return this;
    }
}

export default FMipmap;
export { FMipmap, FNumber };