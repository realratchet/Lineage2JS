import { CompressedTexture, LinearFilter, NearestFilter, RepeatWrapping, ClampToEdgeWrapping, Vector2, DataTexture, RGBAFormat, RGFormat, FloatType, RedFormat, LinearMipmapLinearFilter, RGB_S3TC_DXT1_Format, RGBA_S3TC_DXT1_Format } from "three";
import { DDSLoader } from "three/examples/jsm/loaders/DDSLoader";
import type { DecodeLibrary } from "@l2js/engine";
import type { TextureClampMode_T, DataTextureFormats_T, IDataTextureDecodeInfo, ITextureDecodeInfo, MapData_T } from "@l2js/engine/contracts/texture";
import WetWaterTexture from "../../materials/wet-water-texture";
import { dxt1ToRgba, dxt3ToRgba, dxt5ToRgba } from "@l2js/engine/dds/dxt-decode";

function getClamping(mode: TextureClampMode_T): THREE.Wrapping {
    return mode === "clamp" ? ClampToEdgeWrapping : RepeatWrapping;
}

function getFormat(type: DataTextureFormats_T) {
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

// Uploads the DDS mip chain as an S3TC CompressedTexture. Our DDS header never sets
// the alpha flag so DDSLoader reports DXT1 as RGB - force the RGBA variant which
// decodes DXT1's 1-bit alpha correctly (identical block data).
function decodeCompressedDDS(buffer: ArrayBuffer): THREE.Texture {
    const dds = new DDSLoader().parse(buffer, true);
    const format = dds.format === RGB_S3TC_DXT1_Format ? RGBA_S3TC_DXT1_Format : dds.format;
    const texture = new CompressedTexture(dds.mipmaps as ImageData[], dds.width, dds.height, format as THREE.CompressedPixelFormat);

    texture.minFilter = dds.mipmapCount === 1 ? LinearFilter : LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.flipY = false;
    texture.needsUpdate = true;

    return texture;
}

// Replaced CompressedTexture with DataTexture (Software Decode) to fix Alpha Issues
function decodeDDS(buffer: ArrayBuffer, preferCompressed: boolean = false): THREE.Texture {
    if (preferCompressed) {
        try {
            return decodeCompressedDDS(buffer);
        } catch (e) {
            console.warn("[decodeDDS] compressed upload failed, falling back to software decode:", e);
        }
    }

    // 1. Try Manual Software Decompression (Matches B64 Export Logic)
    try {
        const header = new Int32Array(buffer, 0, 31);
        const height = header[3];
        const width = header[4];
        const fourCC = header[21];
        const dataOffset = 128; // DDS header size

        let rgbaData: Uint8Array | null = null;
        const input = new Uint8Array(buffer, dataOffset);

        if (fourCC === 0x31545844) { // DXT1
            rgbaData = dxt1ToRgba(width, height, input);
        } else if (fourCC === 0x33545844) { // DXT3
            rgbaData = dxt3ToRgba(width, height, input);
        } else if (fourCC === 0x35545844) { // DXT5
            rgbaData = dxt5ToRgba(width, height, input);
        }

        if (rgbaData) {
            const texture = new DataTexture(rgbaData, width, height, RGBAFormat);
            texture.flipY = false;
            texture.generateMipmaps = true;
            texture.minFilter = LinearMipmapLinearFilter;
            texture.magFilter = LinearFilter;
            texture.needsUpdate = true;
            return texture;
        }
    } catch (e) {
        console.warn("[decodeDDS] Software Decode Failed, falling back to DDSLoader", e);
    }

    // 2. Fallback to Original DDSLoader (CompressedTexture)
    const ddsLoader = new DDSLoader();
    const dds = ddsLoader.parse(buffer, true);
    const { mipmaps, width, height, format: _format, mipmapCount } = dds;
    const texture = new CompressedTexture(mipmaps as ImageData[], width, height, _format as THREE.CompressedPixelFormat);

    if (mipmapCount === 1) texture.minFilter = LinearFilter;

    texture.needsUpdate = true;
    texture.flipY = false;

    return texture;
}

function decodeRGBA(info: IDataTextureDecodeInfo): DataTexture {
    const byteLength = info.width * info.height * 4;

    if (info.buffer.byteLength < byteLength) {
        // bad/unsupported texture data must not kill the whole sector
        console.warn(`Texture '${info.name}' has ${info.buffer.byteLength} bytes, expected ${byteLength} - using placeholder`);

        const placeholder = new DataTexture(new Uint8Array([255, 0, 255, 255]), 1, 1);

        placeholder.needsUpdate = true;

        return placeholder;
    }

    const image = new Uint8Array(info.buffer, 0, byteLength);
    const texture = new DataTexture(image, info.width, info.height, getFormat(info.format));

    texture.generateMipmaps = true;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;

    texture.flipY = false;
    texture.needsUpdate = true;

    return texture;
}

function decodeG16(info: IDataTextureDecodeInfo): DataTexture {
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

function decodeFloat(info: IDataTextureDecodeInfo): DataTexture {
    const texture = new DataTexture(
        info.buffer,
        info.width, info.height,
        getFormat(info.format),
        FloatType,
    );

    texture.minFilter = NearestFilter;
    texture.magFilter = NearestFilter;

    // debugger;

    texture.flipY = false;
    texture.needsUpdate = true;

    return texture;
}

export function decodeTexture(library: DecodeLibrary, info: ITextureDecodeInfo): MapData_T {
    let texture: THREE.Texture;

    switch (info.textureType) {
        case "dds": texture = decodeDDS(info.buffer, (library as any).preferCompressedTextures === true); break;
        case "wet": texture = new WetWaterTexture(info as any); break;
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


export function decodeTextureAsB64(info: ITextureDecodeInfo): string | null {
    let rgbaData: Uint8Array | null = null;
    let width = 1, height = 1;

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
            const dataInfo = info as IDataTextureDecodeInfo;
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
