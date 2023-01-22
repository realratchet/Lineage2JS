import { Inflate } from "pako";

type GMPLib = import("gmp-wasm").GMPLib;
type mpz_ptr = import("gmp-wasm").mpz_ptr;

const BLOCK_SIZE = 128;

class RSADecoder {
    protected gmp: GMPLib;
    protected buffer: Uint8Array;
    protected encodedBuffer: Uint8Array;
    protected startPosition = 0;
    protected position = 0;
    protected readOffset = 0;
    protected size = 0;
    protected rop: mpz_ptr;
    protected mod: mpz_ptr;
    protected base: mpz_ptr;
    protected exp: number;
    protected archiveSize = 0;

    constructor(gmp: GMPLib, modulus: string, exponent: number, buffer: Uint8Array) {
        this.gmp = gmp;
        this.encodedBuffer = buffer;

        const rop = gmp.binding.mpq_t();
        gmp.binding.mpq_init(rop);

        const mod = gmp.binding.mpz_t();
        const ptrStrModulus = gmp.binding.malloc_cstr(modulus);
        gmp.binding.mpz_init_set_str(mod, ptrStrModulus, 16);
        gmp.binding.free(ptrStrModulus);

        const base = gmp.binding.mpz_t();

        this.rop = rop;
        this.exp = exponent;
        this.mod = mod;
        this.base = base;

        this.ensureFilled();
        this.archiveSize = new DataView(this.buffer.buffer, this.startPosition).getUint32(0, true);
        this.position = this.position + 4;
    }

    public cleanup() {
        this.gmp.binding.free(this.rop);
        this.gmp.binding.free(this.mod);
        this.gmp.binding.free(this.base);
    }

    protected *read() {
        while (this.ensureFilled()) {
            const val = new Uint8Array(this.size - this.position);

            for (let i = this.position, j = 0; i < this.size; i++, j++) {
                val[j] = this.buffer[this.startPosition + this.position++] & 0xFF;
            }

            yield val;
        }
    }

    protected ensureFilled() {

        if (this.position !== this.size)
            return true;

        const { gmp, rop, base, mod, exp } = this;

        if (this.readOffset + BLOCK_SIZE >= this.encodedBuffer.length)
            return false;   // padding

        const buffer = this.encodedBuffer.slice(this.readOffset, this.readOffset + BLOCK_SIZE);
        const uint8arr = new Uint8Array(buffer);
        const byteString = [...uint8arr].map(x => ("0" + x.toString(16)).slice(-2)).join("");

        const gmpStrBase = gmp.binding.malloc_cstr(byteString);
        gmp.binding.mpz_init_set_str(base, gmpStrBase, 16);

        gmp.binding.mpz_powm_ui(rop, base, exp, mod);

        gmp.binding.free(gmpStrBase);

        const ropString = (new Array(byteString.length).fill("0").join("") + gmp.binding.mpz_to_string(rop, 16)).slice(-byteString.length);
        this.buffer = new Uint8Array(ropString.match(/.{2}/g).map(x => parseInt(x, 16)));

        this.size = this.buffer[3] & 0xff;

        console.assert(this.size >= 0 && this.size <= (BLOCK_SIZE - 4), "Invalid block size.");

        this.startPosition = BLOCK_SIZE - this.size - (((BLOCK_SIZE - 4) - this.size) % 4);
        this.position = 0;
        this.readOffset = this.readOffset + this.startPosition + this.size;

        return true;
    }

    public decode() {
        const inflator = new Inflate({ raw: false });

        for (let byte of this.read())
            inflator.push(byte);

        const result = inflator.result as Uint8Array;

        console.assert(result.byteLength === this.archiveSize, "Archive is damaged.");

        return result.buffer;
    }
}


function decryptRSA(modulus: string, exponent: number, gmp: import("gmp-wasm").GMPLib, buffer: Uint8Array) {
    const rsa = new RSADecoder(gmp, modulus, exponent, buffer);

    const decoded = rsa.decode();

    rsa.cleanup();

    return decoded;
}

export default decryptRSA;
export { decryptRSA };