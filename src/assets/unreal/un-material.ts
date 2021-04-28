import UObject from "./un-object"
import UPackage from "./un-package";
import { PropertyTag } from "./un-property";

type UExport = import("./un-export").UExport;
type ETextureFormat = import("./un-tex-format").ETextureFormat;
type FColor = import("./un-color").FColor;

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
export { UMaterial, UMaterialContainer, UShader };