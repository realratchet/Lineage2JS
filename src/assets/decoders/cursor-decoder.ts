import decodeResources from "./pe-resource-decoder";

type CursorDecodeInfo_T = { data: Uint8Array, x: number, y: number };

function decodeCursors(buffer: ArrayBuffer): CursorDecodeInfo_T[] {
    const readResource = decodeResources(buffer);

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
