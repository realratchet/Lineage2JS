import BufferValue from "../buffer-value";
import UObject from "./un-object";
import { PropertyTag } from "./un-property";

type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;
type UTexture = import("./un-texture").UTexture;

class UDecoLayer extends UObject {
    public static readonly typeSize: number = 1;
    protected showOnTerrain: number;
    protected scaleMap: UTexture;
    protected densityMap: UTexture;
    protected colorMap: UTexture;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "ShowOnTerrain": "showOnTerrain",
            "ScaleMap": "scaleMap",
            "DensityMap": "densityMap",
            "ColorMap": "colorMap"
        });
    }

    public async load(pkg: UPackage, exp: UExport): Promise<this> {
        this.readHead = pkg.tell();
        this.readTail = this.readHead + 182;

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

export default UDecoLayer;
export { UDecoLayer };