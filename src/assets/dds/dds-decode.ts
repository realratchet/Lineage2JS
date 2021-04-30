import DDSHeader from "./dds-header";
import { PixelFormatInfo } from "../unreal/un-tex-format";
import DDSConstants from "./dds-constants";
import { ETexturePixelFormat } from "../unreal/un-material";
import { RGBFormat, RGBAFormat, DataTexture } from "three";
import BlockDXT1 from "./dxt-blocks";

function decompressDDS(format: ETexturePixelFormat, texWidth: number, texHeight: number, data: Uint8Array) {
    const header = new DDSHeader();
    const formatInfo = PixelFormatInfo[format];
    const fourCC = formatInfo.fourCC[0];
    const pixelSize = formatInfo.float ? 16 : 4;
    const size = texWidth * texHeight * pixelSize;

    debugger;

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
    const dataview = new DataView(buffer);

    view.set(headerBuffer, 0);
    view.set(data, headerOffset);

    let w = header.getWidth();
    let h = header.getHeight();

    for (let m = 0; m < 0; m++) {
        w = Math.max(1, w >> 1);
        h = Math.max(1, h >> 1);
    }

    const image = new Uint8Array(w * h * 4);
    const dataTexture = new DataTexture(image, w, h);

    if (header.pf.flags & DDSConstants.DDPF_RGB) {
        debugger;
    } else if (header.pf.flags & DDSConstants.DDPF_FOURCC) {
        readBlockImage(headerOffset, header, dataview, dataTexture);
    } else throw new Error("Invalid DDS type");

    return image;
}

export default decompressDDS;
export { decompressDDS };

function readBlockImage(offset: number, header: DDSHeader, dataview: DataView, texture: DataTexture) {
    const format = header.pf.fourcc == DDSConstants.FOURCC_RXGB ||
        header.pf.fourcc == DDSConstants.FOURCC_ATI1 ||
        header.pf.fourcc == DDSConstants.FOURCC_ATI2 ||
        header.pf.flags & DDSConstants.DDPF_NORMAL ? RGBFormat : RGBAFormat;

    texture.format = format;

    const w = texture.image.width;
    const h = texture.image.height;

    const bw = (w + 3) / 4;
    const bh = (h + 3) / 4;
    const pixels = new Uint8Array(32 * 4 * 4);

    for (let by = 0; by < bh; by++) {
        for (let bx = 0; bx < bw; bx++) {
            // ColorBlock block;

            // // Read color block.
            offset = readBlock(offset, header, dataview, pixels);

            // Write color block.
            for (let y = 0; y < Math.min(4, h - 4 * by); y++) {
                for (let x = 0; x < Math.min(4, w - 4 * bx); x++) {
                    // img->pixel(4*bx+x, 4*by+y) = block.color(x, y);
                }
            }
        }
    }
}

function readBlock(offset: number, header: DDSHeader, dataview: DataView, rgba: Uint8Array) {
    debugger;
    if (header.pf.fourcc === DDSConstants.FOURCC_DXT1) {
        const block = new BlockDXT1();
        offset = block.read(offset, dataview);
        block.decodeBlock(rgba);
    } else if (header.pf.fourcc == DDSConstants.FOURCC_DXT2 ||
        header.pf.fourcc == DDSConstants.FOURCC_DXT3) {
        debugger;
        // 	BlockDXT3 block;
        // 	*stream << block;
        // 	block.decodeBlock(rgba);
    } else if (header.pf.fourcc == DDSConstants.FOURCC_DXT4 ||
        header.pf.fourcc == DDSConstants.FOURCC_DXT5 ||
        header.pf.fourcc == DDSConstants.FOURCC_RXGB) {
        debugger;
        // 	BlockDXT5 block;
        // 	*stream << block;
        // 	block.decodeBlock(rgba);

        if (header.pf.fourcc == DDSConstants.FOURCC_RXGB) {
            debugger;
            // 		// Swap R & A.
            // 		for (int i = 0; i < 16; i++)
            // 		{
            // 			Color32 & c = rgba->color(i);
            // 			uint tmp = c.r;
            // 			c.r = c.a;
            // 			c.a = tmp;
            // 		}
        }
    } else if (header.pf.fourcc == DDSConstants.FOURCC_ATI1) {
        debugger;
        // 	BlockATI1 block;
        // 	*stream << block;
        // 	block.decodeBlock(rgba);
    } else if (header.pf.fourcc == DDSConstants.FOURCC_ATI2) {
        debugger;
        // 	BlockATI2 block;
        // 	*stream << block;
        // 	block.decodeBlock(rgba);
    }

    // // If normal flag set, convert to normal.
    // if (header.pf.flags & DDSConstants.DDPF_NORMAL)
    // {
    // 	if (header.pf.fourcc == DDSConstants.FOURCC_ATI2)
    // 	{
    // 		for (let i = 0; i < 16; i++)
    // 		{
    // 			Color32 & c = rgba->color(i);
    // 			c = buildNormal(c.r, c.g);
    // 		}
    // 	}
    // 	else if (header.pf.fourcc == DDSConstants.FOURCC_DXT5)
    // 	{
    // 		for (let i = 0; i < 16; i++)
    // 		{
    // 			Color32 & c = rgba->color(i);
    // 			c = buildNormal(c.a, c.g);
    // 		}
    // 	}
    // }

    return offset;
}