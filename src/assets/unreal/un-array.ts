import BufferValue from "../buffer-value";
import FUnknownStruct from "./un-unknown-struct";

type UPackage = import("./un-package").UPackage;
type PropertyTag = import("./un-property").PropertyTag;
type FConstructable = import("./un-constructable").FConstructable;

class FArray<T extends FConstructable = FConstructable> extends Array implements IConstructable {
    public static readonly typeSize: number = 16;

    protected Constructor: { new(...pars: any): T } & ValidConstructables_T<T>;

    public getElemCount() { return this.length; }
    public getElem(idx: number) { return this[idx]; }

    public constructor(constr: { new(...pars: any): T } & ValidConstructables_T<T>) {
        super();

        if (constr && !isFinite((constr as any).typeSize) && constr !== FUnknownStruct)
            throw new Error(`Invalid fields for FConstructable: ${constr.name}`);

        this.Constructor = constr;
    }

    public map<T>(fnMap: (value: any, index: number, array: any[]) => T): T[] { return [...this].map(fnMap); }

    public load(pkg: UPackage, tag?: PropertyTag): this {
        const hasTag = tag !== null && tag !== undefined;
        const beginIndex = hasTag ? pkg.tell() : null;
        const count = pkg.read(new BufferValue(BufferValue.compat32));
        const headerOffset = hasTag ? pkg.tell() - beginIndex : null;
        const dataSize = hasTag ? tag.dataSize - headerOffset : null;

        // debugger;

        this.length = count.value as number;

        debugger;

        if (count.value as number === 0) return this;

        const elementSize = hasTag ? dataSize / this.length : null;

        // let startOffset = pkg.tell();

        // if (tag?.name === "Materials") {
        //     const data = await pkg.read(BufferValue.allocBytes(52)).value as DataView;

        //     console.log(data);
        //     pkg.seek(-52);

        //     debugger;
        // }

        for (let i = 0, len = this.length; i < len; i++) {
            // if (tag?.name === "Materials") {
            //     let finalOffset = pkg.tell() - startOffset;

            //     console.log(finalOffset);
            //     pkg.dump(2);
            // }
            this[i] = new this.Constructor(elementSize).load(pkg, tag);
        }

        // if (tag?.name === "Materials") {
        //     let finalOffset = pkg.tell() - startOffset;

        //     console.log(finalOffset);
        //     debugger;
        // }

        if (hasTag) console.assert((pkg.tell() - beginIndex - tag.dataSize) === 0);

        return this;
    }
}

class FArrayLazy<T extends FConstructable = FConstructable> extends FArray<T> {
    public ITextureDecodeInfoload(pkg: UPackage, tag: PropertyTag): this {
        const unkData = pkg.read(BufferValue.allocBytes(4)).value as DataView; // skip unknown

        // debugger;

        super.load(pkg, tag);

        return this;
    }
}

export default FArray;
export { FArray, FArrayLazy };