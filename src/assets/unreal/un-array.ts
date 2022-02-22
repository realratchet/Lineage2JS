import BufferValue from "../buffer-value";
import FUnknownStruct from "./un-unknown-struct";

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

        // if (constr && !isFinite((constr as any).typeSize) && constr !== FUnknownStruct)
        //     throw new Error(`Invalid fields for FConstructable: ${constr.name}`);

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

        // if (count.value as number < 0)
        //     debugger;


        this.length = count.value as number;

        if (count.value as number === 0) return this;

        // if (this.Constructor.name === "FBSPVertex")
        //     debugger;

        // if (this.Constructor.name === "FBSPVertexStream")
        //     debugger;


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
    public load(pkg: UPackage, tag: PropertyTag): this {
        // const unkData = pkg.read(BufferValue.allocBytes(4)).value as DataView; // skip unknown

        pkg.seek(4);

        super.load(pkg, tag);

        return this;
    }
}

class FPrimitiveArray<T extends ValueTypeNames_T = ValueTypeNames_T> implements IConstructable {
    public static readonly typeSize: number = 16;
    // BufferValue<T extends ValueTypeNames_T = ValueTypeNames_T>
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
        // const headerOffset = hasTag ? pkg.tell() - beginIndex : null;
        // const dataSize = hasTag ? tag.dataSize - headerOffset : null;

        const elementCount = count.value as number;

        if (elementCount === 0) {
            this.array = new DataView(new ArrayBuffer(0));
            return this;
        }

        // const elementSize = hasTag ? dataSize / elementCount : null;
        const byteLength = elementCount * this.Constructor.bytes;

        this.array = pkg.readPrimitive(pkg.tell(), byteLength);

        pkg.seek(byteLength);

        if (hasTag) console.assert((pkg.tell() - beginIndex - tag.dataSize) === 0);

        return this;
    }

    getTypedArray() { return new this.Constructor.dtype(this.array.buffer, this.array.byteOffset, this.getElemCount()); }
    getByteLength() { return this.array.byteLength; }
}

class FPrimitiveArrayLazy<T extends ValueTypeNames_T = ValueTypeNames_T> extends FPrimitiveArray<T> {
    public load(pkg: UPackage, tag: PropertyTag): this {
        // const unkData = pkg.read(BufferValue.allocBytes(4)).value as DataView; // skip unknown

        pkg.seek(4);

        super.load(pkg, tag);

        return this;
    }
}



export default FArray;
export { FArray, FArrayLazy, FPrimitiveArray, FPrimitiveArrayLazy };