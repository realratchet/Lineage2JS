function fourCCToInt32(value: string) {
    return value.charCodeAt(0) +
        (value.charCodeAt(1) << 8) +
        (value.charCodeAt(2) << 16) +
        (value.charCodeAt(3) << 24);
}

namespace DDSConstants {
    export const FOURCC_DDS = fourCCToInt32("DDS ");
    export const FOURCC_DXT1 = fourCCToInt32("DXT1");
    export const FOURCC_DXT2 = fourCCToInt32("DXT2");
    export const FOURCC_DXT3 = fourCCToInt32("DXT3");
    export const FOURCC_DXT4 = fourCCToInt32("DXT4");
    export const FOURCC_DXT5 = fourCCToInt32("DXT5");
    export const FOURCC_RXGB = fourCCToInt32("RXGB");
    export const FOURCC_ATI1 = fourCCToInt32("ATI1");
    export const FOURCC_ATI2 = fourCCToInt32("ATI2");
    export const FOURCC_NVTT = fourCCToInt32("NVTT");
    
    export const FOURCC_A2XY = fourCCToInt32("A2XY");

    export const FOURCC_DX10 = fourCCToInt32("DX10");

    // 32 bit RGB formats.
    export const D3DFMT_R8G8B8 = 20;
    export const D3DFMT_A8R8G8B8 = 21;
    export const D3DFMT_X8R8G8B8 = 22;
    export const D3DFMT_R5G6B5 = 23;
    export const D3DFMT_X1R5G5B5 = 24;
    export const D3DFMT_A1R5G5B5 = 25;
    export const D3DFMT_A4R4G4B4 = 26;
    export const D3DFMT_R3G3B2 = 27;
    export const D3DFMT_A8 = 28;
    export const D3DFMT_A8R3G3B2 = 29;
    export const D3DFMT_X4R4G4B4 = 30;
    export const D3DFMT_A2B10G10R10 = 31;
    export const D3DFMT_A8B8G8R8 = 32;
    export const D3DFMT_X8B8G8R8 = 33;
    export const D3DFMT_G16R16 = 34;
    export const D3DFMT_A2R10G10B10 = 35;

    export const D3DFMT_A16B16G16R16 = 36;

    // Palette formats.
    export const D3DFMT_A8P8 = 40;
    export const D3DFMT_P8 = 41;

    // Luminance formats.
    export const D3DFMT_L8 = 50;
    export const D3DFMT_A8L8 = 51;
    export const D3DFMT_A4L4 = 52;
    export const D3DFMT_L16 = 81;

    // Floating point formats
    export const D3DFMT_R16F = 111;
    export const D3DFMT_G16R16F = 112;
    export const D3DFMT_A16B16G16R16F = 113;
    export const D3DFMT_R32F = 114;
    export const D3DFMT_G32R32F = 115;
    export const D3DFMT_A32B32G32R32F = 116;

    export const DDSD_CAPS = 0x00000001;
    export const DDSD_PIXELFORMAT = 0x00001000;
    export const DDSD_WIDTH = 0x00000004;
    export const DDSD_HEIGHT = 0x00000002;
    export const DDSD_PITCH = 0x00000008;
    export const DDSD_MIPMAPCOUNT = 0x00020000;
    export const DDSD_LINEARSIZE = 0x00080000;
    export const DDSD_DEPTH = 0x00800000;

    export const DDSCAPS_COMPLEX = 0x00000008;
    export const DDSCAPS_TEXTURE = 0x00001000;
    export const DDSCAPS_MIPMAP = 0x00400000;
    export const DDSCAPS2_VOLUME = 0x00200000;
    export const DDSCAPS2_CUBEMAP = 0x00000200;

