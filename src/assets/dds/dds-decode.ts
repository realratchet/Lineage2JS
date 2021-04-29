import DDSHeader from "./dds-header";
import { PixelFormatInfo } from "../unreal/un-tex-format";
import DDSConstants from "./dds-constants";
import { ETexturePixelFormat } from "../unreal/un-material";

function decompressDDS(format: ETexturePixelFormat, width: number, height: number) {
    const header = new DDSHeader();
    const fourCC = PixelFormatInfo[format].fourCC[0];

    header.setFourCC(fourCC & 0xFF, (fourCC >> 8) & 0xFF, (fourCC >> 16) & 0xFF, (fourCC >> 24) & 0xFF);
    header.setWidth(width);
    header.setHeight(height);
    header.setNormalFlag(
        format === ETexturePixelFormat.TPF_DXT5N ||
        format === ETexturePixelFormat.TPF_BC5
    );
}

export default decompressDDS;
export { decompressDDS };