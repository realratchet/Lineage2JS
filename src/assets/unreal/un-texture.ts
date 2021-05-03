import FArray from "./un-array";
import { FMipmap } from "./un-mipmap";
import BufferValue from "../buffer-value";
import UMaterial, { ETexturePixelFormat } from "./un-material";
import decompressDDS from "../dds/dds-decode";
import { RepeatWrapping } from "three";


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

        const texture = await decompressDDS(format, width, height, data)

        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;

        return texture;
    }
}

export default UTexture;
export { UTexture };