import type { SeekableLibrary_T } from "./library-serializer";

const MAGIC = 0x3141324c;
const HEADER_SIZE = 64;
const SLOT_SIZE = 32;
const WRITE_SIZE = 256 * 1024;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

type Catalog_T = SeekableLibrary_T & { generation: number, end: number, header: Uint8Array };
type CatalogEntry_T = [string, number, number];

function checksum(header: Uint8Array, index: Uint8Array): number {
    let value = 2166136261;

    for (const bytes of [header, index])
        for (let i = 0; i < bytes.length; i++) value = Math.imul(value ^ bytes[i], 16777619);

    return value >>> 0;
}

export async function openAssetCatalog(file: Blob): Promise<Catalog_T> {
    if (file.size < HEADER_SIZE) throw new Error(`Incomplete asset catalog.`);

    const header = new Uint8Array(await file.slice(0, HEADER_SIZE).arrayBuffer());
    const view = new DataView(header.buffer);
    let selected: Catalog_T = null;

    for (let slot = 0; slot < HEADER_SIZE; slot += SLOT_SIZE) {
        if (view.getUint32(slot, true) !== MAGIC) continue;

        const generation = view.getFloat64(slot + 8, true), offset = view.getFloat64(slot + 16, true), length = view.getUint32(slot + 24, true);

        if (!Number.isSafeInteger(generation) || generation < 1 || !Number.isSafeInteger(offset) || offset < HEADER_SIZE || offset + length > file.size) continue;
        if (selected && generation <= selected.generation) continue;

        const bytes = new Uint8Array(await file.slice(offset, offset + length).arrayBuffer());

        if (checksum(header.subarray(slot, slot + 28), bytes) !== view.getUint32(slot + 28, true)) continue;

        const index: CatalogEntry_T[] = JSON.parse(decoder.decode(bytes));
        const library = { entries: {} }, entries = [], keys = new Set<string>();

        if (!Array.isArray(index)) throw new Error(`Corrupt asset catalog index.`);

        for (const entry of index) {
            if (!Array.isArray(entry) || entry.length !== 3) throw new Error(`Corrupt asset catalog entry.`);

            const [key, position, size] = entry;

            if (typeof key !== "string" || keys.has(key) || !Number.isSafeInteger(position) || position < HEADER_SIZE || !Number.isSafeInteger(size) || size < 0 || size > 0xffffffff || position + size > offset)
                throw new Error(`Corrupt asset catalog entry '${key}'.`);

            keys.add(key);
            Object.defineProperty(library.entries, key, { value: { isLibraryChunk: true, index: entries.length, kind: 0xff, byteLength: size }, enumerable: true, writable: true, configurable: true });
            entries.push({ offset: position, length: size });
        }
        selected = { file, library, entries, values: new Map(), generation, end: offset + length, header };
    }

    if (!selected) throw new Error(`No committed asset catalog index.`);

    return selected;
}

export async function storeAssetCatalog(handle: FileSystemFileHandle, entries: Record<string, any>, seekable: SeekableLibrary_T = null): Promise<number> {
    const previous = seekable as Catalog_T;
    const access = await (handle as any).createSyncAccessHandle();
    let written = 0;

    function write(bytes: Uint8Array, offset: number) {
        let position = 0;

        while (position < bytes.length) {
            const count = access.write(bytes.subarray(position), { at: offset + position });

            if (!Number.isInteger(count) || count <= 0 || count > bytes.length - position) throw new Error(`Incomplete asset catalog write.`);

            position += count;
            written += count;
        }
    }

    try {
        if (previous) {
            const header = new Uint8Array(HEADER_SIZE);

            if (access.read(header, { at: 0 }) !== HEADER_SIZE || header.some((byte, index) => byte !== previous.header[index])) throw new Error(`Asset catalog changed before update.`);
        } else {
            if (access.getSize() !== 0) throw new Error(`Cannot replace an existing asset catalog without its index.`);

            write(new Uint8Array(HEADER_SIZE), 0);
        }

        let offset = previous ? previous.end : HEADER_SIZE;
        const index: CatalogEntry_T[] = [];

        for (const [key, value] of Object.entries(entries)) {
            if (value.isLibraryChunk) {
                const entry = previous && previous.entries[value.index];

                if (!entry || entry.length !== value.byteLength) throw new Error(`Invalid retained asset '${key}'.`);

                index.push([key, entry.offset, entry.length]);
                continue;
            }
            if (!(value instanceof Blob) || value.size > 0xffffffff) throw new Error(`Invalid asset catalog data '${key}'.`);

            index.push([key, offset, value.size]);
            for (let start = 0; start < value.size; start += WRITE_SIZE) {
                const bytes = new Uint8Array(await value.slice(start, start + WRITE_SIZE).arrayBuffer());

                write(bytes, offset);
                offset += bytes.length;
            }
        }

        const bytes = encoder.encode(JSON.stringify(index));
        const generation = previous ? previous.generation + 1 : 1;
        const slot = new Uint8Array(SLOT_SIZE), view = new DataView(slot.buffer);

        if (!Number.isSafeInteger(generation) || bytes.length > 0xffffffff) throw new Error(`Asset catalog index exceeds its format.`);

        view.setUint32(0, MAGIC, true);
        view.setFloat64(8, generation, true);
        view.setFloat64(16, offset, true);
        view.setUint32(24, bytes.length, true);
        view.setUint32(28, checksum(slot.subarray(0, 28), bytes), true);
        write(bytes, offset);
        access.flush();
        write(slot, (generation % 2) * SLOT_SIZE);
        access.flush();
        access.truncate(offset + bytes.length);
        return written;
    } finally {
        access.close();
    }
}
