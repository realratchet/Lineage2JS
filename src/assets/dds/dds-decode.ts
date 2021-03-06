import DDSHeader from "./dds-header";
import { PixelFormatInfo, ETexturePixelFormat } from "../unreal/un-tex-format";

function decodeDDS(format: ETexturePixelFormat, mipCount: number, texWidth: number, texHeight: number, data: Uint8Array): ArrayBuffer {
    const header = new DDSHeader();
    const formatInfo = PixelFormatInfo[format];
    const fourCC = formatInfo.fourCC[0];

    header.setFourCC(fourCC & 0xFF, (fourCC >> 8) & 0xFF, (fourCC >> 16) & 0xFF, (fourCC >> 24) & 0xFF);
    header.setMipmapCount(mipCount);
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

    view.set(headerBuffer, 0);
    view.set(data, headerOffset);

    return buffer;
}

export default decodeDDS;
export { decodeDDS };