import { decodeDXT } from "./dxt-decode";
import type { DecodeLibrary } from "../decode-library";
import type { ITextureDecodeInfo, IDataTextureDecodeInfo, IAnimatedSpriteDecodeInfo } from "../un-texture";

export function decodeDDSPixels(buffer: ArrayBuffer) {
    const header = new Int32Array(buffer, 0, 31);
    const width = header[4], height = header[3], fourCC = header[21];
    const input = new Uint8Array(buffer, 128);
    const rgba = decodeDXT(fourCC, width, height, input);

    return { width, height, fourCC, rgba };
}

export function convertDDSTextureInfo(info: ITextureDecodeInfo): boolean {
    if (info.textureType !== "dds") return false;

    const { width, height, rgba } = decodeDDSPixels(info.buffer);
    if (!rgba) return false;

    const dataInfo = info as IDataTextureDecodeInfo;

    dataInfo.textureType = "rgba";
    dataInfo.buffer = rgba.buffer as ArrayBuffer;
    dataInfo.width = width;
    dataInfo.height = height;
    dataInfo.format = "rgba";

    return true;
}

export function convertDDSMaterialsToRGBA(library: DecodeLibrary) {
    for (const [id, info] of Object.entries(library.materials)) {
        if (!info || info.materialType !== "sprite" && (info as ITextureDecodeInfo).textureType !== "dds") continue;

        const textures = info.materialType === "sprite" ? (info as IAnimatedSpriteDecodeInfo).sprites.map(texture => Object.assign({}, texture)) : [Object.assign({}, info) as ITextureDecodeInfo];

        library.materials[id] = info.materialType === "sprite" ? Object.assign({}, info, { sprites: textures }) : textures[0];

        for (const texture of textures) {
            try {
                convertDDSTextureInfo(texture);
            } catch (e) {
                console.warn(`[DXT] Failed to convert texture '${texture.name}' to RGBA:`, e);
            }
        }
    }
}
