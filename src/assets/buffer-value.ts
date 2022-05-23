const expIsPrintable = /^[^\x00-\x1F\x80-\x9F]$/i;
const int32: ValidTypes_T<"int32"> = { bytes: 4, signed: true, name: "int32", dtype: Int32Array };
const float: ValidTypes_T<"float"> = { bytes: 4, signed: true, name: "float", dtype: Float32Array };
const compat32: ValidTypes_T<"compat32"> = { bytes: 4, signed: true, name: "compat32" };
const uint32: ValidTypes_T<"uint32"> = { bytes: 4, signed: false, name: "uint32", dtype: Uint32Array };
const int64: ValidTypes_T<"int64"> = { bytes: 8, signed: true, name: "int64", dtype: BigInt64Array };
const uint64: ValidTypes_T<"uint64"> = { bytes: 8, signed: false, name: "uint64", dtype: BigUint64Array };
const int8: ValidTypes_T<"int8"> = { bytes: 1, signed: true, name: "int8", dtype: Int8Array };
const uint8: ValidTypes_T<"uint8"> = { bytes: 1, signed: false, name: "uint8", dtype: Uint8Array };
const int16: ValidTypes_T<"int16"> = { bytes: 2, signed: true, name: "int16", dtype: Int16Array };
const uint16: ValidTypes_T<"uint16"> = { bytes: 2, signed: false, name: "uint16", dtype: Uint16Array };
const guid: ValidTypes_T<"guid"> = { bytes: 4 * 4, signed: true, name: "guid" };
const char: ValidTypes_T<"char"> = { bytes: NaN, signed: true, name: "char" };

class BufferValue<T extends ValueTypeNames_T = ValueTypeNames_T> {
    public static readonly uint64 = uint64;
    public static readonly int64 = int64;
    public static readonly compat32 = compat32;
    public static readonly uint32 = uint32;
    public static readonly int32 = int32;
    public static readonly int8 = int8;
    public static readonly uint8 = uint8;
    public static readonly int16 = int16;
    public static readonly uint16 = uint16;
    public static readonly guid = guid;
    public static readonly char = char;
    public static readonly float = float;

    public bytes: DataView;

    private type: ValidTypes_T<T>;
    public readonly endianess: "big" | "little" = "little";

    static allocBytes(bytes: number): BufferValue<"buffer"> {
        return new BufferValue<"buffer">(Object.freeze({ bytes: bytes, signed: true, name: "buffer" }));
    }

    constructor(type?: ValidTypes_T<T>) {
        this.type = Object.assign({}, type);
        this.bytes = new DataView(new ArrayBuffer(isFinite(this.type.bytes) ? this.type.bytes : 0));
    }

    public slice(start: number, end: number) {
        const child = new BufferValue(this.type);
        child.bytes = new DataView(this.bytes.buffer, start, end - start);

        return child;
    }

    public readValue(buffer: ArrayBuffer, offset: number, isEncrypted: boolean, cryptKey: number) {
        if (buffer.byteLength <= offset + this.type.bytes)
            throw new Error("Out of bounds");

        let byteOffset = 0;
        if (this.type.name === "char") {
            const length = new BufferValue(uint8);
            length.readValue(buffer, offset, isEncrypted, cryptKey);
            byteOffset = length.value as number > 0 ? length.type.bytes + 1 : 1;
            offset = offset + byteOffset - 1;
            this.type.bytes = length.value as number - 1;
        }

        if (this.type.name === "compat32") {
            const byte = new BufferValue(uint8);
            let startOffset = offset;

            byte.readValue(buffer, offset, isEncrypted, cryptKey);
            offset += byte.bytes.byteLength;

            let b = byte.bytes.getUint8(0);
            const sign = b & 0x80; // sign bit
            let shift = 6;
            let r = b & 0x3f;

            if (b & 0x40)   // has 2nd byte
            {
                do {
                    byte.readValue(buffer, offset, isEncrypted, cryptKey);
                    b = byte.bytes.getUint8(0);
                    offset += byte.bytes.byteLength;
                    r |= (b & 0x7F) << shift;
                    shift += 7
                } while (b & 0x80); // has more bytes
            }

            r = sign ? -r : r;

            this.bytes.setInt32(0, r, this.endianess === "little");

            return offset - startOffset;
        }

        this.bytes = new DataView(buffer.slice(offset, offset + this.type.bytes));

        if (isEncrypted) {
            for (let i = 0; i < this.bytes.byteLength; i++) {
                this.bytes.setUint8(i + this.bytes.byteOffset, this.bytes.getUint8(i + this.bytes.byteOffset) ^ cryptKey);
            }
        }

        return this.bytes.byteLength + byteOffset;
    }

    public get string(): string {
        let string = "";

        for (let i = 0, bc = this.bytes.byteLength; i < bc; i++) {
            const charCode = this.bytes.getUint8(this.bytes.byteOffset + i);
            const char = String.fromCharCode(charCode);
            string += char.match(expIsPrintable) ? char : ".";
        }

        return string;
    }

    public set value(bytes: BigInt | number | string | DataView) {
        if (typeof bytes === "number") {
            let funName: string = null;

            switch (this.type.name) {
                case "int64": funName = "setBigInt64"; break;
                case "uint64": funName = "setBigUint64"; break;
                case "int32": funName = "setInt32"; break;
                case "float": funName = "setFloat32"; break;
                case "uint32": funName = "setUint32"; break;
                case "int16": funName = "setInt16"; break;
                case "uint16": funName = "setUint16"; break;
                case "int8": funName = "setInt8"; break;
                case "uint8": funName = "setUint8"; break;
                default: throw new Error(`Unknown type: ${this.type.name}`);
            }

            (this.bytes as any)[funName](this.bytes.byteOffset + 0, bytes, this.endianess === "little");
        }
        else throw new Error("Invalid action.");
    }

    public get value(): BigInt | number | string | DataView {
        const buffer = this.bytes;
        let funName: string = null;

        switch (this.type.name) {
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
            case "guid":
            case "char":
            case "buffer": break;
            default: throw new Error(`Unknown type: ${this.type.name}`);
        }

        if (funName) return (buffer as any)[funName](buffer.byteOffset, this.endianess === "little");
        else if (this.type.name === "guid") return this.bytes;
        else if (this.type.name === "char") return this.string;

        return this.bytes;
    }

    public get hex(): string {
        if (this.type.name === "buffer" || this.type.name === "char") {
            if (this.bytes.byteLength === 1) return `0x${this.bytes.getUint8(this.bytes.byteOffset + 0)}`;

            let string = "0x";

            for (let i = 0; i < this.bytes.byteLength; i += 2) {
                const bits = this.bytes.getUint16(this.bytes.byteOffset + i, this.endianess === "little");
                const bitB = ((bits >> 8) & 0xFF).toString(16).toUpperCase();
                const bitA = (bits & 0x00FF).toString(16).toUpperCase();

                string += (bitA.length === 1 ? `0${bitA}` : bitA) + (bitB.length === 1 ? `0${bitB}` : bitB);
            }

            return string;
        }

        const bits = this.toString(16).toUpperCase();
        const head = new Array(bits.length - this.type.bytes).fill("0").join("");

        return `0x${head}${bits}`;
    }
    public toString(...args: any) { return this.value.toString(...args); }
}

export default BufferValue;
export { BufferValue };