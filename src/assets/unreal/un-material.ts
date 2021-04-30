import UObject from "./un-object"
import { PropertyTag } from "./un-property";
import ETextureFormat from "./un-tex-format";

type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;
type ETextureFormat = import("./un-tex-format").ETextureFormat;
type FColor = import("./un-color").FColor;

enum ETexturePixelFormat {
    TPF_UNKNOWN,
    TPF_P8,				// 8-bit paletted
    TPF_G8,				// 8-bit grayscale
    //	TPF_G16,			// 16-bit grayscale (terrain heightmaps)
    TPF_RGB8,
    TPF_RGBA8,			// 32-bit texture
    TPF_BGRA8,			// 32-bit texture
    TPF_DXT1,
    TPF_DXT3,
    TPF_DXT5,
    TPF_DXT5N,
    TPF_V8U8,
    TPF_V8U8_2,			// different decoding, has color offset compared to TPF_V8U8
    TPF_BC4,			// alias names: 3Dc+, ATI1, BC4
    TPF_BC5,			// alias names: 3Dc, ATI2, BC5
    TPF_BC6H,
    TPF_BC7,
    TPF_A1,				// 8 monochrome pixels per byte
    TPF_RGBA4,
    TPF_FLOAT_RGBA,
    TPF_PNG_BGRA,		// UE3+ SourceArt format
    TPF_PNG_RGBA,
    TPF_MAX
};

class UMaterial extends UObject {
    protected internalTime: number[] = new Array(2);
    protected width: number;
    protected height: number;
    protected format: ETextureFormat;
    protected bitsW: number; // texture size log2 (number of bits in size value)
    protected bitsH: number;
    protected clampW: number;
    protected clampH: number;
    protected mipZero: FColor;
    protected maxColor: FColor;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "InternalTime": "internalTime",
            "VSize": "height",
            "USize": "width",
            "Format": "format",
            "UBits": "bitsW",
            "VBits": "bitsH",
            "UClamp": "clampW",
            "VClamp": "clampH",
            "MipZero": "mipZero",
            "MaxColor": "maxColor",
        });
    }

    protected getTexturePixelFormat() {
        switch (this.format) {
            case ETextureFormat.TEXF_P8: return ETexturePixelFormat.TPF_P8;
            case ETextureFormat.TEXF_DXT1: return ETexturePixelFormat.TPF_DXT1;
            case ETextureFormat.TEXF_RGB8: return ETexturePixelFormat.TPF_RGB8;
            case ETextureFormat.TEXF_RGBA8: return ETexturePixelFormat.TPF_BGRA8;
            case ETextureFormat.TEXF_DXT3: return ETexturePixelFormat.TPF_DXT3;
            case ETextureFormat.TEXF_DXT5: return ETexturePixelFormat.TPF_DXT5;
            case ETextureFormat.TEXF_L8: return ETexturePixelFormat.TPF_G8;
            case ETextureFormat.TEXF_CxV8U8: return ETexturePixelFormat.TPF_V8U8_2;
            case ETextureFormat.TEXF_DXT5N: return ETexturePixelFormat.TPF_DXT5N;
            case ETextureFormat.TEXF_3DC: return ETexturePixelFormat.TPF_BC5;
            default: throw new Error(`Unknown UE2 pixel format: ${this.format}`);
        }
    }
}

class UShader extends UMaterial {
    protected diffuse: UMaterial;
    protected opacity: UMaterial;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Diffuse": "diffuse",
            "Opacity": "opacity"
        });
    }
}

class UMaterialContainer extends UObject {
    public static readonly typeSize: number = 1;

    protected noDynamicShadowCast: boolean;
    protected collisionforShadow: boolean;
    protected enableCollision: boolean;
    protected material: UMaterial;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "bNoDynamicShadowCast": "noDynamicShadowCast",
            "EnableCollisionforShadow": "collisionforShadow",
            "EnableCollision": "enableCollision",
            "Material": "material"
        });
    }

    public async load(pkg: UPackage, exp: UExport): Promise<this> {
        this.readHead = pkg.tell();
        this.readTail = this.readHead + 14;

        do {
            const tag = await PropertyTag.from(pkg, this.readHead);

            if (!tag.isValid())
                break;

            await this.loadProperty(pkg, tag);

            this.readHead = pkg.tell();

        } while (this.readHead < this.readTail);

        pkg.seek(this.readTail, "set");

        return this;
    }
}

export default UMaterial;
export { UMaterial, UMaterialContainer, UShader, ETexturePixelFormat };