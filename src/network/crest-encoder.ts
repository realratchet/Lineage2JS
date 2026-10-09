const tmpColors = new Uint8Array(48), tmpPalette = new Uint8Array(12);

function encodeColor565(colors: Uint8Array, offset: number) { return (Math.round(colors[offset] * 31 / 255) << 11) | (Math.round(colors[offset + 1] * 63 / 255) << 5) | Math.round(colors[offset + 2] * 31 / 255); }

function expandColor565(color: number, out: Uint8Array, offset: number) {
    const r = color >> 11, g = (color >> 5) & 63, b = color & 31;

    out[offset] = (r << 3) | (r >> 2);
    out[offset + 1] = (g << 2) | (g >> 4);
    out[offset + 2] = (b << 3) | (b >> 2);
}

function encodeBlockDXT1(colors: Uint8Array, out: DataView, offset: number) {
    let best = -1, first = 0, second = 0, indices = 0;

    for (let i = 0; i < 16; i++)
        for (let j = i + 1; j < 16; j++) {
            const dr = colors[i * 3] - colors[j * 3], dg = colors[i * 3 + 1] - colors[j * 3 + 1], db = colors[i * 3 + 2] - colors[j * 3 + 2], dist = dr * dr + dg * dg + db * db;

            if (dist > best) { best = dist; first = i; second = j; }
        }

    let color0 = encodeColor565(colors, first * 3), color1 = encodeColor565(colors, second * 3);

    if (color0 < color1) { const swap = color0; color0 = color1; color1 = swap; }
    if (color0 !== color1) { // c0 <= c1 would select 3-colour mode with index 3 transparent
        expandColor565(color0, tmpPalette, 0);
        expandColor565(color1, tmpPalette, 3);

        for (let k = 0; k < 3; k++) {
            tmpPalette[6 + k] = (2 * tmpPalette[k] + tmpPalette[3 + k]) / 3;
            tmpPalette[9 + k] = (tmpPalette[k] + 2 * tmpPalette[3 + k]) / 3;
        }

        for (let i = 0; i < 16; i++) {
            let bestIndex = 0, bestDist = Infinity;

            for (let p = 0; p < 4; p++) {
                const dr = colors[i * 3] - tmpPalette[p * 3], dg = colors[i * 3 + 1] - tmpPalette[p * 3 + 1], db = colors[i * 3 + 2] - tmpPalette[p * 3 + 2], dist = dr * dr + dg * dg + db * db;

                if (dist < bestDist) { bestDist = dist; bestIndex = p; }
            }

            indices |= bestIndex << (i * 2);
        }
    }

    out.setUint16(offset, color0, true);
    out.setUint16(offset + 2, color1, true);
    out.setUint32(offset + 4, indices >>> 0, true);
}

export function encodeCrest(file: Uint8Array, width: number, height: number): Uint8Array {
    const view = new DataView(file.buffer, file.byteOffset, file.byteLength);

    if (file.length < 54 || view.getUint16(0, true) !== 0x4d42 || view.getInt32(18, true) !== width || view.getInt32(22, true) !== height || view.getUint16(28, true) !== 8) return null; // NWindow 0x10080c5d / 0x10080f2d / 0x10080a39
    if (width < 64 && view.getUint32(2, true) > 0xC00) return null; // NWindow 0x10080c65

    const pixels = view.getUint32(10, true), palette = 14 + view.getUint32(14, true), ddsHeight = width < 64 ? 16 : height;

    if (pixels + width * height > file.length) return null;

    const data = new Uint8Array(128 + width * ddsHeight / 2), out = new DataView(data.buffer);

    out.setUint32(0, 0x20534444, true); // Engine MakeBMPToDXT1 0x1052010b
    out.setUint32(4, 0x7C, true);
    out.setUint32(8, 0x81007, true);
    out.setUint32(12, ddsHeight, true);
    out.setUint32(16, width, true);
    out.setUint32(20, width * ddsHeight / 2, true);
    out.setUint32(76, 0x20, true);
    out.setUint32(80, 4, true);
    out.setUint32(84, 0x31545844, true);

    for (let by = 0; by < ddsHeight; by += 4)
        for (let bx = 0; bx < width; bx += 4) {
            for (let i = 0; i < 16; i++) {
                const row = ddsHeight - 1 - by - (i >> 2), index = row < height ? file[pixels + row * width + bx + (i & 3)] : 255; // NWindow 0x10080cb7 memsets the padding rows to 0xFF

                tmpColors[i * 3] = file[palette + index * 4 + 2];
                tmpColors[i * 3 + 1] = file[palette + index * 4 + 1];
                tmpColors[i * 3 + 2] = file[palette + index * 4];
            }

            encodeBlockDXT1(tmpColors, out, 128 + ((by >> 2) * (width >> 2) + (bx >> 2)) * 8);
        }

    return data;
}

export default encodeCrest;
