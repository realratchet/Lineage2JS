function decodeResources(buffer: ArrayBuffer) {
    const view = new DataView(buffer), pe = view.getUint32(60, true);

    if (view.getUint16(0, true) !== 0x5a4d || view.getUint32(pe, true) !== 0x4550 || view.getUint16(pe + 24, true) !== 0x10b) throw new Error(`Invalid PE32 image.`);

    const sectionCount = view.getUint16(pe + 6, true), sectionStart = pe + 24 + view.getUint16(pe + 20, true);

    function offset(rva: number, size: number) {
        for (let i = 0; i < sectionCount; i++) {
            const section = sectionStart + i * 40, start = view.getUint32(section + 12, true), length = view.getUint32(section + 16, true), raw = view.getUint32(section + 20, true);

            if (rva >= start && rva - start + size <= length && raw + rva - start + size <= buffer.byteLength) return raw + rva - start;
        }
        throw new Error(`PE resource RVA ${rva} is outside the image.`);
    }

    const resourceSize = view.getUint32(pe + 140, true), resource = offset(view.getUint32(pe + 136, true), resourceSize);

    function directory(relative: number): [number, number][] {
        if (relative + 16 > resourceSize) throw new Error(`Invalid PE resource directory.`);

        const start = resource + relative, count = view.getUint16(start + 12, true) + view.getUint16(start + 14, true);

        if (relative + 16 + count * 8 > resourceSize) throw new Error(`Truncated PE resource directory.`);

        const entries: [number, number][] = [];
        for (let i = 0; i < count; i++) entries.push([view.getUint32(start + 16 + i * 8, true), view.getUint32(start + 20 + i * 8, true)]);
        return entries;
    }

    function child(relative: number, id: number) {
        const entry = directory(relative).find(entry => entry[0] === id);

        if (!entry || !(entry[1] & 0x80000000)) throw new Error(`Missing PE resource directory ${id}.`);
        return entry[1] & 0x7fffffff;
    }

    function readResource(kind: number, id: number) {
        const languages = directory(child(child(0, kind), id));

        if (languages.length !== 1 || languages[0][1] & 0x80000000 || languages[0][1] + 16 > resourceSize) throw new Error(`Invalid PE resource ${kind}/${id}.`);

        const entry = resource + languages[0][1], size = view.getUint32(entry + 4, true), start = offset(view.getUint32(entry, true), size);

        return new Uint8Array(buffer, start, size);
    }

    return readResource;
}

export default decodeResources;
