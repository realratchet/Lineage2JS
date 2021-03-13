import { Buffer } from "buffer";

class AssetBuffer {
    private buffer: Buffer;
    private isEncrypted = false;
    private cryptKey = new Value(uint8);
    private offset = 0;
    private contentOffset = 0;

    constructor(arrayBuffer: ArrayBuffer) {
        this.buffer = new Buffer(arrayBuffer.slice(0, 2048));
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
    protected read(target: Value | number) {
        const cryptKey = this.cryptKey.value as number;
        target = typeof (target) === "number" ? Value.allocBytes(target) : target;

        this.offset += target.readValue(this.buffer, this.offset, this.isEncrypted, cryptKey);

        return target;
    }

    private dump(lineCount: number) {
        console.log("--------------------------------------------------------");
        console.log(`------------------- Dumping lines ----------------------`);
        console.log("--------------------------------------------------------");
        for (let i = 0; i < lineCount; i++) {
            const groups = new Array(8).fill(8).map(() => this.read(2));

            const string1 = groups.map(g => g.hex.slice(2)).join(" ");
            const string2 = groups.map(g => g.string).join("");

            console.log(
                string1,
                string2
            );
        }
        console.log("--------------------------------------------------------");
    }

    public async decode(): Promise<any> {
        const signature = this.read(new Value(uint32));

        if (signature.value == 0x0069004C) {
            this.seek(24);
            this.read(this.cryptKey);

            this.cryptKey.value = 0xC1 ^ (this.cryptKey.value as number);

            if (this.cryptKey.value !== 0xAC)
                throw new Error("yo");

            this.isEncrypted = true;
            this.contentOffset = 28;
            this.seek(0, SEEK_T.SEEK_SET);
            this.read(signature);
        }

        // this.contentOffset = 0;

        /*
        0832A9E D7ACBBAC  ADACACAC  5F98ACAC
        ECACACAC 9C9EACAC  30FE41AC  43ADACAC
        289341AC 35463E82  22E75FED  AC7A1F6
        F1CD75B5 ADACACAC  9C9EACAC  5F98ACAC
        A9E2C3C2 C9ACBCA8  ABA8ABFA  C9CFD8C3
        DEACBCA8 ABA8AAEF  C3C0C3DE  ACBCA8AB
        A8A9F6C3 C2C9ACBC  ACABACA7  F6C3C2C9
        E2D9C1CE C9DEACBC  ACABACAB  FEC9CBC5
        C3C2ACBC ACABACA0  FCC3C5C2  D8FEC9CB
        C5C3C2AC BCACABAC  AAC5E0C9  CDCAACBC
        ACABACA5 E0C3CFCD  D8C5C3C2  ACBCACAB
        */

        // this.contentOffset = 0;
        // this.seek(0, SEEK_T.SEEK_SET);
        // for (let i = 0; i < 64; i++) {
        //     const a = this.read(4);
        //     const b = this.read(4);
        //     const c = this.read(4);
        //     const d = this.read(4);

        //     console.log(
        //         a.hex.slice(2) + " ",
        //         b.hex.slice(2) + " ",
        //         c.hex.slice(2) + " ",
        //         d.hex.slice(2) + " ",
        //         a.string +
        //         b.string +
        //         c.string +
        //         d.string,
        //     );
        // }


        this.contentOffset = 0;
        this.seek(0, SEEK_T.SEEK_SET);
        this.dump(64);

        if (signature.value !== 0x9E2A83C1)
            throw new Error(`Invalid signature: '0x${signature.toString(16).toUpperCase()}' expected '0x9E2A83C1'`);

        const header = new UPkgHeader();

        this.read(header.version);
        this.read(header.flags);
        this.read(header.nameCount);
        this.read(header.nameOffset);
        this.read(header.exportCount);
        this.read(header.exportOffset);
        this.read(header.importCount);
        this.read(header.importOffset);

        if (header.getVersionLWORD() < 68) {
            this.read(header.heritageCount);
            this.read(header.heritageOffset);
        } else {
            this.read(header.guid);

            const generationCount = this.read(new Value(uint32));

            for (let i = 0, gc = generationCount.value as number; i < gc; i++) {
                const gen = new UGeneration();

                this.read(gen.ExportCount);
                this.read(gen.NameCount);

                header.generations.push(gen);
            }
        }

        this.seek(header.nameOffset.value as number, SEEK_T.SEEK_SET);

        const names = [];

        for (let i = 0, nc = header.nameCount.value as number; i < nc; i++) {
            const uname = new UName();

            this.read(uname.name);
            this.read(uname.flags);

            names.push(uname);
        }

        console.log(header);

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

const int32 = { bytes: 4, signed: true, name: "int32" };
const uint32 = { bytes: 4, signed: false, name: "uint32" };
const int8 = { bytes: 1, signed: true, name: "int8" };
const uint8 = { bytes: 1, signed: false, name: "uint8" };
const uuid = { bytes: 16, signed: true, name: "uuid" };
const char = { bytes: NaN, signed: true, name: "char" };

type ValidTypes_T = typeof int32 | typeof uint32 | typeof int8 | typeof uint8 | typeof uuid | typeof char;

const expIsPrintable = /^[\d\w]$/i;

class Value {
    private bytes: Uint8Array;
    private type: ValidTypes_T;
    private endianess: "big" | "little" = "big";

    static allocBytes(bytes: number): Value {
        return new Value(Object.freeze({ bytes: bytes, signed: true, name: "buffer" }));
    }

    constructor(type: ValidTypes_T, defaultValue: number = 0) {
        this.type = Object.assign({}, type);
        this.bytes = new Uint8Array([defaultValue]);
    }

    public readValue(buffer: Buffer, offset: number, isEncrypted: boolean, cryptKey: number) {
        const byteCount = this.type.bytes;

        if (buffer.byteLength <= offset + byteCount) {
            throw new Error("Out of bounds");
        }

        if (this.type.name === "char") {
            const length = new Value(int32);
            length.readValue(buffer, offset, isEncrypted, cryptKey);
            offset = offset + uint32.bytes;
            this.type.bytes = length.value as number;
        }

        this.bytes = new Uint8Array([...buffer.slice(offset, offset + this.type.bytes)]);

        if (isEncrypted) {
            for (let i = 0; i < this.type.bytes; i++) {
                this.bytes[i] ^= cryptKey;
            }
        }

        return byteCount;
    }

    public get string(): string {
        const bytes = this.type.bytes;

        if (bytes === 1) return String.fromCharCode(this.bytes[0]);

        let string = "";

        for (let i = 0; bytes >= 2 && i < bytes; i += 2) {
            // ((0x77694c & 0xFF0000) >> 16).toString(16)
            const [ia, ib] = this.endianess === "big" ? [i + 1, i] : [i, i + 1];

            const chara = String.fromCharCode(this.bytes[ia]);
            const charb = String.fromCharCode(this.bytes[ib]);

            string += chara.match(expIsPrintable) ? chara : ".";
            string += charb.match(expIsPrintable) ? charb : ".";
        }

        return string;
    }

    public set value(bytes: number | string | Uint8Array) {
        if (typeof bytes === "number") this.bytes[0] = bytes;
        else throw new Error("Invalid action.");
    }

    public get value(): number | string | Uint8Array {
        const buffer = this.bytes;
        let DataConstructor: any = null;

        switch (this.type.name) {
            case "int32": DataConstructor = Int32Array; break;
            case "uint32": DataConstructor = Uint32Array; break;
            case "int8": DataConstructor = Int8Array; break;
            case "uint8": DataConstructor = Uint8Array; break;
            case "uuid":
            case "buffer": break;
        }

        if (DataConstructor) return new DataConstructor(buffer.buffer, buffer.byteOffset, 1)[0];
        // if (funcName) return (buffer as any)[funcName]();
        else if (this.type.name === "uuid") return this.string;

        return this.bytes;
    }

    public get hex(): string {
        if (this.type.name === "buffer") {
            if (this.bytes.length === 1) return `0x${this.bytes[0]}`;

            let string = "0x";

            for (let i = 0; i < this.bytes.length; i += 2) {
                const [ia, ib] = this.endianess === "big" ? [i + 1, i] : [i, i + 1];

                const bitA = this.bytes[ia].toString(16).toUpperCase();
                const bitB = this.bytes[ib].toString(16).toUpperCase()

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

class UName {
    public name = new Value(char);
    public flags = new Value(int32);
}

class UGeneration {
    public ExportCount = new Value(uint32);
    public NameCount = new Value(uint32);
}

class UPkgHeader {
    public version = new Value(uint32);
    public flags = new Value(int32);

    public nameCount = new Value(uint32);
    public nameOffset = new Value(uint32);
    public exportCount = new Value(uint32);
    public exportOffset = new Value(uint32);
    public importCount = new Value(uint32);
    public importOffset = new Value(uint32);

    public heritageCount = new Value(uint32);
    public heritageOffset = new Value(uint32);

    //DWORD generation_count;
    public generations: UGeneration[] = [];
    public guid = new Value(uuid);

    public getVersionLWORD() { return (this.version.value as number) & 0xffff; }
}