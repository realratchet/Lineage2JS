const expIsPrintable = /^[\d\w]$/i;
const int32: ValidTypes_T<"int32"> = { bytes: 4, signed: true, name: "int32", dtype: Int32Array };
const compat32: ValidTypes_T<"compat32"> = { bytes: 4, signed: true, name: "compat32" };
const uint32: ValidTypes_T<"uint32"> = { bytes: 4, signed: false, name: "uint32", dtype: Uint32Array };
const int8: ValidTypes_T<"int8"> = { bytes: 1, signed: true, name: "int8", dtype: Int8Array };
const uint8: ValidTypes_T<"uint8"> = { bytes: 1, signed: false, name: "uint8", dtype: Uint8Array };
const guid: ValidTypes_T<"guid"> = { bytes: 4 * 4, signed: true, name: "guid" };
const char: ValidTypes_T<"char"> = { bytes: NaN, signed: true, name: "char" };

class BufferValue<T extends ValueTypeNames_T = ValueTypeNames_T> {
    static int32 = int32;
    static compat32 = compat32;
    static uint32 = uint32;
    static int8 = int8;
    static uint8 = uint8;
    static guid = guid;
    static char = char;

    private bytes: DataView;
    private type: ValidTypes_T<T>;
    private endianess: "big" | "little" = "little";

    static allocBytes(bytes: number): BufferValue<"buffer"> {
        return new BufferValue<"buffer">(Object.freeze({ bytes: bytes, signed: true, name: "buffer" }));
    }

    constructor(type: ValidTypes_T<T>) {
        this.type = Object.assign({}, type);
        this.bytes = new DataView(new ArrayBuffer(isFinite(this.type.bytes) ? this.type.bytes : 0));
    }

    public readValue(buffer: ArrayBuffer, offset: number, isEncrypted: boolean, cryptKey: number) {
        if (buffer.byteLength <= offset + this.type.bytes) {
            throw new Error("Out of bounds");
        }

        let byteOffset = 0;
        if (this.type.name === "char") {
            const length = new BufferValue(uint8);
            length.readValue(buffer, offset, isEncrypted, cryptKey);
            byteOffset = length.type.bytes;
            offset = offset + byteOffset;
            this.type.bytes = length.value as number;
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
            for (let i = 0; i < this.type.bytes; i++) {
                this.bytes.setUint8(i + this.bytes.byteOffset, this.bytes.getUint8(i + this.bytes.byteOffset) ^ cryptKey);
            }
        }

        return this.type.bytes + byteOffset;
    }

    public get string(): string {
        let string = "";

        for (let i = 0, bc = this.bytes.byteLength; i < bc; i++) {
            const charCode = this.bytes.getUint8(this.bytes.byteOffset + i);
            const char = String.fromCharCode(charCode);
            string += char.match(expIsPrintable) ? char : ".";
        }

        return string;

        // if (this.bytes.byteLength === 1) return String.fromCharCode(this.bytes.getUint8(0));

        // let string = "";

        // for (let i = 0; this.bytes.byteLength >= 2 && i < this.bytes.byteLength; i += 2) {
        //     // ((0x77694c & 0xFF0000) >> 16).toString(16)
        //     const [ia, ib] = this.endianess === "big" ? [i + 1, i] : [i, i + 1];

        //     const chara = String.fromCharCode(this.bytes[ia]);
        //     const charb = String.fromCharCode(this.bytes[ib]);

        //     string += chara.match(expIsPrintable) ? chara : ".";
        //     string += charb.match(expIsPrintable) ? charb : ".";
        // }

        // return string;
    }

    public set value(bytes: number | string | DataView) {
        if (typeof bytes === "number") {
            let funName: string = null;

            switch (this.type.name) {
                case "int32": funName = "setInt32"; break;
                case "uint32": funName = "setUint32"; break;
                case "int8": funName = "setInt8"; break;
                case "uint8": funName = "setUint8"; break;
                default: throw new Error(`Unknown type: ${this.type.name}`);
            }

            (this.bytes as any)[funName](this.bytes.byteOffset + 0, bytes, this.endianess === "little");
        }
        else throw new Error("Invalid action.");
    }

    public get value(): number | string | DataView {
        const buffer = this.bytes;
        let funName: string = null;

        switch (this.type.name) {
            case "compat32":
            case "int32":
                funName = "getInt32";
                break;
            case "uint32": funName = "getUint32"; break;
            case "int8": funName = "getInt8"; break;
            case "uint8": funName = "getUint8"; break;
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
        if (this.type.name === "buffer") {
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