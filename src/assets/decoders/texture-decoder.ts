import { DDSLoader } from "three/examples/jsm/loaders/DDSLoader";
import { CompressedTexture, LinearFilter, RepeatWrapping, MirroredRepeatWrapping, ClampToEdgeWrapping, LinearMipmapLinearFilter, NearestMipmapLinearFilter, NearestMipmapNearestFilter, LinearMipmapNearestFilter, NearestFilter, Vector2, DataTexture, PixelFormat, RGBAFormat, RGFormat, FloatType, UVMapping, RedFormat, RGBFormat } from "three";

function getClamping(mode: number): THREE.Wrapping {
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

function getFormat(type: DataTextureFormats_T) {
    if (typeof type !== "string")
        return RGBAFormat;

    switch (type) {
        case "r": return RedFormat;
        case "rg": return RGFormat;
        case "rgb": return RGBFormat;
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

function decodeRGBA(info: IDataTextureDecodeInfo): DataTexture {
    const image = new Uint8Array(info.buffer, 0, info.width * info.height * 4);
    const texture = new DataTexture(image, info.width, info.height, getFormat(info.format));

    texture.minFilter = LinearFilter;   // seems to have 2x1 mipmaps which causes issues

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

function decodeTexture(library: DecodeLibrary, info: ITextureDecodeInfo): MapData_T {
    let texture: THREE.Texture;

    switch (info.textureType) {
        case "dds": texture = decodeDDS(info.buffer); break;
        case "rgba": texture = decodeRGBA(info); break;
        case "g16": texture = decodeG16(info); break;
        case "float": texture = decodeFloat(info); break;
        default: throw new Error(`Unsupported texture format: ${info.textureType}`);
    }

    if (info.wrapS) texture.wrapS = getClamping(info.wrapS);
    if (info.wrapT) texture.wrapT = getClamping(info.wrapT);

    if (info.name) texture.name = info.name;
    if (library.anisotropy >= 0) texture.anisotropy = library.anisotropy;

    return { texture, size: new Vector2(texture.image.width, texture.image.height) };
}

export default decodeTexture;
export { decodeTexture };