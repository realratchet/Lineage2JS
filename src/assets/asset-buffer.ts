class AssetBuffer {
    private buffer: ArrayBuffer;
    private isEncrypted = false;
    private cryptKey = new Value(uint8);
    private offset = 0;
    private contentOffset = 0;

    constructor(arrayBuffer: ArrayBuffer) {
        this.buffer = arrayBuffer//.slice(0, 20480);
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
    protected read<T extends ValueTypeNames_T>(target: Value<T> | number) {
        const cryptKey = this.cryptKey.value as number;
        const _target = typeof (target) === "number" ? Value.allocBytes(target) : target as Value<T>;

        this.offset += _target.readValue(this.buffer, this.offset, this.isEncrypted, cryptKey);

        return _target;
    }

    private dump(lineCount: number, restore: boolean = true) {
        let oldHeader = this.offset;

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

        if (restore) this.offset = oldHeader;
    }

    public async decode(): Promise<any> {
        // this.dump(64);

        const signature = this.read(new Value(uint32));
        const HEADER_SIZE = 28;

        if (signature.value == 0x0069004C) {
            this.seek(HEADER_SIZE, SEEK_T.SEEK_SET);
            this.read(this.cryptKey);

            this.cryptKey.value = 0xC1 ^ (this.cryptKey.value as number);

            if (this.cryptKey.value !== 0xAC)
                throw new Error("yo");

            this.isEncrypted = true;
            this.contentOffset = HEADER_SIZE;
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


        // this.contentOffset = 0;
        // this.seek(0, SEEK_T.SEEK_SET);
        // this.dump(64);

        if (signature.value !== 0x9E2A83C1)
            throw new Error(`Invalid signature: '0x${signature.toString(16).toUpperCase()}' expected '0x9E2A83C1'`);

        const header = new UHeader();

        this.read(header.version);
        this.read(header.packageFlags);
        this.read(header.nameCount);
        this.read(header.nameOffset);
        this.read(header.exportCount);
        this.read(header.exportOffset);
        this.read(header.importCount);
        this.read(header.importOffset);

        const dbgNameCount = header.nameCount.value;
        const dbgNameOffset = header.nameOffset.value.toString(16).toUpperCase();
        const dbgExportCount = header.exportCount.value;
        const dbgExportOffset = header.exportOffset.value.toString(16).toUpperCase();
        const dbgImportCount = header.importCount.value;
        const dbgImportOffset = header.importOffset.value.toString(16).toUpperCase();

        // Names:40[12165] Exports:FB1BF5[11379] Imports:FB0712[490]
        console.log(`Names:${dbgNameOffset}[${dbgNameCount}] Exports:${dbgExportOffset}[${dbgExportCount}] Imports:${dbgImportOffset}[${dbgImportCount}]`);

        console.assert(header.getVersionLWORD() === 123);
        console.assert(header.packageFlags.value === 0x1);
        console.assert(header.nameCount.value === 12165);
        console.assert(header.nameOffset.value === 0x40);
        console.assert(header.exportCount.value === 11379);
        console.assert(header.exportOffset.value === 0xFB1BF5);
        console.assert(header.importCount.value === 490);
        console.assert(header.importOffset.value === 0xFB0712);

        if (header.getVersionLWORD() < 68) {
            this.read(header.heritageCount);
            this.read(header.heritageOffset);
        } else {
            this.read(header.guid);

            const generationCount = this.read(new Value(int32));

            console.assert(generationCount.value === 1);

            for (let i = 0, gc = generationCount.value as number; i < gc; i++) {
                const gen = new UGeneration();

                this.read(gen.exportCount);
                this.read(gen.nameCount);

                header.generations.push(gen);
            }
        }

        const nameTable = this.loadNames(header);
        const exports = this.loadExports(header, nameTable);
        const imports = this.loadImports(header, nameTable);

        debugger;
    }

    loadImports(header: UHeader, nameTable: UName[]) {
        this.seek(header.importOffset.value as number, SEEK_T.SEEK_SET);

        const imports: UImport[] = [];
        const index = new Value(compat32);

        for (let i = 0, ic = header.importCount.value; i < ic; i++) {
            const uimport = new UImport();

            this.read(index);
            if (i === 0) console.assert(index.value === 5553);

            uimport.classPackage = (nameTable[index.value as number].name.value as string).slice(0, -1);
            if (i === 0) console.assert(uimport.classPackage === "Core");

            this.read(index);
            if (i === 0) console.assert(index.value === 11089);

            uimport.className = (nameTable[index.value as number].name.value as string).slice(0, -1);
            if (i === 0) console.assert(uimport.className === "Package");

            this.read(uimport.packageIndex);
            if (i === 0) console.assert(uimport.className === "Package");

            this.read(index);
            if (i === 0) console.assert(index.value === 11086);

            uimport.objectName = (nameTable[index.value as number].name.value as string).slice(0, -1);
            if (i === 0) console.assert(uimport.objectName === "Engine");

            imports.push(uimport);
        }

        return imports;
    }

    loadNames(header: UHeader) {
        this.seek(header.nameOffset.value as number, SEEK_T.SEEK_SET);

        const nameTable: UName[] = [];

        for (let i = 0, nc = header.nameCount.value as number; i < nc; i++) {
            const uname = new UName();

            this.read(uname.name);
            this.read(uname.flags);

            nameTable.push(uname);

            // console.log(`Name[${i}]: "${(uname.name.value as string).slice(1, -1)}"`);
        }

        return nameTable;
    }

    loadExports(header: UHeader, nameTable: UName[]) {
        this.seek(header.exportOffset.value as number, SEEK_T.SEEK_SET);

        const exports: UExport[] = [];
        const index = new Value(compat32);

        for (let i = 0, ec = header.exportCount.value as number; i < ec; i++) {
            const uexport = new UExport();

            if (i === 0) console.assert(this.offset === 16456721);

            this.read(uexport.idClass);
            if (i === 0) console.assert(uexport.idClass.value === -344);

            this.read(uexport.idSuper);
            if (i === 0) console.assert(uexport.idSuper.value === 0);

            this.read(uexport.idPackage);
            if (i === 0) console.assert(uexport.idPackage.value === 0);

            this.read(index);
            if (i === 0) console.assert(index.value === 315);

            uexport.name = (nameTable[index.value as number].name.value as string).slice(0, -1);
            if (i === 0) console.assert(uexport.name === "LevelInfo0")

            this.read(uexport.flags);
            if (i === 0) console.assert(uexport.flags.value === 0x2070001);

            this.read(uexport.size);
            if (i === 0) console.assert(uexport.size.value === 0xe1)

            if (uexport.size.value as number > 0) {
                this.read(uexport.offset);
                if (i === 0) console.assert(uexport.offset.value === 0x47121);
            }

            exports.push(uexport);
        }

        return exports;
    }
}

export default AssetBuffer;
export { AssetBuffer };

enum SEEK_T {
    SEEK_SET = 0,   /* set file offset to offset */
    SEEK_CUR = 1,   /* set file offset to current plus offset */
    // SEEK_END = 2    /* set file offset to EOF plus offset */
}

const int32: ValidTypes_T<"int32"> = { bytes: 4, signed: true, name: "int32", dtype: Int32Array };
const compat32: ValidTypes_T<"compat32"> = { bytes: 4, signed: true, name: "compat32" };
const uint32: ValidTypes_T<"uint32"> = { bytes: 4, signed: false, name: "uint32", dtype: Uint32Array };
const int8: ValidTypes_T<"int8"> = { bytes: 1, signed: true, name: "int8", dtype: Int8Array };
const uint8: ValidTypes_T<"uint8"> = { bytes: 1, signed: false, name: "uint8", dtype: Uint8Array };
const guid: ValidTypes_T<"guid"> = { bytes: 4 * 4, signed: true, name: "guid" };
const char: ValidTypes_T<"char"> = { bytes: NaN, signed: true, name: "char" };

type ValueTypeNames_T = "int32" | "uint32" | "int8" | "uint8" | "guid" | "char" | "buffer" | "compat32";
type ValidTypes_T<T extends ValueTypeNames_T> = {
    bytes?: number;
    signed: boolean;
    name: T;
    dtype?: Int32ArrayConstructor | Uint32ArrayConstructor | Int8ArrayConstructor | Uint8ArrayConstructor;
};

const expIsPrintable = /^[\d\w]$/i;

class Value<T extends ValueTypeNames_T = ValueTypeNames_T> {
    private bytes: DataView;
    private type: ValidTypes_T<T>;
    private endianess: "big" | "little" = "little";

    static allocBytes(bytes: number): Value<"buffer"> {
        return new Value<"buffer">(Object.freeze({ bytes: bytes, signed: true, name: "buffer" }));
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
            const length = new Value(uint8);
            length.readValue(buffer, offset, isEncrypted, cryptKey);
            byteOffset = length.type.bytes;
            offset = offset + byteOffset;
            this.type.bytes = length.value as number;
        }

        if (this.type.name === "compat32") {
            const byte = new Value(uint8);
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

class UExport {
    public idClass = new Value(compat32);
    public idSuper = new Value(compat32);
    public idPackage = new Value(uint32);
    public baseClass: string = null;
    public name: string = null;
    public flags = new Value(uint32);
    public size = new Value(compat32);
    public offset = new Value(compat32);
}

class UName {
    public name = new Value<"char">(char);
    public flags = new Value<"uint32">(uint32);
}

class UGeneration {
    public exportCount = new Value(uint32);
    public nameCount = new Value(uint32);
}

class UImport {
    public className: string = null;
    public packageIndex = new Value(int32);
    public objectName: string = null;
    public classPackage: string = null;
}

class UHeader {
    public version = new Value(uint32);
    public packageFlags = new Value(int32);

    public nameCount = new Value(int32);
    public nameOffset = new Value(int32);

    public exportCount = new Value(int32);
    public exportOffset = new Value(int32);
    public importCount = new Value(int32);
    public importOffset = new Value(int32);

    public heritageCount = new Value(uint32);
    public heritageOffset = new Value(uint32);

    //DWORD generation_count;
    public generations: UGeneration[] = [];
    public guid = new Value(guid);

    public getVersionLWORD() { return (this.version.value as number) & 0xffff; }
}

(global.console as any).assert = function (cond: Function, text: string, dontThrow: boolean) {
    if (cond) return;
    if (dontThrow) {
        debugger;
    } else {
        throw new Error(text || "Assertion failed!");
    }
};