import FArray from "./un-array";
import { FMipmap } from "./un-mipmap";
import BufferValue from "../buffer-value";
import UMaterial from "./un-material";

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
}

export default UTexture;
export { UTexture };