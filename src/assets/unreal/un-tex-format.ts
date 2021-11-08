import DDSConstants from "../dds/dds-constants";

enum ETextureFormat {
    TEXF_P8,            // used 8-bit palette
    TEXF_RGBA7,
    TEXF_RGB16,         // 16-bit texture
    TEXF_DXT1,
    TEXF_RGB8,
    TEXF_RGBA8,         // 32-bit texture
    TEXF_NODATA,
    TEXF_DXT3,
    TEXF_DXT5,
    TEXF_L8,            // 8-bit grayscale
    TEXF_G16,           // 16-bit grayscale (terrain heightmaps)
    TEXF_RRRGGGBBB,
    // Tribes texture formats
    TEXF_CxV8U8,
    TEXF_DXT5N,            // Note: in Bioshock this value has name 3DC, but really DXT5N is used
    TEXF_3DC,            // BC5 compression

    // TEXF_DXT1 = 0x03,
    // TEXF_RGBA8 = 0x05,
    // TEXF_DXT3 = 0x06,
    // TEXF_DXT5 = 0x07,
    // TEXF_G16 = 0x0A
};

type DTOPixelFormatInfo = {
    fourCC: number,
    blockSizeX: number,
    blockSizeY: number,
    bytesPerBlock: number,
    x360AlignX: number,
    x360AlignY: number,
    float: number,
    name: string
};

class UPixelFormatInfo {
    public readonly fourCC: Uint32Array;
    public readonly blockSizeX: Int8Array;
    public readonly blockSizeY: Int8Array;
    public readonly bytesPerBlock: Int8Array;
    public readonly x360AlignX: Int16Array;
    public readonly x360AlignY: Int16Array;
    public readonly float: Int8Array;
    public readonly name: string;

    constructor(dto: DTOPixelFormatInfo) {
        this.fourCC = new Uint32Array([dto.fourCC]);
        this.blockSizeX = new Int8Array([dto.blockSizeX]);
        this.blockSizeY = new Int8Array([dto.blockSizeY]);
        this.bytesPerBlock = new Int8Array([dto.bytesPerBlock]);
        this.x360AlignX = new Int16Array([dto.x360AlignX]);
        this.x360AlignY = new Int16Array([dto.x360AlignY]);
        this.float = new Int8Array([dto.float]);
        this.name = dto.name;

        Object.freeze(this);
    }

    public isDXT() { return this.fourCC[0] !== 0; }
}

enum ETexturePixelFormat {
    TPF_UNKNOWN,
    TPF_P8,                // 8-bit paletted
    TPF_G8,                // 8-bit grayscale
    TPF_G16,               // 16-bit grayscale (terrain heightmaps)
    TPF_RGB8,
    TPF_RGBA8,             // 32-bit texture
    TPF_BGRA8,             // 32-bit texture
    TPF_DXT1,
    TPF_DXT3,
    TPF_DXT5,
    TPF_DXT5N,
    TPF_V8U8,
    TPF_V8U8_2,            // different decoding, has color offset compared to TPF_V8U8
    TPF_BC4,            // alias names: 3Dc+, ATI1, BC4
    TPF_BC5,            // alias names: 3Dc, ATI2, BC5
    TPF_BC6H,
    TPF_BC7,
    TPF_A1,                // 8 monochrome pixels per byte
    TPF_RGBA4,
    TPF_FLOAT_RGBA,
    TPF_PNG_BGRA,        // UE3+ SourceArt format
    TPF_PNG_RGBA,
    TPF_MAX
};

