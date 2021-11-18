import BufferValue from "../buffer-value";
import FConstructable from "./un-constructable";
import FUnknownStruct from "./un-unknown-struct";
import UObject from "./un-object";

type UPackage = import("./un-package").UPackage;
type PropertyTag = import("./un-property").PropertyTag;
// type FConstructable = import("./un-contructable").FConstructable;

class FArray<T extends FConstructable = FConstructable> extends Array implements IConstructable {
    public static readonly typeSize: number = 16;

    protected Constructor: { new(...pars: any): T } & ValidConstructables_T<T>;

    public getElemCount() { return this.length; }
    public getElem(idx: number) { return this[idx]; }

    public constructor(constr: { new(...pars: any): T } & ValidConstructables_T<T>) {
        super();

        if (!isFinite((constr as any).typeSize) && constr !== FUnknownStruct)
            throw new Error(`Invalid fields for FConstructable: ${constr.name}`);

        this.Constructor = constr;
    }

    public async load(pkg: UPackage, tag?: PropertyTag): Promise<this> {
        const hasTag = tag !== null && tag !== undefined;
        const beginIndex = hasTag ? pkg.tell() : null;
        const count = pkg.read(new BufferValue(BufferValue.compat32));
        const headerOffset = hasTag ? pkg.tell() - beginIndex : null;
        const dataSize = hasTag ? tag.dataSize - headerOffset : null;

        this.length = count.value as number;

        if (count.value as number === 0) return this;

        const elementSize = hasTag ? dataSize / this.length : null;

        for (let i = 0, len = this.length; i < len; i++) {
            this[i] = await new this.Constructor(elementSize).load(pkg, tag);
        }

        if (hasTag) console.assert((pkg.tell() - beginIndex - tag.dataSize) === 0);

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