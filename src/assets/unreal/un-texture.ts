import UObject from "./un-object";
import { PropertyTag } from "./un-property";

type ETextureFormat = import("./un-tex-format").ETextureFormat;
type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;

class UTexture extends UObject {
    protected maxColor: number;
    protected width: number;
    protected height: number;
    protected internalTime: number[] = new Array(2);
    protected format: ETextureFormat;
    protected bitsW: number; // texture size log2 (number of bits in size value)
    protected bitsH: number;
    protected clampW: number;
    protected clampH: number;

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
            "VClamp": "clampH"
        }
    };

    public async load(pkg: UPackage, exp: UExport): Promise<this> {

        let curOffset = exp.offset.value as number;
        const endOffset = curOffset + (exp.size.value as number);

        do {
            const tag = await PropertyTag.from(pkg, curOffset);

            if (!tag.isValid())
                break;

            await this.loadProperty(pkg, tag);

            curOffset = pkg.tell();

        } while (curOffset < endOffset);

        // if (curOffset < endOffset)
        //     throw new Error(`Unread bytes: ${endOffset - curOffset}`);

        return this;
    }
}

export default UTexture;
export { UTexture };