import FArray from "./un-array";
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
    protected format: ETextureFormat = ETextureFormat.TEXF_RGBA8;

    public width: number;
    public height: number;
    protected bitsW: number; // texture size log2 (number of bits in size value)
    protected bitsH: number;
    protected wrapS: number;
    protected wrapT: number;

    protected maxColor: FColor;
    protected mipZero: FColor;

    protected minFrameRate: number;
    protected maxFrameRate: number;
    protected totalFrameNum: number;
    protected animNext: UTexture;
    
    protected isTwoSided = false;
    protected isAlphaTexture = false;
    protected isMasked = false;

    protected clampModeU: number;
    protected clampModeV: number;

    public readonly mipmaps: FArray<FMipmap> = new FArray(FMipmap);

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

            "UClampMode": "clampModeU",
            "VClampMode": "clampModeV",

            "MaxColor": "maxColor",

            "MipZero": "mipZero",

            "MinFrameRate": "minFrameRate",
            "MaxFrameRate": "maxFrameRate",
            "TotalFrameNum": "totalFrameNum",
            "AnimNext": "animNext",

            "bTwoSided": "isTwoSided",
            "bAlphaTexture": "isAlphaTexture",
            "bMasked": "isMasked"
        });
    }

    public doLoad(pkg: UPackage, exp: UExport) {

        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();

        const offStart = pkg.tell();

        this.mipmaps.load(pkg, null);

        this.readHead = pkg.tell();

        if (this.readHead !== this.readTail) {
            pkg.seek(offStart + 4, "set");
            this.mipmaps.load(pkg, null); // what the fuck is this but it works
        }

        this.readHead = pkg.tell();

        console.assert(this.readTail === this.readHead);

        // if (this.readHead !== this.readTail)
        //     debugger;
        // else console.error(`'${exp.objectName}' ready properly.`)

        // debugger;

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

        await this.onLoaded();

        const totalMipCount = this.mipmaps.length;

        if (totalMipCount === 0) return null;

        const loadMipmaps = library.loadMipmaps && totalMipCount > 1;

        const firstMipmap = this.mipmaps[0] as FMipmap;
        const lastMipmap = loadMipmaps ? this.mipmaps[totalMipCount - 1] as FMipmap : firstMipmap;
        const insertMipmap = loadMipmaps ? lastMipmap.sizeW !== 1 || lastMipmap.sizeH !== 1 : false;

        const embededMipCount = loadMipmaps ? totalMipCount : 1;
        const mipCount = loadMipmaps ? totalMipCount + (insertMipmap ? 1 : 0) : 1;

        const format = this.getTexturePixelFormat();

        let blockSize;

        switch (format) {
            case ETexturePixelFormat.TPF_DXT1: blockSize = 8; break;
            case ETexturePixelFormat.TPF_DXT3: blockSize = 16; break;
            case ETexturePixelFormat.TPF_DXT5: blockSize = 16; break;
            case ETexturePixelFormat.TPF_DXT5N: blockSize = 16; break;
            default: blockSize = 4; break;
        }

        let byteOffset = 0;
        let imSize = firstMipmap.getByteLength();

        for (let i = 1; i < embededMipCount; i++) {
            imSize += (this.mipmaps[i] as FMipmap).getByteLength();
        }

        if (insertMipmap) imSize += blockSize;

        const data = new Uint8Array(imSize);

        firstMipmap.getImageBuffer(data, 0);
        byteOffset += firstMipmap.getByteLength();

        // debugger;

        for (let i = 1, len = embededMipCount; i < len; i++) {
            const mipmap = this.mipmaps[i] as FMipmap;

            mipmap.getImageBuffer(data, byteOffset);
            byteOffset += mipmap.getByteLength();
        }

        if (insertMipmap) {
            const lastSliceSize = lastMipmap.getByteLength();
            const pixelCount = lastSliceSize / 4;

            const color = new Uint8Array(4);

            for (let i = byteOffset - lastSliceSize; i < byteOffset; i += 4) {
                color[0] += data[i + 0];
                color[1] += data[i + 1];
                color[2] += data[i + 2];
                color[3] += data[i + 3];
            }

            color[0] = Math.round(color[0] / pixelCount);
            color[1] = Math.round(color[1] / pixelCount);
            color[2] = Math.round(color[2] / pixelCount);
            color[3] = Math.round(color[3] / pixelCount);

            for (let i = 0; i < blockSize; i += 4) {
                data[byteOffset + i + 0] = color[0];
                data[byteOffset + i + 1] = color[1];
                data[byteOffset + i + 2] = color[2];
                data[byteOffset + i + 3] = color[3];
            }
        }

        const width = firstMipmap.sizeW, height = firstMipmap.sizeH;
        let decodedBuffer: ArrayBuffer;
        let textureType: DecodableTexture_T;

        switch (format) {
            case ETexturePixelFormat.TPF_DXT1:
            case ETexturePixelFormat.TPF_DXT3:
            case ETexturePixelFormat.TPF_DXT5:
            case ETexturePixelFormat.TPF_DXT5N:
                textureType = "dds";
                decodedBuffer = decompressDDS(format, mipCount, width, height, data);
                // texture.wrapS = RepeatWrapping;
                // texture.wrapT = RepeatWrapping;
                break;
            case ETexturePixelFormat.TPF_G16:
                textureType = "g16";
                decodedBuffer = data.buffer;
                break;
            case ETexturePixelFormat.TPF_BGRA8:
            case ETexturePixelFormat.TPF_RGBA8: {
                textureType = "rgba";
                if (!this.palette) {
                    decodedBuffer = data.buffer;
                } else {
                    const buff = new Uint8Array(imSize * 4);

                    for (let i = 0, len = imSize; i < len; i++) {
                        const c = this.palette.colors.getElem(data[i]);
                        const ii = i * 4;

                        buff[ii + 0] = c.r;
                        buff[ii + 1] = c.g;
                        buff[ii + 2] = c.b;
                        buff[ii + 3] = c.a;
                    }

                    decodedBuffer = buff.buffer;
                }
            } break;
            default: throw new Error(`Unsupported texture format: ${format}`);
        }

        library.materials[this.uuid] = {
            materialType: "texture",
            textureType,
            buffer: decodedBuffer,
            width,
            height,
            wrapS: this.wrapS,
            wrapT: this.wrapT,
            useMipmaps: mipCount > 0
        } as ITextureDecodeInfo;

        return this.uuid;
    }
}

export default UTexture;
export { UTexture };