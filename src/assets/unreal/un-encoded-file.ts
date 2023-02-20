import BufferValue from "../buffer-value";
import * as decoders from "./decryption/decoders";
import * as _gmp from "gmp-wasm";

let gmp: _gmp.GMPLib = null;

class UEncodedFile {
    public readonly path: string;
    public readonly isReadable = false;

    protected handle: this = null;
    protected promiseDecoding: Promise<BufferValue>;
    protected buffer: ArrayBuffer = null;
    protected offset = 0;
    protected contentOffset = 0;

    constructor(path: string) {
        this.path = path;
    }

    public asReadable(): this {

        // if (this.isReadable)
        //     throw new Error("Already readable!");

        const readable = new class Readable { }

        Object.setPrototypeOf(readable, this);
        Object.assign(readable, this, { isReadable: true, handle: this });

        return readable as this;
    }

    public ensureReadable() {
        if (!this.isReadable)
            throw new Error("Stream is not readable!");
    }

    public seek(offset: number, origin: Seek_T = "current") {
        this.ensureReadable();

        switch (origin) {
            case "current": this.offset = this.offset + offset; break;
            case "set": this.offset = offset + this.contentOffset; break;
            default: throw new Error(`Seek type not supported: ${origin}`);
        }
    }

    public readPrimitive(byteOffset: number, byteLength: number) {
        return new DataView(this.buffer, byteOffset + this.contentOffset, byteLength)
    }

    public read<T extends ValueTypeNames_T>(target: BufferValue<T> | number) {
        this.ensureReadable();

        const _target = typeof (target) === "number" ? BufferValue.allocBytes(target) : target as BufferValue<T>;

        this.offset += _target.readValue(this.buffer, this.offset);

        return _target;
    }

    public tell() { return this.offset - this.contentOffset; }

    public dump(lineCount: number = 1, restore: boolean = true, printHeaders: boolean = true) {
        this.ensureReadable();

        let oldHeader = this.offset;
        let constructedString = "";
        let divisor = 0XF, lineCountHex = 1;

        do {
            if ((lineCount / divisor) < 1) break;
            divisor = divisor * 0X10 + 0XF; // shift divisor
            lineCountHex++;
        } while (true);

        const offsetHeader = printHeaders ? new Array(5 + lineCountHex).fill("-").join("") : null;

        if (printHeaders) {
            console.log(`${offsetHeader}--------------------------------------------------------`);
            console.log(`${offsetHeader}------------------- Dumping lines ----------------------`);
            console.log(`${offsetHeader}--------------------------------------------------------`);
        }

        for (let i = 0; i < lineCount; i++) {
            const bytes = Math.min(this.buffer.byteLength - this.offset, 8);
            const groups = new Array(bytes).fill('.').map(() => this.read(2));

            const string1 = groups.map(g => g.hex.slice(2)).join(" ");
            const string2 = groups.map(g => g.string).join("");

            constructedString += string2;
            constructedString = constructedString.slice(-100);

            if (lineCount <= 256) {
                if (true || string1.match(/(^0005)|(^0077)|(^0007)/)) {

                    const extraArgs: any[] = [];

                    let finalString = string1;

                    const bits = i.toString(16).toUpperCase();
                    const head = new Array(lineCountHex - bits.length).fill("0").join("");

                    console.log(
                        [
                            `(0x${head}${bits})`,
                            finalString,
                            string2,
                        ].join(" "),
                        ...extraArgs
                    );
                } else {
                    console.log(
                        string1,
                        string2
                    );
                }
            }
        }

        if (printHeaders)
            console.log(`${offsetHeader}--------------------------------------------------------`);

        if (restore) this.offset = oldHeader;
    }

    public async decode(): Promise<this> {
        if (this.buffer) return this;
        if (!this.promiseDecoding) await this._doDecode();
        else await this.promiseDecoding;

        return this;
    }

    protected _doDecode(): Promise<BufferValue> {
        this.ensureReadable();

        if (this.promiseDecoding) return this.promiseDecoding;

        console.log("Started loading package:", this.path);

        return this.handle.promiseDecoding = this.promiseDecoding = new Promise(async resolve => {
            const response = await fetch(this.path);

            if (!response.ok) throw new Error(response.statusText);

            this.buffer = await response.arrayBuffer();

            const signature = this.read(new BufferValue(BufferValue.uint32));
            const HEADER_SIZE = 28;
            const HEADER_VER_OFFSET = 22;

            if (signature.value == 0x0069004C) {
                this.seek(HEADER_VER_OFFSET, "set");

                const version = new TextDecoder("utf-16").decode(this.read(BufferValue.allocBytes(6)).value as DataView);

                this.seek(HEADER_SIZE, "set");

                let tStart;

                if (version.startsWith("1")) {

                    const cryptKey = 0xC1 ^ this.read(new BufferValue(BufferValue.uint8)).value as number;

                    this.contentOffset = HEADER_SIZE;
                    this.seek(0, "set");

                    tStart = performance.now();

                    this.buffer = decoders.decryptModulo(new Uint8Array(this.buffer, HEADER_SIZE), cryptKey);

                    this.read(signature);
                } else if (version.startsWith("4")) {

                    if (gmp === null) {
                        gmp = await _gmp.init();
                    }

                    this.buffer = decoders.rsa.decryptEncdec(gmp, new Uint8Array(this.buffer, HEADER_SIZE));
                    this.contentOffset = 0;
                    this.seek(0, "set");

                } else {
                    throw new Error(`Unsupported file version: ${version}`)
                }

                console.log(`'${this.path}' loaded in ${performance.now() - tStart} ms`);
            }

            resolve(signature);
        });
    }
}

export default UEncodedFile;
export { UEncodedFile };