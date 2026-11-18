const MAGIC = 0x3141324c;
export const CATALOG_SLOT_SIZE = 32;
export const CATALOG_HEADER_SIZE = CATALOG_SLOT_SIZE * 2;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type CatalogEntry_T = [string, number, number];
type CatalogSlot_T = { generation: number, offset: number, length: number, prefix: Uint8Array, checksum: number };

function checksum(header: Uint8Array, index: Uint8Array): number {
    let value = 2166136261;

    for (const bytes of [header, index])
        for (let i = 0; i < bytes.length; i++) value = Math.imul(value ^ bytes[i], 16777619);

    return value >>> 0;
}

export function readCatalogSlot(header: Uint8Array, slot: number, fileSize: number): CatalogSlot_T | null {
    const view = new DataView(header.buffer, header.byteOffset + slot, CATALOG_SLOT_SIZE);
    if (view.getUint32(0, true) !== MAGIC) return null;

    const generation = view.getFloat64(8, true), offset = view.getFloat64(16, true), length = view.getUint32(24, true);
    if (!Number.isSafeInteger(generation) || generation < 1 || !Number.isSafeInteger(offset) || offset < CATALOG_HEADER_SIZE || offset + length > fileSize) return null;

    return { generation, offset, length, prefix: header.subarray(slot, slot + 28), checksum: view.getUint32(28, true) };
}

export function decodeCatalogIndex(slot: CatalogSlot_T, bytes: Uint8Array): CatalogEntry_T[] | null {
    if (checksum(slot.prefix, bytes) !== slot.checksum) return null;

    const index: CatalogEntry_T[] = JSON.parse(decoder.decode(bytes));
    const keys = new Set<string>();
    if (!Array.isArray(index)) throw new Error(`Corrupt asset catalog index.`);

    for (const entry of index) {
        if (!Array.isArray(entry) || entry.length !== 3) throw new Error(`Corrupt asset catalog entry.`);

        const [key, position, size] = entry;
        if (typeof key !== "string" || keys.has(key) || !Number.isSafeInteger(position) || position < CATALOG_HEADER_SIZE || !Number.isSafeInteger(size) || size < 0 || size > 0xffffffff || position + size > slot.offset)
            throw new Error(`Corrupt asset catalog entry '${key}'.`);

        keys.add(key);
    }
    return index;
}

export function encodeCatalogIndex(index: CatalogEntry_T[], generation: number, offset: number) {
    const bytes = encoder.encode(JSON.stringify(index));
    const slot = new Uint8Array(CATALOG_SLOT_SIZE), view = new DataView(slot.buffer);
    if (!Number.isSafeInteger(generation) || bytes.length > 0xffffffff) throw new Error(`Asset catalog index exceeds its format.`);

    view.setUint32(0, MAGIC, true);
    view.setFloat64(8, generation, true);
    view.setFloat64(16, offset, true);
    view.setUint32(24, bytes.length, true);
    view.setUint32(28, checksum(slot.subarray(0, 28), bytes), true);
    return { bytes, slot, slotOffset: (generation % 2) * CATALOG_SLOT_SIZE };
}
