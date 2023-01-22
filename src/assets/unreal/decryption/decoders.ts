import { decryptRSA } from "./decrypt-rsa";

const encDec = [
    "75b4d6de5c016544068a1acf125869f43d2e09fc55b8b1e289556daf9b8757635593446288b3653da1ce91c87bb1a5c18f16323495c55d7d72c0890a83f69bfd1fd9434eb1c02f3e4679edfa43309319070129c267c85604d87bb65bae205de3707af1d2108881abb567c3b3d069ae67c3a4c6a3aa93d26413d4c66094ae2039",
    0x1d
];

const DecodersRSA: Readonly<{
    decryptEncdec: DecryptFunc_T;
}> = Object.freeze({
    decryptEncdec: decryptRSA.bind(undefined, ...encDec)
});

export { decryptModulo } from "./decrypt-modulo";
export { DecodersRSA as rsa };

type DecryptFunc_T = (gmp: import("gmp-wasm").GMPLib, buffer: Uint8Array) => ArrayBuffer;