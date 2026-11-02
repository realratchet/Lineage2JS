import decodeResources from "./pe-resource-decoder";

function decodeIcon(buffer: ArrayBuffer, id: number) {
    const readResource = decodeResources(buffer), group = readResource(14, id);
    const header = new DataView(group.buffer, group.byteOffset, group.byteLength), count = header.getUint16(4, true);

    if (header.getUint16(0, true) !== 0 || header.getUint16(2, true) !== 1 || !count || group.length !== 6 + count * 14) throw new Error(`Invalid icon group ${id}.`);

    const images = Array.from({ length: count }, (_, i) => {
        const image = readResource(3, header.getUint16(18 + i * 14, true));

        if (image.length !== header.getUint32(14 + i * 14, true)) throw new Error(`Invalid icon image ${id}/${i}.`);

        return image;
    });
    const data = new Uint8Array(6 + count * 16 + images.reduce((size, image) => size + image.length, 0)), icon = new DataView(data.buffer);

    data.set(group.subarray(0, 6));
    let offset = 6 + count * 16;

    images.forEach((image, i) => {
        data.set(group.subarray(6 + i * 14, 18 + i * 14), 6 + i * 16);
        icon.setUint32(18 + i * 16, offset, true);
        data.set(image, offset);
        offset += image.length;
    });

    return data;
}

export default decodeIcon;
