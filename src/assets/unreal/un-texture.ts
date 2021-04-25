import UObject from "./un-object";

type ETextureFormat = import("./un-tex-format").ETextureFormat;
type UPlatte = import("./un-palette").UPlatte;
type FColor = import("./un-contructable").FColor;

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
            "Palette": "palette"
        };
    }
}

export default UTexture;
export { UTexture };