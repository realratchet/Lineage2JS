import { Blowfish } from "egoroof-blowfish";
import * as GMP from "gmp-wasm";

let gmp: Promise<GMP.GMPLib> = null;

export const LOGIN_STATIC_KEY = new Uint8Array([0x5f, 0x3b, 0x35, 0x2e, 0x5d, 0x39, 0x34, 0x2d, 0x33, 0x31, 0x3d, 0x3d, 0x2d, 0x25, 0x78, 0x54, 0x21, 0x5e, 0x5b, 0x24, 0x00]);
export const LOGIN_RSA_BLOCK_SIZE = 128;
const LOGIN_RSA_EXPONENT = 65537;

function swapWords(data: Uint8Array): Uint8Array {
    const out = new Uint8Array(data.length);

    for (let i = 0; i < data.length; i += 4) {
        out[i] = data[i + 3];
        out[i + 1] = data[i + 2];
        out[i + 2] = data[i + 1];
        out[i + 3] = data[i];
    }

    return out;
}

export class L2Blowfish { // L2 uses little-endian words; egoroof-blowfish uses big-endian.
    protected readonly cipher: Blowfish;

    public constructor(key: Uint8Array) {
        this.cipher = new Blowfish(key, Blowfish.MODE.ECB, Blowfish.PADDING.NULL);
    }

    public encrypt(data: Uint8Array) {
        if (data.length % 8 !== 0) throw new Error(`Blowfish data length ${data.length} is not a multiple of 8.`);

        data.set(swapWords(this.cipher.encode(swapWords(data))));
    }

    public decrypt(data: Uint8Array) { // decode() strips trailing NULL padding.
        if (data.length % 8 !== 0) throw new Error(`Blowfish data length ${data.length} is not a multiple of 8.`);

        const decoded = this.cipher.decode(swapWords(data), Blowfish.TYPE.UINT8_ARRAY);

        data.fill(0);
        data.set(decoded);
        data.set(swapWords(data));
    }
}

export function verifyLoginChecksum(data: Uint8Array): boolean {
    if (data.length % 4 !== 0 || data.length <= 4) return false;

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let checksum = 0;

    for (let i = 0; i < data.length - 4; i += 4) checksum ^= view.getUint32(i, true);

    return (checksum >>> 0) === view.getUint32(data.length - 4, true);
}

export function sealLoginPacket(blowfish: L2Blowfish, payload: Uint8Array): Uint8Array {
    const size = payload.length + 4 + 8 - (payload.length + 4) % 8;
    const data = new Uint8Array(size);
    const view = new DataView(data.buffer);
    let checksum = 0;

    data.set(payload);

    for (let i = 0; i < size - 4; i += 4) checksum ^= view.getUint32(i, true);

    view.setUint32(size - 4, checksum >>> 0, true);
    blowfish.encrypt(data);

    return data;
}

export function openLoginPacket(blowfish: L2Blowfish, data: Uint8Array): Uint8Array {
    blowfish.decrypt(data);

    if (!verifyLoginChecksum(data)) throw new Error(`Login packet checksum mismatch (opcode 0x${data[0].toString(16)}, ${data.length} bytes).`);

    return data;
}

export function unscrambleModulus(scrambled: Uint8Array): Uint8Array {
    if (scrambled.length !== LOGIN_RSA_BLOCK_SIZE) throw new Error(`Login modulus must contain ${LOGIN_RSA_BLOCK_SIZE} bytes, received ${scrambled.length}.`);

    const modulus = scrambled.slice();
    const halfSize = LOGIN_RSA_BLOCK_SIZE / 2, xorTarget = 0x0d, xorSource = 0x34, swapOffset = 0x4d;

    for (let i = 0; i < halfSize; i++) modulus[halfSize + i] ^= modulus[i];
    for (let i = 0; i < 4; i++) modulus[xorTarget + i] ^= modulus[xorSource + i];
    for (let i = 0; i < halfSize; i++) modulus[i] ^= modulus[halfSize + i];
    for (let i = 0; i < 4; i++) {
        const value = modulus[i];

        modulus[i] = modulus[swapOffset + i];
        modulus[swapOffset + i] = value;
    }

    return modulus;
}

function bytesToHex(bytes: Uint8Array) { return [...bytes].map(value => value.toString(16).padStart(2, "0")).join(""); }

export async function encryptRSANoPadding(block: Uint8Array, modulus: Uint8Array): Promise<Uint8Array> {
    if (!block.length || !modulus.length || block.length > modulus.length) throw new Error(`Invalid RSA block/modulus lengths ${block.length}/${modulus.length}.`);
    if (!gmp) gmp = GMP.init();

    const context = (await gmp).getContext();

    try {
        const value = context.Integer(bytesToHex(block), 16), key = context.Integer(bytesToHex(modulus), 16);

        if (key.lessOrEqual(1)) throw new Error(`RSA modulus must be greater than one.`);
        if (value.greaterOrEqual(key)) throw new Error(`RSA block must be smaller than its modulus.`);

        const encoded = value.pow(LOGIN_RSA_EXPONENT, key).toBuffer(false);
        const out = new Uint8Array(modulus.length);

        out.set(encoded, out.length - encoded.length);

        return out;
    } finally { context.destroy(); }
}

export function buildLoginCredentials(account: string, password: string): Uint8Array {
    if (account.length < 1 || account.length > 14) throw new Error(`Account name must be 1..14 characters.`);
    if (password.length < 1 || password.length > 16) throw new Error(`Password must be 1..16 characters.`);

    const block = new Uint8Array(LOGIN_RSA_BLOCK_SIZE);
    const markerOffset = 0x5b, marker = 0x24, accountOffset = 0x5e, passwordOffset = 0x6c;

    block[markerOffset] = marker;

    for (let i = 0; i < account.length; i++) block[accountOffset + i] = account.charCodeAt(i) & 0xff;
    for (let i = 0; i < password.length; i++) block[passwordOffset + i] = password.charCodeAt(i) & 0xff;

    return block;
}

export class GameCrypt {
    protected readonly inKey = new Uint8Array(8);
    protected readonly outKey = new Uint8Array(8);
    protected readonly inKeyView = new DataView(this.inKey.buffer);
    protected readonly outKeyView = new DataView(this.outKey.buffer);
    protected isEnabled = false;

    public setKey(key: Uint8Array) {
        if (key.length !== 8) throw new Error(`Game key must contain 8 bytes, received ${key.length}.`);

        this.inKey.set(key);
        this.outKey.set(key);
        this.isEnabled = true;
    }

    public isActive() { return this.isEnabled; }

    public decrypt(data: Uint8Array) {
        if (!this.isEnabled) return;

        const key = this.inKey;
        let prev = 0;

        for (let i = 0; i < data.length; i++) {
            const encrypted = data[i];

            data[i] = encrypted ^ key[i & 7] ^ prev;
            prev = encrypted;
        }

        this.inKeyView.setUint32(0, this.inKeyView.getUint32(0, true) + data.length, true);
    }

    public encrypt(data: Uint8Array) {
        if (!this.isEnabled) return;

        const key = this.outKey;
        let prev = 0;

        for (let i = 0; i < data.length; i++) {
            prev = data[i] ^ key[i & 7] ^ prev;
            data[i] = prev;
        }

        this.outKeyView.setUint32(0, this.outKeyView.getUint32(0, true) + data.length, true);
    }
}

export default GameCrypt;
