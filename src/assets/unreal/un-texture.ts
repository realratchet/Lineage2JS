import FArray from "./un-array";
import { FMipmap } from "./un-mipmap";
import BufferValue from "../buffer-value";
import UMaterial, { ETexturePixelFormat } from "./un-material";
import decompressDDS from "../dds/dds-decode";
import { RepeatWrapping, Texture } from "three";
import decodeG16 from "../decode-g16";


type UPlatte = import("./un-palette").UPlatte;
type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;

class UTexture extends UMaterial {
    protected palette: UPlatte;
    protected mipmaps: FArray<FMipmap> = new FArray(FMipmap);

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Palette": "palette",
            "Mips": "mipmaps"
        });
    }

    public async load(pkg: UPackage, exp: UExport) {
        await super.load(pkg, exp);

        pkg.read(BufferValue.allocBytes(4)); //unknown

        await this.mipmaps.load(pkg, null);

        return this;
    }

    public async decodeMipmap(level: number) {
        const mipmap = this.mipmaps.getElem(level);
        const width = mipmap.sizeW, height = mipmap.sizeH;
        const data = mipmap.getImageBuffer();
        const format = this.getTexturePixelFormat();

        let texture: Texture;

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

        return texture;
    }
}

export default UTexture;
export { UTexture };