    export const DDSCAPS2_CUBEMAP_POSITIVEX = 0x00000400;
    export const DDSCAPS2_CUBEMAP_NEGATIVEX = 0x00000800;
    export const DDSCAPS2_CUBEMAP_POSITIVEY = 0x00001000;
    export const DDSCAPS2_CUBEMAP_NEGATIVEY = 0x00002000;
    export const DDSCAPS2_CUBEMAP_POSITIVEZ = 0x00004000;
    export const DDSCAPS2_CUBEMAP_NEGATIVEZ = 0x00008000;
    export const DDSCAPS2_CUBEMAP_ALL_FACES = 0x0000FC00;

    export const DDPF_ALPHAPIXELS = 0x00000001;
    export const DDPF_ALPHA = 0x00000002;
    export const DDPF_FOURCC = 0x00000004;
    export const DDPF_RGB = 0x00000040;
    export const DDPF_PALETTEINDEXED1 = 0x00000800;
    export const DDPF_PALETTEINDEXED2 = 0x00001000;
    export const DDPF_PALETTEINDEXED4 = 0x00000008;
    export const DDPF_PALETTEINDEXED8 = 0x00000020;
    export const DDPF_LUMINANCE = 0x00020000;
    export const DDPF_ALPHAPREMULT = 0x00008000;
    export const DDPF_NORMAL = 0x80000000;	// @@ Custom nv flag.

    // DX10 formats.
    export enum DXGI_FORMAT {
        DXGI_FORMAT_UNKNOWN = 0,

        DXGI_FORMAT_R32G32B32A32_TYPELESS = 1,
        DXGI_FORMAT_R32G32B32A32_FLOAT = 2,
        DXGI_FORMAT_R32G32B32A32_UINT = 3,
        DXGI_FORMAT_R32G32B32A32_SINT = 4,

        DXGI_FORMAT_R32G32B32_TYPELESS = 5,
        DXGI_FORMAT_R32G32B32_FLOAT = 6,
        DXGI_FORMAT_R32G32B32_UINT = 7,
        DXGI_FORMAT_R32G32B32_SINT = 8,

        DXGI_FORMAT_R16G16B16A16_TYPELESS = 9,
        DXGI_FORMAT_R16G16B16A16_FLOAT = 10,
        DXGI_FORMAT_R16G16B16A16_UNORM = 11,
        DXGI_FORMAT_R16G16B16A16_UINT = 12,
        DXGI_FORMAT_R16G16B16A16_SNORM = 13,
        DXGI_FORMAT_R16G16B16A16_SINT = 14,

        DXGI_FORMAT_R32G32_TYPELESS = 15,
        DXGI_FORMAT_R32G32_FLOAT = 16,
        DXGI_FORMAT_R32G32_UINT = 17,
        DXGI_FORMAT_R32G32_SINT = 18,

        DXGI_FORMAT_R32G8X24_TYPELESS = 19,
        DXGI_FORMAT_D32_FLOAT_S8X24_UINT = 20,
        DXGI_FORMAT_R32_FLOAT_X8X24_TYPELESS = 21,
        DXGI_FORMAT_X32_TYPELESS_G8X24_UINT = 22,

        DXGI_FORMAT_R10G10B10A2_TYPELESS = 23,
        DXGI_FORMAT_R10G10B10A2_UNORM = 24,
        DXGI_FORMAT_R10G10B10A2_UINT = 25,

        DXGI_FORMAT_R11G11B10_FLOAT = 26,

        DXGI_FORMAT_R8G8B8A8_TYPELESS = 27,
        DXGI_FORMAT_R8G8B8A8_UNORM = 28,
        DXGI_FORMAT_R8G8B8A8_UNORM_SRGB = 29,
        DXGI_FORMAT_R8G8B8A8_UINT = 30,
        DXGI_FORMAT_R8G8B8A8_SNORM = 31,
        DXGI_FORMAT_R8G8B8A8_SINT = 32,

        DXGI_FORMAT_R16G16_TYPELESS = 33,
        DXGI_FORMAT_R16G16_FLOAT = 34,
        DXGI_FORMAT_R16G16_UNORM = 35,
        DXGI_FORMAT_R16G16_UINT = 36,
        DXGI_FORMAT_R16G16_SNORM = 37,
        DXGI_FORMAT_R16G16_SINT = 38,

