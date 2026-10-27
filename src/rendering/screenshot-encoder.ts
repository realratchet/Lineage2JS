const arrHuffman = new Uint8Array([0,0,1,5,1,1,1,1,1,1,0,0,0,0,0,0,0,0,1,2,3,4,5,6,7,8,9,10,11,16,0,2,1,3,3,2,4,3,5,5,4,4,0,0,1,125,1,2,3,0,4,17,5,18,33,49,65,6,19,81,97,7,34,113,20,50,129,145,161,8,35,66,177,193,21,82,209,240,36,51,98,114,130,9,10,22,23,24,25,26,37,38,39,40,41,42,52,53,54,55,56,57,58,67,68,69,70,71,72,73,74,83,84,85,86,87,88,89,90,99,100,101,102,103,104,105,106,115,116,117,118,119,120,121,122,131,132,133,134,135,136,137,138,146,147,148,149,150,151,152,153,154,162,163,164,165,166,167,168,169,170,178,179,180,181,182,183,184,185,186,194,195,196,197,198,199,200,201,202,210,211,212,213,214,215,216,217,218,225,226,227,228,229,230,231,232,233,234,241,242,243,244,245,246,247,248,249,250,1,0,3,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,1,2,3,4,5,6,7,8,9,10,11,17,0,2,1,2,4,4,3,4,7,5,4,4,0,1,2,119,0,1,2,3,17,4,5,33,49,6,18,65,81,7,97,113,19,34,50,129,8,20,66,145,161,177,193,9,35,51,82,240,21,98,114,209,10,22,36,52,225,37,241,23,24,25,26,38,39,40,41,42,53,54,55,56,57,58,67,68,69,70,71,72,73,74,83,84,85,86,87,88,89,90,99,100,101,102,103,104,105,106,115,116,117,118,119,120,121,122,130,131,132,133,134,135,136,137,138,146,147,148,149,150,151,152,153,154,162,163,164,165,166,167,168,169,170,178,179,180,181,182,183,184,185,186,194,195,196,197,198,199,200,201,202,210,211,212,213,214,215,216,217,218,226,227,228,229,230,231,232,233,234,242,243,244,245,246,247,248,249,250]);
const arrZigzag = [0,1,8,16,9,2,3,10,17,24,32,25,18,11,4,5,12,19,26,33,40,48,41,34,27,20,13,6,7,14,21,28,35,42,49,56,57,50,43,36,29,22,15,23,30,37,44,51,58,59,52,45,38,31,39,46,53,60,61,54,47,55,62,63];
const arrQuantizers = [
    [3,2,2,3,2,2,3,3,3,3,4,3,3,4,5,8,5,5,4,4,5,10,7,7,6,8,12,10,12,12,11,10,11,11,13,14,18,16,13,14,17,14,11,11,16,22,16,17,19,20,21,21,21,12,15,23,24,22,20,24,18,20,21,20,3,4,4,5,4,5,9,5,5,9,20,13,11,13,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20],
    [6,4,4,5,4,4,6,5,5,5,6,6,6,7,8,14,9,8,8,8,8,17,12,13,10,14,20,18,21,21,20,18,20,19,22,25,32,27,22,24,30,24,19,20,28,38,28,30,33,34,36,36,36,22,27,40,42,39,35,42,32,35,36,35,6,6,6,8,7,8,16,9,9,16,35,23,20,23,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35],
    [8,6,6,7,6,5,8,7,7,7,9,9,8,10,12,20,13,12,11,11,12,25,18,19,15,20,29,26,31,30,29,26,28,28,32,36,46,39,32,34,44,35,28,28,40,55,41,44,48,49,52,52,52,31,39,57,61,56,50,60,46,51,52,50,9,9,9,12,11,12,24,13,13,24,50,33,28,33,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50],
];

