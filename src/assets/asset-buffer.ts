import { Buffer } from "buffer";

class AssetBuffer {
    private buffer: Buffer;
    private isEncrypted = false;
    private cryptKey = new Value(int32);
    private offset = 0;
    private contentOffset = 0;

    constructor(arrayBuffer: ArrayBuffer) {
        this.buffer = new Buffer(arrayBuffer);
    }

    protected seek(offset: number, origin = SEEK_T.SEEK_CUR) {
        switch (origin) {
            case SEEK_T.SEEK_CUR:
                this.offset = this.offset + offset
                break;
            case SEEK_T.SEEK_SET:
                this.offset = offset + this.contentOffset;
                break;
            default: throw new Error(`Seek type not supported: ${origin}`);
        }
    }
    protected read(target: Value) {
        this.offset += target.readValue(this.buffer, this.offset, this.isEncrypted, this.cryptKey.value);

        return target;
    }

    public async decode(): Promise<any> {
        const signature = this.read(new Value(int32));

        if (signature.value == 0x0069004C) {
            this.seek(24);
            this.read(this.cryptKey);
            this.cryptKey.value = 0xC1 ^ this.cryptKey.value;
            this.isEncrypted = true;
            this.contentOffset = 28;
            this.seek(0, SEEK_T.SEEK_SET)
            this.read(signature);
        }

        if (signature.value !== 0x9E2A83C1)
            throw new Error(`Invalid signature: '0x${signature.toString(16).toUpperCase()}' expected '0x9E2A83C1'`);

        // const signature = buffer.readInt32LE();
        // let encryptionKey = 0, isEncrypted = false;

        // if (signature === 0x0069004C) {
        //     encryptionKey = 0xC1 ^ buffer.readInt8(24);

        //     isEncrypted = true;

        // }
    }
}

export default AssetBuffer;
export { AssetBuffer };

enum SEEK_T {
    SEEK_SET = 0,   /* set file offset to offset */
    SEEK_CUR = 1,   /* set file offset to current plus offset */
    // SEEK_END = 2    /* set file offset to EOF plus offset */
}

const int32 = Object.freeze({ bits: 32, signed: true, name: "int32" });
const uint32 = Object.freeze({ bits: 32, signed: false, name: "uint32" });
const int8 = Object.freeze({ bits: 8, signed: true, name: "int8" });
const uint8 = Object.freeze({ bits: 8, signed: false, name: "uint8" });
const uuid = Object.freeze({ bits: 8 * 16, signed: true, name: "uuid" });

type ValidTypes_T = typeof int32 | typeof uint32 | typeof int8 | typeof uint8 | typeof uuid;

class Value {
    public value: number;

    private type: ValidTypes_T;

    constructor(type: ValidTypes_T, defaultValue: number = 0) {
        this.type = type;
        this.value = defaultValue;
    }

    public readValue(buffer: Buffer, offset: number, isEncrypted: boolean, cryptKey: number) {
        const bitCount = this.type.bits;

        let funcName = null;

        switch (this.type.name) {
            case "int32": funcName = "readInt32LE"; break;
            case "uint32": funcName = "readUInt32LE"; break;
            case "int8": funcName = "readInt8"; break;
            case "uint8": funcName = "readUInt8"; break;
            case "uuid":
                break;
            default:
                throw new Error("Unsupported type.")
        }

        this.value = (buffer as any)[funcName](offset);

        if (isEncrypted) this.value ^= cryptKey;

        return bitCount;
    }

    public get string(): string {
        let string = "";

        for (let i = 0; i < this.type.bits; i += 8) {
            // ((0x77694c & 0xFF0000) >> 16).toString(16)
            const bits = (this.value & (0xFF << i)) >> i;
            string += String.fromCharCode(bits);
        }

        return string;
    }
    public get hex(): string { return `0x${this.toString(16).toUpperCase()}`; }
    public toString(...args: any) { return this.value.toString(...args); }
}