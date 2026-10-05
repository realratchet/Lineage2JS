import { Blowfish } from "egoroof-blowfish";

export const LOGIN_STATIC_KEY = new Uint8Array([0x5f, 0x3b, 0x35, 0x2e, 0x5d, 0x39, 0x34, 0x2d, 0x33, 0x31, 0x3d, 0x3d, 0x2d, 0x25, 0x78, 0x54, 0x21, 0x5e, 0x5b, 0x24, 0x00]);

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

export class L2Blowfish { // BlowfishEngine.BytesTo32bits reads little-endian words; egoroof-blowfish is big-endian.
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

        data.set(swapWords((this.cipher as any)._decodeECB(swapWords(data))));
    }
}

export function verifyLoginChecksum(data: Uint8Array): boolean {
    if (data.length % 4 !== 0 || data.length <= 4) return false;

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let checksum = 0;

    for (let i = 0; i < data.length - 4; i += 4) checksum ^= view.getUint32(i, true);

    return (checksum >>> 0) === view.getUint32(data.length - 4, true);
}

export function sealLoginPacket(blowfish: L2Blowfish, payload: Uint8Array): Uint8Array { // LoginCrypt.encrypt: reserve 4 checksum bytes, pad to a multiple of 8, then Blowfish.
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

export function unscrambleModulus(scrambled: Uint8Array): Uint8Array { // Inverse of LoginController.ScrambledKeyPair.scrambleModulus, steps applied in reverse.
    const m = scrambled.slice();

    for (let i = 0; i < 0x40; i++) m[0x40 + i] ^= m[i];
    for (let i = 0; i < 4; i++) m[0x0d + i] ^= m[0x34 + i];
    for (let i = 0; i < 0x40; i++) m[i] ^= m[0x40 + i];
    for (let i = 0; i < 4; i++) {
        const tmp = m[i];

        m[i] = m[0x4d + i];
        m[0x4d + i] = tmp;
    }

    return m;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
    let value = 0n;

    for (let i = 0; i < bytes.length; i++) value = (value << 8n) | BigInt(bytes[i]);

    return value;
}

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
    let result = 1n;

    base %= modulus;

    while (exponent > 0n) {
        if (exponent & 1n) result = result * base % modulus;
        base = base * base % modulus;
        exponent >>= 1n;
    }

    return result;
}

export function encryptRSANoPadding(block: Uint8Array, modulus: Uint8Array): Uint8Array { // RSA/ECB/NoPadding with e = 65537 (RSAKeyGenParameterSpec.F4).
    let value = modPow(bytesToBigInt(block), 65537n, bytesToBigInt(modulus));
    const out = new Uint8Array(modulus.length);

    for (let i = out.length - 1; i >= 0; i--) {
        out[i] = Number(value & 0xffn);
        value >>= 8n;
    }

    return out;
}

export function buildLoginCredentials(account: string, password: string): Uint8Array { // RequestAuthLogin.getOffset expects the C4 layout: marker 0x24 at 0x5b, account at 0x5e, password at 0x6c.
    if (account.length < 1 || account.length > 14) throw new Error(`Account name must be 1..14 characters.`);
    if (password.length < 1 || password.length > 16) throw new Error(`Password must be 1..16 characters.`);

    const block = new Uint8Array(128);

    block[0x5b] = 0x24;

    for (let i = 0; i < account.length; i++) block[0x5e + i] = account.charCodeAt(i) & 0xff;
    for (let i = 0; i < password.length; i++) block[0x6c + i] = password.charCodeAt(i) & 0xff;

    return block;
}

export class GameCrypt {
    protected readonly inKey = new Uint8Array(8);
    protected readonly outKey = new Uint8Array(8);
    protected isEnabled = false;

    public setKey(key: Uint8Array) {
        this.inKey.set(key.subarray(0, 8));
        this.outKey.set(key.subarray(0, 8));
        this.isEnabled = true;
    }

    public isActive() { return this.isEnabled; }

    protected static advance(key: Uint8Array, size: number) {
        const old = (key[0] | (key[1] << 8) | (key[2] << 16) | (key[3] << 24)) + size;

        key[0] = old & 0xff;
        key[1] = (old >>> 8) & 0xff;
        key[2] = (old >>> 16) & 0xff;
        key[3] = (old >>> 24) & 0xff;
    }

    public decrypt(data: Uint8Array) {
        if (!this.isEnabled) return;

        const key = this.inKey;
        let prev = 0;

        for (let i = 0; i < data.length; i++) {
            const enc = data[i];

            data[i] = enc ^ key[i & 7] ^ prev;
            prev = enc;
        }

        GameCrypt.advance(key, data.length);
    }

    public encrypt(data: Uint8Array) {
        if (!this.isEnabled) return;

        const key = this.outKey;
        let prev = 0;

        for (let i = 0; i < data.length; i++) {
            prev = data[i] ^ key[i & 7] ^ prev;
            data[i] = prev;
        }

        GameCrypt.advance(key, data.length);
    }
}