// Core.dll appCreateJpeg: baseline 4:4:4, quantizer scales 20/35/50 and original Huffman tables.
export function encodeScreenshot(image: ImageData, quality: number): Blob {
    const { width, height, data } = image;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 65535 || height > 65535 || data.length !== width * height * 4)
        throw new Error(`Invalid screenshot dimensions: ${width}x${height}`);
    if (!Number.isInteger(quality) || quality < 0 || quality > 3)
        throw new Error(`Invalid screenshot quality: ${quality}`);

    if (quality === 0) {
        const stride = Math.ceil(width * 3 / 4) * 4, size = 54 + stride * height;
        if (size > 0xffffffff) throw new Error(`Screenshot exceeds Bitmap size limit`);
        const arrBytes = new Uint8Array(size), header = new DataView(arrBytes.buffer);
        header.setUint16(0, 0x4d42, true);
        header.setUint32(2, size, true);
        header.setUint32(10, 54, true);
        header.setUint32(14, 40, true);
        header.setInt32(18, width, true);
        header.setInt32(22, height, true);
        header.setUint16(26, 1, true);
        header.setUint16(28, 24, true);
        header.setUint32(34, stride * height, true);
        for (let y = 0; y < height; y++) {
            let src = (height - y - 1) * width * 4, dst = 54 + y * stride;
            for (let x = 0; x < width; x++, src += 4) {
                arrBytes[dst++] = data[src + 2];
                arrBytes[dst++] = data[src + 1];
                arrBytes[dst++] = data[src];
            }
        }
        return new Blob([arrBytes], { type: "image/bmp" });
    }

    const arrTables: Int32Array[] = [], arrQuantizer = arrQuantizers[quality - 1];
    for (let at = 0; at < arrHuffman.length;) {
        const id = arrHuffman[at++], arrCounts = arrHuffman.subarray(at, at + 16), arrTable = new Int32Array(512);
        at += 16;
        let code = 0;
        for (let length = 1; length <= 16; length++) {
            for (let i = 0; i < arrCounts[length - 1]; i++) {
                const symbol = arrHuffman[at++] * 2;
                arrTable[symbol] = code++;
                arrTable[symbol + 1] = length;
            }
            code <<= 1;
        }
        arrTables[(id >> 4) * 2 + (id & 15)] = arrTable;
    }

    let arrBytes = new Uint8Array(Math.max(4096, width * height * 3)), at = 0, bits = 0, bitCount = 0;
    function byte(value: number) {
        if (at === arrBytes.length) {
            const arrGrown = new Uint8Array(arrBytes.length * 2);
            arrGrown.set(arrBytes);
            arrBytes = arrGrown;
        }
        arrBytes[at++] = value;
    }
    function word(value: number) { byte(value >> 8); byte(value); }
    function marker(value: number) { byte(255); byte(value); }
    function emit(value: number, length: number) {
        bits = (bits << length) | value;
        bitCount += length;
        while (bitCount >= 8) {
            bitCount -= 8;
            const value = (bits >>> bitCount) & 255;
            byte(value);
            if (value === 255) byte(0);
        }
    }
    function symbol(arrTable: Int32Array, value: number) {
        const length = arrTable[value * 2 + 1];
        if (!length) throw new Error(`Missing JPEG Huffman symbol: ${value}`);
        emit(arrTable[value * 2], length);
    }
    function magnitude(value: number): number { return value === 0 ? 0 : 32 - Math.clz32(Math.abs(value)); }
    function coefficient(value: number, length: number) { if (length) emit(value < 0 ? value + (1 << length) - 1 : value, length); }

    marker(216);
    marker(224); word(16);
    for (const value of [74,70,73,70,0,1,1,0,0,1,0,1,0,0]) byte(value);
    marker(219); word(132);
    byte(0); for (let i = 0; i < 64; i++) byte(arrQuantizer[i]);
    byte(1); for (let i = 64; i < 128; i++) byte(arrQuantizer[i]);
    marker(192); word(17); byte(8); word(height); word(width);
    for (const value of [3,1,17,0,2,17,1,3,17,1]) byte(value);
    marker(196); word(arrHuffman.length + 2);
    for (let i = 0; i < arrHuffman.length; i++) byte(arrHuffman[i]);
    marker(218); word(12);
    for (const value of [3,1,0,2,17,3,17,0,63,0]) byte(value);

    // shortcut: DCT/color rounding differs from Core; port its arithmetic if exact JPEG output is required.
    const arrBasis = new Float64Array(64), arrBlock = new Float64Array(192), arrHorizontal = new Float64Array(64), arrTransformed = new Float64Array(64), arrCoefficients = new Int32Array(64), arrPrevious = new Int32Array(3);
    for (let k = 0; k < 8; k++) for (let x = 0; x < 8; x++)
        arrBasis[k * 8 + x] = Math.cos((2 * x + 1) * k * Math.PI / 16) * (k === 0 ? Math.SQRT1_2 : 1) / 2;

    for (let top = 0; top < height; top += 8) for (let left = 0; left < width; left += 8) {
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
            const src = (Math.min(height - 1, top + y) * width + Math.min(width - 1, left + x)) * 4, dst = y * 8 + x, r = data[src], g = data[src + 1], b = data[src + 2];
            arrBlock[dst] = .299 * r + .587 * g + .114 * b - 128;
            arrBlock[64 + dst] = -.168736 * r - .331264 * g + .5 * b;
            arrBlock[128 + dst] = .5 * r - .418688 * g - .081312 * b;
        }
        for (let component = 0; component < 3; component++) {
            for (let y = 0; y < 8; y++) for (let u = 0; u < 8; u++) {
                let value = 0;
                for (let x = 0; x < 8; x++) value += arrBlock[component * 64 + y * 8 + x] * arrBasis[u * 8 + x];
                arrHorizontal[y * 8 + u] = value;
            }
            for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) {
                let value = 0;
                for (let y = 0; y < 8; y++) value += arrHorizontal[y * 8 + u] * arrBasis[v * 8 + y];
                arrTransformed[v * 8 + u] = value;
            }
            const tableIndex = component === 0 ? 0 : 1, dc = arrTables[tableIndex], ac = arrTables[2 + tableIndex];
            for (let i = 0; i < 64; i++) {
                const value = arrTransformed[arrZigzag[i]] / arrQuantizer[tableIndex * 64 + i];
                arrCoefficients[i] = value < 0 ? -Math.round(-value) : Math.round(value);
            }
            const difference = arrCoefficients[0] - arrPrevious[component], length = magnitude(difference);
            arrPrevious[component] = arrCoefficients[0];
            symbol(dc, length); coefficient(difference, length);
            let zeros = 0;
            for (let i = 1; i < 64; i++) {
                const value = arrCoefficients[i];
                if (value === 0) { zeros++; continue; }
                while (zeros >= 16) { symbol(ac, 240); zeros -= 16; }
                const length = magnitude(value);
                symbol(ac, zeros * 16 + length); coefficient(value, length);
                zeros = 0;
            }
            if (zeros) symbol(ac, 0);
        }
    }
    if (bitCount) emit((1 << (8 - bitCount)) - 1, 8 - bitCount);
    marker(217);
    return new Blob([arrBytes.subarray(0, at)], { type: "image/jpeg" });
}

export default encodeScreenshot;