const PixelFormatInfo = Object.freeze([
    { key: ETexturePixelFormat.TPF_UNKNOWN, value: { fourCC: 0, blockSizeX: 0, blockSizeY: 0, bytesPerBlock: 0, x360AlignX: 0, x360AlignY: 0, float: 0, name: "UNKNOWN" } },	// TPF_UNKNOWN
    { key: ETexturePixelFormat.TPF_P8, value: { fourCC: 0, blockSizeX: 1, blockSizeY: 1, bytesPerBlock: 1, x360AlignX: 0, x360AlignY: 0, float: 0, name: "P8" } },	// TPF_P8
    { key: ETexturePixelFormat.TPF_G8, value: { fourCC: 0, blockSizeX: 1, blockSizeY: 1, bytesPerBlock: 1, x360AlignX: 64, x360AlignY: 64, float: 0, name: "G8" } },	// TPF_G8
    { key: ETexturePixelFormat.TPF_RGB8, value: { fourCC: 0, blockSizeX: 1, blockSizeY: 1, bytesPerBlock: 3, x360AlignX: 0, x360AlignY: 0, float: 0, name: "RGB8" } },	// TPF_RGB8
    { key: ETexturePixelFormat.TPF_RGBA8, value: { fourCC: 0, blockSizeX: 1, blockSizeY: 1, bytesPerBlock: 4, x360AlignX: 32, x360AlignY: 32, float: 0, name: "RGBA8" } },	// TPF_RGBA8
    { key: ETexturePixelFormat.TPF_BGRA8, value: { fourCC: 0, blockSizeX: 1, blockSizeY: 1, bytesPerBlock: 4, x360AlignX: 32, x360AlignY: 32, float: 0, name: "BGRA8" } },	// TPF_BGRA8
    { key: ETexturePixelFormat.TPF_DXT1, value: { fourCC: DDSConstants.FOURCC_DXT1, blockSizeX: 4, blockSizeY: 4, bytesPerBlock: 8, x360AlignX: 128, x360AlignY: 128, float: 0, name: "DXT1" } },	// TPF_DXT1
    { key: ETexturePixelFormat.TPF_DXT3, value: { fourCC: DDSConstants.FOURCC_DXT3, blockSizeX: 4, blockSizeY: 4, bytesPerBlock: 16, x360AlignX: 128, x360AlignY: 128, float: 0, name: "DXT3" } },	// TPF_DXT3
    { key: ETexturePixelFormat.TPF_DXT5, value: { fourCC: DDSConstants.FOURCC_DXT5, blockSizeX: 4, blockSizeY: 4, bytesPerBlock: 16, x360AlignX: 128, x360AlignY: 128, float: 0, name: "DXT5" } },	// TPF_DXT5
    { key: ETexturePixelFormat.TPF_DXT5N, value: { fourCC: DDSConstants.FOURCC_DXT5, blockSizeX: 4, blockSizeY: 4, bytesPerBlock: 16, x360AlignX: 128, x360AlignY: 128, float: 0, name: "DXT5N" } },	// TPF_DXT5N
    { key: ETexturePixelFormat.TPF_V8U8, value: { fourCC: 0, blockSizeX: 1, blockSizeY: 1, bytesPerBlock: 2, x360AlignX: 64, x360AlignY: 32, float: 0, name: "V8U8" } },	// TPF_V8U8
    { key: ETexturePixelFormat.TPF_V8U8, value: { fourCC: 0, blockSizeX: 1, blockSizeY: 1, bytesPerBlock: 2, x360AlignX: 64, x360AlignY: 32, float: 0, name: "V8U8" } },	// TPF_V8U8_2
    { key: ETexturePixelFormat.TPF_BC4, value: { fourCC: DDSConstants.FOURCC_ATI1, blockSizeX: 4, blockSizeY: 4, bytesPerBlock: 8, x360AlignX: 0, x360AlignY: 0, float: 0, name: "BC4" } },	// TPF_BC4
    { key: ETexturePixelFormat.TPF_BC5, value: { fourCC: DDSConstants.FOURCC_ATI2, blockSizeX: 4, blockSizeY: 4, bytesPerBlock: 16, x360AlignX: 0, x360AlignY: 0, float: 0, name: "BC5" } },	// TPF_BC5
    { key: ETexturePixelFormat.TPF_BC6H, value: { fourCC: 0, blockSizeX: 4, blockSizeY: 4, bytesPerBlock: 16, x360AlignX: 0, x360AlignY: 0, float: 1, name: "BC6H" } },	// TPF_BC6H
    { key: ETexturePixelFormat.TPF_BC7, value: { fourCC: 0, blockSizeX: 4, blockSizeY: 4, bytesPerBlock: 16, x360AlignX: 0, x360AlignY: 0, float: 0, name: "BC7" } },	// TPF_BC7
    { key: ETexturePixelFormat.TPF_A1, value: { fourCC: 0, blockSizeX: 8, blockSizeY: 1, bytesPerBlock: 1, x360AlignX: 0, x360AlignY: 0, float: 0, name: "A1" } },	// TPF_A1
    { key: ETexturePixelFormat.TPF_RGBA4, value: { fourCC: 0, blockSizeX: 1, blockSizeY: 1, bytesPerBlock: 2, x360AlignX: 0, x360AlignY: 0, float: 0, name: "RGBA4" } },	// TPF_RGBA4
    { key: ETexturePixelFormat.TPF_FLOAT_RGBA, value: { fourCC: 0, blockSizeX: 1, blockSizeY: 1, bytesPerBlock: 16, x360AlignX: 0, x360AlignY: 0, float: 1, name: "float_RGBA" } },	// TPF_float_RGBA
    { key: ETexturePixelFormat.TPF_PNG_BGRA, value: { fourCC: 0, blockSizeX: 1, blockSizeY: 1, bytesPerBlock: 0, x360AlignX: 0, x360AlignY: 0, float: 0, name: "PNG_BGRA" } },	// TPF_PNG_BGRA
    { key: ETexturePixelFormat.TPF_PNG_RGBA, value: { fourCC: 0, blockSizeX: 1, blockSizeY: 1, bytesPerBlock: 0, x360AlignX: 0, x360AlignY: 0, float: 0, name: "PNG_RGBA" } },	// TPF_PNG_RGBA
].reduce(function (accum, { key, value }) {
    accum[key] = new UPixelFormatInfo(value);

    return accum;
}, {} as { [key: number]: UPixelFormatInfo }));

export default ETextureFormat;
export { ETextureFormat, PixelFormatInfo, ETexturePixelFormat };