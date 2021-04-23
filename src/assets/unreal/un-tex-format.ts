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

export default ETextureFormat;
export { ETextureFormat };