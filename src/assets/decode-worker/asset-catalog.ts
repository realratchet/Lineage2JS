import type { SeekableLibrary_T } from "./library-serializer";
import { CATALOG_HEADER_SIZE, CATALOG_SLOT_SIZE, readCatalogSlot, decodeCatalogIndex, encodeCatalogIndex, type CatalogEntry_T } from "./asset-catalog-format";

const WRITE_SIZE = 256 * 1024;

type Catalog_T = SeekableLibrary_T & { generation: number, end: number, header: Uint8Array };

export async function openAssetCatalog(file: Blob): Promise<Catalog_T> {
    if (file.size < CATALOG_HEADER_SIZE) throw new Error(`Incomplete asset catalog.`);

    const header = new Uint8Array(await file.slice(0, CATALOG_HEADER_SIZE).arrayBuffer());
    let selected: Catalog_T = null;

    for (let slot = 0; slot < CATALOG_HEADER_SIZE; slot += CATALOG_SLOT_SIZE) {
        const commit = readCatalogSlot(header, slot, file.size);

        if (!commit || (selected && commit.generation <= selected.generation)) continue;

        const { generation, offset, length } = commit;
        const bytes = new Uint8Array(await file.slice(offset, offset + length).arrayBuffer());
        const index = decodeCatalogIndex(commit, bytes);

        if (!index) continue;

        const library = { entries: {} }, entries = [];
        for (const [key, position, size] of index) {
            Object.defineProperty(library.entries, key, { value: { isLibraryChunk: true, index: entries.length, kind: 0xff, byteLength: size }, enumerable: true, writable: true, configurable: true });
            entries.push({ offset: position, length: size });
        }
        selected = { file, library, entries, values: new Map(), generation, end: offset + length, header };
    }

    if (!selected) throw new Error(`No committed asset catalog index.`);

    return selected;
}

export async function storeAssetCatalog(handle: FileSystemFileHandle, entries: Record<string, any>, seekable: SeekableLibrary_T = null): Promise<number> {
    const file = await handle.getFile();
    const current = file.size ? await openAssetCatalog(file) : null;
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
        if (!current) write(new Uint8Array(CATALOG_HEADER_SIZE), 0);

        let offset = current ? current.end : CATALOG_HEADER_SIZE;
        const index: CatalogEntry_T[] = current ? Object.entries(current.library.entries).map(([key, value]: [string, any]) => [key, current.entries[value.index].offset, current.entries[value.index].length]) : [];

        for (const [key, value] of Object.entries(entries)) {
            if (value.isLibraryChunk) {
                const entry = seekable && seekable.entries[value.index];
                const retained = current && current.library.entries[key];
                const stored = retained && current.entries[retained.index];

                if (!entry || entry.length !== value.byteLength || !stored || stored.offset !== entry.offset || stored.length !== entry.length) throw new Error(`Invalid retained asset '${key}'.`);

                continue;
            }
            if (!(value instanceof Blob) || value.size > 0xffffffff) throw new Error(`Invalid asset catalog data '${key}'.`);
            if (current && Object.hasOwn(current.library.entries, key)) continue;

            index.push([key, offset, value.size]);
            for (let start = 0; start < value.size; start += WRITE_SIZE) {
                const bytes = new Uint8Array(await value.slice(start, start + WRITE_SIZE).arrayBuffer());

                write(bytes, offset);
                offset += bytes.length;
            }
        }

        if (current && index.length === current.entries.length) return 0;

        const generation = current ? current.generation + 1 : 1;
        const commit = encodeCatalogIndex(index, generation, offset);
        write(commit.bytes, offset);
        access.flush();
        write(commit.slot, commit.slotOffset);
        access.flush();
        access.truncate(offset + commit.bytes.length);
        return written;
    } finally {
        access.close();
    }
}
