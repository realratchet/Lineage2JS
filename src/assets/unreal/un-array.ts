import BufferValue from "../buffer-value";
import FConstructable from "./un-constructable";
import FUnknownStruct from "./un-unknown-struct";

type UPackage = import("./un-package").UPackage;
type PropertyTag = import("./un-property").PropertyTag;
// type FConstructable = import("./un-contructable").FConstructable;

class FArray<T extends FConstructable = FConstructable> extends FConstructable {
    public static readonly typeSize: number = 16;

    protected list: T[];
    protected elemCount: number;
    protected Constructor: { new(...pars: any): T } & ValidConstructables_T<T>;

    public getElemCount() { return this.elemCount; }
    public getElem(idx: number) { return this.list[idx]; }

    public constructor(constr: { new(...pars: any): T } & ValidConstructables_T<T>) {
        super();

        if (!isFinite((constr as any).typeSize) && constr !== FUnknownStruct)
            throw new Error(`Invalid fields for FConstructable: ${constr.name}`);

        this.Constructor = constr;
    }

    public async load(pkg: UPackage, tag: PropertyTag): Promise<this> {
        const beginIndex = tag !== null ? pkg.tell() : null;
        const count = pkg.read(new BufferValue(BufferValue.compat32));
        const headerOffset = tag !== null ? pkg.tell() - beginIndex : null;
        const dataSize = tag !== null ? tag.dataSize - headerOffset : null;

        this.elemCount = count.value as number;
        this.list = new Array(count.value as number);

        if (count.value as number === 0) return this;

        if (tag !== null) console.assert(dataSize % this.elemCount === 0);

        const elementSize = tag !== null ? dataSize / this.elemCount : null;

        for (let i = 0, len = this.elemCount; i < len; i++) {
            this.list[i] = await new this.Constructor(elementSize).load(pkg, tag);
        }

        return this;
    }
}

class FArrayLazy<T extends FConstructable = FConstructable> extends FArray<T> {
    public async load(pkg: UPackage, tag: PropertyTag): Promise<this> {

        pkg.read(new BufferValue(BufferValue.int32)); // skip unknown

        await super.load(pkg, tag);

        return this;
    }
}

export default FArray;
export { FArray, FArrayLazy };