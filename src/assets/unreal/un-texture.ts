import UObject from "./un-object";
import FArray from "./un-array";
import { FMipmap } from "./un-contructable";

type ETextureFormat = import("./un-tex-format").ETextureFormat;
type UPlatte = import("./un-palette").UPlatte;
type FColor = import("./un-contructable").FColor;
type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;

class UTexture extends UObject {
    protected maxColor: FColor;
    protected width: number;
    protected height: number;
    protected internalTime: number[] = new Array(2);
    protected format: ETextureFormat;
    protected bitsW: number; // texture size log2 (number of bits in size value)
    protected bitsH: number;
    protected clampW: number;
    protected clampH: number;
    protected palette: UPlatte;
    protected mipZero: FColor;
    protected mipmaps: FArray<FMipmap> = new FArray(FMipmap);

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap()), {
            "MaxColor": "maxColor",
            "VSize": "height",
            "USize": "width",
            "InternalTime": "internalTime",
            "Format": "format",
            "UBits": "bitsW",
            "VBits": "bitsH",
            "UClamp": "clampW",
            "VClamp": "clampH",
            "Palette": "palette",
            "MipZero": "mipZero",
            "Mips": "mipmaps"
        };
    }

    public async load(pkg: UPackage, exp: UExport) {
        await super.load(pkg, exp);


        await this.mipmaps.load(pkg);

        return this;
    }
}

export default UTexture;
export { UTexture };