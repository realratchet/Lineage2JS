import BufferValue from "../buffer-value";
import UExport from "./un-export";
import FNumber from "./un-number";



class FArray<T extends FConstructable = FConstructable> extends Array implements IConstructable {
    protected Constructor: { new(...pars: any): T } & ValidConstructables_T<T>;

    public getElemCount() { return this.length; }
    public getElem(idx: number): T { return this[idx]; }

    public constructor(constr: { new(...pars: any): T } & ValidConstructables_T<T>) {
        super();

        this.Constructor = constr;
    }

    public map<T2>(fnMap: (value: T, index: number, array: T[]) => T2): T2[] { return [...this].map(fnMap); }

    public load(pkg: UPackage, tag?: PropertyTag): this {
        const hasTag = tag !== null && tag !== undefined;
        const beginIndex = hasTag ? pkg.tell() : null;
        const count = pkg.read(new BufferValue(BufferValue.compat32)).value as number;
        const headerOffset = hasTag ? pkg.tell() - beginIndex : null;
        const dataSize = hasTag ? tag.dataSize - headerOffset : null;

        this.length = count;

        if (count === 0) return this;

        const elementSize = hasTag ? dataSize / this.length : null;

        for (let i = 0, len = this.length; i < len; i++) {
            const exp = hasTag ? (function () {
                const exp = new UExport();

                exp.size = elementSize;
                exp.objectName = `${tag.name}[${i + 1}/${count}]`
                exp.offset = pkg.tell();

                return exp;
            })() : null;

            this[i] = new (this.Constructor as any)(elementSize).load(pkg, exp);
        }

        if (hasTag) console.assert((pkg.tell() - beginIndex - tag.dataSize) === 0);

        return this;
    }

    public clone(other: FArray<T>): this {
        if (!other)
            return this;

        this.Constructor = other.Constructor;

        for (const v of other)
            this.push(v);

        return this;
    }
}

class FObjectArray<T extends UObject = UObject> extends FArray<T> {
    protected indexArray: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.compat32) as any);

    constructor() { super(null); }

    public load(pkg: UPackage, tag?: PropertyTag): this {
        this.indexArray.load(pkg, tag);


        let i = 0;

        for (const index of this.indexArray)
            this[i++] = pkg.fetchObject(index.value);

        return this;
    }

    public loadSelf(): this {

        for (const obj of (this as UObject[]))
            obj.loadSelf();

        return this;
    }

    public clone(other: FObjectArray<T>): this {
        if (!other)
            return this;

        super.clone(other);
        this.indexArray = other.indexArray;

        return this;
    }
}

class FNameArray extends Array<string> implements IConstructable {
    protected indexArray: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.compat32) as any);

    public load(pkg: UPackage, tag?: PropertyTag): this {
        // debugger;

        this.indexArray.load(pkg, tag);

        debugger;

        let i = 0;

        for (const index of this.indexArray)
            this[i++] = pkg.nameTable[index.value].name;

        return this;
    }

    public loadSelf(): this { return this; }

    public clone(other: FNameArray): this {
        if (!other)
            return this;

        this.indexArray = other.indexArray;

        for (const v of other)
            this.push(v);

        return this;
    }
}

class FArrayLazy<T extends FConstructable = FConstructable> extends FArray<T> {
    public unkLazyInt: number;

    public load(pkg: UPackage, tag?: PropertyTag): this {
        this.unkLazyInt = pkg.read(new BufferValue(BufferValue.int32)).value as number;

        super.load(pkg, tag);

        return this;
    }

    public clone(other: FArrayLazy<T>): this {
        if (!other)
            return this;

        this.unkLazyInt = other.unkLazyInt;

        return this;
    }
}

class FPrimitiveArray<T extends ValueTypeNames_T = ValueTypeNames_T> implements IConstructable {
    protected array: DataView;
    protected Constructor: ValidTypes_T<T>;

    public getElemCount() { return this.array ? this.array.byteLength / this.Constructor.bytes : 0; }
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

    public constructor(constr: ValidTypes_T<T>) { this.Constructor = constr; }

    public map<T>(fnMap: (value: any, index: number, array: any[]) => T): T[] { return [...(this as any as Array<T>)].map(fnMap); }

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

        if (hasTag && (pkg.tell() - beginIndex - tag.dataSize) !== 0) debugger;
        if (hasTag) console.assert((pkg.tell() - beginIndex - tag.dataSize) === 0);

        return this;
    }

    public getTypedArray() {
        try {
            return new this.Constructor.dtype(this.array.buffer, this.array.byteOffset, this.getElemCount());
        } catch (e) {
            if (e.message.includes("should be a multiple of"))
                return new this.Constructor.dtype(this.array.buffer.slice(this.array.byteOffset, this.array.byteOffset + this.getByteLength()));

            throw e;
        }
    }

    public getByteLength() { return this.array.byteLength; }

    public clone(other: FPrimitiveArray<T>): this {
        if (!other)
            return this;

        this.Constructor = other.Constructor;
        this.array = other.array;

        return this;
    }
}

class FPrimitiveArrayLazy<T extends ValueTypeNames_T = ValueTypeNames_T> extends FPrimitiveArray<T> {
    public unkLazyInt: number;

    public load(pkg: UPackage, tag?: PropertyTag): this {
        this.unkLazyInt = pkg.read(new BufferValue(BufferValue.uint32)).value as number;

        super.load(pkg, tag);

        return this;
    }

    public clone(other: FPrimitiveArrayLazy<T>): this {
        if (!other)
            return this;

        this.unkLazyInt = other.unkLazyInt;

        return this;
    }
}



export default FArray;
export { FArray, FArrayLazy, FNameArray, FObjectArray, FPrimitiveArray, FPrimitiveArrayLazy };