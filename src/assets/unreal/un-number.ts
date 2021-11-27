import BufferValue from "../buffer-value";
import FConstructable from "./un-constructable";

type UPackage = import("./un-package").UPackage;
type PropertyTag = import("./un-property").PropertyTag;

class FNumber<T extends ValueTypeNames_T = ValueTypeNames_T> extends FConstructable {
    protected readonly type: ValidTypes_T<T>;
    public value: number;

    constructor(dtype: ValidTypes_T<T>) {
        super();
        this.type = dtype;
    }

    public load(pkg: UPackage, tag: PropertyTag): this {
        this.value = pkg.read(new BufferValue(this.type)).value as number;

        return this;
    }

    public static forType<T extends ValueTypeNames_T = ValueTypeNames_T>(dtype: ValidTypes_T<T>): new (...params: any) => FNumber<T> {
        class FNumberExt extends FNumber<T> {
            public static readonly typeSize: number = dtype.bytes;
            constructor() { super(dtype); }
        }

        return FNumberExt;
    }
}

export default FNumber;
export { FNumber };