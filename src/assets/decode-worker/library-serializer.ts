/**
 * Binary serializer for sanitized DecodeLibrary objects (plain objects, arrays,
 * primitives, bigints, Maps, Sets, ArrayBuffers and typed arrays - see
 * collect-transferables.ts). Containers and buffers are memoized by identity and
 * encoded as back-references, preserving aliasing and surviving cycles. Anything
 * outside the supported set throws - callers treat that as "not cacheable".
 */

const MAGIC = 0x4c324443; // "L2DC"
const FORMAT_VERSION = 1;

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

    public constructor(buffer: ArrayBuffer) {
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

            writer.u8(Tag.TypedArray);
            writer.u8(kind);
            writer.varint(value.byteLength);
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

function deserializeLibrary(buffer: ArrayBuffer): any {
    const reader = new ByteReader(buffer);

    if (reader.u32() !== MAGIC) throw new Error("Not a decode-cache file");
    if (reader.u8() !== FORMAT_VERSION) throw new Error("Unsupported decode-cache format version");

    const refs: any[] = [];

    function read(): any {
        const tag = reader.u8() as Tag;

        switch (tag) {
            case Tag.Null: return null;
            case Tag.Undefined: return undefined;
            case Tag.False: return false;
            case Tag.True: return true;
            case Tag.Number: return reader.f64();
            case Tag.String: return reader.string();
            case Tag.BigInt: return BigInt(reader.string());
            case Tag.BackRef: return refs[reader.varint()];
            case Tag.ArrayBuffer: {
                const bytes = reader.take(reader.varint()).slice();
                refs.push(bytes.buffer);
                return bytes.buffer;
            }
            case Tag.TypedArray: {
                const kind = reader.u8();
                const byteLength = reader.varint();
                const bytes = reader.take(byteLength).slice(); // copy re-aligns and detaches from the file buffer
                const Constructor = TYPED_ARRAY_KINDS[kind] as any;
                const bytesPerElement = Constructor.BYTES_PER_ELEMENT ?? 1;
                const view = new Constructor(bytes.buffer, 0, byteLength / bytesPerElement);

                refs.push(view);
                return view;
            }
            case Tag.Object: {
                const value: Record<string, any> = {};
                refs.push(value);

                const count = reader.varint();
                for (let i = 0; i < count; i++) {
                    const key = reader.string();
                    value[key] = read();
                }
                return value;
            }
            case Tag.Array: {
                const length = reader.varint();
                const value = new Array(length);
                refs.push(value);

                for (let i = 0; i < length; i++) value[i] = read();
                return value;
            }
            case Tag.Map: {
                const value = new Map();
                refs.push(value);

                const count = reader.varint();
                for (let i = 0; i < count; i++) {
                    const key = read();
                    value.set(key, read());
                }
                return value;
            }
            case Tag.Set: {
                const value = new Set();
                refs.push(value);

                const count = reader.varint();
                for (let i = 0; i < count; i++) value.add(read());
                return value;
            }
            default: throw new Error(`Corrupt decode-cache file (unknown tag ${tag})`);
        }
    }

    return read();
}

export { serializeLibrary, deserializeLibrary };
