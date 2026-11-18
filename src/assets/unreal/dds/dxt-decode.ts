import { DDSConstants } from "./dds-constants";

function dxt1ToRgba(width: number, height: number, input: Uint8Array): Uint8Array {
    const rgba = new Uint8Array(width * height * 4);
    const blockCountX = (width + 3) >> 2;
    const blockCountY = (height + 3) >> 2;
    const colors = [
        { r: 0, g: 0, b: 0, a: 255 },
        { r: 0, g: 0, b: 0, a: 255 },
        { r: 0, g: 0, b: 0, a: 255 },
        { r: 0, g: 0, b: 0, a: 255 }
    ];

    let offset = 0;

    for (let y = 0; y < blockCountY; y++) {
        for (let x = 0; x < blockCountX; x++) {
            const c0 = input[offset] | (input[offset + 1] << 8);
            const c1 = input[offset + 2] | (input[offset + 3] << 8);
            offset += 4;

            const code = input[offset] | (input[offset + 1] << 8) | (input[offset + 2] << 16) | (input[offset + 3] << 24);
            offset += 4;

            const r0 = (c0 >> 11) & 0x1f;
            const g0 = (c0 >> 5) & 0x3f;
            const b0 = c0 & 0x1f;

            const r1 = (c1 >> 11) & 0x1f;
            const g1 = (c1 >> 5) & 0x3f;
            const b1 = c1 & 0x1f;

            const rb0 = (r0 << 3) | (r0 >> 2);
            const gb0 = (g0 << 2) | (g0 >> 4);
            const bb0 = (b0 << 3) | (b0 >> 2);

            const rb1 = (r1 << 3) | (r1 >> 2);
            const gb1 = (g1 << 2) | (g1 >> 4);
            const bb1 = (b1 << 3) | (b1 >> 2);

            colors[0].r = rb0; colors[0].g = gb0; colors[0].b = bb0;
            colors[1].r = rb1; colors[1].g = gb1; colors[1].b = bb1;
            colors[3].a = 255;

            if (c0 > c1) {
                colors[2].r = Math.floor((2 * rb0 + rb1) / 3);
                colors[2].g = Math.floor((2 * gb0 + gb1) / 3);
                colors[2].b = Math.floor((2 * bb0 + bb1) / 3);

                colors[3].r = Math.floor((rb0 + 2 * rb1) / 3);
                colors[3].g = Math.floor((gb0 + 2 * gb1) / 3);
                colors[3].b = Math.floor((bb0 + 2 * bb1) / 3);
            } else {
                colors[2].r = Math.floor((rb0 + rb1) / 2);
                colors[2].g = Math.floor((gb0 + gb1) / 2);
                colors[2].b = Math.floor((bb0 + bb1) / 2);

                colors[3].r = 0;
                colors[3].g = 0;
                colors[3].b = 0;
                colors[3].a = 0;
            }

            for (let iy = 0; iy < 4; iy++) {
                for (let ix = 0; ix < 4; ix++) {
                    const shift = (iy * 4 + ix) * 2;
                    const index = (code >> shift) & 0x3;
                    const color = colors[index];

                    const px = x * 4 + ix;
                    const py = y * 4 + iy;

                    if (px < width && py < height) {
                        const pixelIndex = (py * width + px) * 4;
                        rgba[pixelIndex] = color.r;
                        rgba[pixelIndex + 1] = color.g;
                        rgba[pixelIndex + 2] = color.b;
                        rgba[pixelIndex + 3] = color.a;
                    }
                }
            }
        }
    }
    return rgba;
}

