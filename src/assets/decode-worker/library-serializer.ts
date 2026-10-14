const MAGIC = 0x4c324443; // "L2DC"
const FORMAT_VERSION = 5;
const HEADER_SIZE = 13;
const CHUNK_ENTRY_SIZE = 12;
const ARRAY_BUFFER_KIND = 0xff;
const CHUNK_ALIGNMENT = 8;
const RANGE_GAP = 4096;
const RANGE_SIZE = 16 * 1024 * 1024;
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
    Chunk = 14,
}

type LibraryChunkEntry_T = { offset: number, length: number };
type LibraryChunkRef_T = { isLibraryChunk: true, index: number, kind: number, byteLength: number };
type LibraryChunkSource_T = { kind: number, bytes: Uint8Array | Blob, offset?: number, length?: number };
type LibraryBlobRange_T = { file: Blob, offset: number, end: number, padding: number };
type LibraryChunkRange_T = { offset: number, end: number, refs: LibraryChunkRef_T[] };
export type SeekableLibrary_T = { file: Blob, library: any, entries: LibraryChunkEntry_T[], values: Map<number, any> };

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
    protected cacheStrings = new Map<string, number>();
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
        const index = this.cacheStrings.get(value);

        if (index !== undefined) return this.varint(index * 2);

        this.cacheStrings.set(value, this.cacheStrings.size);
        const encoded = textEncoder.encode(value);
        this.varint(encoded.length * 2 + 1);
        this.blob(encoded);
    }

    public result(): Uint8Array {
        return this.bytes.slice(0, this.length); // slice releases the (possibly 2x) growth buffer
    }
}

class ByteReader {
    protected arrStrings: string[] = [];
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
        const code = this.varint();

        if (code % 2 === 0) {
            const index = code / 2;

            if (index >= this.arrStrings.length) throw new Error(`Invalid string reference '${index}'`);

            return this.arrStrings[index];
        }

        const length = (code - 1) / 2;

        if (length > this.bytes.length - this.offset) throw new Error(`Truncated decode-cache string`);

        const value = textDecoder.decode(this.take(length));

        this.arrStrings.push(value);
        return value;
    }
}

export function serializeLibrary(root: any): Uint8Array {
    return encodeLibrary(root, null, false) as Uint8Array;
}

export function serializeLibraryBlob(root: any, seekable: SeekableLibrary_T = null): Blob {
    return encodeLibrary(root, seekable, true) as Blob;
}

