/**
 * Binary serializer for sanitized DecodeLibrary objects (plain objects, arrays,
 * primitives, bigints, Maps, Sets, ArrayBuffers and typed arrays - see
 * collect-transferables.ts). Containers and buffers are memoized by identity and
 * encoded as back-references, preserving aliasing and surviving cycles. Anything
 * outside the supported set throws - callers treat that as "not cacheable".
 */

const MAGIC = 0x4c324443; // "L2DC"
const FORMAT_VERSION = 1;
const DECODE_FRAME_MS = 2;
const DECODE_STEP_BATCH = 2048;
const BUFFER_COPY_CHUNK_SIZE = 256 * 1024;

const decodeYieldQueue: (() => void)[] = [];
const decodeYieldChannel = new MessageChannel();

decodeYieldChannel.port1.onmessage = () => decodeYieldQueue.shift()!();

function yieldDecode(): Promise<void> {
    return new Promise(resolve => {
        decodeYieldQueue.push(resolve);
        decodeYieldChannel.port2.postMessage(0);
    });
}

const enum Tag {
    Null = 0,
    Undefined = 1,
    False = 2,
    True = 3,
    Number = 4,
    String = 5,
    BigInt = 6,
    Object = 7,
    Array = 8,
    Map = 9,
    Set = 10,
    ArrayBuffer = 11,
    TypedArray = 12,
    BackRef = 13,
}

const TYPED_ARRAY_KINDS: (new (buffer: ArrayBuffer, byteOffset?: number, length?: number) => ArrayBufferView)[] = [
    Int8Array, Uint8Array, Uint8ClampedArray,
    Int16Array, Uint16Array,
    Int32Array, Uint32Array,
    Float32Array, Float64Array,
    BigInt64Array, BigUint64Array,
    DataView
];

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

class ByteWriter {
    protected buffer = new ArrayBuffer(1 << 20);
    protected view = new DataView(this.buffer);
    protected bytes = new Uint8Array(this.buffer);
    public length = 0;

    protected ensure(extra: number) {
        if (this.length + extra <= this.buffer.byteLength) return;

        let size = this.buffer.byteLength * 2;
        while (size < this.length + extra) size *= 2;

        const next = new ArrayBuffer(size);
        new Uint8Array(next).set(this.bytes.subarray(0, this.length));

        this.buffer = next;
        this.view = new DataView(next);
        this.bytes = new Uint8Array(next);
    }

    public u8(value: number) {
        this.ensure(1);
        this.bytes[this.length++] = value;
    }

    public u32(value: number) {
        this.ensure(4);
        this.view.setUint32(this.length, value, true);
        this.length += 4;
    }

    public f64(value: number) {
        this.ensure(8);
        this.view.setFloat64(this.length, value, true);
        this.length += 8;
    }

    public varint(value: number) { // unsigned LEB128
        this.ensure(10);
        while (value > 0x7f) {
            this.bytes[this.length++] = (value & 0x7f) | 0x80;
            value = Math.floor(value / 128);
        }
        this.bytes[this.length++] = value;
    }

    public blob(src: Uint8Array) {
        this.ensure(src.length);
        this.bytes.set(src, this.length);
        this.length += src.length;
    }

    public align(alignment: number) {
        const padding = (alignment - this.length % alignment) % alignment;

        this.ensure(padding);
        this.length += padding;
    }

    public string(value: string) {
        const encoded = textEncoder.encode(value);
        this.varint(encoded.length);
        this.blob(encoded);
    }

    public result(): Uint8Array {
        return this.bytes.slice(0, this.length); // slice releases the (possibly 2x) growth buffer
    }
}

class ByteReader {
    protected view: DataView;
    protected bytes: Uint8Array;
    public offset = 0;
    public readonly buffer: ArrayBuffer;

    public constructor(buffer: ArrayBuffer) {
        this.buffer = buffer;
        this.view = new DataView(buffer);
        this.bytes = new Uint8Array(buffer);
    }

    public u8(): number { return this.bytes[this.offset++]; }

    public u32(): number {
        const value = this.view.getUint32(this.offset, true);
        this.offset += 4;
        return value;
    }

    public f64(): number {
        const value = this.view.getFloat64(this.offset, true);
        this.offset += 8;
        return value;
    }

    public varint(): number {
        let value = 0, shift = 1, byte: number;

        do {
            byte = this.bytes[this.offset++];
            value += (byte & 0x7f) * shift;
            shift *= 128;
        } while (byte & 0x80);

        return value;
    }