function dxt3ToRgba(width: number, height: number, input: Uint8Array): Uint8Array {
    const rgba = new Uint8Array(width * height * 4);
    const blockCountX = (width + 3) >> 2;
    const blockCountY = (height + 3) >> 2;
    let offset = 0;

    for (let y = 0; y < blockCountY; y++) {
        for (let x = 0; x < blockCountX; x++) {
            const alphaData = input.slice(offset, offset + 8);
            offset += 8;

            // Color data (same as DXT1)
            const c0 = input[offset] | (input[offset + 1] << 8);
            const c1 = input[offset + 2] | (input[offset + 3] << 8);
            offset += 4;

            const code = input[offset] | (input[offset + 1] << 8) | (input[offset + 2] << 16) | (input[offset + 3] << 24);
            offset += 4;

            const r0 = (c0 >> 11) & 0x1f;
            const g0 = (c0 >> 5) & 0x3f;
            const b0 = c0 & 0x1f;

            const r1 = (c1 >> 11) & 0x1f;
            const g1 = (c1 >> 5) & 0x3f;
            const b1 = c1 & 0x1f;

            const rb0 = (r0 << 3) | (r0 >> 2);
            const gb0 = (g0 << 2) | (g0 >> 4);
            const bb0 = (b0 << 3) | (b0 >> 2);

            const rb1 = (r1 << 3) | (r1 >> 2);
            const gb1 = (g1 << 2) | (g1 >> 4);
            const bb1 = (b1 << 3) | (b1 >> 2);

            const colors = [
                { r: rb0, g: gb0, b: bb0 },
                { r: rb1, g: gb1, b: bb1 },
                { r: Math.floor((2 * rb0 + rb1) / 3), g: Math.floor((2 * gb0 + gb1) / 3), b: Math.floor((2 * bb0 + bb1) / 3) },
                { r: Math.floor((rb0 + 2 * rb1) / 3), g: Math.floor((gb0 + 2 * gb1) / 3), b: Math.floor((bb0 + 2 * bb1) / 3) }
            ];

            for (let iy = 0; iy < 4; iy++) {
                for (let ix = 0; ix < 4; ix++) {
                    const alphaByteIdx = (iy * 2) + (ix >> 1);
                    const alphaShift = (ix % 2) * 4;
                    const alphaVal = (alphaData[alphaByteIdx] >> alphaShift) & 0x0F;
                    const alpha = (alphaVal << 4) | alphaVal; // Expand 4-bit to 8-bit

                    const shift = (iy * 4 + ix) * 2;
                    const index = (code >> shift) & 0x3;
                    const color = colors[index];

                    const px = x * 4 + ix;
                    const py = y * 4 + iy;

                    if (px < width && py < height) {
                        const pixelIndex = (py * width + px) * 4;
                        rgba[pixelIndex] = color.r;
                        rgba[pixelIndex + 1] = color.g;
                        rgba[pixelIndex + 2] = color.b;
                        rgba[pixelIndex + 3] = alpha;
                    }
                }
            }
        }
    }
    return rgba;
}

