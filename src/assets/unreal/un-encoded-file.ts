import BufferValue from "../buffer-value";
import * as forge from "node-forge";
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
        if (gmp === null) {
            gmp = await _gmp.init();
        }


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
                    const modulus = 0x97df398472ddf737ef0a0cd17e8d172f0fef1661a38a8ae1d6e829bc1c6e4c3cfc19292dda9ef90175e46e7394a18850b6417d03be6eea274d3ed1dde5b5d7bde72cc0a0b71d03608655633881793a02c9a67d9ef2b45eb7c08d4be329083ce450e68f7867b6749314d40511d09bc5744551baa86a89dc38123dc1668fd72d83n;
                    const exponent = 0x35n;

                    this.contentOffset = HEADER_SIZE;
                    this.seek(0, "set");

                    const _modulus = new forge.jsbn.BigInteger("97df398472ddf737ef0a0cd17e8d172f0fef1661a38a8ae1d6e829bc1c6e4c3cfc19292dda9ef90175e46e7394a18850b6417d03be6eea274d3ed1dde5b5d7bde72cc0a0b71d03608655633881793a02c9a67d9ef2b45eb7c08d4be329083ce450e68f7867b6749314d40511d09bc5744551baa86a89dc38123dc1668fd72d83", 16);
                    const _exponent = new forge.jsbn.BigInteger("35", 16);
                    const _zero = new forge.jsbn.BigInteger("0", 10);

                    const _buffer = (this.read(BufferValue.allocBytes(128)).value as DataView).buffer;
                    const int8arr = new Int8Array(_buffer);
                    const uint8arr = new Uint8Array(_buffer);

                    const o = 0;
                    const slice = int8arr.slice(0 + o, 128 + o);

                    const _forge = forge;

                    const byteString = [...uint8arr].map(x => ("0" + x.toString(16)).slice(-2)).join("");
                    // const byteString = "0000ffff"

                    const modulus2 = "75b4d6de5c016544068a1acf125869f43d2e09fc55b8b1e289556daf9b8757635593446288b3653da1ce91c87bb1a5c18f16323495c55d7d72c0890a83f69bfd1fd9434eb1c02f3e4679edfa43309319070129c267c85604d87bb65bae205de3707af1d2108881abb567c3b3d069ae67c3a4c6a3aa93d26413d4c66094ae2039";
                    const exponent2 = 0x1d;

                    const gmpModulus = gmp.binding.mpz_t();
                    let strPtr = gmp.binding.malloc_cstr(modulus2);
                    gmp.binding.mpz_init_set_str(gmpModulus, strPtr, 16);
                    gmp.binding.free(strPtr);

                    const gmpValue = gmp.binding.mpz_t();
                    strPtr = gmp.binding.malloc_cstr(byteString);
                    gmp.binding.mpz_init_set_str(gmpValue, strPtr, 16);
                    gmp.binding.free(strPtr);

                    // const num1Ptr = gmp.binding.mpz_t();
                    // gmp.binding.mpz_init_set_si(num1Ptr, 0xffff);

                    const gmpResult = gmp.binding.mpq_t();
                    gmp.binding.mpq_init(gmpResult);

                    const rop = gmpResult;
                    const base = gmpValue;
                    const exp = exponent2;
                    const mod = gmpModulus;

                    gmp.binding.mpz_powm_ui(rop, base, exp, mod);

                    const ropString = (new Array(byteString.length).fill("0").join("") + gmp.binding.mpz_to_string(gmpResult, 16)).slice(-byteString.length);

                    const back = new Int8Array(ropString.match(/.{2}/g).map(x => parseInt(x, 16)));
                    const asNumber = new Int32Array(back.buffer);

                    const size = back[3] & 0xff;

                    if (size > 124)
                        debugger;

                    const startPosition = 128 - size - ((124 - size) % 4);
                    const position = 0;

                    debugger;

                    // const gmpResult = gmp.binding.malloc(128);


                    // strPtr = gmp.binding.malloc_cstr(new Array(byteString.length).fill(" ").join(""))

                    const _slice = gmp.binding.mem.slice(5330816, 5330816 + 128);

                    console.log(gmp.binding.mpz_get_si(gmpValue));

                    // gmp.binding.free(strPtr);

                    debugger;

                    // const pkey = _forge.pki.rsa.setPrivateKey(_modulus, _exponent, _zero, _zero, _zero, _zero, _zero, _zero);
                    const pkey = _forge.pki.privateKeyFromPem(`-----BEGIN RSA PRIVATE KEY-----
                    MIGzAgEAMA0GCSqGSIb3DQEBAQUABIGeMIGbAgEAAoGAdbTW3lwBZUQGihrPElhp
                    9D0uCfxVuLHiiVVtr5uHV2NVk0RiiLNlPaHOkch7saXBjxYyNJXFXX1ywIkKg/ab
                    /R/ZQ06xwC8+Rnnt+kMwkxkHASnCZ8hWBNh7tluuIF3jcHrx0hCIgau1Z8Oz0Gmu
                    Z8OkxqOqk9JkE9TGYJSuIDkCAQACAR0CAQACAQACAQACAQACAQA=
                    -----END RSA PRIVATE KEY-----`)

                    const decyphered = pkey.decrypt(slice, "RAW");
                    765875200

                    const eb = new forge.util.ByteStringBuffer(decyphered);

                    const a = new Int8Array(128);

                    for (let i = 0; i < 128; i++) {
                        a[i] = new Int8Array(new Uint8Array([eb.getByte()]).buffer)[0];
                    }


                    debugger;
                } else {


                    throw new Error(`Unsupported file version: ${version}`)
                }

                console.log(`'${this.path}' loaded in ${performance.now() - tStart} ms`);
                // this.isEncrypted = false;

                // debugger;
            }

            resolve(signature);
        });
    }
}

export default UEncodedFile;
export { UEncodedFile };