function encodeLibrary(root: any, seekable: SeekableLibrary_T, asBlob: boolean): Uint8Array | Blob {
    const writer = new ByteWriter();
    const memo = new Map<any, number>();
    const chunks: LibraryChunkSource_T[] = [];
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

        if (value.isLibraryChunk === true) {
            if (!seekable) throw new Error(`Cannot store an unresolved library chunk.`);

            const entry = seekable.entries[value.index];

            if (!entry || entry.length !== value.byteLength) throw new Error(`Corrupt decode-cache chunk '${value.index}'`);

            writer.u8(Tag.Chunk);
            writer.u8(value.kind);
            writer.varint(chunks.length);
            writer.varint(value.byteLength);
            chunks.push({ kind: value.kind, bytes: seekable.file, offset: entry.offset, length: entry.length });
            return;
        }

        if (value instanceof ArrayBuffer || value instanceof Blob) {
            if (value instanceof Blob && !asBlob) throw new Error(`File-backed chunks require blob serialization.`);

            const byteLength = value instanceof Blob ? value.size : value.byteLength;

            writer.u8(Tag.Chunk);
            writer.u8(ARRAY_BUFFER_KIND);
            writer.varint(chunks.length);
            writer.varint(byteLength);
            chunks.push({ kind: ARRAY_BUFFER_KIND, bytes: value instanceof Blob ? value : new Uint8Array(value) });
            return;
        }

        if (ArrayBuffer.isView(value)) {
            const kind = TYPED_ARRAY_KINDS.indexOf(value.constructor as any);
            if (kind < 0) throw new Error(`Cannot serialize a '${value.constructor.name}' view`);
            writer.u8(Tag.Chunk);
            writer.u8(kind);
            writer.varint(chunks.length);
            writer.varint(value.byteLength);
            chunks.push({ kind, bytes: new Uint8Array(value.buffer, value.byteOffset, value.byteLength) });
            return;
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

    write(Object.assign({}, root));

    const metadata = writer.result();
    const directorySize = chunks.length * CHUNK_ENTRY_SIZE;
    let length = HEADER_SIZE + directorySize + metadata.length;

    length += (CHUNK_ALIGNMENT - length % CHUNK_ALIGNMENT) % CHUNK_ALIGNMENT;
    for (const chunk of chunks) {
        const byteLength = chunk.length ?? (chunk.bytes instanceof Blob ? chunk.bytes.size : chunk.bytes.length);

        if (byteLength > 0xffffffff) throw new Error(`Decode-cache chunk exceeds 4 GiB.`);

        length += byteLength;
        length += (CHUNK_ALIGNMENT - length % CHUNK_ALIGNMENT) % CHUNK_ALIGNMENT;
    }

    const result = new Uint8Array(asBlob ? HEADER_SIZE + directorySize + metadata.length + (CHUNK_ALIGNMENT - (HEADER_SIZE + directorySize + metadata.length) % CHUNK_ALIGNMENT) % CHUNK_ALIGNMENT : length);
    const parts: BlobPart[] = [result];
    const view = new DataView(result.buffer);
    let offset = HEADER_SIZE + directorySize;
    let directoryOffset = HEADER_SIZE;
    let range: LibraryBlobRange_T = null;

    function flushRange() {
        if (!range) return;

        parts.push(range.file.slice(range.offset, range.end));
        if (range.padding) parts.push(new Uint8Array(range.padding));
        range = null;
    }

    view.setUint32(0, MAGIC, true);
    view.setUint8(4, FORMAT_VERSION);
    view.setUint32(5, metadata.length, true);
    view.setUint32(9, chunks.length, true);
    result.set(metadata, offset);
    offset += metadata.length;
    offset += (CHUNK_ALIGNMENT - offset % CHUNK_ALIGNMENT) % CHUNK_ALIGNMENT;

    for (const chunk of chunks) {
        view.setFloat64(directoryOffset, offset, true);
        const byteLength = chunk.length ?? (chunk.bytes instanceof Blob ? chunk.bytes.size : chunk.bytes.length);

        view.setUint32(directoryOffset + 8, byteLength, true);
        directoryOffset += CHUNK_ENTRY_SIZE;
        offset += byteLength;
        const padding = (CHUNK_ALIGNMENT - offset % CHUNK_ALIGNMENT) % CHUNK_ALIGNMENT;

        if (asBlob && chunk.offset !== undefined) {
            if (range && range.file === chunk.bytes && chunk.offset === range.end + range.padding) {
                range.end = chunk.offset + byteLength;
                range.padding = padding;
            } else {
                flushRange();
                range = { file: chunk.bytes as Blob, offset: chunk.offset, end: chunk.offset + byteLength, padding };
            }
        } else {
            flushRange();
            if (asBlob) {
                parts.push(chunk.bytes);
                if (padding) parts.push(new Uint8Array(padding));
            } else result.set(chunk.bytes as Uint8Array, offset - byteLength);
        }
        offset += padding;
    }

    flushRange();

    return asBlob ? new Blob(parts) : result;
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

    protected readonly chunks: (index: number, kind: number, byteLength: number) => any;

    public constructor(buffer: ArrayBuffer, offset: number, chunks: (index: number, kind: number, byteLength: number) => any) {
        this.reader = new ByteReader(buffer);
        this.reader.offset = offset;
        this.chunks = chunks;
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
            case Tag.Chunk: {
                const kind = this.reader.u8();
                const index = this.reader.varint();
                const byteLength = this.reader.varint();
                const value = this.chunks(index, kind, byteLength);

                this.refs.push(value);
                return value;
            }
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

function readHeader(buffer: ArrayBuffer): { metadataLength: number, chunkCount: number } {
    if (buffer.byteLength < HEADER_SIZE) throw new Error("Not a decode-cache file");

    const view = new DataView(buffer);

    if (view.getUint32(0, true) !== MAGIC) throw new Error("Not a decode-cache file");
    if (view.getUint8(4) !== FORMAT_VERSION) throw new Error("Unsupported decode-cache format version");

    return { metadataLength: view.getUint32(5, true), chunkCount: view.getUint32(9, true) };
}

function readEntries(buffer: ArrayBuffer, chunkCount: number): LibraryChunkEntry_T[] {
    if (buffer.byteLength < HEADER_SIZE + chunkCount * CHUNK_ENTRY_SIZE)
        throw new Error("Corrupt decode-cache directory");

    const view = new DataView(buffer);
    const entries = new Array<LibraryChunkEntry_T>(chunkCount);

    for (let i = 0, offset = HEADER_SIZE; i < chunkCount; i++, offset += CHUNK_ENTRY_SIZE) {
        const position = view.getFloat64(offset, true);

        if (!Number.isSafeInteger(position) || position < 0) throw new Error(`Corrupt decode-cache chunk offset '${position}'`);

        entries[i] = { offset: position, length: view.getUint32(offset + 8, true) };
    }

    return entries;
}

function decodeChunk(kind: number, byteLength: number, buffer: ArrayBuffer, offset: number): any {
    if (kind === ARRAY_BUFFER_KIND) return buffer.slice(offset, offset + byteLength);

    const Constructor = TYPED_ARRAY_KINDS[kind] as any;

    if (!Constructor) throw new Error(`Corrupt decode-cache chunk kind '${kind}'`);

    const bytesPerElement = Constructor.BYTES_PER_ELEMENT ?? 1;

    if (byteLength % bytesPerElement !== 0) throw new Error(`Corrupt decode-cache chunk length '${byteLength}'`);

    return new Constructor(buffer, offset, byteLength / bytesPerElement);
}

function createDecoder(buffer: ArrayBuffer, metadataOffset: number, entries: LibraryChunkEntry_T[], copyChunks: boolean = false): LibraryDecoder {
    return new LibraryDecoder(buffer, metadataOffset, (index, kind, byteLength) => {
        const entry = entries[index];

        if (!entry || entry.length !== byteLength || entry.offset < metadataOffset || entry.offset + entry.length > buffer.byteLength)
            throw new Error(`Corrupt decode-cache chunk '${index}'`);

        if (copyChunks && kind !== ARRAY_BUFFER_KIND) return decodeChunk(kind, byteLength, buffer.slice(entry.offset, entry.offset + entry.length), 0);

        return decodeChunk(kind, byteLength, buffer, entry.offset);
    });
}

export function isSerializedLibrary(buffer: ArrayBuffer): boolean {
    if (buffer.byteLength < 5) return false;

    const view = new DataView(buffer);

    return view.getUint32(0, true) === MAGIC && view.getUint8(4) === FORMAT_VERSION;
}

export function deserializeLibrary(buffer: ArrayBuffer): any {
    const { chunkCount } = readHeader(buffer);
    const entries = readEntries(buffer, chunkCount);
    const decoder = createDecoder(buffer, HEADER_SIZE + chunkCount * CHUNK_ENTRY_SIZE, entries);

    while (decoder.step()) { }

    return decoder.result();
}

export async function deserializeLibraryAsync(buffer: ArrayBuffer, copyChunks: boolean = false, yieldWork: () => Promise<void> = null): Promise<any> {
    const { chunkCount } = readHeader(buffer);
    const entries = readEntries(buffer, chunkCount);
    const decoder = createDecoder(buffer, HEADER_SIZE + chunkCount * CHUNK_ENTRY_SIZE, entries, copyChunks);

    while (true) {
        const deadline = performance.now() + DECODE_FRAME_MS;

        do {
            for (let i = 0; i < DECODE_STEP_BATCH; i++)
                if (!decoder.step()) return decoder.result();
        } while (performance.now() < deadline);

        if (yieldWork) await yieldWork();
        await yieldDecode();
    }
}

export async function openLibraryFile(file: Blob): Promise<SeekableLibrary_T> {
    const header = readHeader(await file.slice(0, HEADER_SIZE).arrayBuffer());
    const metadataOffset = HEADER_SIZE + header.chunkCount * CHUNK_ENTRY_SIZE;

    if (metadataOffset + header.metadataLength > file.size) throw new Error(`Corrupt decode-cache metadata length '${header.metadataLength}'`);

    const prefix = await file.slice(0, metadataOffset + header.metadataLength).arrayBuffer();
    const entries = readEntries(prefix, header.chunkCount);

    for (let i = 0; i < entries.length; i++)
        if (entries[i].offset < metadataOffset + header.metadataLength || entries[i].offset + entries[i].length > file.size) throw new Error(`Corrupt decode-cache chunk '${i}'`);

    const decoder = new LibraryDecoder(prefix, metadataOffset, (index, kind, byteLength) => {
        const entry = entries[index];

        if (!entry || entry.length !== byteLength) throw new Error(`Corrupt decode-cache chunk '${index}'`);

        return { isLibraryChunk: true, index, kind, byteLength } as LibraryChunkRef_T;
    });

    while (decoder.step()) { }

    return { file, library: decoder.result(), entries, values: new Map() };
}

function collectChunkRefs(root: any, values: Map<number, any>, containers: any[]): LibraryChunkRef_T[] {
    const refs = new Map<number, LibraryChunkRef_T>();
    const seen = new Set<any>();
    const stack = [];

    function visit(value: any): boolean {
        if (!value || typeof value !== "object" || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return false;
        if ((value as LibraryChunkRef_T).isLibraryChunk === true) {
            const ref = value as LibraryChunkRef_T;

            if (!values.has(ref.index)) refs.set(ref.index, ref);
            return true;
        }

        if (seen.has(value)) return false;
        seen.add(value);
        stack.push(value);
        return false;
    }

    visit(root);

    while (stack.length > 0) {
        const value = stack.pop();
        let hasChunks = false;

        if (value instanceof Map) {
            for (const [key, entry] of value) {
                hasChunks = visit(key) || hasChunks;
                hasChunks = visit(entry) || hasChunks;
            }
        } else if (value instanceof Set) {
            for (const entry of value) hasChunks = visit(entry) || hasChunks;
        } else {
            for (const entry of Object.values(value)) hasChunks = visit(entry) || hasChunks;
        }

        if (hasChunks) containers.push(value);
    }

    return Array.from(refs.values());
}

function buildChunkRanges(seekable: SeekableLibrary_T, refs: LibraryChunkRef_T[]): LibraryChunkRange_T[] {
    refs.sort((a, b) => seekable.entries[a.index].offset - seekable.entries[b.index].offset);

    const ranges: LibraryChunkRange_T[] = [];

    for (const ref of refs) {
        const entry = seekable.entries[ref.index];
        const range = ranges[ranges.length - 1];
        const end = entry.offset + entry.length;

        if (range && entry.offset - range.end <= RANGE_GAP && end - range.offset <= RANGE_SIZE) {
            range.end = Math.max(range.end, end);
            range.refs.push(ref);
        } else {
            ranges.push({ offset: entry.offset, end, refs: [ref] });
        }
    }

    return ranges;
}

function replaceChunkRefs(root: any, values: Map<number, any>, containers: any[]): any {
    function replace(value: any): any {
        return value && value.isLibraryChunk === true ? values.get(value.index) : value;
    }

    for (const value of containers) {
        if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) value[i] = replace(value[i]);
        } else if (value instanceof Map) {
            const entries = Array.from(value, entry => [replace(entry[0]), replace(entry[1])]);

            value.clear();
            for (const entry of entries) value.set(entry[0], entry[1]);
        } else if (value instanceof Set) {
            const entries = Array.from(value, replace);

            value.clear();
            for (const entry of entries) value.add(entry);
        } else {
            for (const key of Object.keys(value)) value[key] = replace(value[key]);
        }
    }

    return replace(root);
}

export async function getLibraryChunkBlob(seekable: SeekableLibrary_T, ref: any, mimeType: string): Promise<Blob> {
    if (!ref || ref.isLibraryChunk !== true || ref.kind !== 1) throw new Error(`Expected a stored Uint8Array chunk.`);

    const entry = seekable.entries[ref.index];

    if (!entry || entry.length !== ref.byteLength || entry.offset < 0 || entry.offset + entry.length > seekable.file.size) throw new Error(`Invalid stored sound chunk '${ref.index}'.`);

    // OPFS catalog rewrites invalidate File slices retained by sound libraries.
    return new Blob([await seekable.file.slice(entry.offset, entry.offset + entry.length).arrayBuffer()], { type: mimeType });
}

export async function hydrateLibraryFile(seekable: SeekableLibrary_T, root: any = seekable.library): Promise<any> {
    const containers = [];
    const refs = collectChunkRefs(root, seekable.values, containers);
    const ranges = buildChunkRanges(seekable, refs);

    for (const range of ranges) {
        const buffer = await seekable.file.slice(range.offset, range.end).arrayBuffer();
        const length = range.refs.reduce((length, ref) => ref.kind === ARRAY_BUFFER_KIND ? length : length + (CHUNK_ALIGNMENT - length % CHUNK_ALIGNMENT) % CHUNK_ALIGNMENT + ref.byteLength, 0);
        const chunks = new Uint8Array(length);
        let offset = 0;

        for (const ref of range.refs) {
            const entry = seekable.entries[ref.index];

            if (ref.kind === ARRAY_BUFFER_KIND) {
                seekable.values.set(ref.index, decodeChunk(ref.kind, ref.byteLength, buffer, entry.offset - range.offset));
                continue;
            }

            offset += (CHUNK_ALIGNMENT - offset % CHUNK_ALIGNMENT) % CHUNK_ALIGNMENT;
            chunks.set(new Uint8Array(buffer, entry.offset - range.offset, ref.byteLength), offset);
            seekable.values.set(ref.index, decodeChunk(ref.kind, ref.byteLength, chunks.buffer, offset));
            offset += ref.byteLength;
        }
    }

    return replaceChunkRefs(root, seekable.values, containers);
}
