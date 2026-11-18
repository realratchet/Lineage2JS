import DDSConstants from "../assets/unreal/dds/dds-constants";
import { decodeDXT, getDXTMipSize } from "../assets/unreal/dds/dxt-decode";

export function decodeCrest(crestId: number, data: Uint8Array) {
    if (data.length < 128) throw new Error(`Invalid crest DDS length ${data.length}`);
    const header = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const height = header.getUint32(12, true), width = header.getUint32(16, true), fourCC = header.getUint32(84, true);
    const blockSize = getDXTMipSize(fourCC, 4, 4);

    if (header.getUint32(0, true) !== DDSConstants.FOURCC_DDS || !(header.getUint32(8, true) & DDSConstants.DDSD_LINEARSIZE) || !width || !height || width & (width - 1) || height & (height - 1) || !blockSize)
        throw new Error(`Invalid crest DDS ${crestId}`);
    const mipCount = header.getUint32(28, true) || 1;
    let mipWidth = width, mipHeight = height, remaining = data.length - 128;

    if (mipCount > remaining / blockSize) throw new Error(`Invalid crest DDS mip count ${crestId}`);
    for (let index = 0; index < mipCount; index++) {
        const size = getDXTMipSize(fourCC, mipWidth, mipHeight);

        if (size > remaining) throw new Error(`Truncated crest DDS mip ${crestId}`);
        remaining -= size;
        mipWidth = Math.ceil(mipWidth / 2);
        mipHeight = Math.ceil(mipHeight / 2);
    }

    const rgba = decodeDXT(fourCC, width, height, data.subarray(128));

    if (!rgba) throw new Error(`Unsupported crest DDS ${crestId}`);
    return { width, height, rgba };
}
