import DDSHeader from "./dds-header";
import { PixelFormatInfo } from "../unreal/un-tex-format";
import { ETexturePixelFormat } from "../unreal/un-material";
import { CompressedTexture, LinearFilter } from "three";
import { DDSLoader } from "three/examples/jsm/loaders/DDSLoader";

type CompressedPixelFormat = import("three").CompressedPixelFormat;
type Texture = import("three").Texture;

const ddsLoader = new DDSLoader();

async function decompressDDS(format: ETexturePixelFormat, texWidth: number, texHeight: number, data: Uint8Array): Promise<Texture> {
    const header = new DDSHeader();
    const formatInfo = PixelFormatInfo[format];
    const fourCC = formatInfo.fourCC[0];

    header.setFourCC(fourCC & 0xFF, (fourCC >> 8) & 0xFF, (fourCC >> 16) & 0xFF, (fourCC >> 24) & 0xFF);
    header.setWidth(texWidth);
    header.setHeight(texHeight);
    header.setNormalFlag(
        format === ETexturePixelFormat.TPF_DXT5N ||
        format === ETexturePixelFormat.TPF_BC5
    );

    const headerBuffer = header.getBuffer();
    const headerOffset = headerBuffer.byteLength;
    const buffer = new ArrayBuffer(headerOffset + data.byteLength);
    const view = new Uint8Array(buffer);

    // debugger;

    view.set(headerBuffer, 0);
    view.set(data, headerOffset);

    const dds = ddsLoader.parse(view.buffer, true);
    const { mipmaps, width, height, format: _format, mipmapCount } = dds;
    const tex = new CompressedTexture(mipmaps as ImageData[], width, height, _format as CompressedPixelFormat);

    if (mipmapCount === 1) tex.minFilter = LinearFilter;

    tex.needsUpdate = true;
    tex.flipY = false;

    return tex;
}

export default decompressDDS;
export { decompressDDS };