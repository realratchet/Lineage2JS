/**
 * Software DXT/S3TC decompression. Kept free of three.js (and DOM) imports so the
 * decode worker can convert "dds" material entries to ready RGBA buffers before
 * transferring the library to the main thread.
 */

function dxt1ToRgba(width: number, height: number, input: Uint8Array): Uint8Array {
    const rgba = new Uint8Array(width * height * 4);
    const blockCountX = (width + 3) >> 2;
    const blockCountY = (height + 3) >> 2;

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

            const colors = [
                { r: rb0, g: gb0, b: bb0, a: 255 },
                { r: rb1, g: gb1, b: bb1, a: 255 },
                { r: 0, g: 0, b: 0, a: 255 },
                { r: 0, g: 0, b: 0, a: 255 }
            ];

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

            let alphaBits = BigInt(0);
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
                    const alphaIndex = Number((alphaBits >> BigInt((iy * 4 + ix) * 3)) & BigInt(0x7));
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

/**
 * Rewrites a "dds" texture decode info into the "rgba" form decodeRGBA consumes
 * (pixel-identical output). Unsupported FourCCs keep the "dds" type and fall back
 * to the main-thread DDSLoader path in decodeDDS.
 */
function convertDDSTextureInfo(info: GD.ITextureDecodeInfo): boolean {
    if (info.textureType !== "dds") return false;

    const header = new Int32Array(info.buffer, 0, 31);
    const height = header[3];
    const width = header[4];
    const fourCC = header[21];
    const input = new Uint8Array(info.buffer, 128); // data starts after the DDS header

    let rgba: Uint8Array | null = null;

    if (fourCC === 0x31545844) rgba = dxt1ToRgba(width, height, input);        // DXT1
    else if (fourCC === 0x33545844) rgba = dxt3ToRgba(width, height, input);   // DXT3
    else if (fourCC === 0x35545844) rgba = dxt5ToRgba(width, height, input);   // DXT5

    if (!rgba) return false;

    const dataInfo = info as GD.IDataTextureDecodeInfo;

    dataInfo.textureType = "rgba";
    dataInfo.buffer = rgba.buffer;
    dataInfo.width = width;
    dataInfo.height = height;
    dataInfo.format = "rgba";

    return true;
}

function convertDDSMaterialsToRGBA(library: GD.DecodeLibrary) {
    for (const info of Object.values(library.materials)) {
        if (!info || (info as GD.ITextureDecodeInfo).textureType !== "dds") continue;

        try {
            convertDDSTextureInfo(info as GD.ITextureDecodeInfo);
        } catch (e) {
            console.warn(`[DXT] Failed to convert texture '${(info as any).name}' to RGBA:`, e);
        }
    }
}

export { dxt1ToRgba, dxt3ToRgba, dxt5ToRgba, convertDDSTextureInfo, convertDDSMaterialsToRGBA };
