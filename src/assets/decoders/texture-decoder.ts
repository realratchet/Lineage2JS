import { DDSLoader } from "three/examples/jsm/loaders/DDSLoader";
import { CompressedTexture, LinearFilter, RepeatWrapping, MirroredRepeatWrapping, ClampToEdgeWrapping, LinearMipmapLinearFilter, NearestMipmapLinearFilter, NearestMipmapNearestFilter, LinearMipmapNearestFilter, NearestFilter, Vector2 } from "three";

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

const decodeDDS = (function () {
    const ddsLoader = new DDSLoader();

    return function decodeDDS(buffer: ArrayBuffer): THREE.CompressedTexture {
        const dds = ddsLoader.parse(buffer, true);
        const { mipmaps, width, height, format: _format, mipmapCount } = dds;
        const texture = new CompressedTexture(mipmaps as ImageData[], width, height, _format as THREE.CompressedPixelFormat);

        // if (mipmapCount === 1) texture.minFilter = LinearFilter;
        texture.minFilter = LinearFilter;   // seems to have 2x1 mipmaps which causes issues

        texture.needsUpdate = true;
        texture.flipY = false;

        return texture;
    };
})();

function decodeTexture(info: ITextureDecodeInfo): MapData_T {
    let texture: THREE.Texture;

    switch (info.textureType) {
        case "dds": texture = decodeDDS(info.buffer); break;
        default: throw new Error(`Unsupported texture format: ${info.textureType}`);
    }

    texture.wrapS = getClamping(info.wrapS);
    texture.wrapT = getClamping(info.wrapT);

    return { texture, size: new Vector2(texture.image.width, texture.image.height) };
}

export default decodeTexture;
export { decodeTexture };