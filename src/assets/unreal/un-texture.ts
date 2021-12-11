import { FArrayLazy } from "./un-array";
import { FMipmap } from "./un-mipmap";
import decompressDDS from "../dds/dds-decode";
import UObject from "./un-object";
import ETextureFormat, { ETexturePixelFormat } from "./un-tex-format";
import FColor from "./un-color";

/*

    1000000000 (512)
    0100000000 (256)
    0010000000 (128)
    0001000000 ( 64)
    0000100000 ( 32)
*/

class UTexture extends UObject {
    protected palette: UPlatte;
    protected internalTime: number[] = new Array(2);
    protected format: ETextureFormat;

    public width: number;
    public height: number;
    protected bitsW: number; // texture size log2 (number of bits in size value)
    protected bitsH: number;
    protected wrapS: number;
    protected wrapT: number;

    protected maxColor: FColor;
    protected mipZero: FColor;

    public readonly mipmaps: FArrayLazy<FMipmap> = new FArrayLazy(FMipmap);

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Palette": "palette",
            "Mips": "mipmaps",

            "Format": "format",
            "InternalTime": "internalTime",

            "VSize": "height",
            "USize": "width",

            "UBits": "bitsW",
            "VBits": "bitsH",
            "UClamp": "wrapS",
            "VClamp": "wrapT",

            "MaxColor": "maxColor",

            "MipZero": "mipZero"
        });
    }

    public doLoad(pkg: UPackage, exp: UExport) {

        super.doLoad(pkg, exp);

        this.mipmaps.load(pkg, null);

        return this;
    }

    public postLoad(pkg: UPackage, exp: UExport) {
        this.readHead = pkg.tell();
    }

    protected getTexturePixelFormat(): ETexturePixelFormat {
        switch (this.format) {
            // case ETextureFormat.TEXF_P8: return ETexturePixelFormat.TPF_P8;
            case ETextureFormat.TEXF_DXT1: return ETexturePixelFormat.TPF_DXT1;
            // case ETextureFormat.TEXF_RGB8: return ETexturePixelFormat.TPF_RGB8;
            case ETextureFormat.TEXF_RGBA8: return ETexturePixelFormat.TPF_BGRA8;
            case ETextureFormat.TEXF_DXT3: return ETexturePixelFormat.TPF_DXT3;
            case ETextureFormat.TEXF_DXT5: return ETexturePixelFormat.TPF_DXT5;
            // case ETextureFormat.TEXF_L8: return ETexturePixelFormat.TPF_G8;
            // case ETextureFormat.TEXF_CxV8U8: return ETexturePixelFormat.TPF_V8U8_2;
            // case ETextureFormat.TEXF_DXT5N: return ETexturePixelFormat.TPF_DXT5N;
            // case ETextureFormat.TEXF_3DC: return ETexturePixelFormat.TPF_BC5;
            case ETextureFormat.TEXF_G16: return ETexturePixelFormat.TPF_G16;
            default: throw new Error(`Unknown UE2 pixel format: ${this.format}`);
        }
    }

    public async getDecodeInfo(library: IDecodeLibrary): Promise<string> {
        if (this.uuid in library.materials) return this.uuid;

        library.materials[this.uuid] = null;

        await Promise.all(this.promisesLoading);

        if (this.mipmaps.length === 0) return null;

        const firstMipmap = this.mipmaps[0] as FMipmap;
        const mipCount = library.loadMipmaps ? this.mipmaps.length : 1;

        let byteOffset = 0;
        let imSize = firstMipmap.getByteLength();

        for (let i = 1; i < mipCount; i++) {
            imSize += (this.mipmaps[i] as FMipmap).getByteLength();
        }

        const data = new Uint8Array(imSize);

        firstMipmap.getImageBuffer(data, 0);
        byteOffset += firstMipmap.getByteLength();

        for (let i = 1, len = mipCount; i < len; i++) {
            const mipmap = this.mipmaps[i] as FMipmap;

            mipmap.getImageBuffer(data, byteOffset);
            byteOffset += mipmap.getByteLength();
        }

        const width = firstMipmap.sizeW, height = firstMipmap.sizeH;
        const format = this.getTexturePixelFormat();
        let decodedBuffer: ArrayBuffer;
        let textureType: DecodableTexture_T;

        switch (format) {
            case ETexturePixelFormat.TPF_DXT1:
            case ETexturePixelFormat.TPF_DXT3:
            case ETexturePixelFormat.TPF_DXT5:
            case ETexturePixelFormat.TPF_DXT5N:
                textureType = "dds";
                decodedBuffer = await decompressDDS(format, mipCount, width, height, data);
                // texture.wrapS = RepeatWrapping;
                // texture.wrapT = RepeatWrapping;
                break;
            case ETexturePixelFormat.TPF_G16:
                textureType = "g16";
                decodedBuffer = new Uint16Array(data.buffer);
                break;
            default: throw new Error(`Unsupported texture format: ${format}`);
        }

        library.materials[this.uuid] = {
            materialType: "texture",
            textureType,
            buffer: decodedBuffer,
            width,
            height,
            wrapS: this.wrapS,
            wrapT: this.wrapT
        } as ITextureDecodeInfo;

        return this.uuid;
    }
}

export default UTexture;
export { UTexture };