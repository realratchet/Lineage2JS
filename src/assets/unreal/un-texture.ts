import FArray, { FArrayLazy } from "./un-array";
import { FMipmap } from "./un-mipmap";
import BufferValue from "../buffer-value";
import { ETexturePixelFormat } from "./un-material";
import decompressDDS from "../dds/dds-decode";
import { RepeatWrapping, Texture, MeshBasicMaterial, Material, DoubleSide, Wrapping, ClampToEdgeWrapping, BackSide, FrontSide, MirroredRepeatWrapping } from "three";
import decodeG16 from "../decode-g16";
import { PropertyTag } from "./un-property";
import UObject from "./un-object";
import ETextureFormat from "./un-tex-format";
import FColor from "./un-color";
import MeshStaticMaterial from "../../materials/mesh-static-material/mesh-static-material";


/*

    1000000000 (512)
    0100000000 (256)
    0010000000 (128)
    0001000000 ( 64)
    0000100000 ( 32)
*/

type UPlatte = import("./un-palette").UPlatte;
type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;

function getClamping(mode: number) {

    switch (mode) {
        case 1024: return RepeatWrapping;
        case 512: return RepeatWrapping;
        case 256: return MirroredRepeatWrapping;
        case 128: return RepeatWrapping;
        case 64: return RepeatWrapping;
        case 32: return RepeatWrapping;
        default:
            console.warn(`Unknown clamping mode: ${mode}`);
            return ClampToEdgeWrapping;
    }
}


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

            "MipZero": "mipZero",

        });
    }

    public async load(pkg: UPackage, exp: UExport) {
        // await super.load(pkg, exp);

        // debugger;

        this.objectName = `Exp_${exp.objectName}`;

        // console.log(this.objectName);

        this.setReadPointers(exp);
        do {
            const tag = await PropertyTag.from(pkg, this.readHead);

            if (!tag.isValid()) break;

            await this.loadProperty(pkg, tag);

            this.readHead = pkg.tell()

        } while (this.readHead < this.readTail);

        this.readHead = pkg.tell();

        // pkg.read(BufferValue.allocBytes(4)); //unknown

        await this.mipmaps.load(pkg, null);

        // if (this.mipmaps.getElemCount() === 0)
        //     debugger;

        this.readHead = pkg.tell();

        // debugger;

        return this;
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

    public async decodeMipmap(level: number): Promise<Texture> {
        const mipmap = this.mipmaps.getElem(level);

        if (!mipmap) {
            // console.warn("Missing mipmap.");
            return null;
        }

        const width = mipmap.sizeW, height = mipmap.sizeH;
        const data = mipmap.getImageBuffer();
        const format = this.getTexturePixelFormat();

        let texture: Texture;

        // debugger;

        switch (format) {
            case ETexturePixelFormat.TPF_DXT1:
            case ETexturePixelFormat.TPF_DXT3:
            case ETexturePixelFormat.TPF_DXT5:
            case ETexturePixelFormat.TPF_DXT5N:
                texture = await decompressDDS(format, width, height, data);
                texture.wrapS = RepeatWrapping;
                texture.wrapT = RepeatWrapping;
                break;
            case ETexturePixelFormat.TPF_G16:
                texture = await decodeG16(width, height, data);
                break;
            default: throw new Error(`Unsupported texture format: ${format}`);
        }

        texture.wrapS = getClamping(this.wrapS);
        texture.wrapT = getClamping(this.wrapT);

        return texture;
    }

    public async decodeMaterial(): Promise<Material> {
        const texture = await this.decodeMipmap(0);

        // if(texture) {
        //     texture.wrapS = RepeatWrapping;
        //     texture.wrapT = RepeatWrapping;
        // }

        const material = new MeshStaticMaterial({
            mapDiffuse: texture,
            side: DoubleSide
            // transparent: true,
            // color: Math.round(Math.random() * 0xffffff)
        });

        // debugger;

        return material;
    }
}

export default UTexture;
export { UTexture };