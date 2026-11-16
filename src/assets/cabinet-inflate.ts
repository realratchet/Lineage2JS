import wasmData from "zlib-streams/zip-module.wasm";
import { Z_OK, Z_STREAM_END, Z_FINISH, Z_BUF_ERROR } from "pako/lib/zlib/constants.js";

type CabinetInflater_T = {
    memory: WebAssembly.Memory;
    malloc(size: number): number;
    inflate_new(): number;
    inflate_init_raw(context: number): number;
    inflate_process(context: number, input: number, inputLength: number, output: number, outputLength: number, flush: number): number;
    inflate_last_consumed(context: number): number;
    inflate_end(context: number): number;
};

const blockSize = 65536;
let inflater: CabinetInflater_T = null;
let inputPointer = 0, outputPointer = 0;

export function inflateCabinetBlock(input: Uint8Array, output: Uint8Array, offset: number = 0, length: number = output.length - offset): number {
    if (!inflater) {
        const bytes = Uint8Array.from(atob(wasmData.slice(wasmData.indexOf(",") + 1)), value => value.charCodeAt(0));

        inflater = new WebAssembly.Instance(new WebAssembly.Module(bytes)).exports as CabinetInflater_T;
        inputPointer = inflater.malloc(blockSize);
        outputPointer = inflater.malloc(blockSize);
        if (!inputPointer || !outputPointer) throw new Error(`Cannot allocate cabinet buffers.`);
    }
    if (input.length >= blockSize) throw new Error(`Cabinet block exceeds its wire length.`);
    const context = inflater.inflate_new();

    if (!context) throw new Error(`Cannot allocate cabinet inflater.`);

    try {
        const initialized = inflater.inflate_init_raw(context);

        if (initialized !== Z_OK) throw new Error(`Cannot initialize cabinet inflater: ${initialized}.`);
        new Uint8Array(inflater.memory.buffer).set(input, inputPointer);
        let read = 0, written = 0;

        while (true) {
            const capacity = Math.min(blockSize, length - written);
            const result = inflater.inflate_process(context, inputPointer + read, input.length - read, outputPointer, capacity, Z_FINISH);
            const status = result >> 24, produced = result & 0xffffff;
            const consumed = inflater.inflate_last_consumed(context);

            if (status !== Z_OK && status !== Z_STREAM_END && status !== Z_BUF_ERROR) throw new Error(`Invalid cabinet block: ${status}.`);
            output.set(new Uint8Array(inflater.memory.buffer, outputPointer, produced), offset + written);
            read += consumed;
            written += produced;

            if (status === Z_STREAM_END) {
                if (read !== input.length) throw new Error(`Trailing cabinet block bytes.`);
                return written;
            }

            if (!produced && !consumed || !capacity) throw new Error(`Incomplete cabinet block: ${status}.`);
        }
    } finally {
        inflater.inflate_end(context);
    }
}

export default inflateCabinetBlock;
