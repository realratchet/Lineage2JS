type CursorDecodeInfo_T = { data: Uint8Array, x: number, y: number };

function decodeCursors(buffer: ArrayBuffer): CursorDecodeInfo_T[] {
    const view = new DataView(buffer), pe = view.getUint32(60, true);

    if (view.getUint16(0, true) !== 0x5a4d || view.getUint32(pe, true) !== 0x4550 || view.getUint16(pe + 24, true) !== 0x10b) throw new Error(`Invalid cursor PE32 image.`);

    const sectionCount = view.getUint16(pe + 6, true), sectionStart = pe + 24 + view.getUint16(pe + 20, true);

    function offset(rva: number, size: number) {
        for (let i = 0; i < sectionCount; i++) {
            const section = sectionStart + i * 40, start = view.getUint32(section + 12, true), length = view.getUint32(section + 16, true), raw = view.getUint32(section + 20, true);

            if (rva >= start && rva - start + size <= length && raw + rva - start + size <= buffer.byteLength) return raw + rva - start;
        }
        throw new Error(`Cursor resource RVA ${rva} is outside the image.`);
    }

    const resourceSize = view.getUint32(pe + 140, true), resource = offset(view.getUint32(pe + 136, true), resourceSize);

    function directory(relative: number): [number, number][] {
        if (relative + 16 > resourceSize) throw new Error(`Invalid cursor resource directory.`);

        const start = resource + relative, count = view.getUint16(start + 12, true) + view.getUint16(start + 14, true);

        if (relative + 16 + count * 8 > resourceSize) throw new Error(`Truncated cursor resource directory.`);

        const entries: [number, number][] = [];
        for (let i = 0; i < count; i++) entries.push([view.getUint32(start + 16 + i * 8, true), view.getUint32(start + 20 + i * 8, true)]);
        return entries;
    }

    function child(relative: number, id: number) {
        const entry = directory(relative).find(entry => entry[0] === id);

        if (!entry || !(entry[1] & 0x80000000)) throw new Error(`Missing cursor resource directory ${id}.`);
        return entry[1] & 0x7fffffff;
    }

    function readResource(kind: number, id: number) {
        const languages = directory(child(child(0, kind), id));

        if (languages.length !== 1 || languages[0][1] & 0x80000000 || languages[0][1] + 16 > resourceSize) throw new Error(`Invalid cursor resource ${kind}/${id}.`);

        const entry = resource + languages[0][1], size = view.getUint32(entry + 4, true), start = offset(view.getUint32(entry, true), size);

        return new Uint8Array(buffer, start, size);
    }

    return [102, 101, 106, 107, 127, 130, 131].map(id => { // NWindow.dll 0x10038390, cursor table 0x10231ce4.
        const group = readResource(12, id), header = new DataView(group.buffer, group.byteOffset, group.byteLength);

        if (group.length !== 20 || header.getUint16(0, true) !== 0 || header.getUint16(2, true) !== 2 || header.getUint16(4, true) !== 1) throw new Error(`Invalid cursor group ${id}.`);

        const image = readResource(1, header.getUint16(18, true)), dib = new DataView(image.buffer, image.byteOffset, image.byteLength);
        const width = header.getUint16(6, true), height = header.getUint16(8, true) / 2;
        const x = dib.getUint16(0, true), y = dib.getUint16(2, true);

        if (image.length !== header.getUint32(14, true) || dib.getUint32(4, true) !== 40 || dib.getInt32(8, true) !== width || dib.getInt32(12, true) !== height * 2 || width <= 0 || width > 256 || height <= 0 || height > 256 || height % 1 || x >= width || y >= height) throw new Error(`Invalid cursor image ${id}.`);

        const data = new Uint8Array(22 + image.length - 4), cursor = new DataView(data.buffer);

        cursor.setUint16(2, 2, true);
        cursor.setUint16(4, 1, true);
        data[6] = width % 256;
        data[7] = height % 256;
        cursor.setUint16(10, x, true);
        cursor.setUint16(12, y, true);
        cursor.setUint32(14, image.length - 4, true);
        cursor.setUint32(18, 22, true);
        data.set(image.subarray(4), 22);

        return { data, x, y };
    });
}

export default decodeCursors;
