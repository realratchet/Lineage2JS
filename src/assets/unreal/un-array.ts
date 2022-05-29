import BufferValue from "../buffer-value";

type UPackage = import("./un-package").UPackage;
type PropertyTag = import("./un-property").PropertyTag;
type FConstructable = import("./un-constructable").FConstructable;

class FArray<T extends FConstructable = FConstructable> extends Array implements IConstructable {
    public static readonly typeSize: number = 16;

    protected Constructor: { new(...pars: any): T } & ValidConstructables_T<T>;

    public getElemCount() { return this.length; }
    public getElem(idx: number): T { return this[idx]; }

    public constructor(constr: { new(...pars: any): T } & ValidConstructables_T<T>) {
        super();

        this.Constructor = constr;
    }

    public map<T>(fnMap: (value: any, index: number, array: any[]) => T): T[] { return [...this].map(fnMap); }

    public load(pkg: UPackage, tag?: PropertyTag): this {
        const hasTag = tag !== null && tag !== undefined;
        const beginIndex = hasTag ? pkg.tell() : null;
        const count = pkg.read(new BufferValue(BufferValue.compat32)).value as number;
        const headerOffset = hasTag ? pkg.tell() - beginIndex : null;
        const dataSize = hasTag ? tag.dataSize - headerOffset : null;

        if (count < 0)
            debugger;

        this.length = count;

        if (count === 0) return this;

        const elementSize = hasTag ? dataSize / this.length : null;

        for (let i = 0, len = this.length; i < len; i++) {
            this[i] = new this.Constructor(elementSize).load(pkg, tag);
        }

        if (hasTag) console.assert((pkg.tell() - beginIndex - tag.dataSize) === 0);

        return this;
    }
}

class FArrayLazy<T extends FConstructable = FConstructable> extends FArray<T> {
    public unkLazyInt: number;


    public load(pkg: UPackage, tag: PropertyTag): this {
        this.unkLazyInt = pkg.read(new BufferValue(BufferValue.int32)).value as number;

        super.load(pkg, tag);

        return this;
    }
}

class FPrimitiveArray<T extends ValueTypeNames_T = ValueTypeNames_T> implements IConstructable {
    public static readonly typeSize: number = 16;
    protected Constructor: ValidTypes_T<T>;

    public getElemCount() { return this.array.byteLength / this.Constructor.bytes; }
    public getElem(idx: number): number {
        let funName: string = null;

        switch (this.Constructor.name) {
            case "int64": funName = "getBigInt64"; break;
            case "uint64": funName = "getBigUint64"; break;
            case "compat32":
            case "int32":
                funName = "getInt32";
                break;
            case "float": funName = "getFloat32"; break;
            case "uint32": funName = "getUint32"; break;
            case "int8": funName = "getInt8"; break;
            case "uint8": funName = "getUint8"; break;
            case "int16": funName = "getInt16"; break;
            case "uint16": funName = "getUint16"; break;
            default: throw new Error(`Unknown type: ${this.Constructor.name}`);
        }

        return (this.array as any)[funName](idx * this.Constructor.bytes, true);

    }

    protected array: DataView;
    public constructor(constr: ValidTypes_T<T>) { this.Constructor = constr; }

    public map<T>(fnMap: (value: any, index: number, array: any[]) => T): T[] { return [...this].map(fnMap); }

    public load(pkg: UPackage, tag?: PropertyTag): this {
        const hasTag = tag !== null && tag !== undefined;
        const beginIndex = hasTag ? pkg.tell() : null;
        const count = pkg.read(new BufferValue(BufferValue.compat32));
        const elementCount = count.value as number;

        if (elementCount === 0) {
            this.array = new DataView(new ArrayBuffer(0));
            return this;
        }

        const byteLength = elementCount * this.Constructor.bytes;

        this.array = pkg.readPrimitive(pkg.tell(), byteLength);

        pkg.seek(byteLength);

        if (hasTag) console.assert((pkg.tell() - beginIndex - tag.dataSize) === 0);

        return this;
    }

    getTypedArray() {
        try {
            return new this.Constructor.dtype(this.array.buffer, this.array.byteOffset, this.getElemCount());
        } catch (e) {
            if (e.message.includes("should be a multiple of"))
                return new this.Constructor.dtype(this.array.buffer.slice(this.array.byteOffset, this.array.byteOffset + this.getByteLength()));

            throw e;
        }
    }
    getByteLength() { return this.array.byteLength; }
}

class FPrimitiveArrayLazy<T extends ValueTypeNames_T = ValueTypeNames_T> extends FPrimitiveArray<T> {
    public unkLazyInt: number;

    public load(pkg: UPackage, tag: PropertyTag): this {
        this.unkLazyInt = pkg.read(new BufferValue(BufferValue.uint32)).value as number;

        super.load(pkg, tag);

        return this;
    }
}



export default FArray;
export { FArray, FArrayLazy, FPrimitiveArray, FPrimitiveArrayLazy };