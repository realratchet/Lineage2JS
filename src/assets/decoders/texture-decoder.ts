import { CompressedTexture, LinearFilter, NearestFilter, RepeatWrapping, MirroredRepeatWrapping, ClampToEdgeWrapping, Vector2, DataTexture, RGBAFormat, RGFormat, FloatType, RedFormat, LinearMipmapLinearFilter } from "three";
import { DDSLoader } from "three/examples/jsm/loaders/DDSLoader";
import DecodeLibrary from "../unreal/decode-library";
import { dxt1ToRgba, dxt3ToRgba, dxt5ToRgba } from "./dxt-decode";

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

// Replaced CompressedTexture with DataTexture (Software Decode) to fix Alpha Issues
function decodeDDS(buffer: ArrayBuffer): THREE.Texture {
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

function decodeRGBA(info: GD.IDataTextureDecodeInfo): DataTexture {
    const image = new Uint8Array(info.buffer, 0, info.width * info.height * 4);
    const texture = new DataTexture(image, info.width, info.height, getFormat(info.format));

    texture.generateMipmaps = true;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;

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
    );

    texture.minFilter = NearestFilter;
    texture.magFilter = NearestFilter;

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