    public take(length: number): Uint8Array {
        const view = this.bytes.subarray(this.offset, this.offset + length);
        this.offset += length;
        return view;
    }

    public align(alignment: number) {
        this.offset += (alignment - this.offset % alignment) % alignment;
    }

    public string(): string {
        return textDecoder.decode(this.take(this.varint()));
    }
}

function serializeLibrary(root: any): Uint8Array {
    const writer = new ByteWriter();
    const memo = new Map<any, number>();
    let nextRef = 0;

    function write(value: any) {
        if (value === null) return writer.u8(Tag.Null);
        if (value === undefined) return writer.u8(Tag.Undefined);

        switch (typeof value) {
            case "boolean": return writer.u8(value ? Tag.True : Tag.False);
            case "number": writer.u8(Tag.Number); return writer.f64(value);
            case "string": writer.u8(Tag.String); return writer.string(value);
            case "bigint": writer.u8(Tag.BigInt); return writer.string(value.toString());
            case "object": break;
            default: throw new Error(`Cannot serialize a '${typeof value}' value`);
        }

        const ref = memo.get(value);
        if (ref !== undefined) {
            writer.u8(Tag.BackRef);
            return writer.varint(ref);
        }
        memo.set(value, nextRef++);

        if (value instanceof ArrayBuffer) {
            writer.u8(Tag.ArrayBuffer);
            writer.varint(value.byteLength);
            return writer.blob(new Uint8Array(value));
        }

        if (ArrayBuffer.isView(value)) {
            const kind = TYPED_ARRAY_KINDS.indexOf(value.constructor as any);
            if (kind < 0) throw new Error(`Cannot serialize a '${value.constructor.name}' view`);
            const bytesPerElement = (value.constructor as any).BYTES_PER_ELEMENT ?? 1;

            writer.u8(Tag.TypedArray);
            writer.u8(kind);
            writer.varint(value.byteLength);
            writer.align(bytesPerElement);
            return writer.blob(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
        }

        if (value instanceof Map) {
            writer.u8(Tag.Map);
            writer.varint(value.size);
            for (const [key, entry] of value) {
                write(key);
                write(entry);
            }
            return;
        }

        if (value instanceof Set) {
            writer.u8(Tag.Set);
            writer.varint(value.size);
            for (const entry of value) write(entry);
            return;
        }

        if (Array.isArray(value)) {
            writer.u8(Tag.Array);
            writer.varint(value.length);
            for (let i = 0; i < value.length; i++) write(value[i]);
            return;
        }

        const proto = Object.getPrototypeOf(value);
        if (proto !== Object.prototype && proto !== null)
            throw new Error(`Cannot serialize a '${value.constructor?.name ?? "?"}' instance`);

        const keys = Object.keys(value);

        writer.u8(Tag.Object);
        writer.varint(keys.length);
        for (const key of keys) {
            writer.string(key);
            write(value[key]);
        }
    }

    writer.u32(MAGIC);
    writer.u8(FORMAT_VERSION);
    /* the root is a DecodeLibrary class instance - store its fields as a plain object */
    write(Object.assign({}, root));

    return writer.result();
}

type ObjectFrame_T = { type: "object", value: Record<string, any>, index: number, count: number };
type ArrayFrame_T = { type: "array", value: any[], index: number, count: number };
type MapFrame_T = { type: "map", value: Map<any, any>, index: number, count: number, key: any, hasKey: boolean };
type SetFrame_T = { type: "set", value: Set<any>, index: number, count: number };
type BufferFrame_T = { type: "buffer", value: ArrayBuffer, index: number, count: number, sourceOffset: number };
type DecoderFrame_T = ObjectFrame_T | ArrayFrame_T | MapFrame_T | SetFrame_T | BufferFrame_T;

class LibraryDecoder {
    protected readonly reader: ByteReader;
    protected readonly refs: any[] = [];
    protected readonly frames: DecoderFrame_T[] = [];
    protected nextFrame: DecoderFrame_T = null;
    protected hasRoot = false;
    protected root: any;

    public constructor(buffer: ArrayBuffer) {
        this.reader = new ByteReader(buffer);

        if (this.reader.u32() !== MAGIC) throw new Error("Not a decode-cache file");
        if (this.reader.u8() !== FORMAT_VERSION) throw new Error("Unsupported decode-cache format version");
    }

    protected readValue(): any {
        const tag = this.reader.u8() as Tag;

        this.nextFrame = null;

        switch (tag) {
            case Tag.Null: return null;
            case Tag.Undefined: return undefined;
            case Tag.False: return false;
            case Tag.True: return true;
            case Tag.Number: return this.reader.f64();
            case Tag.String: return this.reader.string();
            case Tag.BigInt: return BigInt(this.reader.string());
            case Tag.BackRef: return this.refs[this.reader.varint()];
            case Tag.ArrayBuffer: {
                const count = this.reader.varint();
                const sourceOffset = this.reader.offset;
                const value = new ArrayBuffer(count);

                this.reader.offset += count;
                this.refs.push(value);
                this.nextFrame = { type: "buffer", value, index: 0, count, sourceOffset };
                return value;
            }
            case Tag.TypedArray: {
                const kind = this.reader.u8();
                const byteLength = this.reader.varint();
                const Constructor = TYPED_ARRAY_KINDS[kind] as any;
                const bytesPerElement = Constructor.BYTES_PER_ELEMENT ?? 1;

                this.reader.align(bytesPerElement);

                const value = new Constructor(this.reader.buffer, this.reader.offset, byteLength / bytesPerElement);

                this.reader.offset += byteLength;
                this.refs.push(value);
                return value;
            }
            case Tag.Object: {
                const value: Record<string, any> = {};

                this.refs.push(value);
                this.nextFrame = { type: "object", value, index: 0, count: this.reader.varint() };
                return value;
            }
            case Tag.Array: {
                const count = this.reader.varint();
                const value = new Array(count);

                this.refs.push(value);
                this.nextFrame = { type: "array", value, index: 0, count };
                return value;
            }
            case Tag.Map: {
                const value = new Map();

                this.refs.push(value);
                this.nextFrame = { type: "map", value, index: 0, count: this.reader.varint(), key: undefined, hasKey: false };
                return value;
            }
            case Tag.Set: {
                const value = new Set();

                this.refs.push(value);
                this.nextFrame = { type: "set", value, index: 0, count: this.reader.varint() };
                return value;
            }
            default: throw new Error(`Corrupt decode-cache file (unknown tag ${tag})`);
        }
    }

    protected pushNextFrame(): void {
        if (this.nextFrame) this.frames.push(this.nextFrame);
    }

    public step(): boolean {
        while (this.frames.length > 0) {
            const frame = this.frames[this.frames.length - 1];
            const complete = frame.index >= frame.count && (frame.type !== "map" || !frame.hasKey);

            if (!complete) break;
            this.frames.pop();
        }

        if (!this.hasRoot) {
            this.root = this.readValue();
            this.hasRoot = true;
            this.pushNextFrame();
            return true;
        }

        if (this.frames.length === 0) return false;

        const frame = this.frames[this.frames.length - 1];

        switch (frame.type) {
            case "object": {
                const key = this.reader.string();
                frame.value[key] = this.readValue();
                frame.index++;
                break;
            }
            case "array": {
                frame.value[frame.index++] = this.readValue();
                break;
            }
            case "map": {
                if (!frame.hasKey) {
                    frame.key = this.readValue();
                    frame.hasKey = true;
                } else {
                    frame.value.set(frame.key, this.readValue());
                    frame.key = undefined;
                    frame.hasKey = false;
                    frame.index++;
                }
                break;
            }
            case "set": {
                frame.value.add(this.readValue());
                frame.index++;
                break;
            }
            case "buffer": {
                const length = Math.min(BUFFER_COPY_CHUNK_SIZE, frame.count - frame.index);
                const source = new Uint8Array(this.reader.buffer, frame.sourceOffset + frame.index, length);

                new Uint8Array(frame.value, frame.index, length).set(source);
                frame.index += length;
                return true;
            }
        }

        this.pushNextFrame();
        return true;
    }

    public result(): any {
        return this.root;
    }
}

function isSerializedLibrary(buffer: ArrayBuffer): boolean {
    if (buffer.byteLength < 5) return false;

    const view = new DataView(buffer);

    return view.getUint32(0, true) === MAGIC && view.getUint8(4) === FORMAT_VERSION;
}

function deserializeLibrary(buffer: ArrayBuffer): any {
    const decoder = new LibraryDecoder(buffer);

    while (decoder.step()) { }

    return decoder.result();
}

async function deserializeLibraryAsync(buffer: ArrayBuffer): Promise<any> {
    const decoder = new LibraryDecoder(buffer);

    while (true) {
        const deadline = performance.now() + DECODE_FRAME_MS;

        do {
            for (let i = 0; i < DECODE_STEP_BATCH; i++)
                if (!decoder.step()) return decoder.result();
        } while (performance.now() < deadline);

        await yieldDecode();
    }
}

export { serializeLibrary, deserializeLibrary, deserializeLibraryAsync, isSerializedLibrary };