        DXGI_FORMAT_R32_TYPELESS = 39,
        DXGI_FORMAT_D32_FLOAT = 40,
        DXGI_FORMAT_R32_FLOAT = 41,
        DXGI_FORMAT_R32_UINT = 42,
        DXGI_FORMAT_R32_SINT = 43,

        DXGI_FORMAT_R24G8_TYPELESS = 44,
        DXGI_FORMAT_D24_UNORM_S8_UINT = 45,
        DXGI_FORMAT_R24_UNORM_X8_TYPELESS = 46,
        DXGI_FORMAT_X24_TYPELESS_G8_UINT = 47,

        DXGI_FORMAT_R8G8_TYPELESS = 48,
        DXGI_FORMAT_R8G8_UNORM = 49,
        DXGI_FORMAT_R8G8_UINT = 50,
        DXGI_FORMAT_R8G8_SNORM = 51,
        DXGI_FORMAT_R8G8_SINT = 52,

        DXGI_FORMAT_R16_TYPELESS = 53,
        DXGI_FORMAT_R16_FLOAT = 54,
        DXGI_FORMAT_D16_UNORM = 55,
        DXGI_FORMAT_R16_UNORM = 56,
        DXGI_FORMAT_R16_UINT = 57,
        DXGI_FORMAT_R16_SNORM = 58,
        DXGI_FORMAT_R16_SINT = 59,

        DXGI_FORMAT_R8_TYPELESS = 60,
        DXGI_FORMAT_R8_UNORM = 61,
        DXGI_FORMAT_R8_UINT = 62,
        DXGI_FORMAT_R8_SNORM = 63,
        DXGI_FORMAT_R8_SINT = 64,
        DXGI_FORMAT_A8_UNORM = 65,

        DXGI_FORMAT_R1_UNORM = 66,

        DXGI_FORMAT_R9G9B9E5_SHAREDEXP = 67,

        DXGI_FORMAT_R8G8_B8G8_UNORM = 68,
        DXGI_FORMAT_G8R8_G8B8_UNORM = 69,

        DXGI_FORMAT_BC1_TYPELESS = 70,
        DXGI_FORMAT_BC1_UNORM = 71,
        DXGI_FORMAT_BC1_UNORM_SRGB = 72,

        DXGI_FORMAT_BC2_TYPELESS = 73,
        DXGI_FORMAT_BC2_UNORM = 74,
        DXGI_FORMAT_BC2_UNORM_SRGB = 75,

        DXGI_FORMAT_BC3_TYPELESS = 76,
        DXGI_FORMAT_BC3_UNORM = 77,
        DXGI_FORMAT_BC3_UNORM_SRGB = 78,

        DXGI_FORMAT_BC4_TYPELESS = 79,
        DXGI_FORMAT_BC4_UNORM = 80,
        DXGI_FORMAT_BC4_SNORM = 81,

        DXGI_FORMAT_BC5_TYPELESS = 82,
        DXGI_FORMAT_BC5_UNORM = 83,
        DXGI_FORMAT_BC5_SNORM = 84,

        DXGI_FORMAT_B5G6R5_UNORM = 85,
        DXGI_FORMAT_B5G5R5A1_UNORM = 86,
        DXGI_FORMAT_B8G8R8A8_UNORM = 87,
        DXGI_FORMAT_B8G8R8X8_UNORM = 88,
    };

    export enum D3D10_RESOURCE_DIMENSION {
        D3D10_RESOURCE_DIMENSION_UNKNOWN = 0,
        D3D10_RESOURCE_DIMENSION_BUFFER = 1,
        D3D10_RESOURCE_DIMENSION_TEXTURE1D = 2,
        D3D10_RESOURCE_DIMENSION_TEXTURE2D = 3,
        D3D10_RESOURCE_DIMENSION_TEXTURE3D = 4,
    };
}

export default DDSConstants;
export { DDSConstants, fourCCToInt32 };