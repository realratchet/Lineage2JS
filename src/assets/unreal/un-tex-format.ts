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
const PixelFormatInfo = Object.freeze([
    { fourCC: 0, blockSizeX: 0, blockSizeY: 0, bytesPerBlock: 0, x360AlignX: 0, x360AlignY: 0, float: 0, name: "UNKNOWN" },	// TPF_UNKNOWN
    { fourCC: 0, blockSizeX: 1, blockSizeY: 1, bytesPerBlock: 1, x360AlignX: 0, x360AlignY: 0, float: 0, name: "P8" },	// TPF_P8
    { fourCC: 0, blockSizeX: 1, blockSizeY: 1, bytesPerBlock: 1, x360AlignX: 64, x360AlignY: 64, float: 0, name: "G8" },	// TPF_G8
    { fourCC: 0, blockSizeX: 1, blockSizeY: 1, bytesPerBlock: 3, x360AlignX: 0, x360AlignY: 0, float: 0, name: "RGB8" },	// TPF_RGB8
    { fourCC: 0, blockSizeX: 1, blockSizeY: 1, bytesPerBlock: 4, x360AlignX: 32, x360AlignY: 32, float: 0, name: "RGBA8" },	// TPF_RGBA8
    { fourCC: 0, blockSizeX: 1, blockSizeY: 1, bytesPerBlock: 4, x360AlignX: 32, x360AlignY: 32, float: 0, name: "BGRA8" },	// TPF_BGRA8
    { fourCC: DDSConstants.FOURCC_DXT1, blockSizeX: 4, blockSizeY: 4, bytesPerBlock: 8, x360AlignX: 128, x360AlignY: 128, float: 0, name: "DXT1" },	// TPF_DXT1
    { fourCC: DDSConstants.FOURCC_DXT3, blockSizeX: 4, blockSizeY: 4, bytesPerBlock: 16, x360AlignX: 128, x360AlignY: 128, float: 0, name: "DXT3" },	// TPF_DXT3
    { fourCC: DDSConstants.FOURCC_DXT5, blockSizeX: 4, blockSizeY: 4, bytesPerBlock: 16, x360AlignX: 128, x360AlignY: 128, float: 0, name: "DXT5" },	// TPF_DXT5
    { fourCC: DDSConstants.FOURCC_DXT5, blockSizeX: 4, blockSizeY: 4, bytesPerBlock: 16, x360AlignX: 128, x360AlignY: 128, float: 0, name: "DXT5N" },	// TPF_DXT5N
    { fourCC: 0, blockSizeX: 1, blockSizeY: 1, bytesPerBlock: 2, x360AlignX: 64, x360AlignY: 32, float: 0, name: "V8U8" },	// TPF_V8U8
    { fourCC: 0, blockSizeX: 1, blockSizeY: 1, bytesPerBlock: 2, x360AlignX: 64, x360AlignY: 32, float: 0, name: "V8U8" },	// TPF_V8U8_2
    { fourCC: DDSConstants.FOURCC_ATI1, blockSizeX: 4, blockSizeY: 4, bytesPerBlock: 8, x360AlignX: 0, x360AlignY: 0, float: 0, name: "BC4" },	// TPF_BC4
    { fourCC: DDSConstants.FOURCC_ATI2, blockSizeX: 4, blockSizeY: 4, bytesPerBlock: 16, x360AlignX: 0, x360AlignY: 0, float: 0, name: "BC5" },	// TPF_BC5
    { fourCC: 0, blockSizeX: 4, blockSizeY: 4, bytesPerBlock: 16, x360AlignX: 0, x360AlignY: 0, float: 1, name: "BC6H" },	// TPF_BC6H
    { fourCC: 0, blockSizeX: 4, blockSizeY: 4, bytesPerBlock: 16, x360AlignX: 0, x360AlignY: 0, float: 0, name: "BC7" },	// TPF_BC7
    { fourCC: 0, blockSizeX: 8, blockSizeY: 1, bytesPerBlock: 1, x360AlignX: 0, x360AlignY: 0, float: 0, name: "A1" },	// TPF_A1
    { fourCC: 0, blockSizeX: 1, blockSizeY: 1, bytesPerBlock: 2, x360AlignX: 0, x360AlignY: 0, float: 0, name: "RGBA4" },	// TPF_RGBA4
    { fourCC: 0, blockSizeX: 1, blockSizeY: 1, bytesPerBlock: 16, x360AlignX: 0, x360AlignY: 0, float: 1, name: "float_RGBA" },	// TPF_float_RGBA
    { fourCC: 0, blockSizeX: 1, blockSizeY: 1, bytesPerBlock: 0, x360AlignX: 0, x360AlignY: 0, float: 0, name: "PNG_BGRA" },	// TPF_PNG_BGRA
    { fourCC: 0, blockSizeX: 1, blockSizeY: 1, bytesPerBlock: 0, x360AlignX: 0, x360AlignY: 0, float: 0, name: "PNG_RGBA" },	// TPF_PNG_RGBA
].map((data: DTOPixelFormatInfo) => new UPixelFormatInfo(data)));

export default ETextureFormat;
export { ETextureFormat, PixelFormatInfo };