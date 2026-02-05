import { CompressedTexture, LinearFilter, RepeatWrapping, MirroredRepeatWrapping, ClampToEdgeWrapping, Vector2, DataTexture, RGBAFormat, RGFormat, FloatType, RedFormat } from "three";
import { DDSLoader } from "three/examples/jsm/loaders/DDSLoader";
import DecodeLibrary from "../unreal/decode-library";

function getClamping(mode: number): THREE.Wrapping {
    return RepeatWrapping;

    switch (mode) {
        case 1024: return RepeatWrapping;
        case 512: return RepeatWrapping;
        case 256: return MirroredRepeatWrapping;
        case 128: return RepeatWrapping;
        case 64: return RepeatWrapping;
        case 32: return RepeatWrapping;
        default:
            console.warn(`Unknown clamping mode: ${mode}`);
            return ClampToEdgeWrapping;
    }
}

function getFormat(type: GD.DataTextureFormats_T) {
    if (typeof type !== "string")
        return RGBAFormat;

    // const RGBFormat = 1022;

    switch (type) {
        case "r": return RedFormat;
        case "rg": return RGFormat;
        case "rgb": return RGBAFormat;
        case "rgba": return RGBAFormat;
        default: throw new Error(`Unsupported texture format: ${type}`);
    }
}

const decodeDDS = (function () {
    const ddsLoader = new DDSLoader();

    return function decodeDDS(buffer: ArrayBuffer): THREE.CompressedTexture {
        const dds = ddsLoader.parse(buffer, true);
        const { mipmaps, width, height, format: _format, mipmapCount } = dds;
        const texture = new CompressedTexture(mipmaps as ImageData[], width, height, _format as THREE.CompressedPixelFormat);

        if (mipmapCount === 1) texture.minFilter = LinearFilter;
        // texture.minFilter = LinearFilter;   // seems to have 2x1 mipmaps which causes issues

        // debugger;

        texture.needsUpdate = true;
        texture.flipY = false;

        return texture;
    };
})();

function decodeRGBA(info: GD.IDataTextureDecodeInfo): DataTexture {
    const image = new Uint8Array(info.buffer, 0, info.width * info.height * 4);
    const texture = new DataTexture(image, info.width, info.height, getFormat(info.format));

    texture.minFilter = LinearFilter;   // seems to have 2x1 mipmaps which causes issues

    texture.flipY = false;
    texture.needsUpdate = true;

    return texture;
}

function decodeG16(info: GD.IDataTextureDecodeInfo): DataTexture {
    const buff = new Uint16Array(info.buffer);
    const image = new Uint8Array(info.width * info.height * 4);
    const texture = new DataTexture(image, info.width, info.height, getFormat(info.format));

    debugger;

    for (let i = 0, len = info.width * info.height; i < len; i++) {
        image[i * 4 + 0] = image[i * 4 + 1] = image[i * 4 + 2] = buff[i] / 255;
        image[i * 4 + 3] = 255;
    }

    texture.flipY = false;

    return texture;
}

function decodeFloat(info: GD.IDataTextureDecodeInfo): DataTexture {
    const texture = new DataTexture(
        info.buffer,
        info.width, info.height,
        getFormat(info.format),
        FloatType,
        // UVMapping,
        // ClampToEdgeWrapping,
        // ClampToEdgeWrapping,
        // LinearFilter,
        // LinearFilter
    );

    // debugger;

    texture.flipY = false;
    texture.needsUpdate = true;

    return texture;
}

function decodeTexture(library: DecodeLibrary, info: GD.ITextureDecodeInfo): GD.MapData_T {
    let texture: THREE.Texture;

    switch (info.textureType) {
        case "dds": texture = decodeDDS(info.buffer); break;
        case "rgba": texture = decodeRGBA(info); break;
        case "g16": texture = decodeG16(info); break;
        case "float": texture = decodeFloat(info); break;
        default: throw new Error(`Unsupported texture format: ${info.textureType}`);
    }

    texture.wrapS = info.wrapS ? getClamping(info.wrapS) : RepeatWrapping;
    texture.wrapT = info.wrapT ? getClamping(info.wrapT) : RepeatWrapping;

    if (info.name) texture.name = info.name;
    if (library.anisotropy >= 0) texture.anisotropy = library.anisotropy;

    const width = texture.image?.width ?? (texture as any).width ?? 1;
    const height = texture.image?.height ?? (texture as any).height ?? 1;

    return { texture, size: new Vector2(width, height) };
}


// -- DXT/S3TC Decompression Helpers --

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

function decodeTextureAsB64(info: GD.ITextureDecodeInfo): string | null {
    let rgbaData: Uint8Array | null = null;
    let width = 1;
    let height = 1;

    try {
        if (info.textureType === "dds") {
            const header = new Int32Array(info.buffer, 0, 31);
            height = header[3];
            width = header[4];
            const fourCC = header[21];

            const dataOffset = 128; // DDS header size
            const input = new Uint8Array(info.buffer, dataOffset);

            if (fourCC === 0x31545844) { // DXT1
                rgbaData = dxt1ToRgba(width, height, input);
            } else if (fourCC === 0x33545844) { // DXT3
                rgbaData = dxt3ToRgba(width, height, input);
            } else if (fourCC === 0x35545844) { // DXT5
                rgbaData = dxt5ToRgba(width, height, input);
            } else {
                console.warn(`Unsupported DDS FourCC for B64 decode: ${fourCC}`);
                return null;
            }

        } else if (info.textureType === "rgba") {
            const dataInfo = info as GD.IDataTextureDecodeInfo;
            if (dataInfo.format === 'rgba' || !dataInfo.format) {
                width = dataInfo.width;
                height = dataInfo.height;
                rgbaData = new Uint8Array(info.buffer);
            }
        }

        if (rgbaData) {
            if (typeof document === 'undefined') return "no-document-context";

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            const imageData = ctx.createImageData(width, height);
            imageData.data.set(rgbaData);
            ctx.putImageData(imageData, 0, 0);

            return canvas.toDataURL();
        }

    } catch (e) {
        console.error("Failed to decode texture to B64", e);
    }
    return null;
}

export default decodeTexture;
export { decodeTexture, decodeTextureAsB64 };