function dxt5ToRgba(width: number, height: number, input: Uint8Array): Uint8Array {
    const rgba = new Uint8Array(width * height * 4);
    const blockCountX = (width + 3) >> 2;
    const blockCountY = (height + 3) >> 2;
    let offset = 0;

    for (let y = 0; y < blockCountY; y++) {
        for (let x = 0; x < blockCountX; x++) {
            const alpha0 = input[offset];
            const alpha1 = input[offset + 1];

            let alphaBits = 0n;
            for (let j = 0; j < 6; j++) {
                alphaBits |= BigInt(input[offset + 2 + j]) << BigInt(8 * j);
            }

            offset += 8;

            const alphas = new Uint8Array(8);
            alphas[0] = alpha0;
            alphas[1] = alpha1;
            if (alpha0 > alpha1) {
                for (let i = 0; i < 6; i++) alphas[2 + i] = Math.floor(((6 - i) * alpha0 + (i + 1) * alpha1) / 7);
            } else {
                for (let i = 0; i < 4; i++) alphas[2 + i] = Math.floor(((4 - i) * alpha0 + (i + 1) * alpha1) / 5);
                alphas[6] = 0;
                alphas[7] = 255;
            }

            const c0 = input[offset] | (input[offset + 1] << 8);
            const c1 = input[offset + 2] | (input[offset + 3] << 8);
            offset += 4;

            const code = input[offset] | (input[offset + 1] << 8) | (input[offset + 2] << 16) | (input[offset + 3] << 24);
            offset += 4;

            const r0 = (c0 >> 11) & 0x1f;
            const g0 = (c0 >> 5) & 0x3f;
            const b0 = c0 & 0x1f;

            const r1 = (c1 >> 11) & 0x1f;
            const g1 = (c1 >> 5) & 0x3f;
            const b1 = c1 & 0x1f;

            const rb0 = (r0 << 3) | (r0 >> 2);
            const gb0 = (g0 << 2) | (g0 >> 4);
            const bb0 = (b0 << 3) | (b0 >> 2);

            const rb1 = (r1 << 3) | (r1 >> 2);
            const gb1 = (g1 << 2) | (g1 >> 4);
            const bb1 = (b1 << 3) | (b1 >> 2);

            const colors = [
                { r: rb0, g: gb0, b: bb0 },
                { r: rb1, g: gb1, b: bb1 },
                { r: Math.floor((2 * rb0 + rb1) / 3), g: Math.floor((2 * gb0 + gb1) / 3), b: Math.floor((2 * bb0 + bb1) / 3) },
                { r: Math.floor((rb0 + 2 * rb1) / 3), g: Math.floor((gb0 + 2 * gb1) / 3), b: Math.floor((bb0 + 2 * bb1) / 3) }
            ];

            for (let iy = 0; iy < 4; iy++) {
                for (let ix = 0; ix < 4; ix++) {
                    const alphaIndex = Number((alphaBits >> BigInt((iy * 4 + ix) * 3)) & 0x7n);
                    const alpha = alphas[alphaIndex];

                    const shift = (iy * 4 + ix) * 2;
                    const index = (code >> shift) & 0x3;
                    const color = colors[index];

                    const px = x * 4 + ix;
                    const py = y * 4 + iy;

                    if (px < width && py < height) {
                        const pixelIndex = (py * width + px) * 4;
                        rgba[pixelIndex] = color.r;
                        rgba[pixelIndex + 1] = color.g;
                        rgba[pixelIndex + 2] = color.b;
                        rgba[pixelIndex + 3] = alpha;
                    }
                }
            }
        }
    }
    return rgba;
}

export function decodeDXT(fourCC: number, width: number, height: number, input: Uint8Array): Uint8Array | null {
    switch (fourCC) {
        case DDSConstants.FOURCC_DXT1: return dxt1ToRgba(width, height, input);
        case DDSConstants.FOURCC_DXT3: return dxt3ToRgba(width, height, input);
        case DDSConstants.FOURCC_DXT5: return dxt5ToRgba(width, height, input);
        default: return null;
    }
}

export function getDXTMipSize(fourCC: number, width: number, height: number): number {
    const blocks = Math.ceil(width / 4) * Math.ceil(height / 4);
    switch (fourCC) {
        case DDSConstants.FOURCC_DXT1: return blocks * 8;
        case DDSConstants.FOURCC_DXT3:
        case DDSConstants.FOURCC_DXT5: return blocks * 16;
        default: return 0;
    }
}

export function readDXTRed(fourCC: number, width: number, data: Uint8Array, offset: number): number {
    const isDxt1 = fourCC === DDSConstants.FOURCC_DXT1;
    const x = offset % width, y = Math.floor(offset / width);
    const block = ((x >> 2) + (y >> 2) * ((width + 3) >> 2)) * (isDxt1 ? 8 : 16) + (isDxt1 ? 0 : 8);
    const index = (data[block + 4 + (y & 3)] >> ((x & 3) * 2)) & 3;
    const c0 = data[block] | (data[block + 1] << 8), c1 = data[block + 2] | (data[block + 3] << 8);
    const r0 = (c0 >> 11) & 0x1f, r1 = (c1 >> 11) & 0x1f;
    const red0 = (r0 << 3) | (r0 >> 2), red1 = (r1 << 3) | (r1 >> 2);

    if (index === 0) return red0;
    if (index === 1) return red1;
    if (isDxt1 && c0 <= c1) return index === 2 ? Math.floor((red0 + red1) / 2) : 0;

    return index === 2 ? Math.floor((2 * red0 + red1) / 3) : Math.floor((red0 + 2 * red1) / 3);
}
